import { useState, useMemo, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { MatrixMessage } from '@/types/matrix';

interface ChatSearchProps {
  messages: MatrixMessage[];
  onSelectMessage?: (eventId: string) => void;
  onClose: () => void;
}

const SEARCH_DEBOUNCE_MS = 180;

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function ChatSearch({ messages, onSelectMessage, onClose }: ChatSearchProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timeoutId);
  }, [searchQuery]);

  const searchResults = useMemo(() => {
    if (!debouncedSearchQuery.trim()) return [];

    const query = debouncedSearchQuery.toLowerCase();
    return messages
      .filter(
        (msg) =>
          msg.content.toLowerCase().includes(query) ||
          msg.senderDisplayName.toLowerCase().includes(query)
      )
      .slice(0, 50); // Limit results
  }, [messages, debouncedSearchQuery]);

  const highlightMatch = (text: string, query: string): string | JSX.Element[] => {
    if (!query.trim()) return text;

    const escapedQuery = escapeRegExp(query);
    const parts = text.split(new RegExp(`(${escapedQuery})`, 'gi'));
    return parts.map((part, index) =>
      part.toLowerCase() === query.toLowerCase() ? (
        <mark key={index} className="bg-yellow-200 dark:bg-yellow-800 rounded px-0.5">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  return (
    <div className="flex flex-col h-full border-l bg-background">
      <div className="p-3 border-b">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Nachrichten durchsuchen..."
            className="h-8"
            autoFocus
          />
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {debouncedSearchQuery.trim() && (
          <div className="p-2">
            {searchResults.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Keine Ergebnisse für "{debouncedSearchQuery}"
              </p>
            ) : (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground px-2 mb-2">
                  {searchResults.length} Ergebnis{searchResults.length !== 1 ? 'se' : ''}
                </p>
                {searchResults.map((msg) => (
                  <button
                    key={msg.eventId}
                    onClick={() => onSelectMessage?.(msg.eventId)}
                    className={cn(
                      'w-full text-left p-2 rounded-md hover:bg-accent transition-colors'
                    )}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-xs font-medium truncate">{msg.senderDisplayName}</span>
                      <span className="text-[10px] text-muted-foreground flex-shrink-0">
                        {format(new Date(msg.timestamp), 'dd.MM.yy HH:mm', { locale: de })}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {highlightMatch(msg.content, debouncedSearchQuery)}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
