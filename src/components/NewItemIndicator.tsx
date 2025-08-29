import React from 'react';
import { cn } from '@/lib/utils';

interface NewItemIndicatorProps {
  isVisible: boolean;
  size?: 'sm' | 'default';
  className?: string;
}

export const NewItemIndicator: React.FC<NewItemIndicatorProps> = ({
  isVisible,
  size = 'default',
  className
}) => {
  if (!isVisible) return null;

  return (
    <div 
      className={cn(
        "absolute -top-1 -right-1 rounded-full bg-destructive border-2 border-background animate-pulse",
        size === 'sm' ? "w-3 h-3" : "w-4 h-4",
        className
      )}
      aria-hidden="true"
    />
  );
};