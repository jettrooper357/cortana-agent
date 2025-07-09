import { Card } from '@/components/ui/card';

interface Message {
  id: string;
  content: string;
  type: 'user' | 'jarvis';
  timestamp: Date;
}

interface MessagesPanelProps {
  messages: Message[];
  isProcessing: boolean;
}

export default function MessagesPanel({ messages, isProcessing }: MessagesPanelProps) {
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <div className="absolute left-4 top-4 bottom-4 w-80 bg-gradient-card/95 backdrop-blur-sm border border-border rounded-2xl shadow-card">
      <div className="h-full overflow-y-auto p-4 space-y-4">
        <h2 className="text-lg font-semibold text-foreground mb-4">Conversation</h2>
        {messages.map((message) => (
          <div
            key={message.id}
            className="animate-fade-in-up"
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
  );
}