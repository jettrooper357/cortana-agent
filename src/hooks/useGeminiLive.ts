import { useState, useCallback, useRef, useEffect } from 'react';
import { GoogleGenAI, Modality, Session } from '@google/genai';
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
}

// Server message type for Gemini Live API
interface ServerContent {
  interrupted?: boolean;
  turnComplete?: boolean;
  modelTurn?: {
    parts?: Array<{
      text?: string;
      inlineData?: {
        data: string;
        mimeType?: string;
      };
    }>;
  };
}

interface LiveServerMessage {
  serverContent?: ServerContent;
  clientContent?: {
    turnComplete?: boolean;
  };
}

/**
 * useGeminiLive - Real-time bidirectional audio streaming with Gemini Live API
 * 
 * This hook provides TRUE bidirectional audio conversation:
 * - WebSocket connection to Gemini Live API
 * - Real-time audio input from microphone
 * - Real-time audio output from Gemini
 * - Automatic speech detection and turn-taking
 * 
 * Uses @google/genai SDK with the Live API.
 */
export function useGeminiLive(config: GeminiLiveConfig = {}) {
  const { getVoiceProviderConfig } = useSettings();
  const [state, setState] = useState<SessionState>('idle');
  const [isActive, setIsActive] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [conversationHistory, setConversationHistory] = useState<ConversationMessage[]>([]);
  const [error, setError] = useState<string | null>(null);

  const sessionRef = useRef<Session | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const inputContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const audioQueueRef = useRef<Float32Array[]>([]);
  const isPlayingRef = useRef(false);
  const isActiveRef = useRef(false);

  // Keep ref in sync with state
  useEffect(() => {
    isActiveRef.current = isActive;
  }, [isActive]);

  // Update state and notify
  const updateState = useCallback((newState: SessionState) => {
    setState(newState);
    config.onStateChange?.(newState);
  }, [config]);

  // Play audio from queue
  const playAudioQueue = useCallback(async () => {
    if (isPlayingRef.current || audioQueueRef.current.length === 0) return;
    
    isPlayingRef.current = true;
    updateState('speaking');
    
    const ctx = audioContextRef.current;
    if (!ctx) {
      isPlayingRef.current = false;
      return;
    }
    
    while (audioQueueRef.current.length > 0) {
      const audioData = audioQueueRef.current.shift()!;
      const buffer = ctx.createBuffer(1, audioData.length, 24000);
      buffer.copyToChannel(new Float32Array(audioData), 0);
      
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      
      await new Promise<void>((resolve) => {
        source.onended = () => resolve();
        source.start();
      });
    }
    
    isPlayingRef.current = false;
    if (isActiveRef.current) {
      updateState('listening');
    }
  }, [updateState]);

  // Process incoming messages from Gemini
  const handleServerMessage = useCallback((message: LiveServerMessage) => {
    console.log('[GeminiLive] Server message:', message);

    // Handle transcription (user's speech recognized)
    if (message.clientContent?.turnComplete) {
      updateState('processing');
    }

    // Handle model response
    if (message.serverContent) {
      const serverContent = message.serverContent;
      
      // Check for interruption
      if (serverContent.interrupted) {
        console.log('[GeminiLive] Response interrupted');
        audioQueueRef.current = [];
        return;
      }

      // Handle text parts
      if (serverContent.modelTurn?.parts) {
        for (const part of serverContent.modelTurn.parts) {
          // Handle text response
          if (part.text) {
            const text = part.text;
            setCurrentTranscript(text);
            config.onTranscript?.(text, false);
            
            // Add to history
            setConversationHistory(prev => {
              const last = prev[prev.length - 1];
              if (last?.role === 'assistant') {
                return [
                  ...prev.slice(0, -1),
                  { ...last, content: last.content + text }
                ];
              }
              return [...prev, { role: 'assistant', content: text, timestamp: new Date() }];
            });
            
            config.onResponse?.(text);
          }
          
          // Handle audio response
          if (part.inlineData?.data) {
            const audioData = part.inlineData.data;
            // Decode base64 PCM audio
            const binaryStr = atob(audioData);
            const bytes = new Uint8Array(binaryStr.length);
            for (let i = 0; i < binaryStr.length; i++) {
              bytes[i] = binaryStr.charCodeAt(i);
            }
            // Convert to Int16 then Float32
            const int16 = new Int16Array(bytes.buffer);
            const float32 = new Float32Array(int16.length);
            for (let i = 0; i < int16.length; i++) {
              float32[i] = int16[i] / 32768;
            }
            audioQueueRef.current.push(float32);
            playAudioQueue();
          }
        }
      }

      // Check if generation is complete
      if (serverContent.turnComplete) {
        console.log('[GeminiLive] Model turn complete');
        if (isActiveRef.current && !isPlayingRef.current) {
          updateState('listening');
        }
      }
    }
  }, [config, updateState, playAudioQueue]);

  // Start session
  const start = useCallback(async () => {
    try {
      setError(null);
      updateState('connecting');

      // Get provider config to check for API key
      const providerConfig = getVoiceProviderConfig();
      let apiKey: string | undefined;
      
      if (providerConfig.type === 'conversational-ai' && providerConfig.ai) {
        apiKey = providerConfig.ai.apiKey;
      }

      if (!apiKey) {
        throw new Error('Gemini API key is required for Live Audio. Please configure it in Settings → Conversational AI.');
      }

      // Initialize Google GenAI
      const ai = new GoogleGenAI({ apiKey });

      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        } 
      });
      mediaStreamRef.current = stream;

      // Create AudioContext for playback
      audioContextRef.current = new AudioContext({ sampleRate: 24000 });

      // Connect to Gemini Live API
      console.log('[GeminiLive] Connecting to Live API...');
      
      const session = await ai.live.connect({
        model: 'gemini-2.0-flash-exp',
        config: {
          responseModalities: [Modality.AUDIO, Modality.TEXT],
          systemInstruction: config.systemInstruction || `You are Cortana, an AI assistant. 
Be concise, warm, and helpful.
Keep responses under 2 sentences when possible.
Use natural, conversational language.`,
        },
        callbacks: {
          onopen: () => {
            console.log('[GeminiLive] Connected');
            toast.success('Connected to Gemini Live');
          },
          onmessage: (msg) => handleServerMessage(msg as LiveServerMessage),
          onerror: (e) => {
            console.error('[GeminiLive] Error:', e);
            const errorMsg = e instanceof Error ? e.message : 'Connection error';
            setError(errorMsg);
            config.onError?.(errorMsg);
          },
          onclose: (e) => {
            console.log('[GeminiLive] Disconnected:', e?.reason);
            if (isActiveRef.current) {
              setIsActive(false);
              updateState('idle');
            }
          },
        },
      });
      
      sessionRef.current = session;
      setIsActive(true);
      updateState('listening');

      // Set up audio capture using ScriptProcessor
      const inputContext = new AudioContext({ sampleRate: 16000 });
      inputContextRef.current = inputContext;
      const source = inputContext.createMediaStreamSource(stream);
      const processor = inputContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;
      
      processor.onaudioprocess = (e) => {
        if (!sessionRef.current || !isActiveRef.current) return;
        
        const inputData = e.inputBuffer.getChannelData(0);
        // Convert Float32 to Int16
        const int16 = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        
        // Convert to base64
        const uint8 = new Uint8Array(int16.buffer);
        let binary = '';
        for (let i = 0; i < uint8.length; i++) {
          binary += String.fromCharCode(uint8[i]);
        }
        const base64 = btoa(binary);
        
        // Send audio to Gemini
        try {
          session.sendRealtimeInput({
            audio: {
              data: base64,
              mimeType: 'audio/pcm;rate=16000',
            },
          });
        } catch (err) {
          console.error('[GeminiLive] Failed to send audio:', err);
        }
      };
      
      source.connect(processor);
      processor.connect(inputContext.destination);

      toast.success('Gemini Live Audio started');
    } catch (err) {
      console.error('[GeminiLive] Failed to start:', err);
      const errorMsg = err instanceof Error ? err.message : 'Failed to start';
      setError(errorMsg);
      config.onError?.(errorMsg);
      updateState('idle');
      toast.error(errorMsg);
    }
  }, [config, updateState, handleServerMessage, getVoiceProviderConfig]);

  // Stop session
  const stop = useCallback(() => {
    console.log('[GeminiLive] Stopping...');
    
    // Close session
    if (sessionRef.current) {
      try {
        sessionRef.current.close();
      } catch (err) {
        console.error('[GeminiLive] Error closing session:', err);
      }
      sessionRef.current = null;
    }
    
    // Disconnect processor
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    
    // Close input context
    if (inputContextRef.current) {
      inputContextRef.current.close();
      inputContextRef.current = null;
    }
    
    // Stop media stream
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    
    // Close audio context
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    // Clear audio queue
    audioQueueRef.current = [];
    isPlayingRef.current = false;
    
    setIsActive(false);
    updateState('idle');
    setCurrentTranscript('');
    
    toast.info('Gemini Live Audio stopped');
  }, [updateState]);

  // Clear conversation history
  const clearHistory = useCallback(() => {
    setConversationHistory([]);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (sessionRef.current) {
        try {
          sessionRef.current.close();
        } catch {
          // Ignore
        }
      }
      if (processorRef.current) {
        processorRef.current.disconnect();
      }
      if (inputContextRef.current) {
        inputContextRef.current.close();
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  return {
    // State
    state,
    isActive,
    currentTranscript,
    conversationHistory,
    error,
    
    // Actions
    start,
    stop,
    clearHistory,
  };
}
