import { useState, useMemo } from "react";
import { SearchIcon, Hash, BookmarkPlusIcon } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useFacts } from "@/features/facts/hooks/useFacts";
import type { FactRow } from "@/features/facts/types";

interface Props {
  /** Optional: bevorzugte Vorschläge basierend auf Verknüpfungen der Vorbereitung. */
  suggestedDossierIds?: string[];
  suggestedContactIds?: string[];
  excludeFactIds?: string[];
  onPick: (fact: FactRow) => void;
  onCreateNew?: () => void;
  onClose: () => void;
}

export function FactsLibraryPicker({
  suggestedDossierIds = [],
  suggestedContactIds = [],
  excludeFactIds = [],
  onPick,
  onCreateNew,
  onClose,
}: Props) {
  const [search, setSearch] = useState("");
  const { data: allFacts = [], isLoading } = useFacts({ search });

  const { suggested, others } = useMemo(() => {
    const excl = new Set(excludeFactIds);
    const dossierSet = new Set(suggestedDossierIds);
    const contactSet = new Set(suggestedContactIds);
    const sug: FactRow[] = [];
    const oth: FactRow[] = [];
    allFacts.forEach((f) => {
      if (excl.has(f.id)) return;
      const isSug =
        (f.dossier_id && dossierSet.has(f.dossier_id)) ||
        (f.contact_id && contactSet.has(f.contact_id));
      (isSug ? sug : oth).push(f);
    });
    return { suggested: sug, others: oth };
  }, [allFacts, excludeFactIds, suggestedDossierIds, suggestedContactIds]);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Hash className="h-4 w-4" />
            Fakt aus Bibliothek wählen
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 flex-1 overflow-hidden flex flex-col">
          <div className="relative">
            <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Suchen…"
              className="pl-9"
            />
          </div>

          <div className="flex-1 overflow-auto space-y-3 -mr-2 pr-2">
            {isLoading && <div className="text-center py-4 text-sm text-muted-foreground">Lädt…</div>}
            {!isLoading && allFacts.length === 0 && (
              <div className="text-center py-6 text-muted-foreground">
                <p className="text-sm">Keine Fakten gefunden.</p>
              </div>
            )}
            {suggested.length > 0 && (
              <Section label="Vorschläge" facts={suggested} onPick={onPick} />
            )}
            {others.length > 0 && (
              <Section label={suggested.length > 0 ? "Weitere" : "Bibliothek"} facts={others} onPick={onPick} />
            )}
          </div>

          {onCreateNew && (
            <Button variant="outline" size="sm" onClick={onCreateNew}>
              <BookmarkPlusIcon className="h-4 w-4 mr-2" />
              Neuen Fakt anlegen
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Section({ label, facts, onPick }: { label: string; facts: FactRow[]; onPick: (f: FactRow) => void }) {
  return (
    <div className="space-y-1">
      <div className="section-label text-muted-foreground">{label}</div>
      <div className="rounded-md border bg-card divide-y">
        {facts.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => onPick(f)}
            className="w-full text-left p-3 hover:bg-muted/40 transition-colors space-y-1"
          >
            <div className="text-sm">{f.text}</div>
            <div className="flex flex-wrap gap-1.5 text-xs text-muted-foreground">
              {f.source && <span>📎 {f.source}</span>}
              {f.tags?.map((t) => (
                <Badge key={t} variant="outline" className="text-[10px]">
                  #{t}
                </Badge>
              ))}
              {f.usage_count > 0 && <span className="ml-auto tabular-nums">{f.usage_count}× verwendet</span>}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
