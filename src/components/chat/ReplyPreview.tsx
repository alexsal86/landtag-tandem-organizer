import React from 'react';
import { X, Reply } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ReplyPreviewProps {
  replyTo: {
    eventId: string;
    sender: string;
    content: string;
  };
  onCancel: () => void;
  className?: string;
}

export function ReplyPreview({ replyTo, onCancel, className }: ReplyPreviewProps) {
  return (
    <div className={cn(
      "flex items-center gap-2 p-2 border-l-2 border-primary bg-muted/50 rounded-r",
      className
    )}>
      <Reply className="h-4 w-4 text-muted-foreground flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-primary truncate">
          {replyTo.sender}
        </p>
        <p className="text-xs text-muted-foreground truncate">
          {replyTo.content}
        </p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 flex-shrink-0"
        onClick={onCancel}
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
}
