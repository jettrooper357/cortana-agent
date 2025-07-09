interface StatusIndicatorProps {
  isRecording: boolean;
  isProcessing: boolean;
}

export default function StatusIndicator({ isRecording, isProcessing }: StatusIndicatorProps) {
  return (
    <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2">
      <div className={`px-4 py-2 rounded-full border text-sm font-medium transition-all duration-300 bg-gradient-card/95 backdrop-blur-sm ${
        isRecording 
          ? 'border-voice-active text-voice-active animate-recording-pulse' 
          : isProcessing 
          ? 'border-ai-pulse text-ai-pulse animate-pulse' 
          : 'border-border text-foreground'
      }`}>
        {isRecording ? 'Listening...' : 
         isProcessing ? 'Processing...' : 
         'Ready'}
      </div>
    </div>
  );
}