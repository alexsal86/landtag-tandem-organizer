import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X, Tag as TagIcon } from 'lucide-react';
import { icons, LucideIcon } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

interface Tag {
  id: string;
  name: string;
  label: string;
  color: string;
  icon?: string;
  is_active: boolean;
  order_index: number;
}

interface TagFilterPanelProps {
  tags: Tag[];
  selectedTagFilter: string;
  onTagSelect: (tagName: string) => void;
  contactCounts?: Record<string, number>;
}

export function TagFilterPanel({
  tags,
  selectedTagFilter,
  onTagSelect,
  contactCounts = {},
}: TagFilterPanelProps) {
  const getIconComponent = (iconName?: string): LucideIcon => {
    if (!iconName) return TagIcon;
    const Icon = icons[iconName as keyof typeof icons] as LucideIcon;
    return Icon || TagIcon;
  };

  if (tags.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-2">
        <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
          <TagIcon className="h-4 w-4" />
          Tags
        </h3>
        {selectedTagFilter && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onTagSelect('')}
            className="h-6 text-xs"
          >
            <X className="h-3 w-3 mr-1" />
            Zurücksetzen
          </Button>
        )}
      </div>
      
      <Separator />
      
      <ScrollArea className="h-[300px] pr-3">
        <div className="space-y-1">
          {tags.map((tag) => {
            const Icon = getIconComponent(tag.icon);
            const count = contactCounts[tag.name] || 0;
            const isSelected = selectedTagFilter === tag.name;
            
            return (
              <Button
                key={tag.id}
                variant={isSelected ? "secondary" : "ghost"}
                size="sm"
                className={`w-full justify-start h-9 ${
                  isSelected ? 'bg-accent' : 'hover:bg-accent/50'
                }`}
                onClick={() => onTagSelect(isSelected ? '' : tag.name)}
              >
                <div 
                  className="w-2 h-2 rounded-full mr-2 flex-shrink-0"
                  style={{ backgroundColor: tag.color }}
                />
                <Icon className="h-3.5 w-3.5 mr-2 flex-shrink-0" />
                <span className="flex-1 text-left truncate">{tag.label}</span>
                {count > 0 && (
                  <Badge 
                    variant={isSelected ? "default" : "secondary"}
                    className="ml-2 h-5 px-1.5 text-xs font-normal"
                  >
                    {count}
                  </Badge>
                )}
              </Button>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
