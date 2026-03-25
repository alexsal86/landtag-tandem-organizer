import React from 'react';
import { Check, Archive, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

import type { MessageItem } from './dto';

const formatDate = (dateString: string) =>
  new Date(dateString).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const formatShortDate = (dateString: string) =>
  new Date(dateString).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

export const ReceivedMessageCard: React.FC<{
  message: MessageItem;
  isRead: boolean;
  onMarkRead: (id: string, isForAll: boolean) => void;
}> = React.memo(({ message, isRead, onMarkRead }) => (
  <div className={`p-3 border rounded-lg ${isRead ? 'bg-muted/30' : 'bg-background border-primary/20'}`}>
    <div className="flex items-start justify-between">
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <Avatar className="h-6 w-6">
            <AvatarImage src={message.author?.avatarUrl ?? undefined} />
            <AvatarFallback>{message.author?.displayName?.charAt(0) || 'U'}</AvatarFallback>
          </Avatar>
          <span className="text-sm font-medium">{message.author?.displayName || 'Unbekannt'}</span>
          {message.isForAllUsers && <Badge variant="secondary" className="text-xs">An alle</Badge>}
          {!isRead && <Badge variant="default" className="text-xs">Neu</Badge>}
        </div>
        <h4 className="font-medium text-sm mb-1">{message.title}</h4>
        <p className="text-xs text-muted-foreground mb-2">{message.content}</p>
        <p className="text-xs text-muted-foreground">{formatDate(message.createdAt)}</p>
      </div>
      {!isRead && (
        <Button size="sm" variant="outline" onClick={() => onMarkRead(message.id, message.isForAllUsers)} className="ml-2">
          <Check className="h-4 w-4" />
        </Button>
      )}
    </div>
  </div>
));

ReceivedMessageCard.displayName = 'ReceivedMessageCard';

export const SentMessageCard: React.FC<{ message: MessageItem; userId?: string }> = React.memo(({ message, userId }) => {
  const getStatus = () => {
    if (message.isForAllUsers) return { total: 0, read: message.confirmations.length };
    const total = message.recipients.length;
    const read = message.recipients.filter((r) => r.hasRead).length;
    return { total, read };
  };
  const status = getStatus();

  return (
    <div className="p-3 border rounded-lg">
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-medium text-sm">{message.title}</h4>
            {message.isForAllUsers && <Badge variant="secondary" className="text-xs">An alle</Badge>}
          </div>
          <p className="text-xs text-muted-foreground mb-2">{message.content}</p>
          <p className="text-xs text-muted-foreground">{formatDate(message.createdAt)}</p>
        </div>
      </div>

      {!message.isForAllUsers && message.recipients.length > 0 && (
        <div className="space-y-2 mt-2">
          <div className="text-xs font-medium text-muted-foreground">Empfänger:</div>
          <div className="flex flex-wrap gap-2">
            {message.recipients.map((r) => (
              <div key={r.recipientId} className="flex items-center gap-1 text-xs bg-muted/50 rounded px-2 py-1">
                <Avatar className="h-4 w-4"><AvatarImage src={r.profile?.avatarUrl ?? undefined} /><AvatarFallback className="text-xs">{r.profile?.displayName?.charAt(0) || 'U'}</AvatarFallback></Avatar>
                <span>{r.profile?.displayName || 'Unbekannt'}</span>
                {r.hasRead ? (
                  <div className="flex items-center gap-1 text-green-600"><Check className="h-3 w-3" /><span className="text-xs">{r.readAt && formatShortDate(r.readAt)}</span></div>
                ) : <span className="text-xs text-muted-foreground">Nicht gelesen</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {message.isForAllUsers && message.confirmations.length > 0 && (
        <div className="space-y-2 mt-2">
          <div className="text-xs font-medium text-muted-foreground">Bestätigt von:</div>
          <div className="flex flex-wrap gap-2">
            {message.confirmations.map((c) => (
              <div key={c.userId} className="flex items-center gap-1 text-xs bg-muted/50 rounded px-2 py-1">
                <Avatar className="h-4 w-4"><AvatarImage src={c.profile?.avatarUrl ?? undefined} /><AvatarFallback className="text-xs">{c.profile?.displayName?.charAt(0) || 'U'}</AvatarFallback></Avatar>
                <span>{c.profile?.displayName || 'Unbekannt'}</span>
                <div className="flex items-center gap-1 text-green-600"><Check className="h-3 w-3" /><span className="text-xs">{formatShortDate(c.confirmedAt)}</span></div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-2 text-xs text-muted-foreground">
        {message.isForAllUsers ? `${status.read} Benutzer haben bestätigt` : `${status.read}/${status.total} gelesen`}
      </div>
    </div>
  );
});

SentMessageCard.displayName = 'SentMessageCard';

export const ArchivedMessageCard: React.FC<{ message: MessageItem; userId?: string }> = React.memo(({ message, userId }) => (
  <div className="p-3 border rounded-lg bg-muted/30">
    <div className="flex items-start justify-between">
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <Archive className="h-4 w-4 text-muted-foreground" />
          {message.author?.displayName && <span className="text-sm font-medium">Von: {message.author.displayName}</span>}
          {message.authorId === userId && <span className="text-sm font-medium text-primary">Gesendet</span>}
          {message.isForAllUsers && <Badge variant="secondary" className="text-xs">An alle</Badge>}
        </div>
        <h4 className="font-medium text-sm mb-1">{message.title}</h4>
        <p className="text-xs text-muted-foreground mb-2">{message.content}</p>
        <p className="text-xs text-muted-foreground">Gesendet: {formatDate(message.createdAt)}</p>

        {message.authorId !== userId && (
          <div className="mt-2"><div className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded inline-block">✓ Als gelesen bestätigt</div></div>
        )}

        {message.authorId === userId && message.isForAllUsers && message.confirmations.length > 0 && (
          <div className="mt-2">
            <div className="text-xs font-medium text-muted-foreground mb-1">Bestätigt von:</div>
            <div className="flex flex-wrap gap-1">
              {message.confirmations.map((c) => (
                <div key={c.userId} className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                  {c.profile?.displayName || 'Unbekannt'} - {formatShortDate(c.confirmedAt)}
                </div>
              ))}
            </div>
          </div>
        )}

        {message.authorId === userId && !message.isForAllUsers && message.recipients.length > 0 && (
          <div className="mt-2">
            <div className="text-xs font-medium text-muted-foreground mb-1">Gelesen von:</div>
            <div className="flex flex-wrap gap-1">
              {message.recipients.filter(r => r.hasRead).map((r) => (
                <div key={r.recipientId} className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                  {r.profile?.displayName || 'Unbekannt'} - {r.readAt && formatShortDate(r.readAt)}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  </div>
));

ArchivedMessageCard.displayName = 'ArchivedMessageCard';

export const PaginationControls: React.FC<{
  currentPage: number;
  totalMessages: number;
  messagesPerPage: number;
  onPageChange: (page: number) => void;
}> = ({ currentPage, totalMessages, messagesPerPage, onPageChange }) => {
  const totalPages = Math.ceil(totalMessages / messagesPerPage);
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between mt-4 px-2">
      <Button variant="outline" size="sm" onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 0}><ChevronLeft className="h-4 w-4" />Zurück</Button>
      <span className="text-sm text-muted-foreground">Seite {currentPage + 1} von {totalPages}</span>
      <Button variant="outline" size="sm" onClick={() => onPageChange(currentPage + 1)} disabled={currentPage >= totalPages - 1}>Weiter<ChevronRight className="h-4 w-4" /></Button>
    </div>
  );
};
