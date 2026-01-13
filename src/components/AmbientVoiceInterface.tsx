import { useState, useEffect, useRef } from 'react';
import CortanaHeader from '@/components/CortanaHeader';
import GlowingRing from '@/components/GlowingRing';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Mic, MicOff, Settings, Volume2, Loader2, MessageSquare, User, Bot } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAmbientAIWithSettings } from '@/hooks/useAmbientAIWithSettings';
import cortanaAI from '@/assets/cortana-ai.jpg';

type SessionState = 'idle' | 'listening' | 'processing' | 'speaking';

interface ConversationEntry {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export default function AmbientVoiceInterface() {
  const navigate = useNavigate();
  const [sessionState, setSessionState] = useState<SessionState>('idle');
  const [lastResponse, setLastResponse] = useState<string>('');
  const [transcript, setTranscript] = useState<string>('');
  const [conversationLog, setConversationLog] = useState<ConversationEntry[]>([]);
  const [showLog, setShowLog] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const ambientAI = useAmbientAIWithSettings({
    onSpeaking: (speaking) => {
      setSessionState(speaking ? 'speaking' : 'listening');
    },
    onTranscript: (text, isFinal) => {
      setTranscript(text);
      if (isFinal && text.trim()) {
        // Add user message to log
        setConversationLog(prev => [...prev, {
          id: crypto.randomUUID(),
          role: 'user',
          content: text.trim(),
          timestamp: new Date(),
        }]);
        setSessionState('processing');
      }
    },
    onResponse: (response) => {
      setLastResponse(response);
      // Add assistant response to log
      setConversationLog(prev => [...prev, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: response,
        timestamp: new Date(),
      }]);
    },
    onAlert: (level, message) => {
      console.log(`[ALERT ${level}] ${message}`);
    },
  });

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [conversationLog]);

  // Update session state based on ambient AI state
  useEffect(() => {
    if (ambientAI.isSpeaking) {
      setSessionState('speaking');
    } else if (ambientAI.isProcessing) {
      setSessionState('processing');
    } else if (ambientAI.isListening) {
      setSessionState('listening');
    } else {
      setSessionState('idle');
    }
  }, [ambientAI.isSpeaking, ambientAI.isProcessing, ambientAI.isListening]);

  const handleToggle = () => {
    if (ambientAI.isActive) {
      ambientAI.stop();
    } else {
      ambientAI.start();
    }
  };

  const getStatusText = () => {
    if (transcript && sessionState === 'listening') {
      return `"${transcript}"`;
    }
    switch (sessionState) {
      case 'listening':
        return 'Listening...';
      case 'processing':
        return 'Thinking...';
      case 'speaking':
        return 'Speaking...';
      default:
        return 'Ready';
    }
  };

  const getStatusColor = () => {
    switch (sessionState) {
      case 'listening':
        return 'text-ai-glow border-ai-glow';
      case 'processing':
        return 'text-ai-pulse border-ai-pulse animate-pulse';
      case 'speaking':
        return 'text-voice-active border-voice-active';
      default:
        return 'text-muted-foreground border-border';
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
          <div className="absolute inset-0 bg-background/20"></div>

          {/* Enhanced Holographic Cortana Overlay when Speaking */}
          <div
            className={`absolute inset-0 bg-cover bg-center bg-no-repeat transition-all duration-700 ease-out ${
              sessionState === 'speaking'
                ? 'opacity-80 scale-110 animate-pulse-glow'
                : 'opacity-0 scale-95'
            }`}
            style={{
              backgroundImage: `url(/lovable-uploads/48c7a359-5a9a-4f2f-bb1c-71e5282e9b4b.png)`,
              mixBlendMode: 'screen',
              filter: 'brightness(1.5) contrast(1.3) saturate(1.2) hue-rotate(10deg)',
            }}
          />

        {/* Multi-layered Synthesized Halo Effects */}
        <div
          className={`absolute inset-0 flex items-center justify-center transition-all duration-500 ${
            sessionState === 'speaking' ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <div className="relative">
            <div className="w-40 h-40 rounded-full bg-ai-glow/20 animate-ping" />
            <div className="absolute inset-0 w-40 h-40 rounded-full bg-gradient-to-r from-ai-glow/15 to-transparent animate-spin" />
          </div>
          <div className="absolute">
            <div
              className="w-32 h-32 rounded-full bg-ai-glow/30 animate-ping"
              style={{ animationDelay: '0.3s' }}
            />
          </div>
          <div className="absolute">
            <div className="w-24 h-24 rounded-full bg-ai-glow/40 animate-pulse" />
          </div>
        </div>

        {/* Glowing Ring Effect */}
        <GlowingRing isActive={sessionState === 'speaking'} size={300} />

        {/* Listening Indicator */}
        {sessionState === 'listening' && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="relative">
              <div className="w-48 h-48 rounded-full border-2 border-ai-glow/30 animate-pulse" />
              <div className="absolute inset-4 w-40 h-40 rounded-full border border-ai-glow/50 animate-ping" style={{ animationDuration: '2s' }} />
              <div className="absolute inset-0 flex items-center justify-center">
                <Volume2 className="w-8 h-8 text-ai-glow/50 animate-pulse" />
              </div>
            </div>
          </div>
        )}

        {/* Last Response Display */}
        {lastResponse && sessionState !== 'speaking' && (
          <div className="absolute top-24 left-1/2 transform -translate-x-1/2 max-w-md px-4">
            <div className="bg-gradient-card/95 backdrop-blur-sm border border-border rounded-xl p-4 shadow-card">
              <p className="text-sm text-muted-foreground italic">"{lastResponse}"</p>
            </div>
          </div>
        )}

        {/* Status Indicator */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2">
          <div
            className={`px-4 py-2 rounded-full border text-sm font-medium transition-all duration-300 bg-gradient-card/95 backdrop-blur-sm max-w-xs truncate ${getStatusColor()}`}
          >
            {sessionState === 'processing' && (
              <Loader2 className="w-4 h-4 inline mr-2 animate-spin" />
            )}
            {getStatusText()}
          </div>
        </div>

        {/* Activation Button */}
        <div className="absolute bottom-4 right-4">
          <div className="bg-gradient-card/95 backdrop-blur-sm border border-border rounded-2xl shadow-card p-6">
            <div className="flex flex-col items-center space-y-4">
              <Button
                onClick={handleToggle}
                className={`w-20 h-20 rounded-full border-2 transition-all duration-300 ${
                  ambientAI.isActive
                    ? 'bg-voice-active border-voice-active hover:bg-voice-active/80'
                    : 'bg-secondary border-voice-inactive hover:border-ai-glow hover:shadow-glow'
                }`}
              >
                {ambientAI.isActive ? (
                  <MicOff className="w-8 h-8" />
                ) : (
                  <Mic className="w-8 h-8" />
                )}
              </Button>

              <div className="text-center">
                <p className="text-sm text-muted-foreground">
                  {ambientAI.isActive ? 'Stop Listening' : 'Start Ambient AI'}
                </p>
                {ambientAI.isActive && (
                  <p className="text-xs text-ai-glow mt-1">
                    {ambientAI.sttProvider === 'elevenlabs' ? 'ElevenLabs' : 'Browser'} STT
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

          {/* Settings Button */}
          <div className="absolute bottom-4 left-4 flex gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate('/settings')}
              className="bg-gradient-card/95 backdrop-blur-sm border-border hover:border-ai-glow hover:shadow-glow"
            >
              <Settings className="h-5 w-5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setShowLog(!showLog)}
              className={`bg-gradient-card/95 backdrop-blur-sm border-border hover:border-ai-glow hover:shadow-glow ${showLog ? 'border-ai-glow' : ''}`}
            >
              <MessageSquare className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Conversation Log Panel */}
        {showLog && (
          <div className="w-80 bg-gradient-card border-l border-border flex flex-col overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-ai-glow" />
                <h2 className="text-lg font-semibold">Conversation</h2>
              </div>
              {conversationLog.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setConversationLog([])}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Clear
                </Button>
              )}
            </div>
            
            <ScrollArea className="flex-1 p-4" ref={scrollRef}>
              {conversationLog.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-8">
                  <MessageSquare className="w-12 h-12 text-muted-foreground/30 mb-4" />
                  <p className="text-sm text-muted-foreground">No conversation yet</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Start speaking to begin
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {conversationLog.map((entry) => (
                    <div
                      key={entry.id}
                      className={`flex gap-3 ${entry.role === 'user' ? 'flex-row-reverse' : ''}`}
                    >
                      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                        entry.role === 'user' 
                          ? 'bg-primary/20 text-primary' 
                          : 'bg-ai-glow/20 text-ai-glow'
                      }`}>
                        {entry.role === 'user' ? (
                          <User className="w-4 h-4" />
                        ) : (
                          <Bot className="w-4 h-4" />
                        )}
                      </div>
                      <div className={`flex-1 ${entry.role === 'user' ? 'text-right' : ''}`}>
                        <div className={`inline-block max-w-full p-3 rounded-xl text-sm ${
                          entry.role === 'user'
                            ? 'bg-primary/10 text-foreground'
                            : 'bg-muted/50 text-foreground'
                        }`}>
                          {entry.content}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatTime(entry.timestamp)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        )}
      </div>
    </div>
  );
}
