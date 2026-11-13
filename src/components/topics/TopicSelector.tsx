import React from "react";
import { useTopics } from "@/hooks/useTopics";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, Plus, X, Tag, type LucideIcon } from "lucide-react";
import * as LucideIcons from "lucide-react";
import { cn } from "@/lib/utils";

interface TopicSelectorProps {
  selectedTopicIds: string[];
  onTopicsChange: (topicIds: string[]) => void;
  compact?: boolean;
  placeholder?: string;
}

const getIconComponent = (iconName: string, className?: string) => {
  const iconMap = LucideIcons as unknown as Record<string, LucideIcon>;
  const Icon = iconMap[iconName];
  return Icon ? <Icon className={className || "h-3 w-3"} /> : <Tag className={className || "h-3 w-3"} />;
};

export const TopicSelector: React.FC<TopicSelectorProps> = ({
  selectedTopicIds,
  onTopicsChange,
  compact = false,
  placeholder = "Themen hinzufügen...",
}) => {
  const { topics, loading, quickCreateTopic } = useTopics();
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [creating, setCreating] = React.useState(false);
  const trimmed = search.trim();
  const exactMatch = topics.some(t => t.label.toLowerCase() === trimmed.toLowerCase());
  const canCreate = trimmed.length >= 2 && trimmed.length <= 40 && !exactMatch;

  const handleCreate = async () => {
    if (!canCreate || creating) return;
    setCreating(true);
    const id = await quickCreateTopic(trimmed);
    setCreating(false);
    if (id && !selectedTopicIds.includes(id)) onTopicsChange([...selectedTopicIds, id]);
    setSearch("");
  };

  const activeTopics = topics.filter(t => t.is_active);
  const selectedTopics = topics.filter(t => selectedTopicIds.includes(t.id));

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
                backgroundColor: `${topic.color ?? '#3b82f6'}20`,
                borderColor: topic.color ?? undefined,
                color: topic.color ?? undefined 
              }}
            >
              {getIconComponent(topic.icon ?? '')}
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
            <CommandInput placeholder="Thema suchen oder anlegen..." value={search} onValueChange={setSearch} />
            <CommandList>
              {!canCreate && <CommandEmpty>Keine Themen gefunden.</CommandEmpty>}
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
                      style={{ backgroundColor: `${topic.color ?? '#3b82f6'}30` }}
                    >
                      {getIconComponent(topic.icon ?? '', "h-2.5 w-2.5")}
                    </div>
                    <span className="flex-1">{topic.label}</span>
                    {selectedTopicIds.includes(topic.id) && (
                      <Check className="h-4 w-4 text-primary" />
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
              {canCreate && (
                <CommandGroup heading="Neu">
                  <CommandItem
                    value={`__create__${trimmed}`}
                    onSelect={handleCreate}
                    disabled={creating}
                    className="gap-2 cursor-pointer"
                  >
                    <Plus className="h-4 w-4" />
                    <span className="flex-1">„{trimmed}" als neues Thema anlegen</span>
                  </CommandItem>
                </CommandGroup>
              )}
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
  expandable?: boolean;
}

export const TopicDisplay: React.FC<TopicDisplayProps> = ({
  topicIds,
  maxDisplay = 5,
  expandable = true,
}) => {
  const { topics, loading } = useTopics();
  const navigate = useNavigate();
  const [expanded, setExpanded] = React.useState(false);

  if (loading || topicIds.length === 0) {
    return null;
  }

  const displayTopics = topics.filter(t => topicIds.includes(t.id));
  const remainingCount = displayTopics.length - maxDisplay;
  const visibleTopics = expanded ? displayTopics : displayTopics.slice(0, maxDisplay);

  return (
    <div className="flex flex-wrap gap-1">
      {visibleTopics.map(topic => (
        <Badge
          key={topic.id}
          variant="secondary"
          className="gap-1 text-xs cursor-pointer"
          title="Alles zu diesem Thema anzeigen"
          onClick={(e) => { e.stopPropagation(); navigate(`/themen/${topic.id}`); }}
           style={{ 
            backgroundColor: `${topic.color ?? '#3b82f6'}20`,
            borderColor: topic.color ?? undefined,
            color: topic.color ?? undefined 
          }}
        >
          {getIconComponent(topic.icon ?? '')}
          {topic.label}
        </Badge>
      ))}
      {remainingCount > 0 && !expanded && (
        <Badge 
          variant="outline" 
          className="text-xs cursor-pointer hover:bg-muted"
          onClick={(e) => { 
            e.stopPropagation(); 
            if (expandable) setExpanded(true); 
          }}
        >
          +{remainingCount}
        </Badge>
      )}
      {expanded && remainingCount > 0 && (
        <Badge 
          variant="outline" 
          className="text-xs cursor-pointer hover:bg-muted"
          onClick={(e) => { e.stopPropagation(); setExpanded(false); }}
        >
          weniger
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
