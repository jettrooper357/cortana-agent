import { useCallback, useState, useEffect } from 'react';
import { useConversation } from '@11labs/react';
import { useSettings } from './useSettings';
import { useGeminiLive } from './useGeminiLive';
import { useGeminiLiveAudio } from './useGeminiLiveAudio';
import { toast } from 'sonner';

export type UnifiedSessionState = 'idle' | 'connecting' | 'listening' | 'processing' | 'speaking';

interface UnifiedVoiceConfig {
  onStateChange?: (state: UnifiedSessionState) => void;
  onTranscript?: (text: string, isFinal: boolean) => void;
  onResponse?: (text: string) => void;
  onError?: (error: string) => void;
  systemInstruction?: string;
}

/**
 * useUnifiedVoice - A unified voice interface that switches between:
 * 1. Gemini Live mode: Native bidirectional audio via WebSocket (requires API key)
 * 2. Gemini Fallback mode: Browser STT → Gemini AI → TTS (no API key needed)
 * 3. ElevenLabs Agent mode: Full ElevenLabs conversational agent
 * 4. Browser mode: Basic browser TTS (no AI)
 * 
 * The mode is determined by the voice provider settings.
 */
export function useUnifiedVoice(config: UnifiedVoiceConfig = {}) {
  const { settings, getVoiceProviderConfig } = useSettings();
  const [activeMode, setActiveMode] = useState<'gemini-live' | 'gemini-fallback' | 'elevenlabs-agent' | 'browser'>('gemini-fallback');
  
  // ElevenLabs agent conversation hook
  const elevenLabsConversation = useConversation({
    onConnect: () => {
      console.log('[UnifiedVoice] ElevenLabs agent connected');
      config.onStateChange?.('listening');
    },
    onDisconnect: () => {
      console.log('[UnifiedVoice] ElevenLabs agent disconnected');
      config.onStateChange?.('idle');
    },
    onError: (error) => {
      console.error('[UnifiedVoice] ElevenLabs error:', error);
      config.onError?.(String(error));
    },
    onMessage: (message) => {
      console.log('[UnifiedVoice] ElevenLabs message:', message);
    },
  });
  
  // Gemini Live hook (native bidirectional audio - requires API key)
  const geminiLive = useGeminiLive({
    onStateChange: (state) => {
      if (activeMode === 'gemini-live') {
        config.onStateChange?.(state);
      }
    },
    onTranscript: config.onTranscript,
    onResponse: config.onResponse,
    onError: config.onError,
    systemInstruction: config.systemInstruction,
  });
  
  // Gemini Fallback hook (browser STT → Gemini text API → TTS)
  const geminiFallback = useGeminiLiveAudio({
    onStateChange: (state) => {
      if (activeMode === 'gemini-fallback') {
        config.onStateChange?.(state);
      }
    },
    onTranscript: config.onTranscript,
    onResponse: config.onResponse,
    onError: config.onError,
    systemInstruction: config.systemInstruction,
  });
  
  // Determine which mode to use based on settings
  useEffect(() => {
    const providerConfig = getVoiceProviderConfig();
    console.log('[UnifiedVoice] Provider config:', providerConfig);
    
    if (providerConfig.type === 'browser') {
      setActiveMode('browser');
    } else if (providerConfig.type === 'conversational-ai') {
      // Check if the AI has an API key for native Gemini Live
      if (providerConfig.ai?.apiKey) {
        setActiveMode('gemini-live');
      } else {
        // Use fallback mode (browser STT + Gemini text API + TTS)
        setActiveMode('gemini-fallback');
      }
    } else if (providerConfig.type === 'webhook') {
      setActiveMode('elevenlabs-agent');
    }
  }, [settings.voice.provider, getVoiceProviderConfig]);
  
  // Unified state
  const getState = useCallback((): UnifiedSessionState => {
    if (activeMode === 'gemini-live') {
      return geminiLive.state;
    } else if (activeMode === 'gemini-fallback') {
      return geminiFallback.state;
    } else if (activeMode === 'elevenlabs-agent') {
      if (elevenLabsConversation.status === 'connected') {
        return elevenLabsConversation.isSpeaking ? 'speaking' : 'listening';
      }
      return 'idle';
    }
    return 'idle';
  }, [activeMode, geminiLive.state, geminiFallback.state, elevenLabsConversation.status, elevenLabsConversation.isSpeaking]);
  
  // Unified start
  const start = useCallback(async () => {
    const providerConfig = getVoiceProviderConfig();
    console.log('[UnifiedVoice] Starting with mode:', activeMode, 'config:', providerConfig);
    
    if (activeMode === 'browser') {
      toast.info('Browser mode active - no AI conversation');
      config.onStateChange?.('listening');
    } else if (activeMode === 'gemini-live') {
      await geminiLive.start();
    } else if (activeMode === 'gemini-fallback') {
      await geminiFallback.start();
    } else if (activeMode === 'elevenlabs-agent' && providerConfig.type === 'webhook' && providerConfig.webhook) {
      const webhook = providerConfig.webhook;
      if (!webhook.agentId) {
        toast.error('ElevenLabs agent ID not configured');
        config.onError?.('ElevenLabs agent ID not configured');
        return;
      }
      
      try {
        config.onStateChange?.('connecting');
        await navigator.mediaDevices.getUserMedia({ audio: true });
        await elevenLabsConversation.startSession({
          agentId: webhook.agentId,
        });
        toast.success('ElevenLabs agent connected');
      } catch (error) {
        console.error('[UnifiedVoice] Failed to start ElevenLabs agent:', error);
        toast.error('Failed to connect to ElevenLabs agent');
        config.onError?.(error instanceof Error ? error.message : 'Failed to start');
        config.onStateChange?.('idle');
      }
    }
  }, [activeMode, getVoiceProviderConfig, geminiLive, geminiFallback, elevenLabsConversation, config]);
  
  // Unified stop
  const stop = useCallback(async () => {
    console.log('[UnifiedVoice] Stopping mode:', activeMode);
    
    if (activeMode === 'gemini-live') {
      geminiLive.stop();
    } else if (activeMode === 'gemini-fallback') {
      geminiFallback.stop();
    } else if (activeMode === 'elevenlabs-agent') {
      try {
        await elevenLabsConversation.endSession();
      } catch (error) {
        console.error('[UnifiedVoice] Error ending ElevenLabs session:', error);
      }
    }
    
    config.onStateChange?.('idle');
  }, [activeMode, geminiLive, geminiFallback, elevenLabsConversation, config]);
  
  // Check if active
  const isActive = useCallback(() => {
    if (activeMode === 'gemini-live') {
      return geminiLive.isActive;
    } else if (activeMode === 'gemini-fallback') {
      return geminiFallback.isActive;
    } else if (activeMode === 'elevenlabs-agent') {
      return elevenLabsConversation.status === 'connected';
    }
    return false;
  }, [activeMode, geminiLive.isActive, geminiFallback.isActive, elevenLabsConversation.status]);
  
  // Check if speaking
  const isSpeaking = useCallback(() => {
    if (activeMode === 'gemini-live') {
      return geminiLive.state === 'speaking';
    } else if (activeMode === 'gemini-fallback') {
      return geminiFallback.state === 'speaking';
    } else if (activeMode === 'elevenlabs-agent') {
      return elevenLabsConversation.isSpeaking;
    }
    return false;
  }, [activeMode, geminiLive.state, geminiFallback.state, elevenLabsConversation.isSpeaking]);
  
  // Get provider name for display
  const getProviderName = useCallback(() => {
    if (activeMode === 'gemini-live') return 'Gemini Live';
    if (activeMode === 'gemini-fallback') return 'Gemini AI';
    if (activeMode === 'elevenlabs-agent') return 'ElevenLabs Agent';
    return 'Browser';
  }, [activeMode]);
  
  // Get current transcript
  const getCurrentTranscript = useCallback(() => {
    if (activeMode === 'gemini-live') return geminiLive.currentTranscript;
    if (activeMode === 'gemini-fallback') return geminiFallback.currentTranscript;
    return '';
  }, [activeMode, geminiLive.currentTranscript, geminiFallback.currentTranscript]);
  
  // Get conversation history
  const getConversationHistory = useCallback(() => {
    if (activeMode === 'gemini-live') return geminiLive.conversationHistory;
    if (activeMode === 'gemini-fallback') return geminiFallback.conversationHistory;
    return [];
  }, [activeMode, geminiLive.conversationHistory, geminiFallback.conversationHistory]);
  
  // Clear history
  const clearHistory = useCallback(() => {
    if (activeMode === 'gemini-live') {
      geminiLive.clearHistory();
    } else if (activeMode === 'gemini-fallback') {
      geminiFallback.clearHistory();
    }
  }, [activeMode, geminiLive, geminiFallback]);
  
  return {
    // Mode info
    activeMode,
    providerName: getProviderName(),
    
    // State
    state: getState(),
    isActive: isActive(),
    isSpeaking: isSpeaking(),
    
    // Transcript and history
    currentTranscript: getCurrentTranscript(),
    conversationHistory: getConversationHistory(),
    
    // Actions
    start,
    stop,
    clearHistory,
    
    // Raw access if needed
    geminiLive,
    geminiFallback,
    elevenLabsConversation,
  };
}
