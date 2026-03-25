import type { DossierEntry, EntryType } from "../types";
import { ENTRY_TYPE_CONFIG } from "../types";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";

interface EntryCardProps {
  entry: DossierEntry;
}

export function EntryCard({ entry }: EntryCardProps) {
  const config = ENTRY_TYPE_CONFIG[entry.entry_type as EntryType] ?? { label: entry.entry_type, icon: '📄' };

  return (
    <div className="rounded-md border border-border bg-card p-3 space-y-1">
      <div className="flex items-center gap-2 text-sm">
        <span>{config.icon}</span>
        <span className="font-medium truncate flex-1">{entry.title || 'Ohne Titel'}</span>
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true, locale: de })}
        </span>
      </div>
      {entry.content && (
        <p className="text-sm text-muted-foreground line-clamp-3">{entry.content}</p>
      )}
      {entry.source_url && (
        <a
          href={entry.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-primary hover:underline truncate block"
        >
          {entry.source_url}
        </a>
      )}
      {entry.file_name && (
        <p className="text-xs text-muted-foreground">📎 {entry.file_name}</p>
      )}
    </div>
  );
}
