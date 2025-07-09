import { Mic, MicOff } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface VoiceControlsProps {
  isRecording: boolean;
  isProcessing: boolean;
  onStartRecording: () => void;
  onStopRecording: () => void;
}

export default function VoiceControls({ 
  isRecording, 
  isProcessing, 
  onStartRecording, 
  onStopRecording 
}: VoiceControlsProps) {
  return (
    <div className="absolute bottom-4 right-4">
      <div className="bg-gradient-card/95 backdrop-blur-sm border border-border rounded-2xl shadow-card p-6">
        <div className="flex flex-col items-center space-y-4">
          <Button
            onClick={isRecording ? onStopRecording : onStartRecording}
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
          
          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              {isRecording ? 'Recording...' : 
               isProcessing ? 'Processing...' : 
               'Click to start'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}