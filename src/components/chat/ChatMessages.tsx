import React, { useEffect, useRef } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface Message {
  eventId: string;
  roomId: string;
  sender: string;
  senderDisplayName: string;
  content: string;
  timestamp: number;
  type: string;
}

interface ChatMessagesProps {
  messages: Message[];
  currentUserId?: string;
  isLoading?: boolean;
}

export function ChatMessages({ messages, currentUserId, isLoading }: ChatMessagesProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const getInitials = (name: string) => {
    const parts = name.split(/[@:]/);
    const displayPart = parts[0] || parts[1] || name;
    return displayPart.slice(0, 2).toUpperCase();
  };

  const getAvatarColor = (sender: string) => {
    // Generate consistent color from sender string
    let hash = 0;
    for (let i = 0; i < sender.length; i++) {
      hash = sender.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = hash % 360;
    return `hsl(${hue}, 60%, 45%)`;
  };

  const formatMessageTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    if (isToday) {
      return format(date, 'HH:mm', { locale: de });
    }
    return format(date, 'dd.MM. HH:mm', { locale: de });
  };

  // Group messages by date
  const groupedMessages: { date: string; messages: Message[] }[] = [];
  let currentDate = '';

  messages.forEach(message => {
    const messageDate = new Date(message.timestamp).toDateString();
    if (messageDate !== currentDate) {
      currentDate = messageDate;
      groupedMessages.push({
        date: messageDate,
        messages: [message]
      });
    } else {
      groupedMessages[groupedMessages.length - 1].messages.push(message);
    }
  });

  const formatDateHeader = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === now.toDateString()) {
      return 'Heute';
    }
    if (date.toDateString() === yesterday.toDateString()) {
      return 'Gestern';
    }
    return format(date, 'EEEE, d. MMMM', { locale: de });
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <span className="text-sm">Nachrichten werden geladen...</span>
        </div>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <p className="text-sm">Keine Nachrichten</p>
          <p className="text-xs mt-1">Senden Sie die erste Nachricht!</p>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1 px-4" ref={scrollRef}>
      <div className="py-4 space-y-4">
        {groupedMessages.map((group) => (
          <div key={group.date}>
            {/* Date separator */}
            <div className="flex items-center gap-4 my-4">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground bg-background px-2">
                {formatDateHeader(group.date)}
              </span>
              <div className="flex-1 h-px bg-border" />
            </div>

            {/* Messages for this date */}
            <div className="space-y-3">
              {group.messages.map((message, index) => {
                const isOwnMessage = currentUserId === message.sender;
                const showAvatar = index === 0 || 
                  group.messages[index - 1].sender !== message.sender;

                return (
                  <div
                    key={message.eventId}
                    className={cn(
                      "flex gap-3",
                      isOwnMessage && "flex-row-reverse"
                    )}
                  >
                    {showAvatar ? (
                      <Avatar className="h-8 w-8 flex-shrink-0">
                        <AvatarFallback 
                          style={{ backgroundColor: getAvatarColor(message.sender) }}
                          className="text-white text-xs"
                        >
                          {getInitials(message.senderDisplayName)}
                        </AvatarFallback>
                      </Avatar>
                    ) : (
                      <div className="w-8 flex-shrink-0" />
                    )}

                    <div className={cn(
                      "flex flex-col max-w-[70%]",
                      isOwnMessage && "items-end"
                    )}>
                      {showAvatar && (
                        <span className="text-xs text-muted-foreground mb-1">
                          {message.senderDisplayName}
                        </span>
                      )}
                      <div className={cn(
                        "rounded-lg px-3 py-2 text-sm break-words",
                        isOwnMessage 
                          ? "bg-primary text-primary-foreground" 
                          : "bg-muted"
                      )}>
                        {message.content}
                      </div>
                      <span className="text-[10px] text-muted-foreground mt-0.5">
                        {formatMessageTime(message.timestamp)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
