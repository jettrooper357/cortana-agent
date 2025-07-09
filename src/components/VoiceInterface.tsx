import { useState, useEffect } from 'react';
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

  // Listen for ElevenLabs widget events to detect speaking
  useEffect(() => {
    const handleWidgetEvents = (event: any) => {
      if (event.data && event.data.type === 'elevenlabs') {
        switch (event.data.event) {
          case 'agent_speaking_started':
            setIsCortanaSpeaking(true);
            break;
          case 'agent_speaking_ended':
          case 'conversation_ended':
            setIsCortanaSpeaking(false);
            break;
        }
      }
    };

    window.addEventListener('message', handleWidgetEvents);
    return () => window.removeEventListener('message', handleWidgetEvents);
  }, []);

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
        
        {/* Holographic Cortana Overlay when Speaking */}
        <div 
          className={`absolute inset-0 bg-cover bg-center bg-no-repeat transition-all duration-1000 ${
            isCortanaSpeaking 
              ? 'opacity-60 scale-105 animate-pulse-glow' 
              : 'opacity-0 scale-100'
          }`}
          style={{ 
            backgroundImage: `url(/lovable-uploads/48c7a359-5a9a-4f2f-bb1c-71e5282e9b4b.png)`,
            mixBlendMode: 'screen',
            filter: 'brightness(1.3) contrast(1.2) saturate(1.1)'
          }}
        />
        
        {/* Synthesized Halo Effect */}
        <div 
          className={`absolute inset-0 flex items-center justify-center transition-all duration-1000 ${
            isCortanaSpeaking ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <div className="relative">
            <div className="w-32 h-32 rounded-full bg-ai-glow/30 animate-ping" />
            <div className="absolute inset-0 w-32 h-32 rounded-full bg-gradient-to-r from-ai-glow/20 to-transparent animate-spin" />
            <div className="absolute inset-2 w-28 h-28 rounded-full border-2 border-ai-glow/40 animate-pulse" />
          </div>
        </div>
        
        {/* Glowing Ring Effect */}
        <GlowingRing isActive={isCortanaSpeaking} size={300} />
        
        {/* ElevenLabs Conversational AI Widget */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div 
            dangerouslySetInnerHTML={{
              __html: '<elevenlabs-convai agent-id="agent_01jzp3zn2dek1vk4ztygtxzna6"></elevenlabs-convai>'
            }}
          />
        </div>
      </div>
    </div>
  );
}