import React from 'react';
import { Circle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useUserStatus } from '@/hooks/useUserStatus';

export const CompactStatusSelector: React.FC = () => {
  const { statusOptions, currentStatus, quickSetStatus } = useUserStatus();

  const currentStatusDisplay = currentStatus ? {
    emoji: currentStatus.emoji || '●',
    color: currentStatus.color || '#22c55e',
    label: currentStatus.status_type || 'Verfügbar'
  } : { emoji: '●', color: '#22c55e', label: 'Verfügbar' };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 rounded-full"
          aria-label={`Status: ${currentStatusDisplay.label}`}
        >
          <div 
            className="w-3 h-3 rounded-full" 
            style={{ backgroundColor: currentStatusDisplay.color }}
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {statusOptions.map((option) => (
          <DropdownMenuItem
            key={option.id}
            onClick={() => quickSetStatus(option.name as any)}
            className="flex items-center gap-2"
          >
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: option.color }}
            />
            <span>{option.name}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};