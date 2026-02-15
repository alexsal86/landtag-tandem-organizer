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

  const hornGradientId = React.useId();
  const maneGradientId = React.useId();
  const maneGradientSoftId = React.useId();
  const tailGradientId = React.useId();
  const coatGradientId = React.useId();
  const shadowGradientId = React.useId();

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

        @keyframes unicornBob {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-6px); }
        }

        @keyframes legStepFront {
          0%, 100% { transform: rotate(10deg); }
          50% { transform: rotate(-10deg); }
        }

        @keyframes legStepBack {
          0%, 100% { transform: rotate(-8deg); }
          50% { transform: rotate(8deg); }
        }

        @keyframes blink {
          0%, 44%, 48%, 100% { transform: scaleY(1); }
          46% { transform: scaleY(0.15); }
        }

        @keyframes shimmer {
          0%, 100% { opacity: 0.2; }
          50% { opacity: 0.55; }
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
          animation: unicornFade ${duration}ms ease-out forwards, unicornBob 420ms ease-in-out infinite;
        }

        .sparkles {
          animation: shimmer 1.4s ease-in-out infinite;
        }

        .sparkles circle,
        .sparkles path {
          filter: drop-shadow(0 0 2px currentColor);
        }

        .unicorn-eye {
          transform-origin: 60px 65px;
          animation: blink 3.5s ease-in-out infinite;
        }

        .leg-front {
          transform-origin: center 122px;
          animation: legStepFront 260ms ease-in-out infinite;
        }

        .leg-back {
          transform-origin: center 122px;
          animation: legStepBack 260ms ease-in-out infinite;
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
            <defs>
              <linearGradient id={hornGradientId} x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#ffd700" />
                <stop offset="50%" stopColor="#ffed4e" />
                <stop offset="100%" stopColor="#fbbf24" />
              </linearGradient>
              <linearGradient id={maneGradientId} x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#ff0000" />
                <stop offset="16%" stopColor="#ff8000" />
                <stop offset="33%" stopColor="#ffff00" />
                <stop offset="50%" stopColor="#00ff00" />
                <stop offset="66%" stopColor="#0080ff" />
                <stop offset="83%" stopColor="#8000ff" />
                <stop offset="100%" stopColor="#ff0080" />
              </linearGradient>
              <linearGradient id={maneGradientSoftId} x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#ff4080" />
                <stop offset="16%" stopColor="#ff8040" />
                <stop offset="33%" stopColor="#ffff40" />
                <stop offset="50%" stopColor="#40ff40" />
                <stop offset="66%" stopColor="#4080ff" />
                <stop offset="83%" stopColor="#8040ff" />
                <stop offset="100%" stopColor="#ff4080" />
              </linearGradient>
              <linearGradient id={tailGradientId} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="25%" stopColor="#ffe7f5" />
                <stop offset="50%" stopColor="#d7f4ff" />
                <stop offset="100%" stopColor="#f3e9ff" />
              </linearGradient>
              <linearGradient id={coatGradientId} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="50%" stopColor="#f8fbff" />
                <stop offset="100%" stopColor="#edf2f9" />
              </linearGradient>
              <radialGradient id={shadowGradientId} cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#91a1b5" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#91a1b5" stopOpacity="0" />
              </radialGradient>
            </defs>

            <ellipse cx="100" cy="145" rx="55" ry="8" fill={`url(#${shadowGradientId})`} opacity="0.35" />
            <ellipse cx="100" cy="100" rx="40" ry="25" fill={`url(#${coatGradientId})`} stroke="#dbe4ef" strokeWidth="2" />
            <ellipse cx="70" cy="70" rx="25" ry="20" fill="#ffffff" stroke="#dbe4ef" strokeWidth="2" />
            <path d="M 130 90 Q 152 88 158 100" stroke="#ffffff" strokeOpacity="0.7" strokeWidth="3" fill="none" strokeLinecap="round" />

            <polygon points="70,45 75,18 65,18" fill={`url(#${hornGradientId})`} stroke="#ffd26f" strokeWidth="1" />
            <path d="M 45 60 Q 35 45 50 35 Q 40 25 55 20 Q 45 10 60 15 Q 50 5 70 10 Q 60 0 80 5 Q 70 -5 90 0" fill="none" stroke={`url(#${maneGradientId})`} strokeWidth="8" strokeLinecap="round" />
            <path d="M 48 65 Q 38 50 53 40 Q 43 30 58 25 Q 48 15 63 20 Q 53 10 73 15 Q 63 5 83 10 Q 73 0 93 5" fill="none" stroke={`url(#${maneGradientSoftId})`} strokeWidth="6" strokeLinecap="round" />

            <g className="unicorn-eye">
              <circle cx="60" cy="65" r="4" fill="#2b2d42" />
            </g>
            <circle cx="62" cy="63" r="1.5" fill="#ffffff" />
            <ellipse cx="50" cy="75" rx="2.4" ry="1.2" fill="#ff9eb8" />
            <path d="M 59 74 Q 64 77 68 74" stroke="#ff7aa2" strokeWidth="1.2" fill="none" strokeLinecap="round" />

            <rect className="leg-front" x="75" y="120" width="6" height="20" fill="#e9eef5" rx="3" />
            <rect className="leg-back" x="85" y="120" width="6" height="20" fill="#e9eef5" rx="3" />
            <rect className="leg-back" x="105" y="120" width="6" height="20" fill="#e9eef5" rx="3" />
            <rect className="leg-front" x="115" y="120" width="6" height="20" fill="#e9eef5" rx="3" />
            <ellipse cx="78" cy="145" rx="4" ry="2" fill="#696969" />
            <ellipse cx="88" cy="145" rx="4" ry="2" fill="#696969" />
            <ellipse cx="108" cy="145" rx="4" ry="2" fill="#696969" />
            <ellipse cx="118" cy="145" rx="4" ry="2" fill="#696969" />

            <path d="M 140 95 Q 160 85 170 105 Q 175 120 165 135 Q 155 145 145 130 Q 150 115 145 105" fill={`url(#${tailGradientId})`} stroke={`url(#${maneGradientId})`} strokeWidth="2" />

            <g className="sparkles">
              <path d="M 30 37 L 32 41 L 36 42 L 32 44 L 31 48 L 28 44 L 24 42 L 28 40 Z" fill="#ffe169" opacity="0.8">
                <animate attributeName="opacity" values="0.8;0.3;0.8" dur="1.1s" repeatCount="indefinite" />
              </path>
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
          </svg>
        </div>
      </div>
    </>
  );
}
