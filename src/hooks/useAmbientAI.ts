import { useState, useCallback, useRef, useEffect } from 'react';
import { useScribe, CommitStrategy } from '@elevenlabs/react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface GuardianResponse {
  shouldSpeak: boolean;
  response?: string | null;
  alertLevel?: 'none' | 'info' | 'warning' | 'critical';
  observation?: string;
  error?: string;
}

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AmbientAIConfig {
  onSpeaking?: (isSpeaking: boolean) => void;
  onTranscript?: (transcript: string, isFinal: boolean) => void;
  onResponse?: (response: string) => void;
  onAlert?: (level: string, message: string) => void;
}

export function useAmbientAI(config: AmbientAIConfig = {}) {
  const [isActive, setIsActive] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  const conversationHistoryRef = useRef<ConversationMessage[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const processingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastProcessedTranscriptRef = useRef<string>('');

  // ElevenLabs realtime STT
  const scribe = useScribe({
    modelId: 'scribe_v2_realtime',
    commitStrategy: CommitStrategy.VAD,
    onPartialTranscript: (data) => {
      setCurrentTranscript(data.text);
      config.onTranscript?.(data.text, false);
    },
    onCommittedTranscript: (data) => {
      if (data.text && data.text.trim() !== lastProcessedTranscriptRef.current.trim()) {
        lastProcessedTranscriptRef.current = data.text;
        config.onTranscript?.(data.text, true);
        processInput(data.text);
      }
      setCurrentTranscript('');
    },
  });

  // Process user input through AI guardian
  const processInput = useCallback(async (transcript: string) => {
    if (!transcript.trim() || isProcessing || isSpeaking) return;

    setIsProcessing(true);
    
    try {
      // Add user message to history
      conversationHistoryRef.current.push({
        role: 'user',
        content: transcript,
      });

      const { data, error: invokeError } = await supabase.functions.invoke('ai-guardian', {
        body: {
          transcript,
          conversationHistory: conversationHistoryRef.current.slice(-10),
        },
      });

      if (invokeError) throw invokeError;

      const response = data as GuardianResponse;

      if (response.error) {
        if (response.error.includes('Rate limit')) {
          toast.error('AI rate limit exceeded. Please wait a moment.');
        } else if (response.error.includes('Payment')) {
          toast.error('AI credits depleted. Please add funds.');
        }
        return;
      }

      if (response.shouldSpeak && response.response) {
        // Add assistant response to history
        conversationHistoryRef.current.push({
          role: 'assistant',
          content: response.response,
        });
        
        config.onResponse?.(response.response);
        
        if (response.alertLevel && response.alertLevel !== 'none') {
          config.onAlert?.(response.alertLevel, response.response);
        }
        
        await speak(response.response);
      }
    } catch (err) {
      console.error('AI guardian error:', err);
      setError(err instanceof Error ? err.message : 'Processing failed');
    } finally {
      setIsProcessing(false);
    }
  }, [isProcessing, isSpeaking, config]);

  // Text-to-speech
  const speak = useCallback(async (text: string) => {
    if (!text.trim()) return;

    setIsSpeaking(true);
    config.onSpeaking?.(true);

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
          body: JSON.stringify({ text }),
        }
      );

      if (!response.ok) {
        throw new Error(`TTS failed: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.audioContent) {
        const audioUrl = `data:audio/mpeg;base64,${data.audioContent}`;
        audioRef.current = new Audio(audioUrl);
        
        audioRef.current.onended = () => {
          setIsSpeaking(false);
          config.onSpeaking?.(false);
        };
        
        audioRef.current.onerror = () => {
          setIsSpeaking(false);
          config.onSpeaking?.(false);
        };
        
        await audioRef.current.play();
      }
    } catch (err) {
      console.error('TTS error:', err);
      setIsSpeaking(false);
      config.onSpeaking?.(false);
    }
  }, [config]);

  // Start ambient listening
  const start = useCallback(async () => {
    try {
      setError(null);
      
      // Request microphone permission
      await navigator.mediaDevices.getUserMedia({ audio: true });

      // Get scribe token
      const { data, error: tokenError } = await supabase.functions.invoke('elevenlabs-scribe-token');
      
      if (tokenError || !data?.token) {
        throw new Error(tokenError?.message || 'Failed to get scribe token');
      }

      // Start realtime transcription
      await scribe.connect({
        token: data.token,
        microphone: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      setIsActive(true);
      setIsListening(true);
      
      toast.success('Cortana is now listening');
    } catch (err) {
      console.error('Failed to start ambient AI:', err);
      setError(err instanceof Error ? err.message : 'Failed to start');
      toast.error('Failed to start listening. Check microphone permissions.');
    }
  }, [scribe]);

  // Stop ambient listening
  const stop = useCallback(() => {
    scribe.disconnect();
    
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    
    if (processingTimeoutRef.current) {
      clearTimeout(processingTimeoutRef.current);
    }
    
    setIsActive(false);
    setIsListening(false);
    setIsSpeaking(false);
    setIsProcessing(false);
    setCurrentTranscript('');
    
    toast.info('Cortana stopped listening');
  }, [scribe]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      if (processingTimeoutRef.current) {
        clearTimeout(processingTimeoutRef.current);
      }
    };
  }, []);

  // Sync listening state with scribe
  useEffect(() => {
    setIsListening(scribe.isConnected);
  }, [scribe.isConnected]);

  return {
    // State
    isActive,
    isListening,
    isSpeaking,
    isProcessing,
    currentTranscript,
    partialTranscript: scribe.partialTranscript,
    committedTranscripts: scribe.committedTranscripts,
    error,
    
    // Actions
    start,
    stop,
    speak,
    processInput,
    
    // Conversation
    conversationHistory: conversationHistoryRef.current,
    clearHistory: () => { conversationHistoryRef.current = []; },
  };
}
