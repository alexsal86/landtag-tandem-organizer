import React from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Hash, Users, MessageCircle, Filter } from 'lucide-react';

export type RoomFilterType = 'all' | 'direct' | 'groups';

interface RoomFilterProps {
  activeFilter: RoomFilterType;
  onFilterChange: (filter: RoomFilterType) => void;
  counts: {
    all: number;
    direct: number;
    groups: number;
  };
}

export function RoomFilter({ activeFilter, onFilterChange, counts }: RoomFilterProps) {
  const filters: { type: RoomFilterType; label: string; icon: React.ReactNode }[] = [
    { type: 'all', label: 'Alle', icon: <Filter className="h-3.5 w-3.5" /> },
    { type: 'direct', label: 'Direkt', icon: <MessageCircle className="h-3.5 w-3.5" /> },
    { type: 'groups', label: 'Gruppen', icon: <Users className="h-3.5 w-3.5" /> },
  ];

  return (
    <div className="flex gap-1 p-2 border-b">
      {filters.map(({ type, label, icon }) => (
        <Button
          key={type}
          variant={activeFilter === type ? 'secondary' : 'ghost'}
          size="sm"
          className={cn(
            "flex-1 h-7 text-xs gap-1",
            activeFilter === type && "bg-accent"
          )}
          onClick={() => onFilterChange(type)}
        >
          {icon}
          <span>{label}</span>
          <span className="text-muted-foreground">
            ({counts[type]})
          </span>
        </Button>
      ))}
    </div>
  );
}
