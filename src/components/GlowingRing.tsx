import { useEffect, useState } from 'react';

interface GlowingRingProps {
  isActive: boolean;
  size?: number;
}

export default function GlowingRing({ isActive, size = 200 }: GlowingRingProps) {
  const [rings] = useState([1, 2, 3]); // Multiple rings for layered effect

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      {rings.map((ring) => (
        <div
          key={ring}
          className={`absolute rounded-full border-2 transition-all duration-1000 ${
            isActive 
              ? 'border-ai-glow shadow-glow animate-pulse-ring' 
              : 'border-ai-glow/20 scale-75 opacity-0'
          }`}
          style={{
            width: size + (ring * 20),
            height: size + (ring * 20),
            animationDelay: `${ring * 0.2}s`,
          }}
        />
      ))}
      
      {/* Central glowing core */}
      <div
        className={`absolute rounded-full bg-ai-glow/20 transition-all duration-500 ${
          isActive 
            ? 'scale-100 opacity-100 animate-core-pulse' 
            : 'scale-50 opacity-0'
        }`}
        style={{
          width: size * 0.3,
          height: size * 0.3,
        }}
      />
    </div>
  );
}