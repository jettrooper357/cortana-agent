export default function CortanaHeader() {
  return (
    <div className="flex items-center justify-center py-6 border-b border-border bg-gradient-card shadow-soft">
      <div className="flex items-center space-x-3">
        <div className="w-8 h-8 rounded-full bg-gradient-primary animate-pulse-glow"></div>
        <h1 className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
          CORTANA
        </h1>
      </div>
    </div>
  );
}