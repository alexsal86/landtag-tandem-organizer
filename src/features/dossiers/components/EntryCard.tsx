import type { DossierEntry, EntryType } from "../types";
import { ENTRY_TYPE_CONFIG } from "../types";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";
import { useDossiers } from "../hooks/useDossiers";
import { useAssignEntryToDossier, useDeleteEntry, useUpdateEntryTags } from "../hooks/useDossierEntries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Trash2, FolderInput, Check, Pin, PinOff, Tag, X, ExternalLink, CalendarClock } from "lucide-react";
import { useState, KeyboardEvent } from "react";
import { useUpdateEntryFollowup } from "../hooks/useEntryFollowups";
import { format, isPast, isToday } from "date-fns";
import { Input as DateInput } from "@/components/ui/input";

interface EntryCardProps {
  entry: DossierEntry;
  showAssign?: boolean;
  onPin?: (entryId: string, pinned: boolean) => void;
  /** Optional: highlight matching text in title/content (A: global search) */
  highlight?: string;
  /** Optional: click handler on tag chip (E: tag filter) */
  onTagClick?: (tag: string) => void;
}

function highlightText(text: string, term: string) {
  if (!term || term.length < 2) return text;
  const safe = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${safe})`, "gi"));
  return parts.map((p, i) =>
    p.toLowerCase() === term.toLowerCase()
      ? <mark key={i} className="bg-primary/20 text-foreground rounded px-0.5">{p}</mark>
      : <span key={i}>{p}</span>
  );
}

export function EntryCard({ entry, onPin, highlight, onTagClick }: EntryCardProps) {
  const config = ENTRY_TYPE_CONFIG[entry.entry_type as EntryType] ?? { label: entry.entry_type, icon: '📄' };
  const { data: dossiers } = useDossiers();
  const assignEntry = useAssignEntryToDossier();
  const deleteEntry = useDeleteEntry();
  const updateTags = useUpdateEntryTags();
  const updateFollowup = useUpdateEntryFollowup();
  const [assigning, setAssigning] = useState(false);
  const [selectedDossier, setSelectedDossier] = useState<string>("");
  const [tagInput, setTagInput] = useState("");
  const [followupInput, setFollowupInput] = useState<string>(
    entry.followup_at ? format(new Date(entry.followup_at), "yyyy-MM-dd") : ""
  );

  const isInbox = entry.dossier_id === null;
  const emailMeta = entry.entry_type === "email" && entry.metadata
    ? entry.metadata as Record<string, unknown>
    : null;

  const handleAssign = () => {
    if (!selectedDossier) return;
    assignEntry.mutate(
      { entryId: entry.id, dossierId: selectedDossier },
      { onSuccess: () => { setAssigning(false); setSelectedDossier(""); } }
    );
  };

  const addTag = (raw: string) => {
    const t = raw.trim().toLowerCase().replace(/^#/, "");
    if (!t || entry.tags.includes(t)) return;
    updateTags.mutate({ entryId: entry.id, tags: [...entry.tags, t] });
    setTagInput("");
  };

  const removeTag = (t: string) => {
    updateTags.mutate({ entryId: entry.id, tags: entry.tags.filter((x) => x !== t) });
  };

  const handleTagKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(tagInput);
    } else if (e.key === "Backspace" && !tagInput && entry.tags.length) {
      removeTag(entry.tags[entry.tags.length - 1]);
    }
  };

  return (
    <div className={`rounded-md border border-border bg-card p-3 space-y-1.5 group ${entry.is_pinned ? "ring-1 ring-primary/20 bg-primary/[0.02]" : ""}`}>
      <div className="flex items-center gap-2 text-sm">
        <span>{config.icon}</span>
        {entry.is_pinned && <Pin className="h-3 w-3 text-primary shrink-0" />}
        <span className="font-medium truncate flex-1">
          {entry.title ? highlightText(entry.title, highlight ?? "") : 'Ohne Titel'}
        </span>
        {entry.followup_at && (
          <span
            className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded shrink-0 ${
              isPast(new Date(entry.followup_at)) && !isToday(new Date(entry.followup_at))
                ? "bg-destructive/15 text-destructive"
                : isToday(new Date(entry.followup_at))
                ? "bg-warning/15 text-warning"
                : "bg-primary/10 text-primary"
            }`}
            title="Wiedervorlage"
          >
            <CalendarClock className="h-2.5 w-2.5" />
            {format(new Date(entry.followup_at), "dd.MM.")}
          </span>
        )}
        {!entry.is_curated && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-warning/10 text-warning shrink-0">roh</span>
        )}
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true, locale: de })}
        </span>
      </div>

      {/* Email metadata */}
      {emailMeta && (
        <div className="text-xs text-muted-foreground space-y-0.5 pl-6">
          {emailMeta.from ? <p>Von: {String(emailMeta.from)}</p> : null}
          {emailMeta.to ? <p>An: {String(emailMeta.to)}</p> : null}
          {emailMeta.date ? <p>Datum: {String(emailMeta.date)}</p> : null}
        </div>
      )}

      {entry.content && (
        <p className="text-sm text-muted-foreground line-clamp-3 pl-6 whitespace-pre-wrap">
          {highlightText(entry.content, highlight ?? "")}
        </p>
      )}
      {entry.source_url && (
        <a
          href={entry.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-primary hover:underline truncate flex items-center gap-1 pl-6"
        >
          <ExternalLink className="h-3 w-3 shrink-0" />
          <span className="truncate">{entry.source_url}</span>
        </a>
      )}
      {entry.file_name && (
        <p className="text-xs text-muted-foreground pl-6">📎 {entry.file_name}</p>
      )}

      {/* Tags */}
      {entry.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 pl-6">
          {entry.tags.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onTagClick?.(t)}
              className="group/tag inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
            >
              <span>#{t}</span>
              <X
                className="h-2.5 w-2.5 opacity-0 group-hover/tag:opacity-60 hover:opacity-100"
                onClick={(e) => { e.stopPropagation(); removeTag(t); }}
              />
            </button>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-1 pt-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {onPin && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => onPin(entry.id, !entry.is_pinned)}
          >
            {entry.is_pinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
            {entry.is_pinned ? "Lösen" : "Anpinnen"}
          </Button>
        )}

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
              <Tag className="h-3 w-3" /> Tag
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-2" side="bottom" align="start">
            <Input
              autoFocus
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleTagKey}
              placeholder="Tag eingeben, Enter …"
              className="h-8 text-xs"
            />
            <p className="text-[10px] text-muted-foreground mt-1.5 px-1">
              Enter speichert · Komma trennt · Backspace entfernt letzten
            </p>
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
              <CalendarClock className="h-3 w-3" /> {entry.followup_at ? "Wiedervorlage" : "Followup"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-2 space-y-2" side="bottom" align="start">
            <DateInput
              type="date"
              value={followupInput}
              onChange={(e) => setFollowupInput(e.target.value)}
              className="h-8 text-xs"
            />
            <div className="flex items-center justify-between gap-2">
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                disabled={!entry.followup_at && !followupInput}
                onClick={() => {
                  setFollowupInput("");
                  updateFollowup.mutate({ entryId: entry.id, followupAt: null });
                }}
              >
                Entfernen
              </Button>
              <Button
                size="sm"
                className="h-7 text-xs"
                disabled={!followupInput}
                onClick={() => {
                  const iso = new Date(followupInput + "T09:00:00").toISOString();
                  updateFollowup.mutate({ entryId: entry.id, followupAt: iso });
                }}
              >
                Speichern
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        {isInbox && !assigning && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setAssigning(true)}
          >
            <FolderInput className="h-3 w-3" /> Zuordnen
          </Button>
        )}
        {assigning && (
          <div className="flex items-center gap-1 flex-1">
            <Select value={selectedDossier} onValueChange={setSelectedDossier}>
              <SelectTrigger className="h-7 text-xs flex-1">
                <SelectValue placeholder="Dossier wählen …" />
              </SelectTrigger>
              <SelectContent>
                {dossiers?.map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleAssign}
              disabled={!selectedDossier || assignEntry.isPending}
            >
              <Check className="h-3 w-3" />
            </Button>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 ml-auto text-destructive/60 hover:text-destructive"
          onClick={() => deleteEntry.mutate(entry.id)}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
