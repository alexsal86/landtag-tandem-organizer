import { PencilSparkles } from "@/components/icons/PencilSparkles";
import { PlanningViewToggle } from "./PlanningViewToggle";
import { useEffect, useId, useState } from "react";
import { Check, Clock, Archive, CheckCircle, MoreHorizontal, MapPin, Users, ChevronDown, CalendarDays, ExternalLink, ArchiveRestore } from "lucide-react";
import { format, isValid, startOfDay } from "date-fns";
import { de } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QuickAccessMenuItem } from "@/components/shared/QuickAccessMenuItem";
import { NewItemIndicator } from "@/components/notifications/NewItemIndicator";
import { useNotificationHighlight } from "@/hooks/useNotificationHighlight";
import { cn } from "@/lib/utils";
import { PlanningUserChip } from "./PlanningUserChip";
import type { Profile } from "./types";

export interface PlanningOverviewItem {
  id: string;
  title: string;
  user_id: string;
  created_at: string;
  description?: string | null;
  location?: string | null;
  confirmed_date?: string | null;
  is_completed?: boolean | null;
  is_archived?: boolean | null;
  archived_at?: string | null;
  creator?: { display_name: string | null };
  statusLabel?: string;
  canArchive?: boolean;
}

export interface PlanningOverviewCollaborator {
  id: string;
  itemId: string;
  user_id: string;
  can_edit: boolean;
  profiles?: { display_name?: string | null } | null;
}

interface Props<Item extends PlanningOverviewItem> {
  title: string;
  singular: string;
  plannings: readonly Item[];
  archivedPlannings: readonly Item[];
  allProfiles: readonly Profile[];
  collaborators: readonly PlanningOverviewCollaborator[];
  user: { id: string } | null;
  view: "card" | "table";
  onViewChange: (view: "card" | "table") => void;
  isItemNew: (id: string, createdAt: string) => boolean;
  onOpen: (item: Item) => void;
  togglePlanningCompleted?: (id: string, completed: boolean) => void;
  archivePlanning: (id: string) => void;
  restorePlanning: (id: string) => void;
  fetchArchivedPlannings: () => Promise<boolean>;
  showPlanningArchive: boolean;
  setShowPlanningArchive: (show: boolean) => void;
  quickAccess: (item: Item) => { id: string; route: string; icon: string };
}

