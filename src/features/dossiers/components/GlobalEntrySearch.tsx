import { useState, useMemo } from "react";
import { useGlobalEntrySearch } from "../hooks/useDossierEntries";
import { useDossiers } from "../hooks/useDossiers";
import { Input } from "@/components/ui/input";
import { Search, Loader2, FolderOpen } from "lucide-react";
import { ENTRY_TYPE_CONFIG, type EntryType } from "../types";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";

interface GlobalEntrySearchProps {
  onSelectDossier: (id: string) => void;
}

function snippet(text: string, term: string, ctx = 60): string {
  const lower = text.toLowerCase();
  const idx = lower.indexOf(term.toLowerCase());
  if (idx < 0) return text.slice(0, 120);
  const start = Math.max(0, idx - ctx);
  const end = Math.min(text.length, idx + term.length + ctx);
  return (start > 0 ? "… " : "") + text.slice(start, end) + (end < text.length ? " …" : "");
}

function highlight(text: string, term: string) {
  if (!term) return text;
  const safe = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.split(new RegExp(`(${safe})`, "gi")).map((p, i) =>
    p.toLowerCase() === term.toLowerCase()
      ? <mark key={i} className="bg-primary/25 text-foreground rounded px-0.5">{p}</mark>
      : <span key={i}>{p}</span>
  );
}

export function GlobalEntrySearch({ onSelectDossier }: GlobalEntrySearchProps) {
  const [term, setTerm] = useState("");
  const { data: results, isFetching } = useGlobalEntrySearch(term);
  const { data: dossiers } = useDossiers();

  const dossierMap = useMemo(() => {
    const m = new Map<string, string>();
    dossiers?.forEach((d) => m.set(d.id, d.title));
    return m;
  }, [dossiers]);

  const grouped = useMemo(() => {
    if (!results) return [];
    const map = new Map<string, typeof results>();
    for (const r of results) {
      const key = r.dossier_id ?? "__inbox__";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    return Array.from(map.entries()).map(([dossierId, entries]) => ({
      dossierId,
      title: dossierId === "__inbox__" ? "Eingang" : (dossierMap.get(dossierId) ?? "Unbekanntes Dossier"),
      entries,
    }));
  }, [results, dossierMap]);

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Alle Einträge durchsuchen …"
          className="pl-7 h-8 text-xs"
        />
        {isFetching && term.length >= 2 && (
          <Loader2 className="absolute right-2 top-2 h-3.5 w-3.5 animate-spin text-muted-foreground" />
        )}
      </div>

      {term.trim().length >= 2 && (
        <div className="rounded-md border border-border bg-card max-h-[400px] overflow-y-auto">
          {!results || results.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">
              {isFetching ? "Suche …" : "Keine Treffer"}
            </p>
          ) : (
            <div className="divide-y divide-border">
              {grouped.map((g) => (
                <div key={g.dossierId} className="p-2">
                  <button
                    type="button"
                    onClick={() => g.dossierId !== "__inbox__" && onSelectDossier(g.dossierId)}
                    disabled={g.dossierId === "__inbox__"}
                    className="flex items-center gap-1.5 text-[11px] font-medium text-primary hover:underline mb-1 px-1"
                  >
                    <FolderOpen className="h-3 w-3" />
                    {g.title} <span className="text-muted-foreground font-normal">({g.entries.length})</span>
                  </button>
                  <div className="space-y-1">
                    {g.entries.slice(0, 3).map((e) => {
                      const cfg = ENTRY_TYPE_CONFIG[e.entry_type as EntryType] ?? { label: e.entry_type, icon: "📄" };
                      const text = e.content ?? e.title ?? "";
                      return (
                        <button
                          key={e.id}
                          type="button"
                          onClick={() => e.dossier_id && onSelectDossier(e.dossier_id)}
                          className="w-full text-left rounded px-1.5 py-1 hover:bg-muted/60 space-y-0.5"
                        >
                          <div className="flex items-center gap-1.5 text-xs">
                            <span>{cfg.icon}</span>
                            <span className="truncate flex-1 font-medium">
                              {highlight(e.title || "Ohne Titel", term)}
                            </span>
                            <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                              {formatDistanceToNow(new Date(e.created_at), { addSuffix: true, locale: de })}
                            </span>
                          </div>
                          {text && (
                            <p className="text-[11px] text-muted-foreground line-clamp-2 pl-5">
                              {highlight(snippet(text, term), term)}
                            </p>
                          )}
                        </button>
                      );
                    })}
                    {g.entries.length > 3 && (
                      <p className="text-[10px] text-muted-foreground px-1.5">
                        +{g.entries.length - 3} weitere
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
