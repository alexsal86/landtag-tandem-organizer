import { useState, useEffect } from 'react';

export const useTypewriter = (text: string, speed: number = 30) => {
  const [displayText, setDisplayText] = useState('');
  const [isComplete, setIsComplete] = useState(false);
  
  useEffect(() => {
    setDisplayText('');
    setIsComplete(false);
    
    if (!text) {
      setIsComplete(true);
      return;
    }
    
    let i = 0;
    let mounted = true;
    
    const timer = setInterval(() => {
      if (!mounted) {
        clearInterval(timer);
        return;
      }
      
      if (i < text.length) {
        setDisplayText(text.slice(0, i + 1));
        i++;
      } else {
        setIsComplete(true);
        clearInterval(timer);
      }
    }, speed);
    
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [text, speed]);
  
  return { displayText, isComplete };
};
