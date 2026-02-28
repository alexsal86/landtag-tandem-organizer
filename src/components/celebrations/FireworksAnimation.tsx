import React, { useEffect, useState, useRef } from 'react';
import { getCelebrationDuration } from './speed';

interface FireworksAnimationProps {
  speed?: 'slow' | 'normal' | 'fast';
  size?: 'small' | 'medium' | 'large';
  onComplete?: () => void;
}

const getExplosionCount = (size: string): number => {
  switch (size) {
    case 'small': return 2;
    case 'large': return 5;
    default: return 3;
  }
};

const COLORS = [
  ['#ff0000', '#ff6600', '#ffcc00'],
  ['#00ff00', '#00ff88', '#88ff00'],
  ['#0088ff', '#00ccff', '#8800ff'],
  ['#ff00ff', '#ff88ff', '#ff0088'],
  ['#ffd700', '#ffaa00', '#ff8800'],
];

interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  life: number;
  maxLife: number;
}

interface Explosion {
  id: number;
  x: number;
  y: number;
  particles: Particle[];
  delay: number;
  started: boolean;
}

export function FireworksAnimation({ speed = 'normal', size = 'medium', onComplete }: FireworksAnimationProps) {
  const [explosions, setExplosions] = useState<Explosion[]>([]);
  const [shouldRender, setShouldRender] = useState(true);
  const animationRef = useRef<number>(null);
  const startTimeRef = useRef<number>(0);
  const duration = getCelebrationDuration(speed);
  const explosionCount = getExplosionCount(size);

  useEffect(() => {
    // Initialize explosions
    const initialExplosions: Explosion[] = [];
    for (let i = 0; i < explosionCount; i++) {
      const colorSet = COLORS[Math.floor(Math.random() * COLORS.length)];
      const particles: Particle[] = [];
      const particleCount = 20 + Math.floor(Math.random() * 20);
      
      for (let j = 0; j < particleCount; j++) {
        const angle = (j / particleCount) * Math.PI * 2;
        const velocity = 3 + Math.random() * 4;
        particles.push({
          id: j,
          x: 0,
          y: 0,
          vx: Math.cos(angle) * velocity,
          vy: Math.sin(angle) * velocity,
          color: colorSet[Math.floor(Math.random() * colorSet.length)],
          size: 3 + Math.random() * 3,
          life: 1,
          maxLife: 0.8 + Math.random() * 0.4,
        });
      }

      initialExplosions.push({
        id: i,
        x: window.innerWidth * 0.2 + Math.random() * window.innerWidth * 0.6,
        y: window.innerHeight * 0.2 + Math.random() * window.innerHeight * 0.4,
        particles,
        delay: i * 300 + Math.random() * 200,
        started: false,
      });
    }
    setExplosions(initialExplosions);
    startTimeRef.current = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTimeRef.current;
      
      if (elapsed >= duration) {
        setShouldRender(false);
        onComplete?.();
        return;
      }

      setExplosions(prev => prev.map(exp => {
        if (!exp.started && elapsed >= exp.delay) {
          return { ...exp, started: true };
        }
        if (!exp.started) return exp;

        const updatedParticles = exp.particles.map(p => ({
          ...p,
          x: p.x + p.vx,
          y: p.y + p.vy,
          vy: p.vy + 0.1, // gravity
          life: p.life - 0.015,
        })).filter(p => p.life > 0);

        return { ...exp, particles: updatedParticles };
      }));

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [duration, explosionCount, onComplete]);

  if (!shouldRender) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {explosions.filter(e => e.started).map(exp => (
        <div key={exp.id}>
          {exp.particles.map(p => (
            <div
              key={`${exp.id}-${p.id}`}
              style={{
                position: 'absolute',
                left: exp.x + p.x,
                top: exp.y + p.y,
                width: p.size,
                height: p.size,
                backgroundColor: p.color,
                borderRadius: '50%',
                opacity: p.life,
                boxShadow: `0 0 ${p.size * 2}px ${p.color}`,
                transform: `scale(${p.life})`,
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
