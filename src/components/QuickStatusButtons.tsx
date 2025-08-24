import React from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useUserStatus } from '@/hooks/useUserStatus';
import { Coffee, Users, Clock, Zap } from 'lucide-react';

export const QuickStatusButtons: React.FC = () => {
  const { quickSetStatus, currentStatus, getStatusDisplay } = useUserStatus();

  const quickStatuses = [
    {
      type: 'online' as const,
      icon: Zap,
      emoji: '🟢',
      label: 'Online',
      color: 'hsl(142, 76%, 36%)'
    },
    {
      type: 'meeting' as const,
      icon: Users,
      emoji: '🔴',
      label: 'Meeting',
      color: 'hsl(0, 84%, 60%)'
    },
    {
      type: 'break' as const,
      icon: Coffee,
      emoji: '🟡',
      label: 'Pause',
      color: 'hsl(48, 96%, 53%)'
    },
    {
      type: 'away' as const,
      icon: Clock,
      emoji: '🟠',
      label: 'Abwesend',
      color: 'hsl(25, 95%, 53%)'
    }
  ];

  const currentDisplay = getStatusDisplay(currentStatus);

  return (
    <TooltipProvider>
      <div className="flex items-center gap-1">
        {/* Current Status Indicator */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge 
              variant="outline" 
              className="flex items-center gap-1 px-2 py-1 cursor-default"
            >
              <span className="text-sm">{currentDisplay.emoji}</span>
              <span className="text-xs font-medium max-w-[80px] truncate">
                {currentDisplay.label}
              </span>
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>Aktueller Status: {currentDisplay.label}</p>
          </TooltipContent>
        </Tooltip>

        {/* Quick Status Buttons */}
        {quickStatuses.map((status) => {
          const isActive = currentStatus?.status_type === status.type;
          
          return (
            <Tooltip key={status.type}>
              <TooltipTrigger asChild>
                <Button
                  variant={isActive ? "default" : "ghost"}
                  size="sm"
                  className={`h-8 w-8 p-0 transition-all duration-200 ${
                    isActive 
                      ? 'bg-primary text-primary-foreground' 
                      : 'hover:bg-secondary/80'
                  }`}
                  onClick={() => quickSetStatus(status.type)}
                  disabled={isActive}
                >
                  <span className="text-sm">{status.emoji}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Status auf "{status.label}" setzen</p>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
};