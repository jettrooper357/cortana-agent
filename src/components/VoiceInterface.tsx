import { useState } from 'react';
import CortanaHeader from '@/components/CortanaHeader';
import MessagesPanel from '@/components/MessagesPanel';
import VoiceControls from '@/components/VoiceControls';
import StatusIndicator from '@/components/StatusIndicator';
import GlowingRing from '@/components/GlowingRing';
import { Message } from '@/types/voice';
import cortanaAI from '@/assets/cortana-ai.jpg';

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
  const [isCortanaSpeaking, setIsCortanaSpeaking] = useState(false);

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
      
      // Simulate Cortana speaking
      setIsCortanaSpeaking(true);
      setTimeout(() => {
        setIsCortanaSpeaking(false);
      }, 3000);
    }, 2000);
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      <CortanaHeader />

      {/* Full Background Cortana Image */}
      <div 
        className="flex-1 relative bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${cortanaAI})` }}
      >
        <div className="absolute inset-0 bg-gradient-glow opacity-30 animate-pulse-glow"></div>
        <div className="absolute inset-0 bg-background/20"></div>
        
        {/* Glowing Ring Effect */}
        <GlowingRing isActive={isCortanaSpeaking} size={300} />
        
        <MessagesPanel messages={messages} isProcessing={isProcessing} />
        
        <VoiceControls 
          isRecording={isRecording}
          isProcessing={isProcessing}
          onStartRecording={handleStartRecording}
          onStopRecording={handleStopRecording}
        />

        <StatusIndicator isRecording={isRecording} isProcessing={isProcessing} />
      </div>
    </div>
  );
}