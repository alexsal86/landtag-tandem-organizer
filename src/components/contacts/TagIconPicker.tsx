import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { icons, LucideIcon } from 'lucide-react';
import { Search } from 'lucide-react';

interface TagIconPickerProps {
  value?: string;
  onChange: (iconName: string) => void;
}

// Popular/recommended icons for tags
const POPULAR_ICONS = [
  'tag', 'star', 'heart', 'bookmark', 'flag', 'briefcase',
  'users', 'user', 'building', 'home', 'phone', 'mail',
  'calendar', 'clock', 'target', 'zap', 'trending-up', 'award',
  'shield', 'check-circle', 'alert-circle', 'info', 'help-circle',
  'map-pin', 'navigation', 'globe', 'file-text', 'folder',
];

export function TagIconPicker({ value, onChange }: TagIconPickerProps) {
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const getIconComponent = (iconName: string): LucideIcon => {
    const Icon = icons[iconName as keyof typeof icons] as LucideIcon;
    return Icon;
  };

  const SelectedIcon = value ? getIconComponent(value) : null;

  // Filter icons based on search
  const filteredIcons = search
    ? Object.keys(icons).filter(name => 
        name.toLowerCase().includes(search.toLowerCase())
      )
    : POPULAR_ICONS;

  const displayedIcons = filteredIcons.slice(0, 48); // Limit to 48 icons

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 w-8 p-0"
        >
          {SelectedIcon ? (
            <SelectedIcon className="h-4 w-4" />
          ) : (
            <Search className="h-4 w-4" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-3" align="start">
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Icon suchen..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          
          <ScrollArea className="h-[240px]">
            <div className="grid grid-cols-8 gap-1">
              {displayedIcons.map((iconName) => {
                const Icon = getIconComponent(iconName);
                if (!Icon) return null;
                
                return (
                  <Button
                    key={iconName}
                    variant={value === iconName ? 'default' : 'ghost'}
                    size="sm"
                    className="h-9 w-9 p-0"
                    onClick={() => {
                      onChange(iconName);
                      setIsOpen(false);
                    }}
                    title={iconName}
                  >
                    <Icon className="h-4 w-4" />
                  </Button>
                );
              })}
            </div>
          </ScrollArea>
          
          {!search && (
            <p className="text-xs text-muted-foreground text-center">
              Beliebte Icons • Suche für mehr
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
