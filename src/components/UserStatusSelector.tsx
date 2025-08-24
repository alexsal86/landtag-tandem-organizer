import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useUserStatus } from '@/hooks/useUserStatus';
import { useAuth } from '@/hooks/useAuth';
import { Calendar, Clock, MessageSquare, Settings, Smile } from 'lucide-react';

// Emoji categories
const emojiCategories = {
  status: ['🟢', '🔴', '🟡', '🟠', '⚫', '🔵', '🟣'],
  work: ['💼', '💻', '📊', '📝', '📞', '🎯', '⚡'],
  mood: ['😊', '😎', '🤔', '😴', '🤝', '💪', '🎉'],
  activity: ['🍕', '☕', '🚶‍♀️', '🚗', '✈️', '🏠', '🎵'],
  nature: ['🌞', '🌙', '⭐', '🌈', '🔥', '💧', '🌱']
};

interface UserStatusSelectorProps {
  children: React.ReactNode;
}

export const UserStatusSelector: React.FC<UserStatusSelectorProps> = ({ children }) => {
  const { user } = useAuth();
  const { 
    currentStatus, 
    statusOptions, 
    updateStatus, 
    getStatusDisplay,
    loading 
  } = useUserStatus();
  
  const [isOpen, setIsOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<string>('online');
  const [customMessage, setCustomMessage] = useState('');
  const [selectedEmoji, setSelectedEmoji] = useState('🟢');
  const [statusUntil, setStatusUntil] = useState('');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [activeEmojiCategory, setActiveEmojiCategory] = useState<keyof typeof emojiCategories>('status');

  React.useEffect(() => {
    if (currentStatus) {
      setSelectedType(currentStatus.status_type);
      setCustomMessage(currentStatus.custom_message || '');
      setSelectedEmoji(currentStatus.emoji || '🟢');
      setNotificationsEnabled(currentStatus.notifications_enabled);
      if (currentStatus.status_until) {
        const until = new Date(currentStatus.status_until);
        setStatusUntil(until.toISOString().slice(0, 16));
      }
    }
  }, [currentStatus]);

  const handleSave = async () => {
    const until = statusUntil ? new Date(statusUntil) : undefined;
    
    await updateStatus(
      selectedType as any,
      selectedType === 'custom' ? customMessage : undefined,
      selectedEmoji,
      until,
      notificationsEnabled
    );
    
    setIsOpen(false);
  };

  const currentDisplay = getStatusDisplay(currentStatus);

  if (loading) {
    return (
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 bg-muted rounded-full animate-pulse" />
        <span className="text-sm text-muted-foreground">Lädt...</span>
      </div>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Status ändern
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Current Status Display */}
          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
            <Avatar className="w-10 h-10">
              <AvatarImage src={user?.user_metadata?.avatar_url} />
              <AvatarFallback>
                {user?.user_metadata?.display_name?.charAt(0) || user?.email?.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-lg">{currentDisplay.emoji}</span>
                <span className="font-medium">{currentDisplay.label}</span>
              </div>
              <p className="text-sm text-muted-foreground">
                {user?.user_metadata?.display_name || user?.email}
              </p>
            </div>
          </div>

          {/* Quick Status Options */}
          <div>
            <Label className="text-sm font-medium">Schnellauswahl</Label>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {statusOptions.map((option) => (
                <Button
                  key={option.id}
                  variant={selectedType === option.name.toLowerCase() ? "default" : "outline"}
                  className="flex items-center gap-2 justify-start h-auto p-3"
                  onClick={() => {
                    setSelectedType(option.name.toLowerCase());
                    setSelectedEmoji(option.emoji || '🟢');
                  }}
                >
                  <span className="text-lg">{option.emoji}</span>
                  <span className="text-xs">{option.name}</span>
                </Button>
              ))}
            </div>
          </div>

          {/* Custom Status */}
          <div>
            <Label className="text-sm font-medium">Benutzerdefiniert</Label>
            <div className="space-y-3 mt-2">
              <Button
                variant={selectedType === 'custom' ? "default" : "outline"}
                className="w-full flex items-center gap-2 justify-start h-auto p-3"
                onClick={() => setSelectedType('custom')}
              >
                <MessageSquare className="w-4 h-4" />
                <span className="text-sm">Eigene Nachricht</span>
              </Button>
              
              {selectedType === 'custom' && (
                <div className="space-y-3 pl-4 border-l-2 border-primary/20">
                  <div>
                    <Label htmlFor="customMessage" className="text-xs">Nachricht</Label>
                    <Input
                      id="customMessage"
                      placeholder="Was machst du gerade?"
                      value={customMessage}
                      onChange={(e) => setCustomMessage(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  
                  {/* Emoji Selection */}
                  <div>
                    <Label className="text-xs">Emoji</Label>
                    <div className="mt-2 space-y-2">
                      {/* Category Tabs */}
                      <div className="flex gap-1 overflow-x-auto">
                        {Object.entries(emojiCategories).map(([category, emojis]) => (
                          <Button
                            key={category}
                            variant={activeEmojiCategory === category ? "default" : "ghost"}
                            size="sm"
                            className="px-2 py-1 text-xs flex-shrink-0"
                            onClick={() => setActiveEmojiCategory(category as keyof typeof emojiCategories)}
                          >
                            {emojis[0]}
                          </Button>
                        ))}
                      </div>
                      
                      {/* Emoji Grid */}
                      <div className="grid grid-cols-7 gap-1 p-2 border rounded-md">
                        {emojiCategories[activeEmojiCategory].map((emoji) => (
                          <Button
                            key={emoji}
                            variant={selectedEmoji === emoji ? "default" : "ghost"}
                            size="sm"
                            className="p-1 h-8 w-8"
                            onClick={() => setSelectedEmoji(emoji)}
                          >
                            {emoji}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Advanced Options */}
          <div className="space-y-4">
            <Label className="text-sm font-medium">Erweiterte Optionen</Label>
            
            {/* Status Duration */}
            <div>
              <Label htmlFor="statusUntil" className="text-xs flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Status gültig bis (optional)
              </Label>
              <Input
                id="statusUntil"
                type="datetime-local"
                value={statusUntil}
                onChange={(e) => setStatusUntil(e.target.value)}
                className="mt-1"
                min={new Date().toISOString().slice(0, 16)}
              />
            </div>

            {/* Notifications Toggle */}
            <div className="flex items-center justify-between">
              <Label htmlFor="notifications" className="text-xs flex items-center gap-1">
                <Badge variant="outline" className="text-xs">
                  Benachrichtigungen {notificationsEnabled ? 'an' : 'aus'}
                </Badge>
              </Label>
              <Switch
                id="notifications"
                checked={notificationsEnabled}
                onCheckedChange={setNotificationsEnabled}
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-4">
            <Button 
              variant="outline" 
              onClick={() => setIsOpen(false)}
              className="flex-1"
            >
              Abbrechen
            </Button>
            <Button 
              onClick={handleSave}
              className="flex-1"
            >
              Status setzen
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};