import React from 'react';
import { Check, CheckCheck, Clock, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export type MessageStatusType = 'sending' | 'sent' | 'delivered' | 'read' | 'error';

interface MessageStatusProps {
  status: MessageStatusType;
  className?: string;
}

const statusConfig: Record<MessageStatusType, { icon: React.ReactNode; label: string; color: string }> = {
  sending: { 
    icon: <Clock className="h-3 w-3" />, 
    label: 'Wird gesendet...', 
    color: 'text-muted-foreground' 
  },
  sent: { 
    icon: <Check className="h-3 w-3" />, 
    label: 'Gesendet', 
    color: 'text-muted-foreground' 
  },
  delivered: { 
    icon: <CheckCheck className="h-3 w-3" />, 
    label: 'Zugestellt', 
    color: 'text-muted-foreground' 
  },
  read: { 
    icon: <CheckCheck className="h-3 w-3" />, 
    label: 'Gelesen', 
    color: 'text-blue-500' 
  },
  error: { 
    icon: <AlertCircle className="h-3 w-3" />, 
    label: 'Fehler beim Senden', 
    color: 'text-destructive' 
  },
};

export function MessageStatus({ status, className }: MessageStatusProps) {
  const config = statusConfig[status];

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={cn("inline-flex", config.color, className)}>
            {config.icon}
          </span>
        </TooltipTrigger>
        <TooltipContent side="left" className="text-xs">
          {config.label}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
