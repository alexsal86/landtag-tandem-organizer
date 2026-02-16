import React, { useEffect, useRef } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { Reply, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MediaMessage } from './MediaMessage';
import { MessageReactions } from './MessageReactions';
import { MessageStatus, MessageStatusType } from './MessageStatus';

interface Message {
  eventId: string;
  roomId: string;
  sender: string;
  senderDisplayName: string;
  content: string;
  timestamp: number;
  type: string;
  status?: MessageStatusType;
  replyTo?: { eventId: string; sender: string; content: string };
  reactions?: Map<string, { count: number; userReacted: boolean }>;
  mediaContent?: {
    msgtype: string;
    body: string;
    url?: string;
    info?: any;
  };
}

interface ChatMessagesProps {
  messages: Message[];
  currentUserId?: string;
  homeserverUrl: string;
  isLoading?: boolean;
  onReply?: (eventId: string, sender: string, content: string) => void;
  onAddReaction?: (eventId: string, emoji: string) => void;
  onRemoveReaction?: (eventId: string, emoji: string) => void;
}

export function ChatMessages({ 
  messages, 
  currentUserId, 
  homeserverUrl,
  isLoading,
  onReply,
  onAddReaction,
  onRemoveReaction,
}: ChatMessagesProps) {
  
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const getInitials = (name: string) => {
    const parts = name.split(/[@:]/);
    const displayPart = parts[0] || parts[1] || name;
    return displayPart.slice(0, 2).toUpperCase();
  };

  const getAvatarColor = (sender: string) => {
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

  const groupedMessages: { date: string; messages: Message[] }[] = [];
  let currentDate = '';

  messages.forEach(message => {
    const messageDate = new Date(message.timestamp).toDateString();
    if (messageDate !== currentDate) {
      currentDate = messageDate;
      groupedMessages.push({ date: messageDate, messages: [message] });
    } else {
      groupedMessages[groupedMessages.length - 1].messages.push(message);
    }
  });

  const formatDateHeader = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === now.toDateString()) return 'Heute';
    if (date.toDateString() === yesterday.toDateString()) return 'Gestern';
    return format(date, 'EEEE, d. MMMM', { locale: de });
  };

  const getReactionsArray = (reactions?: Map<string, { count: number; userReacted: boolean }>) => {
    if (!reactions) return [];
    return Array.from(reactions.entries()).map(([key, value]) => ({
      key,
      count: value.count,
      userReacted: value.userReacted,
    }));
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
    <div className="flex-1 px-4 overflow-y-auto">
      <div className="py-4 space-y-4">
        {groupedMessages.map((group) => (
          <div key={group.date}>
            <div className="flex items-center gap-4 my-4">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground bg-background px-2">
                {formatDateHeader(group.date)}
              </span>
              <div className="flex-1 h-px bg-border" />
            </div>

            <div className="space-y-3">
              {group.messages.map((message, index) => {
                const isOwnMessage = currentUserId === message.sender;
                const showAvatar = index === 0 || group.messages[index - 1].sender !== message.sender;
                const isMediaMessage = message.mediaContent && ['m.image', 'm.video', 'm.audio', 'm.file'].includes(message.mediaContent.msgtype);

                return (
                  <div
                    key={message.eventId}
                    className={cn("flex gap-3 group", isOwnMessage && "flex-row-reverse")}
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

                    <div className={cn("flex flex-col max-w-[70%]", isOwnMessage && "items-end")}>
                      {showAvatar && (
                        <span className="text-xs text-muted-foreground mb-1">
                          {message.senderDisplayName}
                        </span>
                      )}

                      {/* Reply quote */}
                      {message.replyTo && (
                        <div className="text-xs text-muted-foreground bg-muted/50 border-l-2 border-primary/50 pl-2 py-1 mb-1 rounded-r">
                          <span className="font-medium">{message.replyTo.sender}</span>
                          <p className="truncate">{message.replyTo.content}</p>
                        </div>
                      )}

                      {/* Message content */}
                      {isMediaMessage && message.mediaContent ? (
                        <MediaMessage content={message.mediaContent} homeserverUrl={homeserverUrl} />
                      ) : message.content === '[Encrypted]' || message.type === 'm.bad.encrypted' ? (
                        <div className={cn(
                          "rounded-lg px-3 py-2 text-sm break-words flex items-center gap-2",
                          "bg-muted/50 text-muted-foreground italic"
                        )}>
                          <Lock className="h-4 w-4 flex-shrink-0" />
                          <span>Nachricht konnte nicht entschlüsselt werden</span>
                        </div>
                      ) : (
                        <div className={cn(
                          "rounded-lg px-3 py-2 text-sm break-words",
                          isOwnMessage ? "bg-primary text-primary-foreground" : "bg-muted"
                        )}>
                          {message.content}
                        </div>
                      )}

                      {/* Message footer */}
                      <div className={cn("flex items-center gap-1 mt-0.5", isOwnMessage && "flex-row-reverse")}>
                        <span className="text-[10px] text-muted-foreground">
                          {formatMessageTime(message.timestamp)}
                        </span>
                        {isOwnMessage && message.status && (
                          <MessageStatus status={message.status} />
                        )}
                        {onReply && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => onReply(message.eventId, message.senderDisplayName, message.content)}
                          >
                            <Reply className="h-3 w-3" />
                          </Button>
                        )}
                      </div>

                      {/* Reactions */}
                      {(onAddReaction || getReactionsArray(message.reactions).length > 0) && (
                        <MessageReactions
                          reactions={getReactionsArray(message.reactions)}
                          onAddReaction={(emoji) => onAddReaction?.(message.eventId, emoji)}
                          onRemoveReaction={(emoji) => onRemoveReaction?.(message.eventId, emoji)}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
