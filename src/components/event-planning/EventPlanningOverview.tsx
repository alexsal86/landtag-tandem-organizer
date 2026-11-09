import { PlanningViewToggle } from "./PlanningViewToggle";
import { useId, useState } from "react";
import { Check, Clock, Archive, CheckCircle, MoreHorizontal, MapPin, Users, ChevronDown } from "lucide-react";
import { format, isValid, startOfDay } from "date-fns";
import { de } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QuickAccessMenuItem } from "@/components/shared/QuickAccessMenuItem";
import { NewItemIndicator } from "@/components/notifications/NewItemIndicator";
import { useNotificationHighlight } from "@/hooks/useNotificationHighlight";
import { cn } from "@/lib/utils";
import { PlanningUserChip } from "./PlanningUserChip";
import type { useEventPlanningData } from "./useEventPlanningData";
import type { EventPlanning } from "./types";

type Props = Pick<ReturnType<typeof useEventPlanningData>, "plannings" | "allProfiles" | "collaborators" | "user" | "eventPlanningView" | "saveViewPreferences" | "isItemNew" | "setSelectedPlanning" | "togglePlanningCompleted" | "archivePlanning">;

export function EventPlanningOverview({ plannings, allProfiles, collaborators, user, eventPlanningView, saveViewPreferences, isItemNew, setSelectedPlanning, togglePlanningCompleted, archivePlanning }: Props) {
  const [filter, setFilter] = useState<"all" | "mine" | "open">("open");
  const [pastExpanded, setPastExpanded] = useState(false);
  const pastSectionId = useId();
  const { isHighlighted, highlightRef } = useNotificationHighlight();
  const listView = eventPlanningView === "table";
  const today = startOfDay(new Date()).getTime();
  const confirmedDate = (planning: EventPlanning) => {
    const date = planning.confirmed_date ? new Date(planning.confirmed_date) : null;
    return date && isValid(date) ? date : null;
  };
  const past = (planning: EventPlanning) => {
    const date = confirmedDate(planning);
    return Boolean(planning.is_completed || (date && date.getTime() < today));
  };
  const visible = plannings.filter(planning => filter !== "mine" || planning.user_id === user?.id || collaborators.some(c => c.event_planning_id === planning.id && c.user_id === user?.id));
  const groups = [
    { label: "Anstehend", items: visible.filter(p => !past(p)), muted: false },
    { label: "Vergangen & abgeschlossen", items: visible.filter(past), muted: true },
  ];

  const renderEvent = (planning: EventPlanning, muted: boolean) => {
    const owner = allProfiles.find(p => p.user_id === planning.user_id);
    const team = collaborators.filter(c => c.event_planning_id === planning.id && c.user_id !== planning.user_id);
    const canEdit = planning.user_id === user?.id || team.some(c => c.user_id === user?.id && c.can_edit);
    const date = confirmedDate(planning);
    return <li key={planning.id} ref={highlightRef(planning.id)} onClick={event => {
      if (event.target instanceof Element && event.target.closest("button,a,[role='menu'],[role='menuitem'],[tabindex]")) return;
      setSelectedPlanning(planning);
    }} className={cn("relative min-w-0 cursor-pointer rounded-xl transition-[background-color,box-shadow,border-color] hover:bg-palette-green/5 hover:ring-1 hover:ring-inset hover:ring-palette-green focus-within:ring-1 focus-within:ring-inset focus-within:ring-palette-green", !listView && "border bg-background/60 p-3 hover:border-palette-green", isHighlighted(planning.id) && "notification-highlight")}>
      <NewItemIndicator isVisible={isItemNew(planning.id, planning.created_at)} size="sm" />
      <div className={cn("grid grid-cols-[2rem_minmax(0,1fr)_auto] items-start gap-x-2.5 gap-y-1.5 sm:grid-cols-[2.4rem_minmax(0,1fr)_auto] sm:gap-x-3", listView && "rounded-xl px-1 py-3 sm:px-2 sm:py-3.5")}>
        <button type="button" onClick={() => setSelectedPlanning(planning)} aria-label={`${planning.title} öffnen`} className={cn("row-span-2 mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full sm:h-[2.4rem] sm:w-[2.4rem]", date ? "bg-palette-green/15 text-green-800 dark:text-green-300" : "bg-palette-amber/15 text-amber-900 dark:text-amber-300")}>
          {date ? <Check className="h-4 w-4" strokeWidth={3} aria-hidden /> : <Clock className="h-4 w-4" strokeWidth={2.75} aria-hidden />}
        </button>
        <div className={cn("col-span-2 min-w-0", listView && "sm:col-span-1")}>
          <button type="button" className={cn("block w-full text-left text-base font-semibold leading-snug hover:text-primary", muted && "text-muted-foreground")} onClick={() => setSelectedPlanning(planning)}>{planning.title}</button>
          <div className={cn("mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground", muted && "opacity-75")}>
            <span>{date ? "Termin bestätigt" : "Datum offen"}</span>
            {date && <><span aria-hidden>·</span><time dateTime={planning.confirmed_date!}>{format(date, "dd.MM.yyyy", { locale: de })}</time></>}
            {planning.is_completed && <><span aria-hidden>·</span><span>Als erledigt erklärt</span></>}
          </div>
          {!listView && planning.description && <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{planning.description}</p>}
          {!listView && planning.location && <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground"><MapPin className="h-3.5 w-3.5 shrink-0" />{planning.location}</p>}

        </div>
        <div className={cn("col-span-2 col-start-2 flex min-w-0 items-center justify-between gap-1", listView && "sm:col-span-1 sm:col-start-3 sm:row-start-1 sm:justify-end")}>
          <PlanningUserChip userId={planning.user_id} name={owner?.display_name ?? planning.creator?.display_name} color={owner?.badge_color} />
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" aria-label={`Aktionen für ${planning.title}`}><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setSelectedPlanning(planning)}>Veranstaltung öffnen</DropdownMenuItem>
              {canEdit && <DropdownMenuItem onSelect={() => togglePlanningCompleted(planning.id, !planning.is_completed)}><CheckCircle className="mr-2 h-4 w-4" />{planning.is_completed ? "Als unerledigt markieren" : "Als erledigt erklären"}</DropdownMenuItem>}
              {planning.user_id === user?.id && <DropdownMenuItem onSelect={() => archivePlanning(planning.id)}><Archive className="mr-2 h-4 w-4" />Archivieren</DropdownMenuItem>}
              <DropdownMenuSub>
                <DropdownMenuSubTrigger><Users className="mr-2 h-4 w-4" />Mitarbeit ({team.length})</DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="max-h-72 max-w-72 overflow-y-auto">
                  <DropdownMenuLabel>Mitbearbeiter</DropdownMenuLabel>
                  {team.length === 0 ? <DropdownMenuItem disabled>Keine Mitbearbeiter</DropdownMenuItem> : team.map(c => {
                    const profile = allProfiles.find(p => p.user_id === c.user_id);
                    return <DropdownMenuItem key={c.user_id} className="gap-2" onSelect={event => event.preventDefault()}>
                      <PlanningUserChip userId={c.user_id} name={profile?.display_name ?? c.profiles?.display_name} color={profile?.badge_color} compact role="Mitbearbeiter" />
                      <span className="min-w-0"><span className="block truncate">{profile?.display_name ?? c.profiles?.display_name ?? "Unbekannt"}</span><span className="text-xs text-muted-foreground">{c.can_edit ? "Kann bearbeiten" : "Leserechte"}</span></span>
                    </DropdownMenuItem>;
                  })}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSeparator />
              <QuickAccessMenuItem id={`planning-${planning.id}`} label={planning.title} icon="Calendar" route={`/eventplanning?highlight=${planning.id}`} />
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </li>;
  };

  return <TooltipProvider><section className="min-w-0 rounded-[1.5rem] border border-border/70 bg-card p-4 shadow-sm sm:p-5">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-2xl font-semibold tracking-tight">Veranstaltungen</h2>
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-xl bg-muted/70 p-1" role="group" aria-label="Veranstaltungen filtern">{([["open", "Offen"], ["mine", "Meine"], ["all", "Alle"]] as const).map(([value, label]) => <Button key={value} size="sm" variant="ghost" aria-pressed={filter === value} className={cn("rounded-lg px-3 text-muted-foreground", filter === value && "bg-background text-foreground shadow-sm hover:bg-background")} onClick={() => { setFilter(value); setPastExpanded(value === "all"); }}>{label}</Button>)}</div>
        <PlanningViewToggle value={eventPlanningView} onChange={view => saveViewPreferences("event", view)} label="Veranstaltungsansicht" />
      </div>
    </div>
    {visible.length === 0 ? <p className="py-10 text-center text-sm text-muted-foreground">Keine Veranstaltungen für diesen Filter.</p> : groups.map(group => {
      if (!group.items.length) return !group.muted && filter === "open" ? <p key={group.label} className="py-5 text-sm text-muted-foreground">Keine aktuell offenen Veranstaltungen.</p> : null;
      return <div key={group.label} className="mt-4 first:mt-0">
        {group.muted ? <h3 className="mb-2"><button type="button" aria-expanded={pastExpanded} aria-controls={pastSectionId} onClick={() => setPastExpanded(value => !value)} className="flex w-full items-center gap-2 rounded-md py-1 text-left text-xs font-semibold uppercase tracking-[0.16em] text-palette-green hover:bg-palette-green/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-palette-green">
          <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", !pastExpanded && "-rotate-90")} aria-hidden />
          {group.label}<span className="font-normal tracking-normal text-muted-foreground">({group.items.length})</span>
        </button></h3> : <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-palette-green">{group.label}</h3>}
        <div id={group.muted ? pastSectionId : undefined} hidden={group.muted && !pastExpanded}>
          {(!group.muted || pastExpanded) && <ul className={listView ? "space-y-1" : "grid gap-3 2xl:grid-cols-2"}>{group.items.map(planning => renderEvent(planning, group.muted))}</ul>}
        </div>
      </div>;
    })}
  </section></TooltipProvider>;
}
