import { NoteColorChoices } from "@/components/my-work/NoteColorChoices";
import { useQuickNotesData } from "@/features/quick-notes/useQuickNotesData";
import { QuickNotesSyncStatus, QuickNotesSyncIndicator } from "@/features/quick-notes/QuickNotesSyncStatus";
import { useTenant } from "@/hooks/useTenant";
import { useCallback, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Archive, Search, X, CheckSquare, Trash2, Settings2, Pin, ClockAlert, Clock, Circle, Link2, SlidersHorizontal, MoreHorizontal, Share2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useNoteColorPalette } from "@/components/my-work/useNoteColorPalette";
import { NoteColorPaletteDialog } from "@/components/my-work/NoteColorPaletteDialog";
import { QuickNotesList, type QuickNoteCounts } from "@/components/shared/QuickNotesList";
import { GlobalNoteShareDialog } from "@/components/shared/GlobalNoteShareDialog";
import { NotesArchiveDialog } from "@/components/shared/NotesArchiveDialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { notify } from "@/lib/notify";
import { QUICK_NOTE_FILTERS, type QuickNoteFilter } from "@/components/shared/quickNoteBoard";

const primaryFilters: QuickNoteFilter[] = ["all", "pinned", "stale"];
const filterIcons = { pinned: Pin, stale: ClockAlert, due: Clock, shared: Share2, open: Circle, linked: Link2 };

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
  const [counts, setCounts] = useState<QuickNoteCounts>({ filteredCount: 0, totalCount: 0, byFilter: {} });
  const [filter, setFilter] = useState<QuickNoteFilter>("all");
  const [colorFilter, setColorFilter] = useState<string | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [visibleIds, setVisibleIds] = useState<string[]>([]);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
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

  const renderFilterChip = (option: (typeof QUICK_NOTE_FILTERS)[number]) => {
    const { value, label, hint } = option;
    const active = filter === value;
    const Icon = value === "all" ? null : filterIcons[value];
    const count = counts.byFilter[value] ?? 0;

    return (
      <button
        key={value}
        type="button"
        role="radio"
        aria-checked={active}
        title={hint}
        onClick={() => setFilter(value)}
        className={cn(
          "inline-flex h-7 items-center gap-1.5 rounded-pill border px-3 text-[13px] font-normal transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
          active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
      >
        {Icon && <Icon className="h-3.5 w-3.5" aria-hidden="true" />}
        {label}
        {value === "stale" && <span className="tabular-nums">{count}</span>}
        {!primaryFilters.includes(value) && <span className="tabular-nums">({count})</span>}
      </button>
    );
  };

  return (
    <>
      <section className="w-full space-y-4" aria-label="Meine Notizen">

        <div className="flex flex-wrap items-center gap-2" role="toolbar" aria-label="Notizen filtern">
          <div className="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label="Filter">
            {QUICK_NOTE_FILTERS.filter(f => primaryFilters.includes(f.value)).map(renderFilterChip)}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 rounded-pill border-border bg-background px-3 text-[13px] font-normal text-muted-foreground hover:bg-muted hover:text-muted-foreground">
                  <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="ml-1.5">Weitere Filter{colorFilter || !primaryFilters.includes(filter) ? " aktiv" : ""}</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-72 max-w-[var(--radix-popover-content-available-width)]">
                <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Weitere Filter">
                  {QUICK_NOTE_FILTERS.filter(f => !primaryFilters.includes(f.value)).map(renderFilterChip)}
                </div>
                <div className="mt-4 space-y-2 border-t border-border pt-4">
                  <div className="flex items-center gap-1.5">
                    <span className="section-label">Farben</span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button type="button" onClick={() => setPaletteOpen(true)} className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Farben und Bedeutungen anpassen">
                          <Settings2 className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>Farben & Bedeutungen anpassen</TooltipContent>
                    </Tooltip>
                  </div>
                  <NoteColorChoices palette={palette} selected={colorFilter} onSelect={value => setColorFilter(previous => previous === value ? null : value)} />
                  {colorFilter && (
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setColorFilter(null)}>Farbfilter zurücksetzen</Button>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            {filterActive && (
              <span className="text-caption text-muted-foreground tabular-nums">{counts.filteredCount} von {counts.totalCount}</span>
            )}
            <div className="relative w-48">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Durchsuchen…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-7 pl-8 pr-7 text-[13px]"
                aria-label="Notizen durchsuchen"
              />
              {searchQuery && (
                <Button variant="ghost" size="icon" className="absolute right-0.5 top-1/2 -translate-y-1/2 h-6 w-6" onClick={() => setSearchQuery("")} aria-label="Suche leeren">
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "h-7 w-7")} aria-label="Weitere Aktionen" title="Weitere Aktionen">
                      <MoreHorizontal className="h-4 w-4" />
                    </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => (selectMode ? exitSelectMode() : setSelectMode(true))}>
                  <CheckSquare className="h-4 w-4 mr-2" />{selectMode ? "Auswahl beenden" : "Auswählen"}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setArchiveOpen(true)}>
                  <Archive className="h-4 w-4 mr-2" />Archiv
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setGlobalShareOpen(true)}>
                  <Share2 className="h-4 w-4 mr-2" />Ansicht teilen
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <QuickNotesSyncIndicator />
          </div>
        </div>


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

        <QuickNotesSyncStatus hideLabel />
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
