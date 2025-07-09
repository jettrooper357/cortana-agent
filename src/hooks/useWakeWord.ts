import { useState, useEffect, useRef, useCallback } from 'react';

interface UseWakeWordProps {
  onWakeWordDetected: () => void;
  isEnabled: boolean;
}

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export function useWakeWord({ onWakeWordDetected, isEnabled }: UseWakeWordProps) {
  const [isListening, setIsListening] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const restartTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Request microphone permission
  const requestPermission = useCallback(async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      setHasPermission(true);
      setError(null);
      console.log('Microphone permission granted');
      return true;
    } catch (err) {
      setHasPermission(false);
      setError('Microphone permission denied');
      console.error('Microphone permission denied:', err);
      return false;
    }
  }, []);

  // Start recognition with restart logic
  const startRecognition = useCallback(() => {
    if (!recognitionRef.current || isListening) return;
    
    try {
      recognitionRef.current.start();
      setIsListening(true);
      setError(null);
      console.log('Wake word detection started');
    } catch (err) {
      console.error('Failed to start wake word detection:', err);
      setError('Failed to start speech recognition');
      
      // Retry after delay
      if (restartTimeoutRef.current) {
        clearTimeout(restartTimeoutRef.current);
      }
      restartTimeoutRef.current = setTimeout(() => {
        console.log('Retrying wake word detection...');
        startRecognition();
      }, 2000);
    }
  }, [isListening]);

  // Stop recognition
  const stopRecognition = useCallback(() => {
    if (!recognitionRef.current || !isListening) return;
    
    try {
      recognitionRef.current.stop();
      setIsListening(false);
      console.log('Wake word detection stopped');
    } catch (err) {
      console.error('Failed to stop wake word detection:', err);
    }
    
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }
  }, [isListening]);

  // Initialize speech recognition
  useEffect(() => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      setError('Speech recognition not supported in this browser');
      console.warn('Speech recognition not supported');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      console.log('Speech recognition started');
      setIsListening(true);
      setError(null);
    };

    recognition.onend = () => {
      console.log('Speech recognition ended');
      setIsListening(false);
      
      // Auto-restart if still enabled
      if (isEnabled && hasPermission) {
        console.log('Auto-restarting wake word detection...');
        if (restartTimeoutRef.current) {
          clearTimeout(restartTimeoutRef.current);
        }
        restartTimeoutRef.current = setTimeout(() => {
          startRecognition();
        }, 1000);
      }
    };

    recognition.onresult = (event) => {
      const lastResult = event.results[event.results.length - 1];
      if (lastResult.isFinal) {
        const transcript = lastResult[0].transcript.toLowerCase().trim();
        console.log('Wake word detection heard:', transcript);
        
        if (transcript.includes('hey cortana') || transcript.includes('cortana')) {
          console.log('🎯 Wake word detected!');
          onWakeWordDetected();
        }
      }
    };

    recognition.onerror = (event) => {
      console.error('Wake word recognition error:', event.error);
      setError(`Recognition error: ${event.error}`);
      setIsListening(false);
      
      // Don't restart on certain errors
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setHasPermission(false);
        return;
      }
      
      // Auto-restart on other errors if still enabled
      if (isEnabled && hasPermission) {
        if (restartTimeoutRef.current) {
          clearTimeout(restartTimeoutRef.current);
        }
        restartTimeoutRef.current = setTimeout(() => {
          console.log('Restarting after error...');
          startRecognition();
        }, 3000);
      }
    };

    recognitionRef.current = recognition;

    return () => {
      if (restartTimeoutRef.current) {
        clearTimeout(restartTimeoutRef.current);
      }
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [onWakeWordDetected, isEnabled, hasPermission, startRecognition]);

  // Handle enable/disable state changes
  useEffect(() => {
    if (!recognitionRef.current) return;

    if (isEnabled && hasPermission === null) {
      // Request permission first time
      requestPermission().then((granted) => {
        if (granted) {
          startRecognition();
        }
      });
    } else if (isEnabled && hasPermission && !isListening) {
      startRecognition();
    } else if (!isEnabled && isListening) {
      stopRecognition();
    }
  }, [isEnabled, hasPermission, isListening, requestPermission, startRecognition, stopRecognition]);

  return { 
    isListening, 
    hasPermission, 
    error, 
    requestPermission 
  };
}