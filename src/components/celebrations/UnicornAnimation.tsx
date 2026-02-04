import React, { useEffect, useState } from 'react';

interface UnicornAnimationProps {
  speed?: 'slow' | 'normal' | 'fast';
  size?: 'small' | 'medium' | 'large';
  onComplete?: () => void;
}

const getSpeedDuration = (speed: string): number => {
  switch (speed) {
    case 'slow': return 4000;
    case 'fast': return 2000;
    default: return 2800;
  }
};

const getSizeDimensions = (size: string): { width: number; height: number } => {
  switch (size) {
    case 'small': return { width: 120, height: 90 };
    case 'large': return { width: 280, height: 210 };
    default: return { width: 200, height: 150 };
  }
};

export function UnicornAnimation({ speed = 'normal', size = 'medium', onComplete }: UnicornAnimationProps) {
  const [shouldRender, setShouldRender] = useState(true);
  const duration = getSpeedDuration(speed);
  const dimensions = getSizeDimensions(size);

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
        @keyframes unicornRun {
          0% { transform: translateX(-250px) translateY(50vh); }
          50% { transform: translateX(50vw) translateY(50vh); }
          100% { transform: translateX(calc(100vw + 50px)) translateY(50vh); }
        }
        
        @keyframes unicornFade {
          0% { opacity: 1; transform: scale(1); }
          70% { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(0.8); }
        }
        
        .unicorn-container {
          position: absolute;
          top: 0;
          left: 0;
          width: ${dimensions.width}px;
          height: ${dimensions.height}px;
          animation: unicornRun ${duration}ms ease-out forwards;
        }
        
        .unicorn-svg {
          filter: drop-shadow(2px 2px 4px rgba(0, 0, 0, 0.2));
          animation: unicornFade ${duration}ms ease-out forwards;
        }
        
        .sparkles circle {
          filter: drop-shadow(0 0 2px currentColor);
        }
      `}</style>
      <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
        <div className="unicorn-container">
          <svg
            width={dimensions.width}
            height={dimensions.height}
            viewBox="0 0 200 150"
            className="unicorn-svg"
          >
          <ellipse cx="100" cy="100" rx="40" ry="25" fill="#f8f9fa" stroke="#e9ecef" strokeWidth="2" />
          <ellipse cx="70" cy="70" rx="25" ry="20" fill="#ffffff" stroke="#e9ecef" strokeWidth="2" />
          <polygon points="70,45 75,20 65,20" fill="url(#hornGradient)" stroke="#ffd700" strokeWidth="1" />
          <path d="M 45 60 Q 35 45 50 35 Q 40 25 55 20 Q 45 10 60 15 Q 50 5 70 10 Q 60 0 80 5 Q 70 -5 90 0" fill="none" stroke="url(#rainbowGradient)" strokeWidth="8" strokeLinecap="round" />
          <path d="M 48 65 Q 38 50 53 40 Q 43 30 58 25 Q 48 15 63 20 Q 53 10 73 15 Q 63 5 83 10 Q 73 0 93 5" fill="none" stroke="url(#rainbowGradient2)" strokeWidth="6" strokeLinecap="round" />
          <circle cx="60" cy="65" r="4" fill="#000000" />
          <circle cx="62" cy="63" r="1.5" fill="#ffffff" />
          <ellipse cx="50" cy="75" rx="2" ry="1" fill="#ffb3ba" />
          <rect x="75" y="120" width="6" height="20" fill="#e9ecef" rx="3" />
          <rect x="85" y="120" width="6" height="20" fill="#e9ecef" rx="3" />
          <rect x="105" y="120" width="6" height="20" fill="#e9ecef" rx="3" />
          <rect x="115" y="120" width="6" height="20" fill="#e9ecef" rx="3" />
          <ellipse cx="78" cy="145" rx="4" ry="2" fill="#696969" />
          <ellipse cx="88" cy="145" rx="4" ry="2" fill="#696969" />
          <ellipse cx="108" cy="145" rx="4" ry="2" fill="#696969" />
          <ellipse cx="118" cy="145" rx="4" ry="2" fill="#696969" />
          <path d="M 140 95 Q 160 85 170 105 Q 175 120 165 135 Q 155 145 145 130 Q 150 115 145 105" fill="url(#tailGradient)" stroke="url(#rainbowGradient)" strokeWidth="2" />
          <g className="sparkles">
            <circle cx="30" cy="40" r="2" fill="#ffd700" opacity="0.8">
              <animate attributeName="opacity" values="0.8;0.2;0.8" dur="1s" repeatCount="indefinite" />
            </circle>
            <circle cx="150" cy="30" r="1.5" fill="#ff69b4" opacity="0.6">
              <animate attributeName="opacity" values="0.6;0.1;0.6" dur="1.2s" repeatCount="indefinite" />
            </circle>
            <circle cx="170" cy="60" r="1" fill="#87ceeb" opacity="0.7">
              <animate attributeName="opacity" values="0.7;0.2;0.7" dur="0.8s" repeatCount="indefinite" />
            </circle>
            <circle cx="20" cy="80" r="1.5" fill="#98fb98" opacity="0.5">
              <animate attributeName="opacity" values="0.5;0.1;0.5" dur="1.5s" repeatCount="indefinite" />
            </circle>
            <circle cx="180" cy="100" r="2" fill="#dda0dd" opacity="0.6">
              <animate attributeName="opacity" values="0.6;0.2;0.6" dur="0.9s" repeatCount="indefinite" />
            </circle>
          </g>
          <defs>
            <linearGradient id="hornGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#ffd700" />
              <stop offset="50%" stopColor="#ffed4e" />
              <stop offset="100%" stopColor="#fbbf24" />
            </linearGradient>
            <linearGradient id="rainbowGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#ff0000" />
              <stop offset="16%" stopColor="#ff8000" />
              <stop offset="33%" stopColor="#ffff00" />
              <stop offset="50%" stopColor="#00ff00" />
              <stop offset="66%" stopColor="#0080ff" />
              <stop offset="83%" stopColor="#8000ff" />
              <stop offset="100%" stopColor="#ff0080" />
            </linearGradient>
            <linearGradient id="rainbowGradient2" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#ff4080" />
              <stop offset="16%" stopColor="#ff8040" />
              <stop offset="33%" stopColor="#ffff40" />
              <stop offset="50%" stopColor="#40ff40" />
              <stop offset="66%" stopColor="#4080ff" />
              <stop offset="83%" stopColor="#8040ff" />
              <stop offset="100%" stopColor="#ff4080" />
            </linearGradient>
            <linearGradient id="tailGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="50%" stopColor="#f8f9fa" />
              <stop offset="100%" stopColor="#e9ecef" />
            </linearGradient>
          </defs>
        </svg>
        </div>
      </div>
    </>
  );
}
