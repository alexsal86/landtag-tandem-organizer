import React from "react";
import { useTopics, Topic } from "@/hooks/useTopics";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, Plus, X, Tag } from "lucide-react";
import * as LucideIcons from "lucide-react";
import { cn } from "@/lib/utils";

interface TopicSelectorProps {
  selectedTopicIds: string[];
  onTopicsChange: (topicIds: string[]) => void;
  compact?: boolean;
}

const getIconComponent = (iconName: string, className?: string) => {
  const Icon = (LucideIcons as any)[iconName];
  return Icon ? <Icon className={className || "h-3 w-3"} /> : <Tag className={className || "h-3 w-3"} />;
};

export const TopicSelector: React.FC<TopicSelectorProps> = ({
  selectedTopicIds,
  onTopicsChange,
  compact = false,
}) => {
  const { topics, loading } = useTopics();
  const [open, setOpen] = React.useState(false);

  const activeTopics = topics.filter(t => t.is_active);
  const selectedTopics = activeTopics.filter(t => selectedTopicIds.includes(t.id));

  const toggleTopic = (topicId: string) => {
    if (selectedTopicIds.includes(topicId)) {
      onTopicsChange(selectedTopicIds.filter(id => id !== topicId));
    } else {
      onTopicsChange([...selectedTopicIds, topicId]);
    }
  };

  const removeTopic = (topicId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onTopicsChange(selectedTopicIds.filter(id => id !== topicId));
  };

  if (loading) {
    return <div className="text-sm text-muted-foreground">Themen werden geladen...</div>;
  }

  return (
    <div className="space-y-2">
      {/* Selected topics display */}
      {selectedTopics.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedTopics.map((topic) => (
            <Badge
              key={topic.id}
              variant="secondary"
              className="flex items-center gap-1 pr-1"
              style={{ 
                backgroundColor: topic.color + '20', 
                color: topic.color,
                borderColor: topic.color + '40'
              }}
            >
              {getIconComponent(topic.icon || 'Tag', "h-3 w-3")}
              <span>{topic.label}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-4 w-4 p-0 hover:bg-transparent"
                onClick={(e) => removeTopic(topic.id, e)}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          ))}
        </div>
      )}

      {/* Add topic popover */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size={compact ? "sm" : "default"}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            {compact ? "Thema" : "Thema hinzufügen"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-0" align="start">
          <Command>
            <CommandInput placeholder="Thema suchen..." />
            <CommandList>
              <CommandEmpty>Kein Thema gefunden.</CommandEmpty>
              <CommandGroup>
                {activeTopics.map((topic) => {
                  const isSelected = selectedTopicIds.includes(topic.id);
                  return (
                    <CommandItem
                      key={topic.id}
                      value={topic.label}
                      onSelect={() => toggleTopic(topic.id)}
                      className="flex items-center gap-2"
                    >
                      <div
                        className="flex items-center justify-center w-5 h-5 rounded"
                        style={{ backgroundColor: topic.color + '20', color: topic.color }}
                      >
                        {getIconComponent(topic.icon || 'Tag', "h-3 w-3")}
                      </div>
                      <span className="flex-1">{topic.label}</span>
                      <Check
                        className={cn(
                          "h-4 w-4",
                          isSelected ? "opacity-100" : "opacity-0"
                        )}
                      />
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
};

// Read-only display of topics
interface TopicDisplayProps {
  topicIds: string[];
  maxDisplay?: number;
}

export const TopicDisplay: React.FC<TopicDisplayProps> = ({ topicIds, maxDisplay = 3 }) => {
  const { topics } = useTopics();
  
  const displayTopics = topics.filter(t => topicIds.includes(t.id));
  const visibleTopics = displayTopics.slice(0, maxDisplay);
  const remainingCount = displayTopics.length - maxDisplay;

  if (displayTopics.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1">
      {visibleTopics.map((topic) => (
        <Badge
          key={topic.id}
          variant="secondary"
          className="flex items-center gap-1 text-xs"
          style={{ 
            backgroundColor: topic.color + '20', 
            color: topic.color,
            borderColor: topic.color + '40'
          }}
        >
          {getIconComponent(topic.icon || 'Tag', "h-2.5 w-2.5")}
          <span>{topic.label}</span>
        </Badge>
      ))}
      {remainingCount > 0 && (
        <Badge variant="outline" className="text-xs">
          +{remainingCount}
        </Badge>
      )}
    </div>
  );
};
