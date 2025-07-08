import { useState } from 'react';
import { Mic, MicOff, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface Message {
  id: string;
  content: string;
  type: 'user' | 'jarvis';
  timestamp: Date;
}

export default function VoiceInterface() {
  const [isRecording, setIsRecording] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      content: 'Hello! I am Jarvis, your AI assistant. How can I help you today?',
      type: 'jarvis',
      timestamp: new Date()
    }
  ]);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleStartRecording = async () => {
    try {
      // Request microphone access
      await navigator.mediaDevices.getUserMedia({ audio: true });
      setIsRecording(true);
      
      // TODO: Implement actual voice recording with ElevenLabs
      console.log('Recording started...');
      
      // Simulate recording for now
      setTimeout(() => {
        handleStopRecording();
      }, 3000);
    } catch (error) {
      console.error('Error accessing microphone:', error);
    }
  };

  const handleStopRecording = () => {
    setIsRecording(false);
    setIsProcessing(true);
    
    // TODO: Process recording and send to webhook
    // For now, simulate a response
    setTimeout(() => {
      const userMessage: Message = {
        id: Date.now().toString(),
        content: 'This is a simulated transcription of your voice input.',
        type: 'user',
        timestamp: new Date()
      };
      
      const jarvisResponse: Message = {
        id: (Date.now() + 1).toString(),
        content: 'I received your message and I am processing it. This is a simulated response from the webhook.',
        type: 'jarvis',
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, userMessage, jarvisResponse]);
      setIsProcessing(false);
    }, 2000);
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <div className="flex items-center justify-center py-6 border-b border-border bg-gradient-card shadow-soft">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-full bg-gradient-primary animate-pulse-glow"></div>
          <h1 className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            JARVIS
          </h1>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in-up`}
          >
            <Card className={`max-w-md p-4 shadow-card ${
              message.type === 'user' 
                ? 'bg-primary text-primary-foreground ml-12' 
                : 'bg-gradient-card border-border mr-12'
            }`}>
              <div className="flex items-start space-x-3">
                {message.type === 'jarvis' && (
                  <div className="w-6 h-6 rounded-full bg-gradient-primary flex-shrink-0 mt-1 animate-pulse-glow"></div>
                )}
                <div className="flex-1">
                  <p className="text-sm leading-relaxed">{message.content}</p>
                  <span className="text-xs opacity-70 mt-2 block">
                    {formatTime(message.timestamp)}
                  </span>
                </div>
              </div>
            </Card>
          </div>
        ))}
        
        {isProcessing && (
          <div className="flex justify-start animate-fade-in-up">
            <Card className="max-w-md p-4 shadow-card bg-gradient-card border-border mr-12">
              <div className="flex items-center space-x-3">
                <div className="w-6 h-6 rounded-full bg-gradient-primary animate-pulse-glow"></div>
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-ai-glow rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-ai-glow rounded-full animate-bounce delay-100"></div>
                  <div className="w-2 h-2 bg-ai-glow rounded-full animate-bounce delay-200"></div>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>

      {/* Voice Input Area */}
      <div className="p-6 border-t border-border bg-gradient-card">
        <div className="flex items-center justify-center">
          <Button
            onClick={isRecording ? handleStopRecording : handleStartRecording}
            disabled={isProcessing}
            className={`w-16 h-16 rounded-full border-2 transition-all duration-300 ${
              isRecording 
                ? 'bg-voice-active border-voice-active animate-recording-pulse hover:bg-voice-active/80' 
                : 'bg-secondary border-voice-inactive hover:border-ai-glow hover:shadow-glow'
            }`}
          >
            {isRecording ? (
              <MicOff className="w-6 h-6" />
            ) : (
              <Mic className="w-6 h-6" />
            )}
          </Button>
        </div>
        
        <div className="text-center mt-4">
          <p className="text-sm text-muted-foreground">
            {isRecording ? 'Recording... Click to stop' : 
             isProcessing ? 'Processing your request...' : 
             'Click to start recording'}
          </p>
        </div>
      </div>
    </div>
  );
}