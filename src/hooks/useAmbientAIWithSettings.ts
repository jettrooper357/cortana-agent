import { useState, useCallback, useRef, useEffect } from 'react';
import { useScribe, CommitStrategy } from '@elevenlabs/react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useGoals, Goal } from './useGoals';
import { useTasks, Task } from './useTasks';
import { useSettings } from './useSettings';
import { useVoiceServices } from './useVoiceServices';

interface GuardianResponse {
  shouldSpeak: boolean;
  response?: string | null;
  alertLevel?: 'none' | 'info' | 'warning' | 'critical';
  observation?: string;
  error?: string;
  taskCreated?: boolean;
}

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AmbientAIConfig {
  onSpeaking?: (isSpeaking: boolean) => void;
  onTranscript?: (transcript: string, isFinal: boolean) => void;
  onResponse?: (response: string) => void;
  onAlert?: (level: string, message: string) => void;
  proactiveCheckInterval?: { min: number; max: number };
}

export function useAmbientAIWithSettings(config: AmbientAIConfig = {}) {
  const { goals } = useGoals();
  const { tasks, refetch: refetchTasks } = useTasks();
  const { settings, getWebhookById } = useSettings();
  
  // Get the configured webhook objects
  const ttsWebhook = settings.voice?.ttsWebhookId && settings.voice.ttsWebhookId !== 'browser' 
    ? getWebhookById(settings.voice.ttsWebhookId) 
    : null;
  const sttWebhook = settings.voice?.sttWebhookId && settings.voice.sttWebhookId !== 'browser'
    ? getWebhookById(settings.voice.sttWebhookId)
    : null;
  
  const voiceServices = useVoiceServices({
    ttsWebhook,
    sttWebhook,
  });
  
  const [isActive, setIsActive] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  const conversationHistoryRef = useRef<ConversationMessage[]>([]);
  const lastProcessedTranscriptRef = useRef<string>('');
  const proactiveCheckTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const goalsRef = useRef<Goal[]>([]);
  const tasksRef = useRef<Task[]>([]);

  // Check if using ElevenLabs for STT
  const useElevenLabsSTT = sttWebhook?.type === 'elevenlabs';

  // ElevenLabs Scribe (only used when sttWebhook is ElevenLabs type)
  const scribe = useScribe({
    modelId: 'scribe_v2_realtime',
    commitStrategy: CommitStrategy.VAD,
    onPartialTranscript: (data) => {
      if (useElevenLabsSTT) {
        setCurrentTranscript(data.text);
        config.onTranscript?.(data.text, false);
      }
    },
    onCommittedTranscript: (data) => {
      if (useElevenLabsSTT) {
        if (data.text && data.text.trim() !== lastProcessedTranscriptRef.current.trim()) {
          lastProcessedTranscriptRef.current = data.text;
          config.onTranscript?.(data.text, true);
          processInput(data.text);
        }
        setCurrentTranscript('');
      }
    },
  });

  // Keep refs updated
  useEffect(() => {
    goalsRef.current = goals;
  }, [goals]);

  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  // Schedule proactive check
  const scheduleProactiveCheck = useCallback(() => {
    if (proactiveCheckTimeoutRef.current) {
      clearTimeout(proactiveCheckTimeoutRef.current);
    }

    const { min = 2, max = 5 } = config.proactiveCheckInterval || {};
    const randomMinutes = min + Math.random() * (max - min);
    const delayMs = randomMinutes * 60 * 1000;

    proactiveCheckTimeoutRef.current = setTimeout(() => {
      doProactiveCheck();
    }, delayMs);
  }, [config.proactiveCheckInterval]);

  // Proactive check
  const doProactiveCheck = useCallback(async () => {
    if (isProcessing || isSpeaking || !isActive) {
      scheduleProactiveCheck();
      return;
    }

    const activeGoals = goalsRef.current.filter(g => g.status === 'active');
    if (activeGoals.length === 0) {
      scheduleProactiveCheck();
      return;
    }

    setIsProcessing(true);

    try {
      const pendingTasks = tasksRef.current.filter(t => t.status === 'pending' || t.status === 'in_progress');

      const { data, error: invokeError } = await supabase.functions.invoke('ai-guardian', {
        body: {
          goals: activeGoals.map(g => ({
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
          tasks: pendingTasks.map(t => ({
            id: t.id,
            title: t.title,
            description: t.description,
            category: t.category,
            status: t.status,
            priority: t.priority,
            due_at: t.due_at,
            room: t.room,
          })),
          isProactiveCheck: true,
          conversationHistory: conversationHistoryRef.current.slice(-6),
        },
      });

      if (invokeError) throw invokeError;

      const response = data as GuardianResponse;

      if (response.taskCreated) {
        refetchTasks();
      }

      if (!response.error && response.shouldSpeak && response.response) {
        conversationHistoryRef.current.push({
          role: 'assistant',
          content: response.response,
        });

        config.onResponse?.(response.response);

        if (response.alertLevel && response.alertLevel !== 'none') {
          config.onAlert?.(response.alertLevel, response.response);
        }

        await speak(response.response);
      }
    } catch (err) {
      console.error('Proactive check error:', err);
    } finally {
      setIsProcessing(false);
      scheduleProactiveCheck();
    }
  }, [isProcessing, isSpeaking, isActive, config, scheduleProactiveCheck, refetchTasks]);

  // Process user input
  const processInput = useCallback(async (transcript: string) => {
    if (!transcript.trim() || isProcessing || isSpeaking) return;

    setIsProcessing(true);
    
    try {
      conversationHistoryRef.current.push({
        role: 'user',
        content: transcript,
      });

      const activeGoals = goalsRef.current.filter(g => g.status === 'active');
      const pendingTasks = tasksRef.current.filter(t => t.status === 'pending' || t.status === 'in_progress');

      const { data, error: invokeError } = await supabase.functions.invoke('ai-guardian', {
        body: {
          transcript,
          goals: activeGoals.map(g => ({
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
          tasks: pendingTasks.map(t => ({
            id: t.id,
            title: t.title,
            description: t.description,
            category: t.category,
            status: t.status,
            priority: t.priority,
            due_at: t.due_at,
            room: t.room,
          })),
          conversationHistory: conversationHistoryRef.current.slice(-10),
        },
      });

      if (invokeError) throw invokeError;

      const response = data as GuardianResponse;

      if (response.error) {
        if (response.error.includes('Rate limit')) {
          toast.error('AI rate limit exceeded. Please wait a moment.');
        } else if (response.error.includes('Payment')) {
          toast.error('AI credits depleted. Please add funds.');
        }
        return;
      }

      if (response.taskCreated) {
        refetchTasks();
        toast.success('Task created');
      }

      if (response.shouldSpeak && response.response) {
        conversationHistoryRef.current.push({
          role: 'assistant',
          content: response.response,
        });
        
        config.onResponse?.(response.response);
        
        if (response.alertLevel && response.alertLevel !== 'none') {
          config.onAlert?.(response.alertLevel, response.response);
        }
        
        await speak(response.response);
      }
    } catch (err) {
      console.error('AI guardian error:', err);
      setError(err instanceof Error ? err.message : 'Processing failed');
    } finally {
      setIsProcessing(false);
    }
  }, [isProcessing, isSpeaking, config, refetchTasks]);

  // Speak using configured provider
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

  // Start ambient listening
  const start = useCallback(async () => {
    try {
      setError(null);
      
      await navigator.mediaDevices.getUserMedia({ audio: true });

      if (useElevenLabsSTT) {
        // Use ElevenLabs Scribe
        const { data, error: tokenError } = await supabase.functions.invoke('elevenlabs-scribe-token');
        
        if (tokenError || !data?.token) {
          throw new Error(tokenError?.message || 'Failed to get scribe token');
        }

        await scribe.connect({
          token: data.token,
          microphone: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
      } else {
        // Use browser speech recognition
        await voiceServices.startListening((text, isFinal) => {
          if (isFinal && text.trim() !== lastProcessedTranscriptRef.current.trim()) {
            lastProcessedTranscriptRef.current = text;
            config.onTranscript?.(text, true);
            processInput(text);
          } else if (!isFinal) {
            setCurrentTranscript(text);
            config.onTranscript?.(text, false);
          }
        });
      }

      setIsActive(true);
      setIsListening(true);
      
      scheduleProactiveCheck();
      
      const provider = useElevenLabsSTT ? (sttWebhook?.name || 'ElevenLabs') : 'browser';
      toast.success(`Cortana is now listening (${provider})`);
    } catch (err) {
      console.error('Failed to start ambient AI:', err);
      setError(err instanceof Error ? err.message : 'Failed to start');
      toast.error('Failed to start listening. Check microphone permissions.');
    }
  }, [scribe, scheduleProactiveCheck, useElevenLabsSTT, sttWebhook, voiceServices, config, processInput]);

  // Stop listening
  const stop = useCallback(() => {
    if (useElevenLabsSTT) {
      scribe.disconnect();
    } else {
      voiceServices.stopListening();
    }
    
    voiceServices.stopSpeaking();
    
    if (proactiveCheckTimeoutRef.current) {
      clearTimeout(proactiveCheckTimeoutRef.current);
    }
    
    setIsActive(false);
    setIsListening(false);
    setIsSpeaking(false);
    setIsProcessing(false);
    setCurrentTranscript('');
    
    toast.info('Cortana stopped listening');
  }, [scribe, useElevenLabsSTT, voiceServices]);

  // Cleanup on unmount only - empty deps to prevent re-running on voiceServices changes
  useEffect(() => {
    return () => {
      // Use window.speechSynthesis directly to avoid dependency on voiceServices
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      if (proactiveCheckTimeoutRef.current) {
        clearTimeout(proactiveCheckTimeoutRef.current);
      }
    };
  }, []); // Empty deps - only run on unmount

  // Sync listening state
  useEffect(() => {
    if (useElevenLabsSTT) {
      setIsListening(scribe.isConnected);
    }
  }, [scribe.isConnected, useElevenLabsSTT]);

  return {
    isActive,
    isListening,
    isSpeaking: isSpeaking || voiceServices.isSpeaking,
    isProcessing,
    currentTranscript,
    partialTranscript: useElevenLabsSTT 
      ? scribe.partialTranscript 
      : voiceServices.interimTranscript,
    error,
    
    start,
    stop,
    speak,
    processInput,
    
    conversationHistory: conversationHistoryRef.current,
    clearHistory: () => { conversationHistoryRef.current = []; },
    
    // Current providers (for display)
    ttsProvider: ttsWebhook?.name || 'Browser',
    sttProvider: sttWebhook?.name || 'Browser',
    browserSupport: voiceServices.browserSupport,
  };
}
