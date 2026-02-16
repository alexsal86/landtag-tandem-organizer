import React from 'react';
import { cn } from '@/lib/utils';
import { MessageSquare, Hash, User, Lock } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';

interface Room {
  roomId: string;
  name: string;
  lastMessage?: string;
  lastMessageTimestamp?: number;
  unreadCount: number;
  isDirect?: boolean;
  memberCount?: number;
  isEncrypted?: boolean;
}

interface RoomListProps {
  rooms: Room[];
  selectedRoomId: string | null;
  onSelectRoom: (roomId: string) => void;
}

export function RoomList({ rooms, selectedRoomId, onSelectRoom }: RoomListProps) {
  const formatTimestamp = (timestamp?: number) => {
    if (!timestamp) return '';
    return formatDistanceToNow(new Date(timestamp), { 
      addSuffix: true, 
      locale: de 
    });
  };

  const getRoomDisplayName = (room: Room) => {
    if (room.name && room.name !== room.roomId) {
      return room.name;
    }
    const match = room.roomId.match(/^!([^:]+):/);
    if (match) {
      return match[1];
    }
    return room.roomId;
  };

  if (rooms.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4">
        <MessageSquare className="h-8 w-8 mb-2 opacity-50" />
        <p className="text-sm text-center">Keine Räume gefunden</p>
      </div>
    );
  }

  return (
    <div className="overflow-y-auto h-full">
      <div className="space-y-1 p-2">
        {rooms.map((room) => (
          <button
            key={room.roomId}
            onClick={() => onSelectRoom(room.roomId)}
            className={cn(
              "w-full flex items-start gap-3 p-3 rounded-lg text-left transition-colors",
              "hover:bg-accent/50",
              selectedRoomId === room.roomId && "bg-accent"
            )}
          >
            <div className="flex-shrink-0 mt-0.5">
              {room.isDirect ? (
                <User className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Hash className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className={cn(
                    "font-medium text-sm truncate",
                    room.unreadCount > 0 && "text-foreground"
                  )}>
                    {getRoomDisplayName(room)}
                  </span>
                  {room.isEncrypted && (
                    <span title="Ende-zu-Ende verschlüsselt">
                      <Lock className="h-3 w-3 text-green-500 flex-shrink-0" />
                    </span>
                  )}
                </div>
                {room.unreadCount > 0 && (
                  <Badge variant="default" className="flex-shrink-0 h-5 min-w-[20px] justify-center">
                    {room.unreadCount > 99 ? '99+' : room.unreadCount}
                  </Badge>
                )}
              </div>
              {room.lastMessage && (
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {room.lastMessage}
                </p>
              )}
              {room.lastMessageTimestamp && (
                <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                  {formatTimestamp(room.lastMessageTimestamp)}
                </p>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
