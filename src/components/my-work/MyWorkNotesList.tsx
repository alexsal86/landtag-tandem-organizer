import { useQuickNotesData } from "@/features/quick-notes/useQuickNotesData";
import { QuickNotesSyncStatus } from "@/features/quick-notes/QuickNotesSyncStatus";
import { useTenant } from "@/hooks/useTenant";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Globe, Archive, Search, X, CheckSquare, Trash2, Settings2, Filter } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useNoteColorPalette, colorLabel } from "@/components/my-work/useNoteColorPalette";
import { NoteColorPaletteDialog } from "@/components/my-work/NoteColorPaletteDialog";
import { QuickNotesList } from "@/components/shared/QuickNotesList";
import { GlobalNoteShareDialog } from "@/components/shared/GlobalNoteShareDialog";
import { NotesArchiveDialog } from "@/components/shared/NotesArchiveDialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { notify } from "@/lib/notify";
import { QUICK_NOTE_FILTERS, type QuickNoteFilter } from "@/components/shared/quickNoteBoard";

interface MyWorkNotesListProps {
  refreshTrigger?: number;
}

export function MyWorkNotesList({ refreshTrigger }: MyWorkNotesListProps) {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const { patchNote } = useQuickNotesData();
  const [globalShareOpen, setGlobalShareOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [localRefreshTrigger, setLocalRefreshTrigger] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [counts, setCounts] = useState({ filteredCount: 0, totalCount: 0 });
  const [filter, setFilter] = useState<QuickNoteFilter>("all");
  const [colorFilter, setColorFilter] = useState<string | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [visibleIds, setVisibleIds] = useState<string[]>([]);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const { palette, save } = useNoteColorPalette();

  const refresh = () => setLocalRefreshTrigger((prev) => prev + 1);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const exitSelectMode = () => { setSelectMode(false); setSelectedIds(new Set()); };

  const runBulk = async (kind: "archive" | "delete") => {
    if (!user?.id || !currentTenant || selectedIds.size === 0) return;
    setBulkBusy(true);
    const ids = [...selectedIds];
    const now = new Date();
    const patch = kind === "archive"
      ? { is_archived: true, archived_at: now.toISOString() }
      : { deleted_at: now.toISOString(), permanent_delete_at: new Date(now.getTime() + 30 * 864e5).toISOString() };
    const results = await Promise.allSettled(ids.map(id => patchNote({ id, patch })));
    setBulkBusy(false);
    const failed = ids.filter((_id, index) => results[index].status === "rejected");
    const count = ids.length - failed.length;
    if (count) notify.success(kind === "archive" ? `${count} Notizen archiviert` : `${count} Notizen in den Papierkorb verschoben`);
    if (failed.length) {
      setSelectedIds(new Set(failed));
      notify.error(`${failed.length} Notiz(en) konnten nicht geändert werden. Freigegebene oder noch nicht synchronisierte Notizen bitte einzeln prüfen.`);
    } else exitSelectMode();
  };

  const filterActive = filter !== "all" || colorFilter !== null || searchQuery.length > 0;

  return (
    <>
      <section className="w-full space-y-4" aria-label="Meine Notizen">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={showFilters || filterActive ? "secondary" : "ghost"}
            size="sm"
            className="mr-auto"
            onClick={() => setShowFilters((v) => !v)}
            aria-expanded={showFilters}
          >
            <Filter className="h-4 w-4" />
            <span className="ml-1.5">Filter{filterActive ? " aktiv" : ""}</span>
          </Button>
          <div className="relative w-56">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Notizen durchsuchen..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 pl-8 pr-8 text-sm"
              aria-label="Notizen durchsuchen"
            />
            {searchQuery && (
              <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6" onClick={() => setSearchQuery("")} aria-label="Suche leeren">
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
          <Button variant={selectMode ? "secondary" : "ghost"} size="sm" onClick={() => (selectMode ? exitSelectMode() : setSelectMode(true))} title="Mehrere auswählen">
            <CheckSquare className="h-4 w-4" />
            <span className="ml-1.5 hidden md:inline">Auswählen</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setArchiveOpen(true)} title="Archiv & Papierkorb" aria-label="Archiv & Papierkorb">
            <Archive className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setGlobalShareOpen(true)} title="Alle Notizen freigeben" aria-label="Alle Notizen freigeben">
            <Globe className="h-4 w-4" />
          </Button>
        </div>

        {(showFilters || filterActive) && <div className="flex flex-wrap items-center gap-2">
          {QUICK_NOTE_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              title={f.hint}
              onClick={() => setFilter(f.value)}
              aria-pressed={filter === f.value}
              className={cn(
                "h-7 rounded-pill border px-3 text-caption transition-colors",
                filter === f.value ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground hover:bg-muted",
              )}
            >
              {f.label}
            </button>
          ))}
          <div className="mx-1 h-5 w-px bg-border" />
          <TooltipProvider>
            {palette.map((c) => (
              <Tooltip key={c.value}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label={`Nach Farbe ${colorLabel(c)} filtern`}
                    aria-pressed={colorFilter === c.value}
                    onClick={() => setColorFilter((prev) => (prev === c.value ? null : c.value))}
                    className={cn("h-5 w-5 rounded-full border-2 transition-transform", colorFilter === c.value ? "border-foreground scale-110" : "border-transparent")}
                    style={{ backgroundColor: c.value }}
                  />
                </TooltipTrigger>
                <TooltipContent>{colorLabel(c)}</TooltipContent>
              </Tooltip>
            ))}
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" onClick={() => setPaletteOpen(true)} className="flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground hover:text-foreground" aria-label="Farben anpassen">
                  <Settings2 className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Farben & Bedeutungen anpassen</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          {filterActive && (
            <span className="ml-auto text-caption text-muted-foreground tabular-nums">
              {counts.filteredCount} von {counts.totalCount}
            </span>
          )}
        </div>}

        {selectMode && (
          <div className="sticky top-0 z-sticky flex flex-wrap items-center gap-2 rounded-lg border bg-card px-3 py-2 shadow-sm">
            <span className="text-sm font-medium tabular-nums">{selectedIds.size} ausgewählt</span>
            <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set(visibleIds))}>Alle sichtbaren</Button>
            <div className="ml-auto flex gap-2">
              <Button variant="outline" size="sm" disabled={selectedIds.size === 0 || bulkBusy} onClick={() => void runBulk("archive")}>
                <Archive className="h-4 w-4 mr-1.5" />Archivieren
              </Button>
              <Button variant="outline" size="sm" className="text-destructive" disabled={selectedIds.size === 0 || bulkBusy} onClick={() => void runBulk("delete")}>
                <Trash2 className="h-4 w-4 mr-1.5" />Löschen
              </Button>
              <Button variant="ghost" size="sm" onClick={exitSelectMode}>Fertig</Button>
            </div>
          </div>
        )}

        <QuickNotesSyncStatus />
        <QuickNotesList
          refreshTrigger={(refreshTrigger || 0) + localRefreshTrigger}
          showHeader={false}
          maxHeight="none"
          searchPlacement="hidden"
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          onCountsChange={setCounts}
          layout="grid"
          filter={filter}
          colorFilter={colorFilter}
          selectable={selectMode}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onVisibleIdsChange={setVisibleIds}
        />

      </section>

      <NoteColorPaletteDialog open={paletteOpen} onOpenChange={setPaletteOpen} palette={palette} onSave={save} />

      <GlobalNoteShareDialog open={globalShareOpen} onOpenChange={setGlobalShareOpen} />

      <NotesArchiveDialog
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        refreshTrigger={localRefreshTrigger}
        onRestore={refresh}
      />
    </>
  );
}
