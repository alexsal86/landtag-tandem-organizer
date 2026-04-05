import { cn } from '@/lib/utils';

interface NotificationDotProps {
  visible: boolean;
  className?: string;
}

export function NotificationDot({ visible, className }: NotificationDotProps) {
  if (!visible) return null;

  return (
    <span
      className={cn(
        "h-2 w-2 rounded-full bg-destructive animate-pulse",
        className
      )}
    />
  );
}
