import { useMemo, useState } from "react";
import {
  Hash, PlusIcon, SearchIcon, ArchiveIcon, ArchiveRestoreIcon, TrashIcon, ExternalLinkIcon,
  ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  useFactsPaginated, useFacts, useUpsertFact, useArchiveFact, useDeleteFact,
} from "../hooks/useFacts";
import { FactEditDialog } from "./FactEditDialog";
import { useDossiers } from "@/features/dossiers/hooks/useDossiers";
import type { FactRow, FactSortField, FactSortDir } from "../types";

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

export function FactsLibraryView() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<FactRow | "new" | null>(null);
  const [sortField, setSortField] = useState<FactSortField>("updated_at");
  const [sortDir, setSortDir] = useState<FactSortDir>("desc");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);

  // All-tags lookup (separate, unpaginated, archive-respecting)
  const { data: allFacts = [] } = useFacts({ includeArchived: showArchived });
  const allTags = useMemo(() => {
    const s = new Set<string>();
    allFacts.forEach((f) => f.tags?.forEach((t) => s.add(t)));
    return Array.from(s).sort();
  }, [allFacts]);

  const { data, isLoading } = useFactsPaginated({
    search,
    tags: activeTag ? [activeTag] : undefined,
    includeArchived: showArchived,
    sortField,
    sortDir,
    page,
    pageSize,
  });
  const facts = data?.rows ?? [];
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  const { data: dossiers = [] } = useDossiers();
  const upsert = useUpsertFact();
  const archive = useArchiveFact();
  const del = useDeleteFact();

  const dossierMap = useMemo(() => {
    const m = new Map<string, string>();
    dossiers.forEach((d) => m.set(d.id, d.title));
    return m;
  }, [dossiers]);

  const toggleSort = (field: FactSortField) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir(field === "text" ? "asc" : "desc");
    }
    setPage(0);
  };

  const SortIcon = ({ field }: { field: FactSortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 opacity-40" />;
    return sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
  };

  return (
    <div className="p-4 space-y-4 max-w-6xl">
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
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            placeholder="Fakten oder Quelle durchsuchen…"
            className="pl-9"
          />
        </div>
        <Button
          variant={showArchived ? "default" : "outline"}
          size="sm"
          onClick={() => { setShowArchived((v) => !v); setPage(0); }}
        >
          <ArchiveIcon className="h-4 w-4 mr-2" />
          Archiv
        </Button>
      </div>

      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => { setActiveTag(null); setPage(0); }}
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
              onClick={() => { setActiveTag(activeTag === tag ? null : tag); setPage(0); }}
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

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <button type="button" onClick={() => toggleSort("text")} className="inline-flex items-center gap-1 hover:text-foreground">
                  Fakt <SortIcon field="text" />
                </button>
              </TableHead>
              <TableHead className="w-[180px]">Quelle / Tags</TableHead>
              <TableHead className="w-[120px]">
                <button type="button" onClick={() => toggleSort("usage_count")} className="inline-flex items-center gap-1 hover:text-foreground">
                  Verwendung <SortIcon field="usage_count" />
                </button>
              </TableHead>
              <TableHead className="w-[140px]">
                <button type="button" onClick={() => toggleSort("updated_at")} className="inline-flex items-center gap-1 hover:text-foreground">
                  Aktualisiert <SortIcon field="updated_at" />
                </button>
              </TableHead>
              <TableHead className="w-[110px] text-right">Aktionen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-6">Lädt…</TableCell></TableRow>
            )}
            {!isLoading && facts.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-10">
                  <Hash className="h-10 w-10 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">Keine Fakten gefunden.</p>
                </TableCell>
              </TableRow>
            )}
            {facts.map((fact) => (
              <TableRow key={fact.id} className="hover:bg-muted/30">
                <TableCell>
                  <button
                    type="button"
                    onClick={() => setEditing(fact)}
                    className="text-left text-sm leading-relaxed"
                  >
                    {fact.text || <span className="italic text-muted-foreground">Ohne Text</span>}
                  </button>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1 text-xs text-muted-foreground">
                    {fact.source && <span className="block w-full truncate">📎 {fact.source}</span>}
                    {fact.tags?.slice(0, 3).map((t) => (
                      <Badge key={t} variant="outline" className="text-[10px]">#{t}</Badge>
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
                  </div>
                </TableCell>
                <TableCell className="tabular-nums text-sm">{fact.usage_count}×</TableCell>
                <TableCell className="text-xs text-muted-foreground tabular-nums">
                  {new Date(fact.updated_at).toLocaleDateString("de-DE")}
                  {fact.is_archived && <Badge variant="secondary" className="ml-1 text-[10px]">Archiv</Badge>}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost" size="icon" className="h-8 w-8"
                    onClick={() => archive.mutate({ id: fact.id, archived: !fact.is_archived })}
                    aria-label={fact.is_archived ? "Reaktivieren" : "Archivieren"}
                  >
                    {fact.is_archived ? <ArchiveRestoreIcon className="h-4 w-4" /> : <ArchiveIcon className="h-4 w-4" />}
                  </Button>
                  <Button
                    variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => { if (confirm("Fakt endgültig löschen?")) del.mutate(fact.id); }}
                    aria-label="Löschen"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <span>Zeilen pro Seite:</span>
          <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(0); }}>
            <SelectTrigger className="h-8 w-[80px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map((s) => <SelectItem key={s} value={String(s)}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="tabular-nums">
          {total === 0 ? "0" : `${page * pageSize + 1}–${Math.min((page + 1) * pageSize, total)} von ${total}`}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-8 w-8" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="px-2 tabular-nums">{page + 1} / {pageCount}</span>
          <Button variant="outline" size="icon" className="h-8 w-8" disabled={page + 1 >= pageCount} onClick={() => setPage((p) => p + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

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
