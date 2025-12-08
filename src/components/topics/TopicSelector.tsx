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
  placeholder?: string;
}

const getIconComponent = (iconName: string, className?: string) => {
  const Icon = (LucideIcons as any)[iconName];
  return Icon ? <Icon className={className || "h-3 w-3"} /> : <Tag className={className || "h-3 w-3"} />;
};

export const TopicSelector: React.FC<TopicSelectorProps> = ({
  selectedTopicIds,
  onTopicsChange,
  compact = false,
  placeholder = "Themen hinzufügen...",
}) => {
  const { topics, loading } = useTopics();
  const [open, setOpen] = React.useState(false);

  const activeTopics = topics.filter(t => t.is_active);
  const selectedTopics = activeTopics.filter(t => selectedTopicIds.includes(t.id));
  const availableTopics = activeTopics.filter(t => !selectedTopicIds.includes(t.id));

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
    return <div className="text-sm text-muted-foreground">Lade Themen...</div>;
  }

  return (
    <div className="space-y-2">
      {/* Selected Topics */}
      {selectedTopics.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedTopics.map(topic => (
            <Badge
              key={topic.id}
              variant="secondary"
              className="gap-1 pr-1"
              style={{ 
                backgroundColor: `${topic.color}20`,
                borderColor: topic.color,
                color: topic.color 
              }}
            >
              {getIconComponent(topic.icon)}
              <span className="text-xs">{topic.label}</span>
              <button
                onClick={(e) => removeTopic(topic.id, e)}
                className="ml-1 hover:bg-muted rounded-full p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Add Topics Popover */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size={compact ? "sm" : "default"}
            className={cn(
              "gap-1 text-muted-foreground",
              compact && "h-7 text-xs"
            )}
          >
            <Plus className={compact ? "h-3 w-3" : "h-4 w-4"} />
            {placeholder}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-0" align="start">
          <Command>
            <CommandInput placeholder="Thema suchen..." />
            <CommandList>
              <CommandEmpty>Keine Themen gefunden.</CommandEmpty>
              <CommandGroup>
                {activeTopics.map(topic => (
                  <CommandItem
                    key={topic.id}
                    value={topic.label}
                    onSelect={() => toggleTopic(topic.id)}
                    className="gap-2 cursor-pointer"
                  >
                    <div 
                      className="w-4 h-4 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: `${topic.color}30` }}
                    >
                      {getIconComponent(topic.icon, "h-2.5 w-2.5")}
                    </div>
                    <span className="flex-1">{topic.label}</span>
                    {selectedTopicIds.includes(topic.id) && (
                      <Check className="h-4 w-4 text-primary" />
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
};

interface TopicDisplayProps {
  topicIds: string[];
  maxDisplay?: number;
}

export const TopicDisplay: React.FC<TopicDisplayProps> = ({
  topicIds,
  maxDisplay = 5,
}) => {
  const { topics, loading } = useTopics();

  if (loading || topicIds.length === 0) {
    return null;
  }

  const displayTopics = topics.filter(t => topicIds.includes(t.id));
  const visibleTopics = displayTopics.slice(0, maxDisplay);
  const remainingCount = displayTopics.length - maxDisplay;

  return (
    <div className="flex flex-wrap gap-1">
      {visibleTopics.map(topic => (
        <Badge
          key={topic.id}
          variant="secondary"
          className="gap-1 text-xs"
          style={{ 
            backgroundColor: `${topic.color}20`,
            borderColor: topic.color,
            color: topic.color 
          }}
        >
          {getIconComponent(topic.icon)}
          {topic.label}
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

// Legacy compatibility - returns topic labels as strings
export const useTopicSuggestions = () => {
  const { topics, loading } = useTopics();
  
  return {
    topicSuggestions: topics.filter(t => t.is_active).map(t => t.label),
    loading
  };
};
