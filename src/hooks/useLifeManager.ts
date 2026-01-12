import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useGoals, Goal } from './useGoals';
import { useTasks, Task } from './useTasks';
import { useUserContext } from './useUserContext';
import { useCameras } from './useCameras';
import { useSettings } from './useSettings';
import { useVoiceServices } from './useVoiceServices';
import { toast } from 'sonner';

interface Intervention {
  shouldIntervene: boolean;
  message?: string;
  severity?: 'info' | 'nudge' | 'warning' | 'urgent';
  triggerType?: string;
  triggerReason?: string;
  observation?: string;
  suggestedAction?: string;
  updatedActivity?: string;
  updatedRoom?: string;
  error?: string;
  tasksCreated?: string[];
}

interface RecentObservation {
  room?: string;
  activity_detected?: string;
  snapshot_description?: string;
  objects_detected?: string[];
}

interface RecentIntervention {
  message: string;
  triggered_at: string;
  severity: string;
}

interface LifeManagerConfig {
  // Timing
  observationIntervalMs?: number; // How often to check (default: 30s)
  minInterventionGapMs?: number; // Minimum time between interventions (default: 60s)
  
  // Callbacks
  onIntervention?: (message: string, severity: string) => void;
  onObservation?: (observation: string) => void;
  onSpeaking?: (speaking: boolean) => void;
}

