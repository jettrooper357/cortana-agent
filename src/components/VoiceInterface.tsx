import { useState, useEffect, useCallback, useRef } from 'react';
import CortanaHeader from '@/components/CortanaHeader';
import GlowingRing from '@/components/GlowingRing';
import { useWakeWord } from '@/hooks/useWakeWord';
import { useUnifiedVoice } from '@/hooks/useUnifiedVoice';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import cortanaAI from '@/assets/cortana-ai.jpg';

type SessionState = 'idle' | 'listening' | 'processing' | 'speaking';

export default function VoiceInterface() {
  const navigate = useNavigate();
  const [sessionState, setSessionState] = useState<SessionState>('idle');
  const isActivatingRef = useRef(false);
  
  // Use the unified voice hook that handles all provider switching
  const unifiedVoice = useUnifiedVoice({
    onStateChange: (state) => {
      setSessionState(state === 'connecting' ? 'processing' : state);
    },
    onError: (error) => {
      console.error('Voice error:', error);
    },
  });

  // Handle Cortana activation
  const activateCortana = useCallback(async () => {
    if (isActivatingRef.current || unifiedVoice.isActive) {
      console.log('Activation already in progress or session active, skipping...');
      return;
    }
    
    console.log('=== CORTANA ACTIVATION ===');
    console.log('Using provider:', unifiedVoice.providerName);
    
    isActivatingRef.current = true;
    try {
      await unifiedVoice.start();
    } catch (error) {
      console.error('Failed to activate Cortana:', error);
      setSessionState('idle');
    } finally {
      isActivatingRef.current = false;
    }
  }, [unifiedVoice]);

  // Handle session deactivation
  const deactivateCortana = useCallback(async () => {
    try {
      await unifiedVoice.stop();
      setSessionState('idle');
      console.log('Cortana session deactivated');
    } catch (error) {
      console.error('Failed to deactivate Cortana session:', error);
    }
  }, [unifiedVoice]);

  // Wake word detection
  const { isListening: isWakeWordListening } = useWakeWord({
    onWakeWordDetected: activateCortana,
    isEnabled: !unifiedVoice.isActive
  });

  // Session timeout (auto-deactivate after 30 seconds of inactivity)
  useEffect(() => {
    if (!unifiedVoice.isActive || sessionState === 'speaking') return;
    
    const timeout = setTimeout(() => {
      console.log('Session timeout - deactivating Cortana');
      deactivateCortana();
    }, 30000);
    
    return () => clearTimeout(timeout);
  }, [sessionState, unifiedVoice.isActive, deactivateCortana]);

  // Get status text based on current state
  const getStatusText = () => {
    switch (sessionState) {
      case 'listening': return `Listening... (${unifiedVoice.providerName})`;
      case 'processing': return 'Activating...';
      case 'speaking': return 'Speaking...';
      default: return 'Ready';
    }
  };

  // Get status color based on current state
  const getStatusColor = () => {
    switch (sessionState) {
      case 'listening': return 'text-ai-glow border-ai-glow';
      case 'processing': return 'text-ai-pulse border-ai-pulse animate-pulse';
      case 'speaking': return 'text-voice-active border-voice-active';
      default: return 'text-muted-foreground border-border';
    }
  };

  return (
    <div className="flex flex-col min-h-screen max-h-screen overflow-hidden bg-background">
      <CortanaHeader />

      {/* Full Background Cortana Image */}
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
            filter: 'brightness(1.5) contrast(1.3) saturate(1.2) hue-rotate(10deg)'
          }}
        />
        
        {/* Multi-layered Synthesized Halo Effects */}
        <div 
          className={`absolute inset-0 flex items-center justify-center transition-all duration-500 ${
            sessionState === 'speaking' ? 'opacity-100' : 'opacity-0'
          }`}
        >
          {/* Outer energy ring */}
          <div className="relative">
            <div className="w-40 h-40 rounded-full bg-ai-glow/20 animate-ping" />
            <div className="absolute inset-0 w-40 h-40 rounded-full bg-gradient-to-r from-ai-glow/15 to-transparent animate-spin" />
          </div>
          
          {/* Middle energy ring */}
          <div className="absolute">
            <div className="w-32 h-32 rounded-full bg-ai-glow/30 animate-ping" style={{ animationDelay: '0.3s' }} />
            <div className="absolute inset-0 w-32 h-32 rounded-full bg-gradient-to-r from-ai-glow/25 to-transparent animate-spin" style={{ animationDelay: '0.15s' }} />
          </div>
          
          {/* Inner core */}
          <div className="absolute">
            <div className="w-24 h-24 rounded-full bg-ai-glow/40 animate-pulse" />
            <div className="absolute inset-2 w-20 h-20 rounded-full border-2 border-ai-glow/50 animate-pulse" style={{ animationDelay: '0.2s' }} />
            <div className="absolute inset-4 w-16 h-16 rounded-full bg-gradient-primary/30 animate-core-pulse" />
          </div>
        </div>
        
        {/* Glowing Ring Effect */}
        <GlowingRing isActive={sessionState === 'speaking'} size={300} />
        
        {/* Status Indicator */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2">
          <div className={`px-4 py-2 rounded-full border text-sm font-medium transition-all duration-300 bg-gradient-card/95 backdrop-blur-sm ${getStatusColor()}`}>
            {getStatusText()}
          </div>
        </div>
        
        {/* Manual Activation Button */}
        <div className="absolute bottom-4 right-4">
          <div className="bg-gradient-card/95 backdrop-blur-sm border border-border rounded-2xl shadow-card p-6">
            <div className="flex flex-col items-center space-y-4">
              <Button
                onClick={unifiedVoice.isActive ? deactivateCortana : activateCortana}
                disabled={sessionState === 'processing'}
                className={`w-20 h-20 rounded-full border-2 transition-all duration-300 ${
                  unifiedVoice.isActive
                    ? 'bg-voice-active border-voice-active hover:bg-voice-active/80' 
                    : 'bg-secondary border-voice-inactive hover:border-ai-glow hover:shadow-glow'
                }`}
              >
                {unifiedVoice.isActive ? (
                  <MicOff className="w-8 h-8" />
                ) : (
                  <Mic className="w-8 h-8" />
                )}
              </Button>
              
              <div className="text-center">
                <p className="text-sm text-muted-foreground">
                  {unifiedVoice.isActive ? 'End Session' : 'Activate Cortana'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Settings Button */}
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
    </div>
  );
}
