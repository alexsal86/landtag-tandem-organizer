import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface EmojiPickerProps {
  value: string;
  onEmojiSelect: (emoji: string) => void;
}

const emojiCategories = {
  status: ['🟢', '🔴', '🟡', '🟠', '🔵', '🟣', '⚫', '⚪', '🟤'],
  work: ['💼', '📊', '📈', '📋', '🖥️', '⌨️', '📝', '💻', '📱'],
  mood: ['😊', '😄', '😎', '🤔', '😴', '😵‍💫', '🤖', '🧠', '💪'],
  activity: ['☕', '🍕', '🏃‍♂️', '🚗', '✈️', '🎯', '🎨', '🎵', '📚'],
  nature: ['🌟', '⭐', '🌙', '☀️', '🌈', '🔥', '⚡', '🌊', '🌸']
};

export const EmojiPicker: React.FC<EmojiPickerProps> = ({ value, onEmojiSelect }) => {
  const [open, setOpen] = useState(false);

  const handleEmojiClick = (emoji: string) => {
    onEmojiSelect(emoji);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start h-10"
        >
          {value ? (
            <span className="text-lg mr-2">{value}</span>
          ) : (
            <span className="text-muted-foreground text-sm">Emoji wählen</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <Tabs defaultValue="status" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="status" className="text-xs">Status</TabsTrigger>
            <TabsTrigger value="work" className="text-xs">Arbeit</TabsTrigger>
            <TabsTrigger value="mood" className="text-xs">Stimmung</TabsTrigger>
            <TabsTrigger value="activity" className="text-xs">Aktivität</TabsTrigger>
            <TabsTrigger value="nature" className="text-xs">Natur</TabsTrigger>
          </TabsList>
          
          {Object.entries(emojiCategories).map(([category, emojis]) => (
            <TabsContent key={category} value={category} className="p-4">
              <div className="grid grid-cols-9 gap-2">
                {emojis.map((emoji) => (
                  <Button
                    key={emoji}
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-lg hover:bg-accent"
                    onClick={() => handleEmojiClick(emoji)}
                  >
                    {emoji}
                  </Button>
                ))}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </PopoverContent>
    </Popover>
  );
};