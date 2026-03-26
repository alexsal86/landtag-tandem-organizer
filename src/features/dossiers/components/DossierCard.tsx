import type { Dossier } from "../types";
import { formatDistanceToNow, isPast } from "date-fns";
import { de } from "date-fns/locale";
import { Bell, MessageSquare, Link2, HelpCircle } from "lucide-react";

interface DossierCardProps {
  dossier: Dossier;
  entryCounts?: { total: number; pinned: number };
  linkCount?: number;
  onSelect?: (id: string) => void;
}

const PRIORITY_BORDER: Record<string, string> = {
  hoch: "border-l-destructive",
  mittel: "border-l-warning",
  niedrig: "border-l-muted-foreground/30",
};

const STATUS_STYLE: Record<string, string> = {
  aktiv: "bg-primary/10 text-primary",
  beobachten: "bg-accent/10 text-accent-foreground",
  ruhend: "bg-muted text-muted-foreground",
  archiviert: "bg-muted text-muted-foreground",
};

export function DossierCard({ dossier, entryCounts, linkCount, onSelect }: DossierCardProps) {
  const isOverdue = dossier.next_review_at ? isPast(new Date(dossier.next_review_at)) : false;
  const hasOpenQuestions = !!dossier.open_questions?.trim();

  return (
    <button
      onClick={() => onSelect?.(dossier.id)}
      className={`w-full text-left rounded-lg border border-border border-l-4 ${PRIORITY_BORDER[dossier.priority] ?? "border-l-muted"} bg-card p-4 hover:shadow-md transition-all space-y-2 group`}
    >
      {/* Row 1: Title + badges */}
      <div className="flex items-start gap-2">
        <h3 className="font-semibold text-sm leading-tight flex-1 line-clamp-2">{dossier.title}</h3>
        <div className="flex items-center gap-1.5 shrink-0">
          {isOverdue && (
            <span className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive font-medium">
              <Bell className="h-3 w-3" /> Review
            </span>
          )}
          <span className={`text-[10px] px-2 py-0.5 rounded-full capitalize font-medium ${STATUS_STYLE[dossier.status] ?? "bg-muted text-muted-foreground"}`}>
            {dossier.status}
          </span>
        </div>
      </div>

      {/* Row 2: Summary */}
      {dossier.summary && (
        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{dossier.summary}</p>
      )}

      {/* Row 3: Stats + timestamp */}
      <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
        {entryCounts && entryCounts.total > 0 && (
          <span className="flex items-center gap-1">
            <MessageSquare className="h-3 w-3" /> {entryCounts.total}
          </span>
        )}
        {(linkCount ?? 0) > 0 && (
          <span className="flex items-center gap-1">
            <Link2 className="h-3 w-3" /> {linkCount}
          </span>
        )}
        {hasOpenQuestions && (
          <span className="flex items-center gap-1 text-warning">
            <HelpCircle className="h-3 w-3" /> Offene Fragen
          </span>
        )}
        <span className="ml-auto">
          {formatDistanceToNow(new Date(dossier.updated_at), { addSuffix: true, locale: de })}
        </span>
      </div>
    </button>
  );
}
