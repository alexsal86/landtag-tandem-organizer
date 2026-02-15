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
    case 'small': return { width: 130, height: 95 };
    case 'large': return { width: 300, height: 220 };
    default: return { width: 220, height: 160 };
  }
};

export function UnicornAnimation({ speed = 'normal', size = 'medium', onComplete }: UnicornAnimationProps) {
  const [shouldRender, setShouldRender] = useState(true);
  const duration = getSpeedDuration(speed);
  const dimensions = getSizeDimensions(size);

  const bodyGradientId = React.useId();
  const hornGradientId = React.useId();
  const maneGradientId = React.useId();
  const tailGradientId = React.useId();
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
          0% { transform: translateX(-300px) translateY(52vh); }
          100% { transform: translateX(calc(100vw + 80px)) translateY(52vh); }
        }

        @keyframes unicornFade {
          0% { opacity: 0; }
          8% { opacity: 1; }
          78% { opacity: 1; }
          100% { opacity: 0; }
        }

        @keyframes unicornBounce {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }

        @keyframes legFront {
          0%, 100% { transform: rotate(12deg); }
          50% { transform: rotate(-12deg); }
        }

        @keyframes legBack {
          0%, 100% { transform: rotate(-10deg); }
          50% { transform: rotate(10deg); }
        }

        @keyframes tailSway {
          0%, 100% { transform: rotate(8deg); }
          50% { transform: rotate(-8deg); }
        }

        .unicorn-container {
          position: absolute;
          top: 0;
          left: 0;
          width: ${dimensions.width}px;
          height: ${dimensions.height}px;
          animation: unicornRun ${duration}ms linear forwards;
        }

        .unicorn-svg {
          animation: unicornFade ${duration}ms ease-out forwards, unicornBounce 330ms ease-in-out infinite;
          filter: drop-shadow(3px 4px 7px rgba(0, 0, 0, 0.2));
        }

        .leg-front {
          transform-origin: center 138px;
          animation: legFront 240ms ease-in-out infinite;
        }

        .leg-back {
          transform-origin: center 138px;
          animation: legBack 240ms ease-in-out infinite;
        }

        .tail {
          transform-origin: 167px 95px;
          animation: tailSway 260ms ease-in-out infinite;
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
          <svg width={dimensions.width} height={dimensions.height} viewBox="0 0 220 160" className="unicorn-svg" role="img" aria-label="Laufendes Einhorn">
            <defs>
              <linearGradient id={bodyGradientId} x1="20%" y1="0%" x2="80%" y2="100%">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="100%" stopColor="#edf3ff" />
              </linearGradient>
              <linearGradient id={hornGradientId} x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#fff1a8" />
                <stop offset="100%" stopColor="#f6b73c" />
              </linearGradient>
              <linearGradient id={maneGradientId} x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#ff77c8" />
                <stop offset="35%" stopColor="#8f7dff" />
                <stop offset="70%" stopColor="#5cc9ff" />
                <stop offset="100%" stopColor="#79e7b7" />
              </linearGradient>
              <linearGradient id={tailGradientId} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ffd8f0" />
                <stop offset="50%" stopColor="#9fc8ff" />
                <stop offset="100%" stopColor="#a7f3d0" />
              </linearGradient>
              <radialGradient id={shadowGradientId} cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#7b8ca8" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#7b8ca8" stopOpacity="0" />
              </radialGradient>
            </defs>

            <ellipse cx="110" cy="150" rx="62" ry="9" fill={`url(#${shadowGradientId})`} />

            <g>
              <ellipse cx="114" cy="100" rx="54" ry="30" fill={`url(#${bodyGradientId})`} stroke="#d9e3f2" strokeWidth="2.5" />

              <path d="M 78 85 C 62 78, 54 60, 72 50 C 78 46, 87 46, 95 52" fill="none" stroke={`url(#${maneGradientId})`} strokeWidth="13" strokeLinecap="round" />
              <path d="M 86 82 C 76 73, 74 62, 83 57 C 88 54, 95 56, 101 62" fill="none" stroke="#ffe7fb" strokeWidth="6" strokeLinecap="round" opacity="0.8" />

              <g className="tail">
                <path d="M 166 96 C 182 90, 194 102, 190 117 C 186 133, 173 140, 160 130 C 164 117, 160 106, 166 96 Z" fill={`url(#${tailGradientId})`} stroke="#8b78ff" strokeWidth="2" />
              </g>

              <ellipse cx="72" cy="69" rx="25" ry="20" fill={`url(#${bodyGradientId})`} stroke="#d9e3f2" strokeWidth="2.5" />
              <polygon points="71,45 78,16 66,17" fill={`url(#${hornGradientId})`} stroke="#e8a93a" strokeWidth="1" />
              <path d="M 64 49 L 71 44 L 76 50" fill="none" stroke="#ffd8f1" strokeWidth="2" strokeLinecap="round" />

              <ellipse cx="63" cy="69" rx="4.5" ry="5" fill="#243047" />
              <circle cx="64.5" cy="67.2" r="1.2" fill="#fff" />
              <path d="M 52 78 Q 61 84 70 79" fill="none" stroke="#f394b8" strokeWidth="1.8" strokeLinecap="round" />

              <rect className="leg-front" x="86" y="122" width="9" height="24" rx="4.5" fill="#f1f5fd" stroke="#d5dff0" strokeWidth="1.2" />
              <rect className="leg-back" x="101" y="122" width="9" height="24" rx="4.5" fill="#f1f5fd" stroke="#d5dff0" strokeWidth="1.2" />
              <rect className="leg-back" x="122" y="122" width="9" height="24" rx="4.5" fill="#f1f5fd" stroke="#d5dff0" strokeWidth="1.2" />
              <rect className="leg-front" x="137" y="122" width="9" height="24" rx="4.5" fill="#f1f5fd" stroke="#d5dff0" strokeWidth="1.2" />

              <ellipse cx="90" cy="149" rx="5" ry="2.4" fill="#667085" />
              <ellipse cx="105" cy="149" rx="5" ry="2.4" fill="#667085" />
              <ellipse cx="126" cy="149" rx="5" ry="2.4" fill="#667085" />
              <ellipse cx="141" cy="149" rx="5" ry="2.4" fill="#667085" />
            </g>

            <g opacity="0.85">
              <circle cx="20" cy="52" r="2" fill="#ffd866">
                <animate attributeName="opacity" values="0.9;0.3;0.9" dur="1.2s" repeatCount="indefinite" />
              </circle>
              <circle cx="34" cy="34" r="1.6" fill="#ff89d7">
                <animate attributeName="opacity" values="0.8;0.2;0.8" dur="1.6s" repeatCount="indefinite" />
              </circle>
              <circle cx="194" cy="62" r="1.7" fill="#87ceff">
                <animate attributeName="opacity" values="0.9;0.2;0.9" dur="1.0s" repeatCount="indefinite" />
              </circle>
            </g>
          </svg>
        </div>
      </div>
    </>
  );
}
