import { useCallback, useRef, useState, useEffect } from 'react';
import { useConversation } from '@11labs/react';
import { useSettings } from './useSettings';
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
 * 1. Gemini mode: Browser STT → Gemini AI → TTS (browser or ElevenLabs)
 * 2. ElevenLabs Agent mode: Full ElevenLabs conversational agent
 * 
 * The mode is determined by the conversationProvider setting.
 */
export function useUnifiedVoice(config: UnifiedVoiceConfig = {}) {
  const { settings, getVoiceProviderConfig, getWebhookById, getConversationalAIById } = useSettings();
  const [activeMode, setActiveMode] = useState<'gemini' | 'elevenlabs-agent' | 'browser'>('gemini');
  
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
  
  // Gemini audio hook
  const geminiAudio = useGeminiLiveAudio({
    onStateChange: (state) => {
      if (activeMode === 'gemini') {
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
    if (providerConfig.type === 'browser') {
      setActiveMode('browser');
    } else if (providerConfig.type === 'conversational-ai') {
      setActiveMode('gemini');
    } else if (providerConfig.type === 'webhook') {
      setActiveMode('elevenlabs-agent');
    }
  }, [settings.voice.provider, getVoiceProviderConfig]);
  
  // Unified state
  const getState = useCallback((): UnifiedSessionState => {
    if (activeMode === 'gemini') {
      return geminiAudio.state;
    } else {
      if (elevenLabsConversation.status === 'connected') {
        return elevenLabsConversation.isSpeaking ? 'speaking' : 'listening';
      }
      return 'idle';
    }
  }, [activeMode, geminiAudio.state, elevenLabsConversation.status, elevenLabsConversation.isSpeaking]);
  
  // Unified start
  const start = useCallback(async () => {
    const providerConfig = getVoiceProviderConfig();
    console.log('[UnifiedVoice] Starting with mode:', providerConfig.type);
    
    if (providerConfig.type === 'browser') {
      setActiveMode('browser');
      // Use browser TTS only (no AI)
      toast.info('Browser mode active - no AI conversation');
      config.onStateChange?.('listening');
    } else if (providerConfig.type === 'conversational-ai') {
      setActiveMode('gemini');
      await geminiAudio.start();
    } else if (providerConfig.type === 'webhook' && providerConfig.webhook) {
      setActiveMode('elevenlabs-agent');
      
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
  }, [getVoiceProviderConfig, geminiAudio, elevenLabsConversation, config]);
  
  // Unified stop
  const stop = useCallback(async () => {
    console.log('[UnifiedVoice] Stopping mode:', activeMode);
    
    if (activeMode === 'gemini') {
      geminiAudio.stop();
    } else {
      try {
        await elevenLabsConversation.endSession();
      } catch (error) {
        console.error('[UnifiedVoice] Error ending ElevenLabs session:', error);
      }
    }
    
    config.onStateChange?.('idle');
  }, [activeMode, geminiAudio, elevenLabsConversation, config]);
  
  // Check if active
  const isActive = useCallback(() => {
    if (activeMode === 'gemini') {
      return geminiAudio.isActive;
    } else {
      return elevenLabsConversation.status === 'connected';
    }
  }, [activeMode, geminiAudio.isActive, elevenLabsConversation.status]);
  
  // Check if speaking
  const isSpeaking = useCallback(() => {
    if (activeMode === 'gemini') {
      return geminiAudio.state === 'speaking';
    } else {
      return elevenLabsConversation.isSpeaking;
    }
  }, [activeMode, geminiAudio.state, elevenLabsConversation.isSpeaking]);
  
  return {
    // Mode info
    activeMode,
    providerName: activeMode === 'gemini' ? 'Gemini AI' : 'ElevenLabs Agent',
    
    // State
    state: getState(),
    isActive: isActive(),
    isSpeaking: isSpeaking(),
    
    // Gemini specific
    currentTranscript: geminiAudio.currentTranscript,
    conversationHistory: geminiAudio.conversationHistory,
    
    // Actions
    start,
    stop,
    clearHistory: geminiAudio.clearHistory,
    
    // Raw access if needed
    geminiAudio,
    elevenLabsConversation,
  };
}
