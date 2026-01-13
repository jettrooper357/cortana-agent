import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useSettings } from './useSettings';

export type SessionState = 'idle' | 'connecting' | 'listening' | 'processing' | 'speaking';

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface GeminiLiveConfig {
  onStateChange?: (state: SessionState) => void;
  onTranscript?: (text: string, isFinal: boolean) => void;
  onResponse?: (text: string) => void;
  onError?: (error: string) => void;
  systemInstruction?: string;
  voice?: string;
}

interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent {
  error: string;
  message?: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

function getSpeechRecognition(): (new () => SpeechRecognition) | null {
  const win = window as unknown as { 
    SpeechRecognition?: new () => SpeechRecognition;
    webkitSpeechRecognition?: new () => SpeechRecognition;
  };
  return win.SpeechRecognition || win.webkitSpeechRecognition || null;
}

/**
 * useGeminiLiveAudio - Real-time voice conversation hook
 * 
 * This hook provides bidirectional audio conversation capabilities:
 * - Browser speech recognition for input
 * - Gemini AI for processing
 * - Browser speech synthesis for output
 * 
 * The flow is designed to be as close to real-time as possible
 * while working within browser constraints.
 */
export function useGeminiLiveAudio(config: GeminiLiveConfig = {}) {
  const { settings } = useSettings();
  const [state, setState] = useState<SessionState>('idle');
  const [isActive, setIsActive] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [conversationHistory, setConversationHistory] = useState<ConversationMessage[]>([]);
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const synthRef = useRef<SpeechSynthesisUtterance | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isProcessingRef = useRef(false);
  const isSpeakingRef = useRef(false);
  const lastProcessedRef = useRef('');
  const restartTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Update state and notify
  const updateState = useCallback((newState: SessionState) => {
    setState(newState);
    config.onStateChange?.(newState);
  }, [config]);

  // Speak response using ElevenLabs or browser TTS based on settings
  const speak = useCallback(async (text: string): Promise<void> => {
    if (!text.trim()) return;

    isSpeakingRef.current = true;
    updateState('speaking');

    const voiceProvider = settings.voice?.provider;
    
    // Check if we should use ElevenLabs (when provider is a webhook ID that's an elevenlabs webhook)
    const ttsWebhook = voiceProvider 
      ? settings.webhooks?.find(w => w.id === voiceProvider && w.type === 'elevenlabs') 
      : null;
    
    console.log('[Gemini Live] TTS provider:', voiceProvider, 'Webhook:', ttsWebhook?.name);
    
    if (ttsWebhook?.type === 'elevenlabs') {
      try {
        console.log('[Gemini Live] Using ElevenLabs TTS');
        
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            },
            body: JSON.stringify({ text, voiceId: ttsWebhook.agentId }),
          }
        );

        if (!response.ok) {
          throw new Error(`ElevenLabs TTS failed: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.audioContent) {
          // Play the audio
          await new Promise<void>((resolve, reject) => {
            const audioUrl = `data:audio/mpeg;base64,${data.audioContent}`;
            const audio = new Audio(audioUrl);
            audioRef.current = audio;
            
            audio.onended = () => {
              audioRef.current = null;
              isSpeakingRef.current = false;
              if (isActive) {
                updateState('listening');
              }
              resolve();
            };
            
            audio.onerror = (e) => {
              console.error('[Gemini Live] Audio playback error:', e);
              audioRef.current = null;
              reject(new Error('Audio playback failed'));
            };
            
            audio.play().catch(reject);
          });
          return;
        }
      } catch (error) {
        console.error('[Gemini Live] ElevenLabs TTS failed, falling back to browser:', error);
        // Fall through to browser TTS
      }
    }

    // Fallback to browser TTS
    if (!('speechSynthesis' in window)) {
      console.warn('[Gemini Live] No speech synthesis available');
      isSpeakingRef.current = false;
      if (isActive) {
        updateState('listening');
      }
      return;
    }

    return new Promise((resolve) => {
      // Cancel any ongoing speech
      window.speechSynthesis.cancel();
      
      // Small delay after cancel
      setTimeout(() => {
        const utterance = new SpeechSynthesisUtterance(text);
        synthRef.current = utterance;
        
        // Try to get a natural voice
        const voices = window.speechSynthesis.getVoices();
        const preferredVoice = voices.find(v => 
          v.name.includes('Samantha') || 
          v.name.includes('Google') ||
          v.name.includes('Natural') ||
          (v.lang.startsWith('en') && v.localService)
        ) || voices.find(v => v.lang.startsWith('en'));
        
        if (preferredVoice) {
          utterance.voice = preferredVoice;
        }
        
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;

        utterance.onend = () => {
          isSpeakingRef.current = false;
          synthRef.current = null;
          if (isActive) {
            updateState('listening');
          }
          resolve();
        };

        utterance.onerror = (event) => {
          console.error('[Gemini Live] Browser TTS error:', event);
          isSpeakingRef.current = false;
          synthRef.current = null;
          if (isActive) {
            updateState('listening');
          }
          resolve();
        };

        window.speechSynthesis.speak(utterance);
      }, 100);
    });
  }, [isActive, updateState, settings.voice?.provider, settings.webhooks]);

  // Process transcript with Gemini
  const processTranscript = useCallback(async (transcript: string) => {
    if (!transcript.trim() || isProcessingRef.current || isSpeakingRef.current) {
      return;
    }

    if (transcript.trim() === lastProcessedRef.current.trim()) {
      return;
    }

    isProcessingRef.current = true;
    lastProcessedRef.current = transcript;
    updateState('processing');

    try {
      // Add user message to history
      const userMessage: ConversationMessage = {
        role: 'user',
        content: transcript.trim(),
        timestamp: new Date(),
      };
      
      setConversationHistory(prev => [...prev, userMessage]);

      // Call the Gemini audio chat function
      const { data, error: invokeError } = await supabase.functions.invoke('gemini-audio-chat', {
        body: {
          transcript: transcript.trim(),
          conversationHistory: conversationHistory.slice(-10).map(m => ({
            role: m.role,
            content: m.content,
          })),
          systemInstruction: config.systemInstruction,
        },
      });

      if (invokeError) {
        throw invokeError;
      }

      if (data?.error) {
        if (data.error.includes('Rate limit')) {
          toast.error('AI rate limit exceeded. Please wait a moment.');
        } else if (data.error.includes('credits')) {
          toast.error('AI credits depleted. Please add funds.');
        }
        throw new Error(data.error);
      }

      const response = data?.response;
      if (response) {
        // Add assistant message to history
        const assistantMessage: ConversationMessage = {
          role: 'assistant',
          content: response,
          timestamp: new Date(),
        };
        setConversationHistory(prev => [...prev, assistantMessage]);
        
        config.onResponse?.(response);
        
        // Speak the response
        await speak(response);
      }
    } catch (err) {
      console.error('Processing error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Processing failed';
      setError(errorMessage);
      config.onError?.(errorMessage);
      
      if (isActive) {
        updateState('listening');
      }
    } finally {
      isProcessingRef.current = false;
    }
  }, [conversationHistory, config, speak, updateState, isActive]);

  // Start listening
  const startListening = useCallback(() => {
    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition) {
      const errorMsg = 'Speech recognition not supported in this browser';
      setError(errorMsg);
      config.onError?.(errorMsg);
      return;
    }

    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      console.log('Speech recognition started');
      if (!isSpeakingRef.current && !isProcessingRef.current) {
        updateState('listening');
      }
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript;
        
        if (result.isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      if (interimTranscript) {
        setCurrentTranscript(interimTranscript);
        config.onTranscript?.(interimTranscript, false);
      }

      if (finalTranscript.trim()) {
        setCurrentTranscript('');
        config.onTranscript?.(finalTranscript, true);
        processTranscript(finalTranscript);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Speech recognition error:', event.error);
      
      // Don't treat 'aborted' as an error - it's expected when stopping
      if (event.error === 'aborted') {
        return;
      }

      // For 'no-speech', just restart
      if (event.error === 'no-speech' && isActive) {
        restartTimeoutRef.current = setTimeout(() => {
          if (isActive && !isSpeakingRef.current && !isProcessingRef.current) {
            startListening();
          }
        }, 500);
        return;
      }

      setError(`Speech recognition error: ${event.error}`);
      config.onError?.(`Speech recognition error: ${event.error}`);
    };

    recognition.onend = () => {
      console.log('Speech recognition ended');
      
      // Auto-restart if still active and not speaking/processing
      if (isActive && !isSpeakingRef.current && !isProcessingRef.current) {
        restartTimeoutRef.current = setTimeout(() => {
          if (isActive && !isSpeakingRef.current && !isProcessingRef.current) {
            startListening();
          }
        }, 300);
      }
    };

    try {
      recognition.start();
    } catch (err) {
      console.error('Failed to start recognition:', err);
    }
  }, [isActive, config, processTranscript, updateState]);

  // Stop listening
  const stopListening = useCallback(() => {
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (err) {
        // Ignore errors when stopping
      }
      recognitionRef.current = null;
    }
  }, []);

  // Stop speaking
  const stopSpeaking = useCallback(() => {
    // Stop ElevenLabs audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    // Stop browser TTS
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    isSpeakingRef.current = false;
    synthRef.current = null;
  }, []);

  // Start session
  const start = useCallback(async () => {
    try {
      setError(null);
      updateState('connecting');

      // Request microphone permission
      await navigator.mediaDevices.getUserMedia({ audio: true });

      setIsActive(true);
      startListening();
      
      toast.success('Gemini Live Audio started');
    } catch (err) {
      console.error('Failed to start Gemini Live Audio:', err);
      const errorMsg = err instanceof Error ? err.message : 'Failed to start';
      setError(errorMsg);
      config.onError?.(errorMsg);
      updateState('idle');
      toast.error('Failed to start: Check microphone permissions');
    }
  }, [config, startListening, updateState]);

  // Stop session
  const stop = useCallback(() => {
    setIsActive(false);
    stopListening();
    stopSpeaking();
    updateState('idle');
    setCurrentTranscript('');
    lastProcessedRef.current = '';
    isProcessingRef.current = false;
    
    toast.info('Gemini Live Audio stopped');
  }, [stopListening, stopSpeaking, updateState]);

  // Clear conversation history
  const clearHistory = useCallback(() => {
    setConversationHistory([]);
    lastProcessedRef.current = '';
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (restartTimeoutRef.current) {
        clearTimeout(restartTimeoutRef.current);
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // Ignore
        }
      }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Restart listening when speaking ends
  useEffect(() => {
    if (isActive && state === 'listening' && !recognitionRef.current) {
      startListening();
    }
  }, [isActive, state, startListening]);

  return {
    // State
    state,
    isActive,
    currentTranscript,
    conversationHistory,
    error,
    
    // Controls
    start,
    stop,
    speak,
    clearHistory,
    
    // Direct control (for advanced use)
    processTranscript,
  };
}
