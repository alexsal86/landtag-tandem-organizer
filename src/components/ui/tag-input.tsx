import { useState, KeyboardEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { X, Tag } from "lucide-react";

interface TagInputProps {
  tags: string[];
  onTagsChange: (tags: string[]) => void;
  placeholder?: string;
  className?: string;
  suggestions?: string[];
  showInherited?: boolean;
  inheritedTags?: string[];
}

export function TagInput({ 
  tags, 
  onTagsChange, 
  placeholder = "Tags hinzufügen...",
  className = "",
  suggestions = [],
  showInherited = false,
  inheritedTags = []
}: TagInputProps) {
  const [inputValue, setInputValue] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);

  const filteredSuggestions = suggestions.filter(
    suggestion => 
      suggestion.toLowerCase().includes(inputValue.toLowerCase()) &&
      !tags.includes(suggestion) &&
      !inheritedTags.includes(suggestion)
  );

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag();
    } else if (e.key === "Backspace" && !inputValue && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    }
  };

  const addTag = (tagValue?: string) => {
    const newTag = (tagValue || inputValue).trim();
    if (newTag && !tags.includes(newTag) && !inheritedTags.includes(newTag)) {
      onTagsChange([...tags, newTag]);
      setInputValue("");
      setShowSuggestions(false);
    }
  };

  const removeTag = (tagToRemove: string) => {
    onTagsChange(tags.filter(tag => tag !== tagToRemove));
  };

  const allTags = [...(inheritedTags || []), ...tags];

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex flex-wrap gap-1 p-2 border border-input rounded-md min-h-[40px] focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
        {showInherited && inheritedTags?.map((tag) => (
          <Badge 
            key={`inherited-${tag}`} 
            variant="outline" 
            className="bg-muted/30 text-muted-foreground border-dashed flex items-center gap-1"
          >
            <Tag className="h-3 w-3" />
            {tag}
            <span className="text-xs">(geerbt)</span>
          </Badge>
        ))}
        {tags.map((tag) => (
          <Badge key={tag} variant="secondary" className="flex items-center gap-1">
            {tag}
            <Button
              variant="ghost"
              size="sm"
              className="h-auto p-0 ml-1 hover:bg-transparent"
              onClick={() => removeTag(tag)}
            >
              <X className="h-3 w-3" />
            </Button>
          </Badge>
        ))}
        <Input
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            setShowSuggestions(e.target.value.length > 0);
          }}
          onKeyDown={handleKeyDown}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          onFocus={() => setShowSuggestions(inputValue.length > 0)}
          placeholder={allTags.length === 0 ? placeholder : ""}
          className="border-0 shadow-none focus-visible:ring-0 flex-1 min-w-[120px]"
        />
      </div>

      {showSuggestions && filteredSuggestions.length > 0 && (
        <div className="border border-border rounded-md bg-popover p-1 shadow-md">
          {filteredSuggestions.slice(0, 5).map((suggestion) => (
            <Button
              key={suggestion}
              variant="ghost"
              size="sm"
              className="w-full justify-start text-sm"
              onClick={() => addTag(suggestion)}
            >
              {suggestion}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}