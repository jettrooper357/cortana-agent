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
  // Function to get current app context (tasks, goals, etc.) for AI
  getAppContext?: () => string;
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
  
  // Build the full system instruction with app context
  const buildSystemInstruction = useCallback(() => {
    const baseInstruction = config.systemInstruction || `You are Cortana, an AI assistant. 
Be concise, warm, and helpful.
Keep responses under 2 sentences when possible.
Use natural, conversational language.`;

    const appContext = config.getAppContext?.() || '';
    
    if (appContext) {
      return `${baseInstruction}

## Current App Context
${appContext}

Use this context to provide relevant, personalized assistance. Reference specific tasks, goals, and rules when helpful.`;
    }
    
    return baseInstruction;
  }, [config]);
  
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
      // Handle transcripts and responses based on message structure
      const msg = message as any;
      if (msg.source === 'user' && msg.message) {
        config.onTranscript?.(msg.message, true);
      } else if (msg.source === 'ai' && msg.message) {
        config.onResponse?.(msg.message);
      }
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
    systemInstruction: buildSystemInstruction(),
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
    systemInstruction: buildSystemInstruction(),
  });
  
  // Determine which mode to use based on settings
  // IMPORTANT: Always try to use the selected mode - only fallback on actual errors during runtime
  useEffect(() => {
    const providerConfig = getVoiceProviderConfig();
    console.log('[UnifiedVoice] Provider config:', providerConfig);
    
    if (providerConfig.type === 'browser') {
      setActiveMode('browser');
    } else if (providerConfig.type === 'conversational-ai') {
      // Try Gemini Live first if API key exists, otherwise use fallback
      // Both modes will work - fallback uses free Lovable AI
      if (providerConfig.ai?.apiKey) {
        setActiveMode('gemini-live');
      } else {
        setActiveMode('gemini-fallback');
      }
    } else if (providerConfig.type === 'webhook') {
      // Try ElevenLabs agent if agentId exists
      // Otherwise use Gemini fallback (which will use webhook's voiceId for TTS if available)
      if (providerConfig.webhook?.agentId) {
        setActiveMode('elevenlabs-agent');
      } else {
        setActiveMode('gemini-fallback');
      }
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
  
  // Unified start - always try the selected mode and fallback only on errors
  const start = useCallback(async () => {
    const providerConfig = getVoiceProviderConfig();
    console.log('[UnifiedVoice] Starting with mode:', activeMode, 'config:', providerConfig);
    
    if (activeMode === 'browser') {
      toast.info('Browser mode active - no AI conversation');
      config.onStateChange?.('listening');
    } else if (activeMode === 'gemini-live') {
      try {
        await geminiLive.start();
      } catch (error) {
        console.error('[UnifiedVoice] Gemini Live failed, trying fallback:', error);
        toast.warning('Gemini Live unavailable, using fallback mode');
        setActiveMode('gemini-fallback');
        await geminiFallback.start();
      }
    } else if (activeMode === 'gemini-fallback') {
      // Just start - TTS will automatically fallback to browser if ElevenLabs fails
      await geminiFallback.start();
    } else if (activeMode === 'elevenlabs-agent' && providerConfig.type === 'webhook' && providerConfig.webhook) {
      const webhook = providerConfig.webhook;
      
      try {
        config.onStateChange?.('connecting');
        
        // Request microphone permission first
        console.log('[UnifiedVoice] Requesting microphone permission...');
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        console.log('[UnifiedVoice] Microphone permission granted');
        
        console.log('[UnifiedVoice] Starting ElevenLabs agent with ID:', webhook.agentId);
        
        // Start the ElevenLabs session
        await elevenLabsConversation.startSession({
          agentId: webhook.agentId!,
        });
        
        console.log('[UnifiedVoice] ElevenLabs startSession completed, status:', elevenLabsConversation.status);
        toast.success('ElevenLabs agent connected');
      } catch (error) {
        console.error('[UnifiedVoice] Failed to start ElevenLabs agent:', error);
        toast.warning('ElevenLabs agent failed - using Gemini AI');
        
        // Fallback to Gemini mode if ElevenLabs agent fails
        setActiveMode('gemini-fallback');
        try {
          await geminiFallback.start();
        } catch (fallbackError) {
          console.error('[UnifiedVoice] Fallback also failed:', fallbackError);
          config.onStateChange?.('idle');
        }
      }
    }
  }, [activeMode, getVoiceProviderConfig, geminiLive, geminiFallback, elevenLabsConversation, config, buildSystemInstruction]);
  
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
