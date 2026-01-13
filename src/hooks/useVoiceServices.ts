import { useState, useCallback, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import type { WebhookSettings } from '@/hooks/useSettings';

// Config now accepts webhook configs instead of just provider types
interface VoiceServicesConfig {
  ttsWebhook?: WebhookSettings | null; // null or undefined = browser
  sttWebhook?: WebhookSettings | null; // null or undefined = browser
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}

// Browser Speech Recognition types
interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

// Use type assertion for browser compatibility
const getSpeechRecognition = (): (new () => SpeechRecognition) | undefined => {
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
};

export function useVoiceServices(config: VoiceServicesConfig = {}) {
  const ttsWebhook = config.ttsWebhook;
  const sttWebhook = config.sttWebhook;
  
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const synthRef = useRef<SpeechSynthesisUtterance | null>(null);
  const isSpeakingRef = useRef(false); // Track speaking state without causing re-renders

  // ==================== TTS ====================

  // Ensure voices are loaded (they load asynchronously in many browsers)
  const getVoicesAsync = useCallback((): Promise<SpeechSynthesisVoice[]> => {
    return new Promise((resolve) => {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        resolve(voices);
        return;
      }
      
      // Voices not loaded yet, wait for the event
      const handleVoicesChanged = () => {
        const loadedVoices = window.speechSynthesis.getVoices();
        window.speechSynthesis.removeEventListener('voiceschanged', handleVoicesChanged);
        resolve(loadedVoices);
      };
      
      window.speechSynthesis.addEventListener('voiceschanged', handleVoicesChanged);
      
      // Timeout fallback after 1 second
      setTimeout(() => {
        window.speechSynthesis.removeEventListener('voiceschanged', handleVoicesChanged);
        resolve(window.speechSynthesis.getVoices());
      }, 1000);
    });
  }, []);

  // Browser TTS
  const speakWithBrowser = useCallback(async (text: string): Promise<void> => {
    console.log('[Browser TTS] Starting with text:', text.substring(0, 50) + '...');
    
    if (!('speechSynthesis' in window)) {
      console.error('[Browser TTS] Speech synthesis not supported');
      throw new Error('Browser does not support speech synthesis');
    }

    // Cancel any ongoing speech first
    window.speechSynthesis.cancel();
    
    // Small delay to ensure cancel is processed
    await new Promise(resolve => setTimeout(resolve, 50));

    // Wait for voices to be loaded
    const voices = await getVoicesAsync();
    console.log('[Browser TTS] Available voices:', voices.length);

    return new Promise((resolve, reject) => {
      const utterance = new SpeechSynthesisUtterance(text);
      synthRef.current = utterance;
      
      // Try to get a nice voice
      const preferredVoice = voices.find(v => 
        v.name.includes('Samantha') || 
        v.name.includes('Google') || 
        v.name.includes('Microsoft') ||
        v.lang.startsWith('en')
      ) || voices[0];
      
      if (preferredVoice) {
        utterance.voice = preferredVoice;
        console.log('[Browser TTS] Using voice:', preferredVoice.name);
      } else {
        console.warn('[Browser TTS] No voice available, using default');
      }
      
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      
      let keepAliveInterval: NodeJS.Timeout | null = null;
      
      const cleanup = () => {
        if (keepAliveInterval) {
          clearInterval(keepAliveInterval);
          keepAliveInterval = null;
        }
        setIsSpeaking(false);
      };
      
      utterance.onstart = () => {
        console.log('[Browser TTS] Speech started');
        setIsSpeaking(true);
        
        // Chrome bug workaround: speech synthesis can pause after ~15 seconds
        // Keep it alive with periodic resume calls
        keepAliveInterval = setInterval(() => {
          if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
            // Don't call resume if not paused - just check it's still going
          } else if (window.speechSynthesis.paused) {
            console.log('[Browser TTS] Resuming paused speech');
            window.speechSynthesis.resume();
          }
        }, 3000);
      };
      
      utterance.onend = () => {
        console.log('[Browser TTS] Speech ended successfully');
        cleanup();
        resolve();
      };
      
      utterance.onerror = (event) => {
        console.error('[Browser TTS] Speech error:', event.error);
        cleanup();
        // Don't reject on 'interrupted' or 'canceled' - these are expected when stopping
        if (event.error === 'interrupted' || event.error === 'canceled') {
          resolve(); // Treat as success since it was intentional
        } else {
          reject(new Error(event.error));
        }
      };
      
      // Ensure speech synthesis is not paused before starting
      window.speechSynthesis.resume();
      
      // Queue the speech
      window.speechSynthesis.speak(utterance);
      console.log('[Browser TTS] Speech queued');
    });
  }, [getVoicesAsync]);

  // ElevenLabs TTS - now accepts webhook config
  const speakWithElevenLabs = useCallback(async (text: string, webhook?: WebhookSettings | null): Promise<void> => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ 
            text, 
            apiKey: webhook?.apiKey,
            voiceId: webhook?.agentId, // Use agentId as voiceId for TTS
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`TTS failed: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      if (data.audioContent) {
        return new Promise((resolve, reject) => {
          const audioUrl = `data:audio/mpeg;base64,${data.audioContent}`;
          audioRef.current = new Audio(audioUrl);
          
          audioRef.current.onplay = () => setIsSpeaking(true);
          audioRef.current.onended = () => {
            setIsSpeaking(false);
            resolve();
          };
          audioRef.current.onerror = () => {
            setIsSpeaking(false);
            reject(new Error('Audio playback failed'));
          };
          
          audioRef.current.play().catch(reject);
        });
      }
    } catch (err) {
      console.error('ElevenLabs TTS error:', err);
      throw err;
    }
  }, []);

  // Main speak function - uses webhook config to determine provider
  // Using ref to check if already speaking to avoid interruptions
  const speak = useCallback(async (text: string): Promise<void> => {
    if (!text.trim()) return;
    
    // Prevent multiple simultaneous speak calls
    if (isSpeakingRef.current) {
      console.log('[TTS] Already speaking, queuing or skipping');
      return;
    }
    
    isSpeakingRef.current = true;
    setError(null);
    
    try {
      // If we have a TTS webhook configured, use it based on type
      if (ttsWebhook) {
        if (ttsWebhook.type === 'elevenlabs') {
          await speakWithElevenLabs(text, ttsWebhook);
        } else {
          // For other webhook types, fall back to browser for now
          await speakWithBrowser(text);
        }
      } else {
        await speakWithBrowser(text);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'TTS failed';
      setError(errorMsg);
      
      // Fallback to browser if webhook TTS fails
      if (ttsWebhook) {
        console.warn(`${ttsWebhook.name} TTS failed, falling back to browser:`, err);
        try {
          await speakWithBrowser(text);
        } catch (fallbackErr) {
          console.error('Browser TTS fallback also failed:', fallbackErr);
        }
      }
    } finally {
      isSpeakingRef.current = false;
    }
  }, [ttsWebhook, speakWithBrowser, speakWithElevenLabs]);

  // Stop speaking
  const stopSpeaking = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  }, []);

  // ==================== STT ====================

  // Browser STT
  const startBrowserListening = useCallback((
    onTranscript: (text: string, isFinal: boolean) => void
  ): Promise<void> => {
    return new Promise((resolve, reject) => {
      const SpeechRecognitionClass = getSpeechRecognition();
      
      if (!SpeechRecognitionClass) {
        reject(new Error('Browser does not support speech recognition'));
        return;
      }

      const recognition = new SpeechRecognitionClass();
      recognitionRef.current = recognition;
      
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      
      recognition.onstart = () => {
        setIsListening(true);
        resolve();
      };
      
      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let interim = '';
        let final = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            final += result[0].transcript;
          } else {
            interim += result[0].transcript;
          }
        }
        
        if (final) {
          setTranscript(prev => prev + ' ' + final);
          onTranscript(final.trim(), true);
        }
        setInterimTranscript(interim);
        if (interim) {
          onTranscript(interim, false);
        }
      };
      
      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error('Speech recognition error:', event.error);
        if (event.error !== 'no-speech') {
          setError(event.error);
        }
      };
      
      recognition.onend = () => {
        setIsListening(false);
        // Auto-restart if still supposed to be listening
        if (recognitionRef.current) {
          try {
            recognition.start();
          } catch (e) {
            // Ignore - might be intentionally stopped
          }
        }
      };
      
      recognition.start();
    });
  }, []);

  // ElevenLabs STT (uses Scribe)
  const startElevenLabsListening = useCallback(async (
    onTranscript: (text: string, isFinal: boolean) => void
  ): Promise<void> => {
    // This would use the useScribe hook from @elevenlabs/react
    // For now, fall back to browser
    console.warn('ElevenLabs STT requires useScribe hook integration - using browser fallback');
    return startBrowserListening(onTranscript);
  }, [startBrowserListening]);

  // Main listen function - uses webhook config to determine provider
  const startListening = useCallback(async (
    onTranscript: (text: string, isFinal: boolean) => void
  ): Promise<void> => {
    setError(null);
    setTranscript('');
    setInterimTranscript('');
    
    try {
      // If we have an STT webhook configured, use it based on type
      if (sttWebhook && sttWebhook.type === 'elevenlabs') {
        await startElevenLabsListening(onTranscript);
      } else {
        await startBrowserListening(onTranscript);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'STT failed';
      setError(errorMsg);
      toast.error(errorMsg);
      throw err;
    }
  }, [sttWebhook, startBrowserListening, startElevenLabsListening]);

  // Stop listening
  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.abort();
      recognitionRef.current = null;
    }
    setIsListening(false);
    setInterimTranscript('');
  }, []);

  // Cleanup on unmount only - use refs to avoid dependency issues
  useEffect(() => {
    const audioRefCurrent = audioRef;
    const recognitionRefCurrent = recognitionRef;
    
    return () => {
      // Stop audio playback
      if (audioRefCurrent.current) {
        audioRefCurrent.current.pause();
        audioRefCurrent.current = null;
      }
      // Cancel browser TTS
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      // Stop speech recognition
      if (recognitionRefCurrent.current) {
        recognitionRefCurrent.current.abort();
        recognitionRefCurrent.current = null;
      }
    };
  }, []); // Empty deps - only run on mount/unmount

  // Check browser support
  const browserSupport = {
    tts: typeof window !== 'undefined' && 'speechSynthesis' in window,
    stt: typeof window !== 'undefined' && !!getSpeechRecognition(),
  };

  return {
    // State
    isSpeaking,
    isListening,
    transcript,
    interimTranscript,
    error,
    browserSupport,
    
    // TTS
    speak,
    stopSpeaking,
    
    // STT
    startListening,
    stopListening,
    
    // Direct access to providers
    speakWithBrowser,
    speakWithElevenLabs,
  };
}
