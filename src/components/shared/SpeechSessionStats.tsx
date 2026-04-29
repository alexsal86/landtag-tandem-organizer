import { useEffect, useState } from 'react';

interface SpeechSessionStatsProps {
  sessionStartTime: number | null;
  wordCount: number;
  isListening: boolean;
}

export function SpeechSessionStats({ sessionStartTime, wordCount, isListening }: SpeechSessionStatsProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!sessionStartTime || !isListening) {
      setElapsed(0);
      return;
    }
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - sessionStartTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [sessionStartTime, isListening]);

  if (!isListening) return null;

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;

  return (
    <span className="text-xs text-muted-foreground tabular-nums">
      {timeStr} · {wordCount} {wordCount === 1 ? 'Wort' : 'Wörter'}
    </span>
  );
}