export function PlanningOverview<Item extends PlanningOverviewItem>({ title, singular, plannings, allProfiles, collaborators, user, view, onViewChange, isItemNew, onOpen, togglePlanningCompleted, archivePlanning, archivedPlannings, fetchArchivedPlannings, restorePlanning, showPlanningArchive, setShowPlanningArchive, quickAccess }: Props<Item>) {
  const [filter, setFilter] = useState<"all" | "mine" | "open" | "archive">(showPlanningArchive ? "archive" : "open");
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [archiveError, setArchiveError] = useState(false);
  useEffect(() => {
    if (filter !== "archive") return;
    let cancelled = false;
    setArchiveLoading(true);
    setArchiveError(false);
    void fetchArchivedPlannings().then(success => {
      if (!cancelled) { setArchiveError(!success); setArchiveLoading(false); }
    });
    return () => { cancelled = true; };
  }, [filter, fetchArchivedPlannings]);
  const [pastExpanded, setPastExpanded] = useState(false);
  const pastSectionId = useId();
  const { isHighlighted, highlightRef } = useNotificationHighlight();
  const listView = view === "table";
  const today = startOfDay(new Date()).getTime();
  const confirmedDate = (planning: Item) => {
    const date = planning.confirmed_date ? new Date(planning.confirmed_date) : null;
    return date && isValid(date) ? date : null;
  };
  const past = (planning: Item) => {
    const date = confirmedDate(planning);
    return Boolean(planning.is_completed || (date && date.getTime() < today));
  };
  const visible = (filter === "archive" ? archivedPlannings : plannings).filter(planning => filter !== "mine" || planning.user_id === user?.id || collaborators.some(c => c.itemId === planning.id && c.user_id === user?.id));
  const groups = filter === "archive" ? [{ label: `Archivierte ${title}`, items: visible, muted: false }] : [
    { label: "Anstehend", items: visible.filter(p => !past(p)), muted: false },
    { label: "Vergangen & abgeschlossen", items: visible.filter(past), muted: true },
  ];

  const renderEvent = (planning: Item, muted: boolean) => {
    const owner = allProfiles.find(p => p.user_id === planning.user_id);
    const team = collaborators.filter(c => c.itemId === planning.id && c.user_id !== planning.user_id);
    const canEdit = planning.user_id === user?.id || team.some(c => c.user_id === user?.id && c.can_edit);
    const date = confirmedDate(planning);
    const dateLabel = date ? format(date, planning.confirmed_date?.includes("T") ? "dd.MM.yyyy · HH:mm 'Uhr'" : "dd.MM.yyyy", { locale: de }) : "Datum offen";
    return <li key={planning.id} ref={highlightRef(planning.id)} onClick={event => {
      if (event.target instanceof Element && event.target.closest("button,a,[role='menu'],[role='menuitem'],[tabindex]")) return;
      onOpen(planning);
    }} className={cn("relative min-w-0 cursor-pointer rounded-xl transition-[background-color,box-shadow,border-color] hover:bg-palette-green/5 hover:ring-1 hover:ring-inset hover:ring-palette-green focus-within:ring-1 focus-within:ring-inset focus-within:ring-palette-green", !listView && "w-full border bg-background/60 p-3 hover:border-palette-green", isHighlighted(planning.id) && "notification-highlight")}>
      <NewItemIndicator isVisible={!planning.is_archived && isItemNew(planning.id, planning.created_at)} size="sm" />
      <div className={cn("grid grid-cols-[2rem_minmax(0,1fr)_auto] items-start gap-x-2.5 gap-y-1.5 sm:grid-cols-[2.4rem_minmax(0,1fr)_auto] sm:gap-x-3", listView && "rounded-xl px-1 py-3 sm:px-2 sm:py-3.5")}>
        <button type="button" onClick={() => onOpen(planning)} aria-label={`${planning.title} öffnen`} className={cn("row-span-2 mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full sm:h-[2.4rem] sm:w-[2.4rem]", date ? "bg-palette-green/15 text-green-800 dark:text-green-300" : "bg-palette-amber/15 text-amber-900 dark:text-amber-300")}>
          {date ? <Check className="h-4 w-4" strokeWidth={3} aria-hidden /> : <Clock className="h-4 w-4" strokeWidth={2.75} aria-hidden />}
        </button>
        <div className={cn("col-span-2 min-w-0", listView && "sm:col-span-1")}>
          <button type="button" className={cn("block w-full text-left text-base font-semibold leading-snug hover:text-primary", muted && "text-muted-foreground")} onClick={() => onOpen(planning)}>{planning.title}</button>
          <div className={cn("mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground", muted && "opacity-75")}>
            <span>{date ? "Termin bestätigt" : "Datum offen"}</span>
            {listView && date && <><span aria-hidden>·</span><time dateTime={planning.confirmed_date!}>{dateLabel}</time></>}
            {planning.is_archived && <><span aria-hidden>·</span><span>Archiviert{planning.archived_at ? ` am ${format(new Date(planning.archived_at), "dd.MM.yyyy", { locale: de })}` : ""}</span></>}
            {planning.statusLabel && <><span aria-hidden>·</span><span>{planning.statusLabel}</span></>}
            {planning.is_completed && !planning.statusLabel && <><span aria-hidden>·</span><span>Als erledigt erklärt</span></>}
          </div>
          {!listView && <div className={cn("mt-3 grid gap-3 text-sm text-muted-foreground", planning.description && "sm:grid-cols-2")}>
            <div className="min-w-0 space-y-2">
              <p className="flex items-start gap-2"><CalendarDays className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /><span>{date ? <time dateTime={planning.confirmed_date!}>{dateLabel}</time> : "Datum offen"}</span></p>
              {planning.location && <p className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /><span className="min-w-0 break-words">{planning.location}</span></p>}
            </div>
            {planning.description && <p className="flex min-w-0 items-start gap-2"><PencilSparkles className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /><span className="min-w-0 whitespace-pre-wrap break-words">{planning.description}</span></p>}
          </div>}

        </div>
        <div className={cn("col-span-2 col-start-2 flex min-w-0 items-center justify-end gap-2", !listView && "mt-2 border-t border-border/50 pt-2", listView && "sm:col-span-1 sm:col-start-3 sm:row-start-1 sm:justify-end")}>
          <div className="flex min-w-0 items-center gap-2">
            {!listView && <span className="text-xs text-muted-foreground">Verantwortlich</span>}
            <PlanningUserChip userId={planning.user_id} name={owner?.display_name ?? planning.creator?.display_name} color={owner?.badge_color} />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" aria-label={`Aktionen für ${planning.title}`}><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <div className="flex max-w-[min(24rem,calc(100vw-2rem))] items-start gap-2 px-2 py-2 text-sm" role="group" aria-label="Mitarbeiter">
                <Users className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="pt-0.5 font-medium">Mitarbeiter</span>
                <div className="flex min-w-0 flex-1 flex-wrap gap-x-3 gap-y-1">
                  {team.length === 0 ? <span className="pt-0.5 text-muted-foreground">Keine</span> : team.map(c => {
                    const profile = allProfiles.find(p => p.user_id === c.user_id);
                    const name = profile?.display_name ?? c.profiles?.display_name ?? "Unbekannt";
                    return <span key={c.user_id} className="inline-flex min-w-0 items-center gap-1.5" title={c.can_edit ? "Kann bearbeiten" : "Leserechte"}>
                      <PlanningUserChip userId={c.user_id} name={name} color={profile?.badge_color} compact role="Mitbearbeiter" />
                      <span className="break-words">{name}</span>
                    </span>;
                  })}
                </div>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => onOpen(planning)}><ExternalLink className="mr-2 h-4 w-4" aria-hidden />{singular} öffnen</DropdownMenuItem>
              {!planning.is_archived && canEdit && togglePlanningCompleted && <DropdownMenuItem onSelect={() => togglePlanningCompleted?.(planning.id, !planning.is_completed)}><CheckCircle className="mr-2 h-4 w-4" />{planning.is_completed ? "Als unerledigt markieren" : "Als erledigt erklären"}</DropdownMenuItem>}
              {(planning.canArchive ?? planning.user_id === user?.id) && (planning.is_archived ? <DropdownMenuItem onSelect={() => restorePlanning(planning.id)}><ArchiveRestore className="mr-2 h-4 w-4" />Wiederherstellen</DropdownMenuItem> : <DropdownMenuItem onSelect={() => archivePlanning(planning.id)}><Archive className="mr-2 h-4 w-4" />Archivieren</DropdownMenuItem>)}

              <DropdownMenuSeparator />
              <QuickAccessMenuItem {...quickAccess(planning)} label={planning.title} />
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </li>;
  };

  return <TooltipProvider><section className="min-w-0 rounded-[1.5rem] border border-border/70 bg-card p-4 shadow-sm sm:p-5">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex items-center rounded-xl bg-muted/70 p-1" role="group" aria-label={`${title} filtern`}>{([["open", "Offen"], ["mine", "Meine"], ["all", "Alle"], ["archive", "Archiv"]] as const).map(([value, label]) => <span key={value} className={cn("inline-flex", value === "archive" && "ml-1 border-l border-border pl-1")}><Button size="sm" variant="ghost" aria-pressed={filter === value} className={cn("rounded-lg px-3 text-muted-foreground", filter === value && "bg-background text-foreground shadow-sm hover:bg-background")} onClick={() => { setFilter(value); setShowPlanningArchive(value === "archive"); setPastExpanded(value === "all"); }}>{label}</Button></span>)}</div>
        <PlanningViewToggle value={view} onChange={onViewChange} label={`${singular}: Ansicht`} />
      </div>
    </div>
    {filter === "archive" && archiveLoading ? <p className="py-10 text-center text-sm text-muted-foreground" role="status">Archiv wird geladen…</p> : filter === "archive" && archiveError ? <p className="py-10 text-center text-sm text-destructive" role="alert">Das Archiv konnte nicht geladen werden.</p> : visible.length === 0 ? <p className="py-10 text-center text-sm text-muted-foreground">{filter === "archive" ? `Keine archivierten ${title} vorhanden.` : `Keine ${title} für diesen Filter.`}</p> : groups.map(group => {
      if (!group.items.length) return !group.muted && filter === "open" ? <p key={group.label} className="py-5 text-sm text-muted-foreground">{`Keine aktuell offenen ${title}.`}</p> : null;
      return <div key={group.label} className="mt-4 first:mt-0">
        {group.muted ? <h3 className="mb-2"><button type="button" aria-expanded={pastExpanded} aria-controls={pastSectionId} onClick={() => setPastExpanded(value => !value)} className="flex w-full items-center gap-2 rounded-md py-1 text-left text-xs font-semibold uppercase tracking-[0.16em] text-palette-green hover:bg-palette-green/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-palette-green">
          <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", !pastExpanded && "-rotate-90")} aria-hidden />
          {group.label}<span className="font-normal tracking-normal text-muted-foreground">({group.items.length})</span>
        </button></h3> : <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-palette-green">{group.label}</h3>}
        <div id={group.muted ? pastSectionId : undefined} hidden={group.muted && !pastExpanded}>
          {(!group.muted || pastExpanded) && <ul className={listView ? "space-y-1" : "grid grid-cols-1 gap-3"}>{group.items.map(planning => renderEvent(planning, group.muted))}</ul>}
        </div>
      </div>;
    })}
  </section></TooltipProvider>;
}
