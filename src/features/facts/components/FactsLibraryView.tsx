import { useMemo, useState } from "react";
import { Hash, PlusIcon, SearchIcon, ArchiveIcon, ArchiveRestoreIcon, TrashIcon, ExternalLinkIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useFacts, useUpsertFact, useArchiveFact, useDeleteFact } from "../hooks/useFacts";
import { FactEditDialog } from "./FactEditDialog";
import { useDossiers } from "@/features/dossiers/hooks/useDossiers";
import type { FactRow } from "../types";

export function FactsLibraryView() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<FactRow | "new" | null>(null);

  const { data: facts = [], isLoading } = useFacts({
    search,
    tags: activeTag ? [activeTag] : undefined,
    includeArchived: showArchived,
  });
  const { data: dossiers = [] } = useDossiers();
  const upsert = useUpsertFact();
  const archive = useArchiveFact();
  const del = useDeleteFact();

  const dossierMap = useMemo(() => {
    const m = new Map<string, string>();
    dossiers.forEach((d) => m.set(d.id, d.title));
    return m;
  }, [dossiers]);

  const allTags = useMemo(() => {
    const s = new Set<string>();
    facts.forEach((f) => f.tags?.forEach((t) => s.add(t)));
    return Array.from(s).sort();
  }, [facts]);

  return (
    <div className="p-4 space-y-4 max-w-5xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Hash className="h-5 w-5 text-primary" />
            <h1 className="text-title font-semibold">Fakten-Bibliothek</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Wiederverwendbare Datenpunkte mit Quelle, Tags und Verknüpfung.
          </p>
        </div>
        <Button size="sm" onClick={() => setEditing("new")}>
          <PlusIcon className="h-4 w-4 mr-2" />
          Neuer Fakt
        </Button>
      </div>

      <div className="flex gap-2 items-center">
        <div className="relative flex-1">
          <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Fakten oder Quelle durchsuchen…"
            className="pl-9"
          />
        </div>
        <Button
          variant={showArchived ? "default" : "outline"}
          size="sm"
          onClick={() => setShowArchived((v) => !v)}
        >
          <ArchiveIcon className="h-4 w-4 mr-2" />
          Archiv
        </Button>
      </div>

      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTag(null)}
            className={`px-2.5 py-1 rounded-full text-xs ${
              !activeTag ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"
            }`}
          >
            Alle
          </button>
          {allTags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => setActiveTag(activeTag === tag ? null : tag)}
              className={`px-2.5 py-1 rounded-full text-xs ${
                activeTag === tag
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/70"
              }`}
            >
              #{tag}
            </button>
          ))}
        </div>
      )}

      <Card className="divide-y">
        {isLoading && <div className="p-6 text-center text-sm text-muted-foreground">Lädt…</div>}
        {!isLoading && facts.length === 0 && (
          <div className="p-10 text-center text-muted-foreground">
            <Hash className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p className="text-sm">Noch keine Fakten in der Bibliothek.</p>
            <p className="text-xs">Lege deinen ersten Fakt an, um ihn in Vorbereitungen wiederzuverwenden.</p>
          </div>
        )}
        {facts.map((fact) => (
          <div key={fact.id} className="p-4 space-y-2 hover:bg-muted/30 transition-colors">
            <div className="flex items-start gap-3">
              <button
                type="button"
                onClick={() => setEditing(fact)}
                className="flex-1 text-left text-sm leading-relaxed"
              >
                {fact.text || <span className="italic text-muted-foreground">Ohne Text</span>}
              </button>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => archive.mutate({ id: fact.id, archived: !fact.is_archived })}
                  aria-label={fact.is_archived ? "Reaktivieren" : "Archivieren"}
                >
                  {fact.is_archived ? <ArchiveRestoreIcon className="h-4 w-4" /> : <ArchiveIcon className="h-4 w-4" />}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => {
                    if (confirm("Fakt endgültig löschen?")) del.mutate(fact.id);
                  }}
                  aria-label="Löschen"
                >
                  <TrashIcon className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              {fact.source && <span>📎 {fact.source}</span>}
              {fact.tags?.map((t) => (
                <Badge key={t} variant="outline" className="text-[10px]">
                  #{t}
                </Badge>
              ))}
              {fact.dossier_id && dossierMap.get(fact.dossier_id) && (
                <button
                  type="button"
                  onClick={() => navigate(`/dossiers?dossier=${fact.dossier_id}`)}
                  className="inline-flex items-center gap-1 hover:text-primary"
                >
                  <ExternalLinkIcon className="h-3 w-3" />
                  {dossierMap.get(fact.dossier_id)}
                </button>
              )}
              {fact.usage_count > 0 && (
                <span className="ml-auto tabular-nums">
                  {fact.usage_count}× verwendet
                </span>
              )}
              {fact.is_archived && <Badge variant="secondary" className="text-[10px]">Archiviert</Badge>}
            </div>
          </div>
        ))}
      </Card>

      {editing && (
        <FactEditDialog
          fact={editing === "new" ? null : editing}
          dossiers={dossiers.map((d) => ({ id: d.id, title: d.title }))}
          onClose={() => setEditing(null)}
          onSave={async (input) => {
            await upsert.mutateAsync(input);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}
