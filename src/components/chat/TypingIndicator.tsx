import React from 'react';
import { cn } from '@/lib/utils';

interface TypingIndicatorProps {
  typingUsers: string[];
  className?: string;
}

export function TypingIndicator({ typingUsers, className }: TypingIndicatorProps) {
  if (typingUsers.length === 0) return null;

  const getTypingText = () => {
    if (typingUsers.length === 1) {
      return `${typingUsers[0]} tippt...`;
    }
    if (typingUsers.length === 2) {
      return `${typingUsers[0]} und ${typingUsers[1]} tippen...`;
    }
    return `${typingUsers[0]} und ${typingUsers.length - 1} weitere tippen...`;
  };

  return (
    <div className={cn("flex items-center gap-2 px-4 py-2 text-xs text-muted-foreground", className)}>
      <div className="flex gap-1">
        <span className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
      <span>{getTypingText()}</span>
    </div>
  );
}
