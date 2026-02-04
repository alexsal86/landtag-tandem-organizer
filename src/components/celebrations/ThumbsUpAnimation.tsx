import React, { useEffect, useState } from 'react';

interface ThumbsUpAnimationProps {
  speed?: 'slow' | 'normal' | 'fast';
  size?: 'small' | 'medium' | 'large';
  onComplete?: () => void;
}

const getSpeedDuration = (speed: string): number => {
  switch (speed) {
    case 'slow': return 3500;
    case 'fast': return 1800;
    default: return 2500;
  }
};

const getSizeValue = (size: string): number => {
  switch (size) {
    case 'small': return 60;
    case 'large': return 120;
    default: return 90;
  }
};

export function ThumbsUpAnimation({ speed = 'normal', size = 'medium', onComplete }: ThumbsUpAnimationProps) {
  const [shouldRender, setShouldRender] = useState(true);
  const duration = getSpeedDuration(speed);
  const sizeValue = getSizeValue(size);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShouldRender(false);
      onComplete?.();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onComplete]);

  if (!shouldRender) return null;

  return (
    <>
      <style>{`
        @keyframes thumbsFloat {
          0% {
            transform: translateY(0) scale(0.5) rotate(-15deg);
            opacity: 0;
          }
          20% {
            transform: translateY(-50px) scale(1.1) rotate(5deg);
            opacity: 1;
          }
          40% {
            transform: translateY(-100px) scale(1) rotate(-5deg);
            opacity: 1;
          }
          60% {
            transform: translateY(-150px) scale(1.05) rotate(3deg);
            opacity: 1;
          }
          80% {
            transform: translateY(-200px) scale(1) rotate(-2deg);
            opacity: 0.8;
          }
          100% {
            transform: translateY(-280px) scale(0.8) rotate(0deg);
            opacity: 0;
          }
        }
        
        @keyframes thumbsPulse {
          0%, 100% { filter: drop-shadow(0 0 10px rgba(255, 215, 0, 0.6)); }
          50% { filter: drop-shadow(0 0 25px rgba(255, 215, 0, 0.9)); }
        }
        
        .thumbs-container {
          position: fixed;
          left: 50%;
          bottom: 20%;
          margin-left: -${sizeValue / 2}px;
          animation: thumbsFloat ${duration}ms ease-out forwards;
        }
        
        .thumbs-emoji {
          font-size: ${sizeValue}px;
          animation: thumbsPulse 0.6s ease-in-out infinite;
        }
      `}</style>
      <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
        <div className="thumbs-container">
          <span className="thumbs-emoji">👍</span>
        </div>
      </div>
    </>
  );
}
