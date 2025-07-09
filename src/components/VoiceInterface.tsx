import { useState, useEffect } from 'react';
import { useConversation } from '@11labs/react';
import CortanaHeader from '@/components/CortanaHeader';
import MessagesPanel from '@/components/MessagesPanel';
import VoiceControls from '@/components/VoiceControls';
import StatusIndicator from '@/components/StatusIndicator';
import GlowingRing from '@/components/GlowingRing';
import { Message } from '@/types/voice';
import cortanaAI from '@/assets/cortana-ai.jpg';

export default function VoiceInterface() {
  const conversation = useConversation();
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
  
  // Use ElevenLabs React SDK for reliable speaking detection
  const isCortanaSpeaking = conversation.isSpeaking || false;

  // Initialize ElevenLabs conversation
  useEffect(() => {
    const initConversation = async () => {
      try {
        console.log('Initializing ElevenLabs conversation...');
        await conversation.startSession({ 
          agentId: "agent_01jzp3zn2dek1vk4ztygtxzna6" 
        });
        console.log('ElevenLabs conversation initialized successfully');
      } catch (error) {
        console.error('Failed to initialize ElevenLabs conversation:', error);
      }
    };
    
    initConversation();
    
    return () => {
      conversation.endSession();
    };
  }, []);

  // Debug logging for speaking state
  useEffect(() => {
    console.log('Cortana speaking state changed:', isCortanaSpeaking);
  }, [isCortanaSpeaking]);

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
        
        {/* Enhanced Holographic Cortana Overlay when Speaking */}
        <div 
          className={`absolute inset-0 bg-cover bg-center bg-no-repeat transition-all duration-700 ease-out ${
            isCortanaSpeaking 
              ? 'opacity-80 scale-110 animate-pulse-glow' 
              : 'opacity-0 scale-95'
          }`}
          style={{ 
            backgroundImage: `url(/lovable-uploads/48c7a359-5a9a-4f2f-bb1c-71e5282e9b4b.png)`,
            mixBlendMode: 'screen',
            filter: 'brightness(1.5) contrast(1.3) saturate(1.2) hue-rotate(10deg)'
          }}
        />
        
        {/* Multi-layered Synthesized Halo Effects */}
        <div 
          className={`absolute inset-0 flex items-center justify-center transition-all duration-500 ${
            isCortanaSpeaking ? 'opacity-100' : 'opacity-0'
          }`}
        >
          {/* Outer energy ring */}
          <div className="relative">
            <div className="w-40 h-40 rounded-full bg-ai-glow/20 animate-ping" />
            <div className="absolute inset-0 w-40 h-40 rounded-full bg-gradient-to-r from-ai-glow/15 to-transparent animate-spin" />
          </div>
          
          {/* Middle energy ring */}
          <div className="absolute">
            <div className="w-32 h-32 rounded-full bg-ai-glow/30 animate-ping" style={{ animationDelay: '0.3s' }} />
            <div className="absolute inset-0 w-32 h-32 rounded-full bg-gradient-to-r from-ai-glow/25 to-transparent animate-spin" style={{ animationDelay: '0.15s' }} />
          </div>
          
          {/* Inner core */}
          <div className="absolute">
            <div className="w-24 h-24 rounded-full bg-ai-glow/40 animate-pulse" />
            <div className="absolute inset-2 w-20 h-20 rounded-full border-2 border-ai-glow/50 animate-pulse" style={{ animationDelay: '0.2s' }} />
            <div className="absolute inset-4 w-16 h-16 rounded-full bg-gradient-primary/30 animate-core-pulse" />
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