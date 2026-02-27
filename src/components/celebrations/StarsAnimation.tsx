import React, { useEffect, useState, useRef } from 'react';
import { getCelebrationDuration } from './speed';

interface StarsAnimationProps {
  speed?: 'slow' | 'normal' | 'fast';
  size?: 'small' | 'medium' | 'large';
  onComplete?: () => void;
}

const getStarCount = (size: string): number => {
  switch (size) {
    case 'small': return 10;
    case 'large': return 30;
    default: return 20;
  }
};

interface Star {
  id: number;
  x: number;
  y: number;
  size: number;
  rotation: number;
  opacity: number;
  color: string;
  velocityY: number;
  rotationSpeed: number;
  twinkleOffset: number;
}

const COLORS = ['#ffd700', '#ffed4e', '#fff8dc', '#c0c0c0', '#e6e6fa'];

export function StarsAnimation({ speed = 'normal', size = 'medium', onComplete }: StarsAnimationProps) {
  const [stars, setStars] = useState<Star[]>([]);
  const [shouldRender, setShouldRender] = useState(true);
  const animationRef = useRef<number>();
  const startTimeRef = useRef<number>(0);
  const duration = getCelebrationDuration(speed);
  const starCount = getStarCount(size);

  useEffect(() => {
    // Initialize stars
    const initialStars: Star[] = [];
    for (let i = 0; i < starCount; i++) {
      initialStars.push({
        id: i,
        x: Math.random() * window.innerWidth,
        y: window.innerHeight + 20 + Math.random() * 100,
        size: 15 + Math.random() * 25,
        rotation: Math.random() * 360,
        opacity: 0.7 + Math.random() * 0.3,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        velocityY: -2 - Math.random() * 2,
        rotationSpeed: (Math.random() - 0.5) * 5,
        twinkleOffset: Math.random() * Math.PI * 2,
      });
    }
    setStars(initialStars);
    startTimeRef.current = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTimeRef.current;
      
      if (elapsed >= duration) {
        setShouldRender(false);
        onComplete?.();
        return;
      }

      setStars(prev => prev.map(s => ({
        ...s,
        y: s.y + s.velocityY,
        rotation: s.rotation + s.rotationSpeed,
        opacity: Math.max(0, Math.min(1, s.opacity + Math.sin((elapsed / 100) + s.twinkleOffset) * 0.02)),
      })));

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [duration, starCount, onComplete]);

  if (!shouldRender) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {stars.map(s => (
        <svg
          key={s.id}
          style={{
            position: 'absolute',
            left: s.x - s.size / 2,
            top: s.y - s.size / 2,
            width: s.size,
            height: s.size,
            transform: `rotate(${s.rotation}deg)`,
            opacity: s.opacity,
            filter: `drop-shadow(0 0 ${s.size / 3}px ${s.color})`,
          }}
          viewBox="0 0 24 24"
        >
          <path
            d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
            fill={s.color}
          />
        </svg>
      ))}
    </div>
  );
}
