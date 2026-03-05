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

const ESTIMATED_ROW_HEIGHT = 92;
const OVERSCAN_ROWS = 6;

export function RoomList({ rooms, selectedRoomId, onSelectRoom }: RoomListProps) {
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const rowHeightsRef = React.useRef<Map<string, number>>(new Map());
  const resizeObserversRef = React.useRef<Map<string, ResizeObserver>>(new Map());
  const [scrollTop, setScrollTop] = React.useState(0);
  const [viewportHeight, setViewportHeight] = React.useState(0);
  const [layoutVersion, setLayoutVersion] = React.useState(0);

  React.useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;

    const updateViewportHeight = () => setViewportHeight(scrollContainer.clientHeight);
    const handleScroll = () => setScrollTop(scrollContainer.scrollTop);

    updateViewportHeight();
    handleScroll();

    scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', updateViewportHeight);

    return () => {
      scrollContainer.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', updateViewportHeight);
    };
  }, []);

  React.useEffect(() => {
    const roomIds = new Set(rooms.map((room) => room.roomId));

    rowHeightsRef.current.forEach((_, roomId) => {
      if (!roomIds.has(roomId)) {
        rowHeightsRef.current.delete(roomId);
      }
    });

    resizeObserversRef.current.forEach((observer, roomId) => {
      if (!roomIds.has(roomId)) {
        observer.disconnect();
        resizeObserversRef.current.delete(roomId);
      }
    });
  }, [rooms]);

  React.useEffect(() => {
    return () => {
      resizeObserversRef.current.forEach((observer) => observer.disconnect());
      resizeObserversRef.current.clear();
    };
  }, []);

  const registerRowRef = React.useCallback((roomId: string, element: HTMLDivElement | null) => {
    const existingObserver = resizeObserversRef.current.get(roomId);
    if (existingObserver) {
      existingObserver.disconnect();
      resizeObserversRef.current.delete(roomId);
    }

    if (!element) {
      return;
    }

    const updateHeight = () => {
      const nextHeight = Math.ceil(element.getBoundingClientRect().height);
      const previousHeight = rowHeightsRef.current.get(roomId);
      if (previousHeight === nextHeight) return;

      rowHeightsRef.current.set(roomId, nextHeight);
      setLayoutVersion((value) => value + 1);
    };

    updateHeight();

    const observer = new ResizeObserver(updateHeight);
    observer.observe(element);
    resizeObserversRef.current.set(roomId, observer);
  }, []);

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

  const prefixOffsets: number[] = new Array(rooms.length);
  let totalHeight = 0;

  for (let i = 0; i < rooms.length; i++) {
    prefixOffsets[i] = totalHeight;
    const room = rooms[i];
    totalHeight += rowHeightsRef.current.get(room.roomId) ?? ESTIMATED_ROW_HEIGHT;
  }

  const findStartIndex = (targetOffset: number) => {
    let low = 0;
    let high = rooms.length - 1;
    let result = 0;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (prefixOffsets[mid] <= targetOffset) {
        result = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    return result;
  };

  const rawStartIndex = findStartIndex(scrollTop);
  const rawEndIndex = findStartIndex(scrollTop + viewportHeight + ESTIMATED_ROW_HEIGHT);

  const startIndex = Math.max(0, rawStartIndex - OVERSCAN_ROWS);
  const endIndex = Math.min(rooms.length, rawEndIndex + OVERSCAN_ROWS + 1);

  const visibleRooms = rooms.slice(startIndex, endIndex);

  return (
    <div ref={scrollContainerRef} className="overflow-y-auto h-full">
      <div className="relative p-2" style={{ height: totalHeight + 16 }} data-layout-version={layoutVersion}>
        {visibleRooms.map((room, index) => {
          const rowIndex = startIndex + index;

          return (
            <div
              key={room.roomId}
              ref={(element) => registerRowRef(room.roomId, element)}
              className="absolute left-2 right-2 pb-1"
              style={{
                transform: `translateY(${prefixOffsets[rowIndex]}px)`
              }}
            >
              <button
                onClick={() => onSelectRoom(room.roomId)}
                className={cn(
                  'w-full flex items-start gap-3 p-3 rounded-lg text-left transition-colors',
                  'hover:bg-accent/50',
                  selectedRoomId === room.roomId && 'bg-accent'
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
                      <span
                        className={cn(
                          'font-medium text-sm truncate',
                          room.unreadCount > 0 && 'text-foreground'
                        )}
                      >
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
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{room.lastMessage}</p>
                  )}
                  {room.lastMessageTimestamp && (
                    <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                      {formatTimestamp(room.lastMessageTimestamp)}
                    </p>
                  )}
                </div>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