function getTimeOfDay(hour: number): string {
  if (hour >= 5 && hour < 9) return 'early_morning';
  if (hour >= 9 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
}

export function useLifeManager(config: LifeManagerConfig = {}) {
  const { user } = useAuth();
  const { goals } = useGoals();
  const { tasks, refetch: refetchTasks } = useTasks();
  const { context, updateContext } = useUserContext();
  const { cameras } = useCameras();
  const { settings } = useSettings();
  
  // Use voice services with current settings
  const voiceServices = useVoiceServices({
    ttsProvider: settings.voice?.ttsProvider || 'browser',
    sttProvider: settings.voice?.sttProvider || 'browser',
  });
  
  const [isActive, setIsActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [lastIntervention, setLastIntervention] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const observationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const recentObservationsRef = useRef<RecentObservation[]>([]);
  const recentInterventionsRef = useRef<RecentIntervention[]>([]);
  const lastInterventionTimeRef = useRef<number>(0);
  
  const {
    observationIntervalMs = 30000, // 30 seconds
    minInterventionGapMs = 60000, // 1 minute
  } = config;

  // Capture image from camera (if available)
  const captureImage = useCallback(async (): Promise<string | null> => {
    const activeCamera = cameras.find(c => c.is_active && c.http_url);
    if (!activeCamera?.http_url) return null;
    
    try {
      // Try to fetch camera snapshot
      const response = await fetch(activeCamera.http_url, {
        credentials: 'include',
      });
      if (!response.ok) return null;
      
      const blob = await response.blob();
      const buffer = await blob.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
      return base64;
    } catch (err) {
      console.error('Failed to capture camera image:', err);
      return null;
    }
  }, [cameras]);

  // Speak a message using configured TTS provider
  const speak = useCallback(async (text: string) => {
    if (!text.trim()) return;

    setIsSpeaking(true);
    config.onSpeaking?.(true);

    try {
      await voiceServices.speak(text);
    } catch (err) {
      console.error('TTS error:', err);
    } finally {
      setIsSpeaking(false);
      config.onSpeaking?.(false);
    }
  }, [config, voiceServices]);

  // Log intervention to database
  const logIntervention = useCallback(async (
    intervention: Intervention,
    userId: string
  ) => {
    if (!intervention.message) return;
    
    try {
      await supabase.from('interventions').insert([{
        user_id: userId,
        trigger_type: intervention.triggerType || 'unknown',
        trigger_reason: intervention.triggerReason || '',
        message: intervention.message,
        severity: intervention.severity || 'info',
        room: context?.current_room || null,
        context_snapshot: JSON.parse(JSON.stringify({
          goals: goals.filter(g => g.status === 'active').map(g => g.title),
          tasks: tasks.filter(t => t.status !== 'completed').map(t => t.title),
          idle_minutes: context?.idle_minutes || 0,
          current_activity: context?.current_activity || null,
        })),
      }]);
      
      // Track in memory for avoiding repetition
      recentInterventionsRef.current.unshift({
        message: intervention.message,
        triggered_at: new Date().toISOString(),
        severity: intervention.severity || 'info',
      });
      
      // Keep only last 10
      recentInterventionsRef.current = recentInterventionsRef.current.slice(0, 10);
    } catch (err) {
      console.error('Failed to log intervention:', err);
    }
  }, [context, goals, tasks]);

  // Main observation cycle
  const observe = useCallback(async (transcript?: string) => {
    if (!user || isProcessing || isSpeaking) return;
    
    // Check intervention gap (unless user spoke)
    if (!transcript) {
      const now = Date.now();
      const timeSinceLastIntervention = now - lastInterventionTimeRef.current;
      if (timeSinceLastIntervention < minInterventionGapMs) {
        return;
      }
    }
    
    setIsProcessing(true);
    setError(null);
    
    try {
      // Capture camera image if available
      const imageBase64 = await captureImage();
      
      const now = new Date();
      const input = {
        imageBase64,
        transcript,
        userContext: {
          current_room: context?.current_room || undefined,
          room_entered_at: context?.room_entered_at || undefined,
          current_activity: context?.current_activity || undefined,
          activity_started_at: context?.activity_started_at || undefined,
          idle_minutes: context?.idle_minutes || 0,
          last_intervention_at: context?.last_intervention_at || undefined,
          interventions_today: context?.interventions_today || 0,
          productive_minutes_today: context?.productive_minutes_today || 0,
          tasks_completed_today: context?.tasks_completed_today || 0,
        },
        tasks: tasks.map(t => ({
          id: t.id,
          title: t.title,
          description: t.description,
          category: t.category,
          status: t.status,
          priority: t.priority,
          due_at: t.due_at,
          room: t.room,
          estimated_minutes: t.estimated_minutes,
        })),
        goals: goals.filter(g => g.status === 'active').map(g => ({
          id: g.id,
          title: g.title,
          description: g.description,
          category: g.category,
          target_value: g.target_value,
          current_value: g.current_value,
          unit: g.unit,
          status: g.status,
          due_date: g.due_date,
        })),
        recentObservations: recentObservationsRef.current.slice(0, 5),
        recentInterventions: recentInterventionsRef.current.slice(0, 5),
        currentTime: now.toISOString(),
        dayOfWeek: now.getDay(),
        timeOfDay: getTimeOfDay(now.getHours()),
      };

      const { data, error: invokeError } = await supabase.functions.invoke('life-manager', {
        body: input,
      });

      if (invokeError) throw invokeError;

      const intervention = data as Intervention;

      if (intervention.error) {
        if (intervention.error.includes('Rate limit')) {
          toast.error('AI rate limit exceeded. Pausing observations.');
        } else if (intervention.error.includes('Payment')) {
          toast.error('AI credits depleted. Please add funds.');
        }
        return;
      }

      // Log observation
      if (intervention.observation) {
        config.onObservation?.(intervention.observation);
        recentObservationsRef.current.unshift({
          room: intervention.updatedRoom || context?.current_room || undefined,
          activity_detected: intervention.updatedActivity || context?.current_activity || undefined,
          snapshot_description: intervention.observation,
        });
        recentObservationsRef.current = recentObservationsRef.current.slice(0, 20);
      }

      // Update context if AI detected room/activity
      if (intervention.updatedRoom || intervention.updatedActivity) {
        await updateContext({
          current_room: intervention.updatedRoom || context?.current_room,
          current_activity: intervention.updatedActivity || context?.current_activity,
        });
      }

      // Handle tasks created by AI
      if (intervention.tasksCreated && intervention.tasksCreated.length > 0) {
        refetchTasks();
        toast.success(`Created ${intervention.tasksCreated.length} task(s) from observation`);
      }

      // Execute intervention
      if (intervention.shouldIntervene && intervention.message) {
        lastInterventionTimeRef.current = Date.now();
        setLastIntervention(intervention.message);
        
        config.onIntervention?.(intervention.message, intervention.severity || 'info');
        
        // Log to database
        await logIntervention(intervention, user.id);
        
        // Update context
        await updateContext({
          last_intervention_at: new Date().toISOString(),
          interventions_today: (context?.interventions_today || 0) + 1,
        });
        
        // Speak the intervention
        await speak(intervention.message);
      }
    } catch (err) {
      console.error('Life manager observation error:', err);
      setError(err instanceof Error ? err.message : 'Observation failed');
    } finally {
      setIsProcessing(false);
    }
  }, [
    user, isProcessing, isSpeaking, context, tasks, goals, 
    captureImage, speak, logIntervention, updateContext, 
    config, minInterventionGapMs
  ]);

  // Start the life manager
  const start = useCallback(async () => {
    if (!user) {
      toast.error('Please log in to start the life manager');
      return;
    }
    
    setIsActive(true);
    setError(null);
    
    // Initialize user context if needed
    await updateContext({
      session_started_at: new Date().toISOString(),
    });
    
    // Do immediate observation
    await observe();
    
    // Start observation loop
    observationIntervalRef.current = setInterval(() => {
      observe();
    }, observationIntervalMs);
    
    toast.success('Life manager activated');
  }, [user, observe, updateContext, observationIntervalMs]);

  // Stop the life manager
  const stop = useCallback(() => {
    if (observationIntervalRef.current) {
      clearInterval(observationIntervalRef.current);
      observationIntervalRef.current = null;
    }
    
    voiceServices.stopSpeaking();
    
    setIsActive(false);
    setIsProcessing(false);
    setIsSpeaking(false);
    
    toast.info('Life manager stopped');
  }, [voiceServices]);

  // Process voice input
  const processVoiceInput = useCallback(async (transcript: string) => {
    if (!transcript.trim()) return;
    await observe(transcript);
  }, [observe]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (observationIntervalRef.current) {
        clearInterval(observationIntervalRef.current);
      }
      voiceServices.stopSpeaking();
    };
  }, [voiceServices]);

  return {
    // State
    isActive,
    isProcessing,
    isSpeaking,
    lastIntervention,
    error,
    
    // Actions
    start,
    stop,
    processVoiceInput,
    observe, // Manual trigger
    speak,
    
    // Context
    context,
    updateContext,
  };
}
