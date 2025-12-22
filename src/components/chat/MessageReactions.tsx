import React, { useState } from 'react';
import { SmilePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface Reaction {
  key: string;
  count: number;
  userReacted: boolean;
}

interface MessageReactionsProps {
  reactions: Reaction[];
  onAddReaction: (emoji: string) => void;
  onRemoveReaction: (emoji: string) => void;
}

const QUICK_EMOJIS = ['👍', '❤️', '😄', '😮', '😢', '🎉', '🤔', '👀'];

export function MessageReactions({ reactions, onAddReaction, onRemoveReaction }: MessageReactionsProps) {
  const [showPicker, setShowPicker] = useState(false);

  const handleReactionClick = (reaction: Reaction) => {
    if (reaction.userReacted) {
      onRemoveReaction(reaction.key);
    } else {
      onAddReaction(reaction.key);
    }
  };

  const handleQuickEmojiClick = (emoji: string) => {
    onAddReaction(emoji);
    setShowPicker(false);
  };

  return (
    <div className="flex flex-wrap items-center gap-1 mt-1">
      {/* Existing reactions */}
      {reactions.map((reaction) => (
        <button
          key={reaction.key}
          onClick={() => handleReactionClick(reaction)}
          className={cn(
            "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs",
            "border transition-colors",
            reaction.userReacted
              ? "bg-primary/10 border-primary/30 text-primary"
              : "bg-muted border-border hover:bg-accent"
          )}
        >
          <span>{reaction.key}</span>
          <span className="text-muted-foreground">{reaction.count}</span>
        </button>
      ))}

      {/* Add reaction button */}
      <Popover open={showPicker} onOpenChange={setShowPicker}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <SmilePlus className="h-3.5 w-3.5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2" align="start">
          <div className="flex gap-1">
            {QUICK_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => handleQuickEmojiClick(emoji)}
                className="p-1.5 hover:bg-accent rounded transition-colors text-lg"
              >
                {emoji}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
