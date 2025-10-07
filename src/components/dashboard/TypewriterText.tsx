import { useEffect, useMemo } from 'react';
import { useTypewriter } from '@/hooks/useTypewriter';

interface TypewriterTextProps {
  text: string;
  speed?: number;
  className?: string;
  onComplete?: () => void;
}

export const TypewriterText = ({ text, speed = 30, className = '', onComplete }: TypewriterTextProps) => {
  const { displayText, isComplete } = useTypewriter(text, speed);
  
  useEffect(() => {
    if (isComplete && onComplete) {
      onComplete();
    }
  }, [isComplete, onComplete]);
  
  // Parse text for bold markers (**text**)
  const parsedContent = useMemo(() => {
    const parts = displayText.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        const boldText = part.slice(2, -2);
        return <strong key={index} className="font-bold">{boldText}</strong>;
      }
      return part;
    });
  }, [displayText]);
  
  return (
    <span className={className}>
      {parsedContent}
      {!isComplete && <span className="animate-pulse">|</span>}
    </span>
  );
};
