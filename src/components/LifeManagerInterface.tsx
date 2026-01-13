import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import CortanaHeader from '@/components/CortanaHeader';
import GlowingRing from '@/components/GlowingRing';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Mic, MicOff, Settings, Loader2, Eye, Target, Clock, MessageSquare } from 'lucide-react';
import { useLifeManager } from '@/hooks/useLifeManager';
import { useUnifiedVoice } from '@/hooks/useUnifiedVoice';
import { useTasks } from '@/hooks/useTasks';
import { useGoals } from '@/hooks/useGoals';
import { useSettings } from '@/hooks/useSettings';
import { toast } from 'sonner';
import cortanaAI from '@/assets/cortana-ai.jpg';

type SessionState = 'idle' | 'observing' | 'processing' | 'intervening' | 'conversing';

export default function LifeManagerInterface() {
  const navigate = useNavigate();
  const [sessionState, setSessionState] = useState<SessionState>('idle');
  const [lastIntervention, setLastIntervention] = useState<string>('');
  const [observationLog, setObservationLog] = useState<string[]>([]);
  const [isActive, setIsActive] = useState(false);

  const { tasks, getPendingTasks, getOverdueTasks } = useTasks();
  const { goals } = useGoals();
  const { getVoiceProviderConfig } = useSettings();
  
  // Determine if we should use interactive conversation based on Voice Provider setting
  // Interactive = ElevenLabs Agent (has agentId) or any Conversational AI
  const isConversationalMode = useMemo(() => {
    const config = getVoiceProviderConfig();
    // If webhook with agentId (ElevenLabs Agent) -> conversational
    if (config.type === 'webhook' && config.webhook?.agentId) {
      return true;
    }
    // If conversational AI (Gemini, etc.) -> conversational
    if (config.type === 'conversational-ai') {
      return true;
    }
    // Browser or TTS-only webhook -> passive observation
    return false;
  }, [getVoiceProviderConfig]);
  
  // Interactive voice conversation using settings-based provider
  const unifiedVoice = useUnifiedVoice({
    systemInstruction: `You are Cortana, an AI home guardian and personal assistant.
You observe the home through sensors and conversation.
Be concise, warm, and helpful - responses will be spoken aloud.
Keep responses under 2 sentences when possible.
Use natural, conversational language.`,
    onStateChange: (state) => {
      if (isActive && isConversationalMode) {
        if (state === 'idle') setSessionState('idle');
        else if (state === 'connecting' || state === 'processing') setSessionState('processing');
        else if (state === 'listening') setSessionState('conversing');
        else if (state === 'speaking') setSessionState('intervening');
      }
    },
    onTranscript: (text, isFinal) => {
      if (isFinal && text.trim()) {
        setObservationLog(prev => [`You: "${text}"`, ...prev.slice(0, 9)]);
      }
    },
    onResponse: (response) => {
      setLastIntervention(response);
      setObservationLog(prev => [`Cortana: "${response.slice(0, 100)}${response.length > 100 ? '...' : ''}"`, ...prev.slice(0, 9)]);
    },
    onError: (error) => {
      console.error('[LifeManager] Voice error:', error);
      toast.error('Voice error: ' + error);
    },
  });
  
  const lifeManager = useLifeManager({
    observationIntervalMs: 30000, // 30 seconds
    minInterventionGapMs: 60000, // 1 minute between interventions
    onIntervention: (message, severity) => {
      if (isActive && !isConversationalMode) {
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
      }
    },
    onObservation: (observation) => {
      if (isActive && !isConversationalMode) {
        setObservationLog(prev => [observation, ...prev.slice(0, 9)]);
      }
    },
    onSpeaking: (speaking) => {
      if (isActive && !isConversationalMode) {
        setSessionState(speaking ? 'intervening' : 'observing');
      }
    },
  });

  // Update session state based on life manager (when in passive mode)
  useEffect(() => {
    if (!isActive || isConversationalMode) return;
    
    if (lifeManager.isSpeaking) {
      setSessionState('intervening');
    } else if (lifeManager.isProcessing) {
      setSessionState('processing');
    } else if (lifeManager.isActive) {
      setSessionState('observing');
    } else {
      setSessionState('idle');
    }
  }, [lifeManager.isSpeaking, lifeManager.isProcessing, lifeManager.isActive, isActive, isConversationalMode]);

  // Single start handler - automatically chooses mode based on Voice Provider
  const handleStart = useCallback(async () => {
    try {
      setIsActive(true);
      setSessionState('processing');
      
      if (isConversationalMode) {
        // Interactive conversation mode
        await unifiedVoice.start();
        console.log('[LifeManager] Started interactive conversation with:', unifiedVoice.providerName);
      } else {
        // Passive observation mode
        await lifeManager.start();
        console.log('[LifeManager] Started passive observation');
      }
    } catch (err) {
      console.error('Failed to start:', err);
      toast.error('Failed to start - falling back to observation mode');
      // Fallback to observation if conversation fails
      try {
        await lifeManager.start();
      } catch (e) {
        setIsActive(false);
        setSessionState('idle');
      }
    }
  }, [isConversationalMode, unifiedVoice, lifeManager]);

  // Single stop handler
  const handleStop = useCallback(async () => {
    try {
      if (isConversationalMode) {
        await unifiedVoice.stop();
      } else {
        lifeManager.stop();
      }
    } catch (err) {
      console.error('Failed to stop:', err);
    }
    setIsActive(false);
    setSessionState('idle');
  }, [isConversationalMode, unifiedVoice, lifeManager]);

  const pendingTasks = getPendingTasks();
  const overdueTasks = getOverdueTasks();
  const activeGoals = goals.filter(g => g.status === 'active');

  const getStatusText = () => {
    if (isActive && isConversationalMode) {
      if (unifiedVoice.state === 'listening') return `Listening... (${unifiedVoice.providerName})`;
      if (unifiedVoice.state === 'speaking') return 'Speaking...';
      if (unifiedVoice.state === 'processing' || unifiedVoice.state === 'connecting') return 'Processing...';
      return `Ready (${unifiedVoice.providerName})`;
    }
    switch (sessionState) {
      case 'observing':
        return 'Observing...';
      case 'processing':
        return 'Analyzing...';
      case 'intervening':
        return 'Speaking...';
      case 'conversing':
        return 'Listening...';
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
          {sessionState === 'observing' && !isConversationalMode && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="relative">
                <div className="w-32 h-32 rounded-full border border-ai-glow/30 animate-ping" style={{ animationDuration: '3s' }} />
                <div className="absolute inset-4 flex items-center justify-center">
                  <Eye className="w-8 h-8 text-ai-glow/50 animate-pulse" />
                </div>
              </div>
            </div>
          )}

          {/* Conversation Mode Indicator */}
          {isActive && isConversationalMode && unifiedVoice.state === 'listening' && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="relative">
                <div className="w-40 h-40 rounded-full border-2 border-voice-active/40 animate-pulse" />
                <div className="absolute inset-4 w-32 h-32 rounded-full border border-voice-active/60 animate-ping" style={{ animationDuration: '2s' }} />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Mic className="w-10 h-10 text-voice-active/70 animate-pulse" />
                </div>
              </div>
            </div>
          )}

          {/* Glowing Ring when Speaking/Intervening */}
          <GlowingRing isActive={sessionState === 'intervening' || unifiedVoice.state === 'speaking'} size={300} />

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
                isActive && isConversationalMode ? (
                  unifiedVoice.state === 'listening' ? 'text-voice-active border-voice-active' :
                  unifiedVoice.state === 'speaking' ? 'text-ai-glow border-ai-glow' :
                  'text-ai-pulse border-ai-pulse animate-pulse'
                ) : (
                  sessionState === 'observing' ? 'text-ai-glow border-ai-glow/50' :
                  sessionState === 'processing' ? 'text-ai-pulse border-ai-pulse animate-pulse' :
                  sessionState === 'intervening' ? 'text-voice-active border-voice-active' :
                  'text-muted-foreground border-border'
                )
              }`}
            >
              {(sessionState === 'processing' || unifiedVoice.state === 'connecting') && (
                <Loader2 className="w-4 h-4 inline mr-2 animate-spin" />
              )}
              {sessionState === 'observing' && !isConversationalMode && (
                <Eye className="w-4 h-4 inline mr-2" />
              )}
              {isActive && isConversationalMode && unifiedVoice.state === 'listening' && (
                <Mic className="w-4 h-4 inline mr-2 animate-pulse" />
              )}
              {getStatusText()}
            </div>
          </div>

          {/* Control Panel - SINGLE BUTTON */}
          <div className="absolute bottom-4 right-4">
            <div className="bg-gradient-card/95 backdrop-blur-sm border border-border rounded-2xl shadow-card p-4">
              <div className="flex flex-col items-center space-y-2">
                <Button
                  onClick={isActive ? handleStop : handleStart}
                  className={`w-20 h-20 rounded-full border-2 transition-all duration-300 ${
                    isActive
                      ? 'bg-voice-active border-voice-active hover:bg-voice-active/80'
                      : 'bg-secondary border-voice-inactive hover:border-ai-glow hover:shadow-glow'
                  }`}
                >
                  {isActive ? (
                    <MicOff className="w-8 h-8" />
                  ) : isConversationalMode ? (
                    <Mic className="w-8 h-8" />
                  ) : (
                    <Eye className="w-8 h-8" />
                  )}
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  {isActive ? 'Stop' : (isConversationalMode ? 'Talk' : 'Observe')}
                </p>
              </div>
              
              {/* Provider indicator */}
              {isActive && (
                <div className="mt-3 text-center">
                  <Badge variant="outline" className="text-xs border-ai-glow/50 text-ai-glow">
                    {isConversationalMode ? <MessageSquare className="w-3 h-3 mr-1" /> : <Eye className="w-3 h-3 mr-1" />}
                    {isConversationalMode ? unifiedVoice.providerName : 'Observer'}
                  </Badge>
                </div>
              )}
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
