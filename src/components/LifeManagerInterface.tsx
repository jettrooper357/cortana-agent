import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useScribe, CommitStrategy } from '@elevenlabs/react';
import { supabase } from '@/integrations/supabase/client';
import CortanaHeader from '@/components/CortanaHeader';
import GlowingRing from '@/components/GlowingRing';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Mic, MicOff, Settings, Loader2, Eye, Target, Clock, AlertTriangle } from 'lucide-react';
import { useLifeManager } from '@/hooks/useLifeManager';
import { useTasks } from '@/hooks/useTasks';
import { useGoals } from '@/hooks/useGoals';
import { toast } from 'sonner';
import cortanaAI from '@/assets/cortana-ai.jpg';

type SessionState = 'idle' | 'observing' | 'processing' | 'intervening';

export default function LifeManagerInterface() {
  const navigate = useNavigate();
  const [sessionState, setSessionState] = useState<SessionState>('idle');
  const [lastIntervention, setLastIntervention] = useState<string>('');
  const [transcript, setTranscript] = useState<string>('');
  const [observationLog, setObservationLog] = useState<string[]>([]);
  const [isListening, setIsListening] = useState(false);

  const { tasks, getPendingTasks, getOverdueTasks } = useTasks();
  const { goals } = useGoals();
  
  const lifeManager = useLifeManager({
    observationIntervalMs: 30000, // 30 seconds
    minInterventionGapMs: 60000, // 1 minute between interventions
    onIntervention: (message, severity) => {
      setLastIntervention(message);
      setSessionState('intervening');
      
      // Toast based on severity
      if (severity === 'urgent') {
        toast.error(message, { duration: 10000 });
      } else if (severity === 'warning') {
        toast.warning(message, { duration: 8000 });
      } else if (severity === 'nudge') {
        toast.info(message, { duration: 6000 });
      }
    },
    onObservation: (observation) => {
      setObservationLog(prev => [observation, ...prev.slice(0, 9)]);
    },
    onSpeaking: (speaking) => {
      setSessionState(speaking ? 'intervening' : 'observing');
    },
  });

  // Voice recognition setup
  const scribe = useScribe({
    modelId: 'scribe_v2_realtime',
    commitStrategy: CommitStrategy.VAD,
    onPartialTranscript: (data) => {
      setTranscript(data.text);
    },
    onCommittedTranscript: (data) => {
      if (data.text && data.text.trim()) {
        lifeManager.processVoiceInput(data.text);
      }
      setTranscript('');
    },
  });

  // Update session state
  useEffect(() => {
    if (lifeManager.isSpeaking) {
      setSessionState('intervening');
    } else if (lifeManager.isProcessing) {
      setSessionState('processing');
    } else if (lifeManager.isActive) {
      setSessionState('observing');
    } else {
      setSessionState('idle');
    }
  }, [lifeManager.isSpeaking, lifeManager.isProcessing, lifeManager.isActive]);

  // Sync listening state
  useEffect(() => {
    setIsListening(scribe.isConnected);
  }, [scribe.isConnected]);

  const handleStart = useCallback(async () => {
    try {
      // Start life manager
      await lifeManager.start();
      
      // Start voice recognition
      await navigator.mediaDevices.getUserMedia({ audio: true });
      const { data, error: tokenError } = await supabase.functions.invoke('elevenlabs-scribe-token');
      
      if (tokenError || !data?.token) {
        console.error('Failed to get scribe token, voice disabled');
      } else {
        await scribe.connect({
          token: data.token,
          microphone: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
      }
    } catch (err) {
      console.error('Failed to start:', err);
      toast.error('Failed to start life manager');
    }
  }, [lifeManager, scribe]);

  const handleStop = useCallback(() => {
    lifeManager.stop();
    scribe.disconnect();
  }, [lifeManager, scribe]);

  const pendingTasks = getPendingTasks();
  const overdueTasks = getOverdueTasks();
  const activeGoals = goals.filter(g => g.status === 'active');

  const getStatusText = () => {
    if (transcript) return `"${transcript}"`;
    switch (sessionState) {
      case 'observing':
        return 'Observing...';
      case 'processing':
        return 'Analyzing...';
      case 'intervening':
        return 'Speaking...';
      default:
        return 'Inactive';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'urgent':
        return 'bg-destructive text-destructive-foreground';
      case 'warning':
        return 'bg-yellow-500/20 text-yellow-400';
      case 'nudge':
        return 'bg-ai-glow/20 text-ai-glow';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="flex flex-col min-h-screen max-h-screen overflow-hidden bg-background">
      <CortanaHeader />

      <div className="flex flex-1 overflow-hidden">
        {/* Main Visual Area */}
        <div
          className="flex-1 relative bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${cortanaAI})` }}
        >
          <div className="absolute inset-0 bg-gradient-glow opacity-30 animate-pulse-glow"></div>
          <div className="absolute inset-0 bg-background/30"></div>

          {/* Intervention Overlay */}
          <div
            className={`absolute inset-0 bg-cover bg-center bg-no-repeat transition-all duration-700 ease-out ${
              sessionState === 'intervening'
                ? 'opacity-80 scale-105 animate-pulse-glow'
                : 'opacity-0 scale-95'
            }`}
            style={{
              backgroundImage: `url(/lovable-uploads/48c7a359-5a9a-4f2f-bb1c-71e5282e9b4b.png)`,
              mixBlendMode: 'screen',
              filter: 'brightness(1.5) contrast(1.3) saturate(1.2)',
            }}
          />

          {/* Active Observation Indicator */}
          {sessionState === 'observing' && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="relative">
                <div className="w-32 h-32 rounded-full border border-ai-glow/30 animate-ping" style={{ animationDuration: '3s' }} />
                <div className="absolute inset-4 flex items-center justify-center">
                  <Eye className="w-8 h-8 text-ai-glow/50 animate-pulse" />
                </div>
              </div>
            </div>
          )}

          {/* Glowing Ring when Intervening */}
          <GlowingRing isActive={sessionState === 'intervening'} size={300} />

          {/* Last Intervention Display */}
          {lastIntervention && sessionState !== 'intervening' && (
            <div className="absolute top-24 left-1/2 transform -translate-x-1/2 max-w-lg px-4">
              <div className="bg-gradient-card/95 backdrop-blur-sm border border-border rounded-xl p-4 shadow-card">
                <p className="text-sm text-foreground font-medium">"{lastIntervention}"</p>
              </div>
            </div>
          )}

          {/* Status Bar */}
          <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2">
            <div
              className={`px-4 py-2 rounded-full border text-sm font-medium transition-all duration-300 bg-gradient-card/95 backdrop-blur-sm ${
                sessionState === 'observing' ? 'text-ai-glow border-ai-glow/50' :
                sessionState === 'processing' ? 'text-ai-pulse border-ai-pulse animate-pulse' :
                sessionState === 'intervening' ? 'text-voice-active border-voice-active' :
                'text-muted-foreground border-border'
              }`}
            >
              {sessionState === 'processing' && (
                <Loader2 className="w-4 h-4 inline mr-2 animate-spin" />
              )}
              {sessionState === 'observing' && (
                <Eye className="w-4 h-4 inline mr-2" />
              )}
              {getStatusText()}
            </div>
          </div>

          {/* Control Panel */}
          <div className="absolute bottom-4 right-4">
            <div className="bg-gradient-card/95 backdrop-blur-sm border border-border rounded-2xl shadow-card p-6">
              <div className="flex flex-col items-center space-y-4">
                <Button
                  onClick={lifeManager.isActive ? handleStop : handleStart}
                  className={`w-20 h-20 rounded-full border-2 transition-all duration-300 ${
                    lifeManager.isActive
                      ? 'bg-voice-active border-voice-active hover:bg-voice-active/80'
                      : 'bg-secondary border-voice-inactive hover:border-ai-glow hover:shadow-glow'
                  }`}
                >
                  {lifeManager.isActive ? (
                    <MicOff className="w-8 h-8" />
                  ) : (
                    <Eye className="w-8 h-8" />
                  )}
                </Button>

                <div className="text-center">
                  <p className="text-sm text-muted-foreground">
                    {lifeManager.isActive ? 'Stop Manager' : 'Start Life Manager'}
                  </p>
                  {lifeManager.isActive && (
                    <p className="text-xs text-ai-glow mt-1">
                      {isListening ? 'Voice enabled' : 'Visual only'}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Settings */}
          <div className="absolute bottom-4 left-4">
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate('/settings')}
              className="bg-gradient-card/95 backdrop-blur-sm border-border hover:border-ai-glow hover:shadow-glow"
            >
              <Settings className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Context Panel */}
        <div className="w-80 bg-gradient-card border-l border-border flex flex-col overflow-hidden">
          {/* Stats Header */}
          <div className="p-4 border-b border-border">
            <h2 className="text-lg font-semibold mb-3">Current Status</h2>
            
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-muted/50 rounded-lg p-2">
                <div className="text-muted-foreground">Room</div>
                <div className="font-medium truncate">
                  {lifeManager.context?.current_room || 'Unknown'}
                </div>
              </div>
              <div className="bg-muted/50 rounded-lg p-2">
                <div className="text-muted-foreground">Activity</div>
                <div className="font-medium truncate">
                  {lifeManager.context?.current_activity || 'Unknown'}
                </div>
              </div>
              <div className="bg-muted/50 rounded-lg p-2">
                <div className="text-muted-foreground">Idle</div>
                <div className="font-medium">
                  {lifeManager.context?.idle_minutes || 0} min
                </div>
              </div>
              <div className="bg-muted/50 rounded-lg p-2">
                <div className="text-muted-foreground">Interventions</div>
                <div className="font-medium">
                  {lifeManager.context?.interventions_today || 0} today
                </div>
              </div>
            </div>
          </div>

          {/* Pending Tasks */}
          <div className="p-4 border-b border-border">
            <div className="flex items-center gap-2 mb-3">
              <Target className="w-4 h-4 text-ai-glow" />
              <h3 className="font-medium">Pending Tasks</h3>
              {overdueTasks.length > 0 && (
                <Badge variant="destructive" className="text-xs">
                  {overdueTasks.length} overdue
                </Badge>
              )}
            </div>
            
            {pendingTasks.length === 0 ? (
              <p className="text-xs text-muted-foreground">No pending tasks</p>
            ) : (
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {pendingTasks.slice(0, 5).map(task => (
                  <div 
                    key={task.id} 
                    className={`text-xs p-2 rounded-lg ${
                      task.status === 'in_progress' ? 'bg-ai-glow/20 border border-ai-glow/30' : 'bg-muted/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium truncate">{task.title}</span>
                      <Badge 
                        variant="outline" 
                        className={`text-[10px] ${
                          task.priority === 'urgent' ? 'border-destructive text-destructive' :
                          task.priority === 'high' ? 'border-yellow-500 text-yellow-500' :
                          ''
                        }`}
                      >
                        {task.priority}
                      </Badge>
                    </div>
                    {task.room && (
                      <span className="text-muted-foreground">📍 {task.room}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
            
            <Button 
              variant="ghost" 
              size="sm" 
              className="w-full mt-2 text-xs"
              onClick={() => navigate('/tasks')}
            >
              Manage Tasks
            </Button>
          </div>

          {/* Active Goals */}
          <div className="p-4 border-b border-border">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-4 h-4 text-ai-glow" />
              <h3 className="font-medium">Active Goals</h3>
            </div>
            
            {activeGoals.length === 0 ? (
              <p className="text-xs text-muted-foreground">No active goals</p>
            ) : (
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {activeGoals.slice(0, 4).map(goal => {
                  const progress = goal.target_value 
                    ? Math.min((goal.current_value / goal.target_value) * 100, 100)
                    : 0;
                  
                  return (
                    <div key={goal.id} className="text-xs p-2 bg-muted/50 rounded-lg">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium truncate">{goal.title}</span>
                        <span className="text-muted-foreground">{Math.round(progress)}%</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-1.5">
                        <div 
                          className="bg-ai-glow h-1.5 rounded-full transition-all"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            
            <Button 
              variant="ghost" 
              size="sm" 
              className="w-full mt-2 text-xs"
              onClick={() => navigate('/goals')}
            >
              Manage Goals
            </Button>
          </div>

          {/* Observation Log */}
          <div className="flex-1 p-4 overflow-hidden">
            <div className="flex items-center gap-2 mb-3">
              <Eye className="w-4 h-4 text-ai-glow" />
              <h3 className="font-medium">Observations</h3>
            </div>
            
            <div className="space-y-2 overflow-y-auto max-h-full">
              {observationLog.length === 0 ? (
                <p className="text-xs text-muted-foreground">No observations yet</p>
              ) : (
                observationLog.map((obs, i) => (
                  <div key={i} className="text-xs p-2 bg-muted/30 rounded-lg text-muted-foreground">
                    {obs}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
