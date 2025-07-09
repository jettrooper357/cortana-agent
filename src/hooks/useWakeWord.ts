import { useState, useEffect, useRef } from 'react';

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
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      console.warn('Speech recognition not supported');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      const lastResult = event.results[event.results.length - 1];
      if (lastResult.isFinal) {
        const transcript = lastResult[0].transcript.toLowerCase().trim();
        console.log('Wake word detection heard:', transcript);
        
        if (transcript.includes('hey cortana') || transcript.includes('cortana')) {
          console.log('Wake word detected!');
          onWakeWordDetected();
        }
      }
    };

    recognition.onerror = (event) => {
      console.error('Wake word recognition error:', event.error);
      // Don't restart automatically on errors to prevent infinite loops
    };

    recognition.onend = () => {
      setIsListening(false);
      console.log('Speech recognition ended');
      // Auto-restart if still enabled and not manually stopped
      if (isEnabled && recognitionRef.current) {
        setTimeout(() => {
          if (isEnabled && recognitionRef.current) {
            try {
              recognitionRef.current.start();
              setIsListening(true);
              console.log('Auto-restarting wake word detection...');
            } catch (error) {
              console.error('Failed to auto-restart wake word detection:', error);
            }
          }
        }, 1000); // Wait 1 second before restarting
      }
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [onWakeWordDetected]);

  useEffect(() => {
    if (!recognitionRef.current) return;

    if (isEnabled && !isListening) {
      try {
        recognitionRef.current.start();
        setIsListening(true);
        console.log('Wake word detection started');
      } catch (error) {
        console.error('Failed to start wake word detection:', error);
      }
    } else if (!isEnabled && isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
      console.log('Wake word detection stopped');
    }
  }, [isEnabled, isListening]);

  return { isListening };
}