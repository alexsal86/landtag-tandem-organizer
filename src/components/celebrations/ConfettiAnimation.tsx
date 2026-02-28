import React, { useEffect, useState, useRef } from 'react';
import { getCelebrationDuration } from './speed';

interface ConfettiAnimationProps {
  speed?: 'slow' | 'normal' | 'fast';
  size?: 'small' | 'medium' | 'large';
  onComplete?: () => void;
}

const getParticleCount = (size: string): number => {
  switch (size) {
    case 'small': return 30;
    case 'large': return 100;
    default: return 60;
  }
};

const COLORS = ['#ff0000', '#ff8000', '#ffff00', '#00ff00', '#00ffff', '#0080ff', '#8000ff', '#ff00ff', '#ff69b4', '#ffd700'];

interface Particle {
  id: number;
  x: number;
  y: number;
  rotation: number;
  color: string;
  size: number;
  velocityY: number;
  velocityX: number;
  rotationSpeed: number;
  shape: 'rect' | 'circle';
}

export function ConfettiAnimation({ speed = 'normal', size = 'medium', onComplete }: ConfettiAnimationProps) {
  const [particles, setParticles] = useState<Particle[]>([]);
  const [shouldRender, setShouldRender] = useState(true);
  const animationRef = useRef<number>(null);
  const startTimeRef = useRef<number>(0);
  const duration = getCelebrationDuration(speed);
  const particleCount = getParticleCount(size);

  useEffect(() => {
    // Initialize particles
    const initialParticles: Particle[] = [];
    for (let i = 0; i < particleCount; i++) {
      initialParticles.push({
        id: i,
        x: Math.random() * window.innerWidth,
        y: -20 - Math.random() * 100,
        rotation: Math.random() * 360,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        size: 6 + Math.random() * 8,
        velocityY: 2 + Math.random() * 3,
        velocityX: (Math.random() - 0.5) * 3,
        rotationSpeed: (Math.random() - 0.5) * 10,
        shape: Math.random() > 0.5 ? 'rect' : 'circle',
      });
    }
    setParticles(initialParticles);
    startTimeRef.current = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTimeRef.current;
      
      if (elapsed >= duration) {
        setShouldRender(false);
        onComplete?.();
        return;
      }

      setParticles(prev => prev.map(p => ({
        ...p,
        y: p.y + p.velocityY,
        x: p.x + p.velocityX + Math.sin(p.y / 30) * 0.5,
        rotation: p.rotation + p.rotationSpeed,
      })));

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [duration, particleCount, onComplete]);

  if (!shouldRender) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {particles.map(p => (
        <div
          key={p.id}
          style={{
            position: 'absolute',
            left: p.x,
            top: p.y,
            width: p.size,
            height: p.shape === 'rect' ? p.size * 0.6 : p.size,
            backgroundColor: p.color,
            borderRadius: p.shape === 'circle' ? '50%' : '2px',
            transform: `rotate(${p.rotation}deg)`,
            opacity: Math.min(1, (window.innerHeight - p.y) / 200),
          }}
        />
      ))}
    </div>
  );
}
