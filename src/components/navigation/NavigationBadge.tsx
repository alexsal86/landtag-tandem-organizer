import React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface NavigationBadgeProps {
  count: number;
  hasNew?: boolean;
  className?: string;
  size?: 'sm' | 'default';
}

export const NavigationBadge: React.FC<NavigationBadgeProps> = ({
  count,
  hasNew = false,
  className,
  size = 'default'
}) => {
  if (count === 0) return null;

  return (
    <div className="relative">
      <Badge 
        variant="destructive"
        className={cn(
          "flex items-center justify-center min-w-[1.25rem] font-medium transition-all",
          size === 'sm' ? "h-4 px-1.5 text-xs" : "h-5 px-2 text-xs",
          className
        )}
      >
        {count > 99 ? '99+' : count}
      </Badge>
    </div>
  );
};