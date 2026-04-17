import { useMemo, useState } from "react";
import { useRecentEntriesAcrossDossiers } from "../hooks/useDossierEntries";
import { useDossiers } from "../hooks/useDossiers";
import { ENTRY_TYPE_CONFIG, type EntryType } from "../types";
import { formatDistanceToNow, format } from "date-fns";
import { de } from "date-fns/locale";
import { Loader2, Radio, FolderOpen, ExternalLink } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface MeinRadarViewProps {
  onSelectDossier: (id: string) => void;
}

const RANGE_OPTIONS: { value: string; label: string; days: number }[] = [
  { value: "1", label: "Heute", days: 1 },
  { value: "7", label: "Letzte 7 Tage", days: 7 },
  { value: "14", label: "Letzte 14 Tage", days: 14 },
  { value: "30", label: "Letzte 30 Tage", days: 30 },
];

export function MeinRadarView({ onSelectDossier }: MeinRadarViewProps) {
  const [range, setRange] = useState("7");
  const days = Number(range);
  const { data: entries, isLoading } = useRecentEntriesAcrossDossiers(days);
  const { data: dossiers } = useDossiers();

  const dossierMap = useMemo(() => {
    const m = new Map<string, string>();
    dossiers?.forEach((d) => m.set(d.id, d.title));
    return m;
  }, [dossiers]);

  const groupedByDay = useMemo(() => {
    if (!entries) return [];
    const groups = new Map<string, typeof entries>();
    for (const e of entries) {
      const day = format(new Date(e.created_at), "yyyy-MM-dd");
      if (!groups.has(day)) groups.set(day, []);
      groups.get(day)!.push(e);
    }
    return Array.from(groups.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [entries]);

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Radio className="h-4 w-4 text-primary" />
            Mein Radar
          </h2>
          <p className="text-xs text-muted-foreground">Neue Einträge über alle Dossiers hinweg</p>
        </div>
        <Select value={range} onValueChange={setRange}>
          <SelectTrigger className="h-8 text-xs w-auto min-w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RANGE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="animate-spin h-6 w-6 text-muted-foreground" />
        </div>
      ) : !entries?.length ? (
        <div className="flex flex-col items-center py-12 text-muted-foreground gap-2">
          <Radio className="h-10 w-10 opacity-40" />
          <p className="text-sm">Keine neuen Einträge im gewählten Zeitraum</p>
        </div>
      ) : (
        <div className="space-y-5">
          {groupedByDay.map(([day, dayEntries]) => (
            <div key={day} className="space-y-2">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {format(new Date(day), "EEEE, d. MMMM", { locale: de })}
                <span className="ml-2 font-normal normal-case tracking-normal">
                  · {dayEntries.length} Eintrag{dayEntries.length === 1 ? "" : "e"}
                </span>
              </h3>
              <div className="space-y-1.5">
                {dayEntries.map((e) => {
                  const cfg = ENTRY_TYPE_CONFIG[e.entry_type as EntryType] ?? { label: e.entry_type, icon: "📄" };
                  const dossierTitle = e.dossier_id ? dossierMap.get(e.dossier_id) : null;
                  return (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => e.dossier_id && onSelectDossier(e.dossier_id)}
                      className="w-full text-left rounded-md border border-border bg-card hover:bg-muted/40 transition-colors p-3 space-y-1"
                    >
                      <div className="flex items-center gap-2 text-sm">
                        <span>{cfg.icon}</span>
                        <span className="font-medium truncate flex-1">{e.title || "Ohne Titel"}</span>
                        <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                          {formatDistanceToNow(new Date(e.created_at), { addSuffix: true, locale: de })}
                        </span>
                      </div>
                      {e.content && (
                        <p className="text-xs text-muted-foreground line-clamp-2 pl-6">{e.content}</p>
                      )}
                      <div className="flex items-center gap-3 pl-6 text-[11px] text-muted-foreground">
                        {dossierTitle && (
                          <span className="inline-flex items-center gap-1 text-primary">
                            <FolderOpen className="h-3 w-3" /> {dossierTitle}
                          </span>
                        )}
                        {e.source_url && (
                          <span className="inline-flex items-center gap-1">
                            <ExternalLink className="h-3 w-3" /> Quelle
                          </span>
                        )}
                        {e.tags.length > 0 && (
                          <span className="truncate">{e.tags.map((t) => `#${t}`).join(" ")}</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
