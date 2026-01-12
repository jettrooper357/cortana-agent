import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type VoiceProvider = 'browser' | 'elevenlabs';

interface VoiceServicesConfig {
  ttsProvider: VoiceProvider;
  sttProvider: VoiceProvider;
  elevenLabsVoiceId?: string;
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

const DEFAULT_CONFIG: VoiceServicesConfig = {
  ttsProvider: 'browser',
  sttProvider: 'browser',
};

export function useVoiceServices(config: Partial<VoiceServicesConfig> = {}) {
  // Use refs to always have current config values in callbacks
  const ttsProvider = config.ttsProvider ?? 'browser';
  const sttProvider = config.sttProvider ?? 'browser';
  const elevenLabsVoiceId = config.elevenLabsVoiceId;
  
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const synthRef = useRef<SpeechSynthesisUtterance | null>(null);

  // ==================== TTS ====================

  // Browser TTS
  const speakWithBrowser = useCallback((text: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (!('speechSynthesis' in window)) {
        reject(new Error('Browser does not support speech synthesis'));
        return;
      }

      // Cancel any ongoing speech
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      synthRef.current = utterance;
      
      // Try to get a nice voice
      const voices = window.speechSynthesis.getVoices();
      const preferredVoice = voices.find(v => 
        v.name.includes('Samantha') || 
        v.name.includes('Google') || 
        v.name.includes('Microsoft') ||
        v.lang.startsWith('en')
      ) || voices[0];
      
      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }
      
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => {
        setIsSpeaking(false);
        resolve();
      };
      utterance.onerror = (event) => {
        setIsSpeaking(false);
        reject(new Error(event.error));
      };
      
      window.speechSynthesis.speak(utterance);
    });
  }, []);

  // ElevenLabs TTS
  const speakWithElevenLabs = useCallback(async (text: string, voiceId?: string): Promise<void> => {
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
          body: JSON.stringify({ text, voiceId }),
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

  // Main speak function
  const speak = useCallback(async (text: string): Promise<void> => {
    if (!text.trim()) return;
    
    setError(null);
    
    try {
      if (ttsProvider === 'elevenlabs') {
        await speakWithElevenLabs(text, elevenLabsVoiceId);
      } else {
        await speakWithBrowser(text);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'TTS failed';
      setError(errorMsg);
      
      // Fallback to browser if ElevenLabs fails
      if (ttsProvider === 'elevenlabs') {
        console.warn('ElevenLabs TTS failed, falling back to browser:', err);
        try {
          await speakWithBrowser(text);
        } catch (fallbackErr) {
          console.error('Browser TTS fallback also failed:', fallbackErr);
        }
      }
    }
  }, [ttsProvider, elevenLabsVoiceId, speakWithBrowser, speakWithElevenLabs]);

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

  // Main listen function
  const startListening = useCallback(async (
    onTranscript: (text: string, isFinal: boolean) => void
  ): Promise<void> => {
    setError(null);
    setTranscript('');
    setInterimTranscript('');
    
    try {
      if (sttProvider === 'elevenlabs') {
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
  }, [sttProvider, startBrowserListening, startElevenLabsListening]);

  // Stop listening
  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.abort();
      recognitionRef.current = null;
    }
    setIsListening(false);
    setInterimTranscript('');
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopSpeaking();
      stopListening();
    };
  }, [stopSpeaking, stopListening]);

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
