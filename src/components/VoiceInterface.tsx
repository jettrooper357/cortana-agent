import { useState } from 'react';
import { Mic, MicOff, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import cortanaAI from '@/assets/cortana-ai.jpg';

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
      content: 'Hello! I am Cortana, your AI assistant. How can I help you today?',
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
            CORTANA
          </h1>
        </div>
      </div>

      <div className="flex-1 flex">
        {/* Messages Panel - Left Side */}
        <div className="w-1/3 border-r border-border">
          <div className="h-full overflow-y-auto p-4 space-y-4">
            <h2 className="text-lg font-semibold text-foreground mb-4">Conversation</h2>
            {messages.map((message) => (
              <div
                key={message.id}
                className={`animate-fade-in-up`}
              >
                <Card className={`p-3 shadow-card ${
                  message.type === 'user' 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-gradient-card border-border'
                }`}>
                  <div className="flex items-start space-x-3">
                    {message.type === 'jarvis' && (
                      <div className="w-4 h-4 rounded-full bg-gradient-primary flex-shrink-0 mt-1 animate-pulse-glow"></div>
                    )}
                    <div className="flex-1">
                      <p className="text-xs leading-relaxed">{message.content}</p>
                      <span className="text-xs opacity-70 mt-1 block">
                        {formatTime(message.timestamp)}
                      </span>
                    </div>
                  </div>
                </Card>
              </div>
            ))}
            
            {isProcessing && (
              <div className="animate-fade-in-up">
                <Card className="p-3 shadow-card bg-gradient-card border-border">
                  <div className="flex items-center space-x-3">
                    <div className="w-4 h-4 rounded-full bg-gradient-primary animate-pulse-glow"></div>
                    <div className="flex space-x-1">
                      <div className="w-1.5 h-1.5 bg-ai-glow rounded-full animate-bounce"></div>
                      <div className="w-1.5 h-1.5 bg-ai-glow rounded-full animate-bounce delay-100"></div>
                      <div className="w-1.5 h-1.5 bg-ai-glow rounded-full animate-bounce delay-200"></div>
                    </div>
                  </div>
                </Card>
              </div>
            )}
          </div>
        </div>

        {/* Central Cortana Display */}
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="relative">
            <div className="relative z-10">
              <img 
                src={cortanaAI} 
                alt="Cortana AI Interface"
                className="w-96 h-56 object-cover rounded-2xl shadow-card border border-border"
              />
              <div className="absolute inset-0 bg-gradient-glow rounded-2xl animate-pulse-glow"></div>
            </div>
            
            {/* Status Indicator */}
            <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2">
              <div className={`px-4 py-2 rounded-full border text-sm font-medium transition-all duration-300 ${
                isRecording 
                  ? 'bg-voice-active border-voice-active text-background animate-recording-pulse' 
                  : isProcessing 
                  ? 'bg-ai-pulse border-ai-pulse text-background animate-pulse' 
                  : 'bg-secondary border-border text-foreground'
              }`}>
                {isRecording ? 'Listening...' : 
                 isProcessing ? 'Processing...' : 
                 'Ready'}
              </div>
            </div>
          </div>
        </div>

        {/* Controls Panel - Right Side */}
        <div className="w-1/3 border-l border-border">
          <div className="h-full flex flex-col p-6">
            <h2 className="text-lg font-semibold text-foreground mb-6">Voice Controls</h2>
            
            <div className="flex-1 flex items-center justify-center">
              <Button
                onClick={isRecording ? handleStopRecording : handleStartRecording}
                disabled={isProcessing}
                className={`w-20 h-20 rounded-full border-2 transition-all duration-300 ${
                  isRecording 
                    ? 'bg-voice-active border-voice-active animate-recording-pulse hover:bg-voice-active/80' 
                    : 'bg-secondary border-voice-inactive hover:border-ai-glow hover:shadow-glow'
                }`}
              >
                {isRecording ? (
                  <MicOff className="w-8 h-8" />
                ) : (
                  <Mic className="w-8 h-8" />
                )}
              </Button>
            </div>
            
            <div className="text-center">
              <p className="text-sm text-muted-foreground">
                {isRecording ? 'Recording... Click to stop' : 
                 isProcessing ? 'Processing your request...' : 
                 'Click to start recording'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}