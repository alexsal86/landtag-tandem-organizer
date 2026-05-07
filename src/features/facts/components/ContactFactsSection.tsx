import { useState } from "react";
import { Hash, PlusIcon, ArchiveIcon, ArchiveRestoreIcon, TrashIcon, SendIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useFacts, useUpsertFact, useArchiveFact, useDeleteFact } from "../hooks/useFacts";
import { useDossiers } from "@/features/dossiers/hooks/useDossiers";
import { FactEditDialog } from "./FactEditDialog";
import { AdoptFactDialog } from "./AdoptFactDialog";
import type { FactRow } from "../types";

interface Props {
  contactId: string;
}

export function ContactFactsSection({ contactId }: Props) {
  const [editing, setEditing] = useState<FactRow | "new" | null>(null);
  const [adoptFor, setAdoptFor] = useState<FactRow | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const { data: facts = [], isLoading } = useFacts({
    contactId,
    includeArchived: showArchived,
  });
  const { data: dossiers = [] } = useDossiers();
  const upsert = useUpsertFact();
  const archive = useArchiveFact();
  const del = useDeleteFact();

  return (
    <Card className="bg-card shadow-elegant border-border">
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <div className="flex items-center gap-2">
          <Hash className="h-5 w-5 text-primary" />
          <CardTitle>Fakten zu diesem Kontakt</CardTitle>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={showArchived ? "default" : "outline"}
            size="sm"
            onClick={() => setShowArchived((v) => !v)}
          >
            <ArchiveIcon className="h-4 w-4 mr-2" />
            Archiv
          </Button>
          <Button size="sm" onClick={() => setEditing("new")}>
            <PlusIcon className="h-4 w-4 mr-2" />
            Neuer Fakt
          </Button>
        </div>
      </CardHeader>
      <CardContent className="divide-y">
        {isLoading && <div className="py-6 text-sm text-muted-foreground">Lädt…</div>}
        {!isLoading && facts.length === 0 && (
          <div className="py-8 text-center text-muted-foreground">
            <Hash className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">Noch keine Fakten zu diesem Kontakt.</p>
            <p className="text-xs">Lege einen Fakt an – er ist in Vorbereitungen abrufbar.</p>
          </div>
        )}
        {facts.map((fact) => (
          <div key={fact.id} className="py-3 space-y-1.5">
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
                  onClick={() => setAdoptFor(fact)}
                  aria-label="In Vorbereitung übernehmen"
                  title="In Vorbereitung übernehmen"
                >
                  <SendIcon className="h-4 w-4" />
                </Button>
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
              {fact.usage_count > 0 && (
                <span className="ml-auto tabular-nums">{fact.usage_count}× verwendet</span>
              )}
              {fact.is_archived && <Badge variant="secondary" className="text-[10px]">Archiviert</Badge>}
            </div>
          </div>
        ))}
      </CardContent>

      {editing && (
        <FactEditDialog
          fact={editing === "new" ? null : editing}
          dossiers={dossiers.map((d) => ({ id: d.id, title: d.title }))}
          defaultContactId={contactId}
          onClose={() => setEditing(null)}
          onSave={async (input) => {
            await upsert.mutateAsync({ ...input, contact_id: contactId });
            setEditing(null);
          }}
        />
      )}

      {adoptFor && (
        <AdoptFactDialog
          fact={adoptFor}
          onClose={() => setAdoptFor(null)}
        />
      )}
    </Card>
  );
}
