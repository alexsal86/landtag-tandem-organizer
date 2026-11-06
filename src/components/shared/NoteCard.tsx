import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubTrigger,
  DropdownMenuSubContent, DropdownMenuPortal
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Pin, Trash2, MoreHorizontal, CheckSquare, Vote,
  Calendar as CalendarIcon, Archive, ChevronDown, ChevronUp, Clock,
  Star, Share2, Users, Hourglass, Pencil, GripVertical, ListTree,
  History, ArrowRight, Palette, X, FileText, Lightbulb, Wand2, NotebookPen, ClockAlert
} from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { differenceInCalendarDays, format, formatDistanceToNow, isPast, isToday, isYesterday } from "date-fns";
import { de } from "date-fns/locale";
import { NoteStatusChips } from "@/components/shared/NoteStatusChips";
import { RichTextDisplay } from "@/components/ui/RichTextDisplay";
import { sanitizeRichHtml } from "@/utils/htmlSanitizer";
import { noteColors, getCardBackground, stripHtml } from "@/hooks/useQuickNotes";
import type { QuickNote } from "@/components/shared/QuickNotesList";
import { renderChecklistHtml, countChecklist, isNoteStale } from "@/components/shared/quickNoteBoard";

interface NoteCardProps {
  note: QuickNote;
  userId?: string;
  showFollowUpBadge?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dragHandleProps?: any;
  isExpanded: boolean;
  isDetailsExpanded: boolean;
  colorModeUpdating: string | null;
  className?: string;
  highlightRef?: (el: HTMLElement | null) => void;
  onNoteClick?: (note: QuickNote) => void;
  onToggleExpand: (noteId: string, e: React.MouseEvent) => void;
  onToggleDetailsExpand: (noteId: string, e: React.MouseEvent) => void;
  onTogglePin: (note: QuickNote) => void;
  onDelete: (note: QuickNote) => void;
  onArchive: (noteId: string) => void;
  onSetPriority: (noteId: string, level: number) => void;
  onSetColor: (noteId: string, color: string | null) => void;
  onSetColorMode: (noteId: string, fullCard: boolean) => void;
  onSetFollowUp: (noteId: string, date: Date | null) => void;
  onOpenDatePicker: (note: QuickNote) => void;
  onCreateTask: (note: QuickNote) => void;
  onRemoveTask: (note: QuickNote) => void;
  onCreateDecision: (note: QuickNote) => void;
  onRemoveDecision: (note: QuickNote) => void;
  onCreateCaseItem: (note: QuickNote) => void;
  onRemoveCaseItem: (note: QuickNote) => void;
  onOpenMeetingSelector: (note: QuickNote) => void;
  onRemoveFromMeeting: (noteId: string) => void;
  onOpenEdit: (note: QuickNote) => void;
  onOpenVersionHistory: (note: QuickNote) => void;
  onSplitNote: (note: QuickNote) => void;
  onShare: (note: QuickNote) => void;
  onTransferToThemenspeicher?: (note: QuickNote) => void;
  onMoveToThemenspeicher?: (note: QuickNote) => void;
  isInThemenspeicher?: boolean;
  isTransferringToThemenspeicher?: boolean;
  onSendToDaySlip?: (note: QuickNote) => void;
  onToggleChecklist?: (note: QuickNote, index: number) => void;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: (noteId: string) => void;
}

export function NoteCard({
  note, userId, showFollowUpBadge = false, dragHandleProps,
  isExpanded, isDetailsExpanded, colorModeUpdating,
  className, highlightRef,
  onNoteClick, onToggleExpand, onToggleDetailsExpand,
  onTogglePin, onDelete, onArchive, onSetPriority, onSetColor, onSetColorMode,
  onSetFollowUp, onOpenDatePicker, onCreateTask, onRemoveTask,
  onCreateDecision, onRemoveDecision, onCreateCaseItem, onRemoveCaseItem,
  onOpenMeetingSelector, onRemoveFromMeeting,
  onOpenEdit, onOpenVersionHistory, onSplitNote, onShare,
  onTransferToThemenspeicher,
  onMoveToThemenspeicher,
  isInThemenspeicher = false,
  isTransferringToThemenspeicher = false,
  onSendToDaySlip, onToggleChecklist, selectable = false, selected = false, onToggleSelect,
}: NoteCardProps) {
  const checklist = countChecklist(note.content);
  const [transferPopoverOpen, setTransferPopoverOpen] = useState(false);
  const hasLinkedItems = note.task_id || note.decision_id || note.meeting_id || note.case_item_id;
  const hasShared = (note.share_count || 0) > 0 || note.is_shared === true;

  const canEdit = note.user_id === userId || note.can_edit === true;
  const contentRef = useRef<HTMLDivElement>(null);
  const [truncated, setTruncated] = useState(false);
  useLayoutEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const measure = () => { if (!isExpanded) setTruncated(el.scrollHeight > el.clientHeight + 1); };
    measure();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    window.addEventListener("resize", measure);
    return () => { ro?.disconnect(); window.removeEventListener("resize", measure); };
  }, [isExpanded, note.content]);

  const stale = isNoteStale(note);
  const changedAt = new Date(note.updated_at || note.created_at);
  const staleWeeks = Math.max(4, Math.floor(differenceInCalendarDays(new Date(), changedAt) / 7));
  const relTime = isToday(changedAt) ? "heute" : isYesterday(changedAt) ? "gestern" : formatDistanceToNow(changedAt, { addSuffix: true, locale: de });
  const colorLabel = noteColors.find((c) => c.value === note.color)?.label ?? "Standard";
  const prio = note.priority_level || 0;

  return (
    <div
      key={note.id}
      ref={highlightRef}
      tabIndex={-1}
      className={cn("group relative flex flex-col rounded-lg border border-border bg-card p-3 transition-colors duration-fast ease-standard hover:border-foreground/25 focus-within:border-foreground/25", selected && "ring-2 ring-primary", className)}
      style={{
        backgroundColor: note.color && note.color_full_card === true ? getCardBackground(note.color) : undefined,
      }}
      onClick={(e) => {
        const check = (e.target as HTMLElement).closest<HTMLElement>("[data-check-index]");
        if (check) {
          e.stopPropagation();
          if (onToggleChecklist && canEdit) onToggleChecklist(note, Number(check.dataset.checkIndex));
          return;
        }
        if (selectable) { onToggleSelect?.(note.id); return; }
        onNoteClick?.(note);
      }}
    >
      {selectable && (
        <div className="absolute -left-2 -top-2 z-sticky rounded-full bg-background p-0.5 shadow-sm" onClick={(e) => e.stopPropagation()}>
          <Checkbox checked={selected} onCheckedChange={() => onToggleSelect?.(note.id)} aria-label="Notiz auswählen" />
        </div>
      )}
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-start gap-2 pr-1">
          {note.title && (
            <div className="flex-1 break-words text-sm font-medium leading-snug line-clamp-2 [&_p]:inline [&_p]:m-0">
              <RichTextDisplay content={note.title} />
            </div>
          )}
          {checklist.total > 0 && (
            <Badge variant="outline" className="h-5 flex-shrink-0 px-1.5 py-0 text-xs tabular-nums" title="Erledigte Punkte">
              {checklist.done}/{checklist.total}
            </Badge>
          )}
          {showFollowUpBadge && note.follow_up_date && (
            <div className="flex flex-shrink-0 items-center gap-1">
              <Badge variant="outline" className="h-5 px-1.5 py-0 text-xs text-palette-amber border-palette-amber/40 bg-palette-amber/10">
                <Clock className="mr-1 h-3 w-3" />
                {format(new Date(note.follow_up_date), "dd.MM.yy", { locale: de })}
              </Badge>
              <Button variant="ghost" size="icon" className="h-5 w-5 rounded-full hover:bg-destructive/10" onClick={(e) => { e.stopPropagation(); onSetFollowUp(note.id, null); }} title="Wiedervorlage entfernen">
                <X className="h-3 w-3 text-muted-foreground hover:text-destructive" />
              </Button>
            </div>
          )}
        </div>
        {/* Right column: menu */}
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          <div className="flex items-center gap-0.5">
            {note.is_pinned && (
              <TooltipProvider><Tooltip><TooltipTrigger asChild>
                <span className="inline-flex h-6 w-6 items-center justify-center text-warning" role="img" aria-label="Angeheftet">
                  <Pin className="h-3.5 w-3.5 fill-current" />
                </span>
              </TooltipTrigger><TooltipContent>Angeheftet</TooltipContent></Tooltip></TooltipProvider>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => e.stopPropagation()}>
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {(note.user_id === userId || note.can_edit) && (
                  <DropdownMenuItem onClick={() => onOpenEdit(note)}>
                    <Pencil className="h-3 w-3 mr-2" />Bearbeiten
                  </DropdownMenuItem>
                )}
                {note.task_id ? (
                  <DropdownMenuItem onClick={() => onRemoveTask(note)} className="text-palette-blue">
                    <CheckSquare className="h-3 w-3 mr-2" />Aufgabe entfernen
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={() => onCreateTask(note)}>
                    <CheckSquare className="h-3 w-3 mr-2" />Als Aufgabe
                  </DropdownMenuItem>
                )}
                {note.decision_id ? (
                  <DropdownMenuItem disabled className="text-palette-purple">
                    <Vote className="h-3 w-3 mr-2" />Entscheidung aktiv
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={() => onCreateDecision(note)}>
                    <Vote className="h-3 w-3 mr-2" />Als Entscheidung
                  </DropdownMenuItem>
                )}
                {note.case_item_id ? (
                  <DropdownMenuItem onClick={() => onRemoveCaseItem(note)} className="text-palette-teal">
                    <FileText className="h-3 w-3 mr-2" />Vorgang entfernen
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={() => onCreateCaseItem(note)}>
                    <FileText className="h-3 w-3 mr-2" />Als Vorgang
                  </DropdownMenuItem>
                )}
                {note.meeting_id ? (
                  <DropdownMenuItem onClick={() => onRemoveFromMeeting(note.id)} className="text-palette-green">
                    <CalendarIcon className="h-3 w-3 mr-2" />Von Jour Fixe entfernen
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={() => onOpenMeetingSelector(note)}>
                    <CalendarIcon className="h-3 w-3 mr-2" />Auf Jour Fixe setzen
                  </DropdownMenuItem>
                )}
                {onMoveToThemenspeicher && (
                  <DropdownMenuItem onClick={() => onMoveToThemenspeicher(note)}>
                    <Lightbulb className="h-3 w-3 mr-2" />In Themenspeicher verschieben
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger><Star className="h-3 w-3 mr-2" />Priorität</DropdownMenuSubTrigger>
                  <DropdownMenuPortal><DropdownMenuSubContent>
                    <DropdownMenuItem onClick={() => onSetPriority(note.id, 3)}>
                      <span className="text-palette-amber mr-2">★★★</span> Level 3{note.priority_level === 3 && <span className="ml-auto text-xs">✓</span>}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onSetPriority(note.id, 2)}>
                      <span className="text-palette-amber mr-2">★★</span> Level 2{note.priority_level === 2 && <span className="ml-auto text-xs">✓</span>}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onSetPriority(note.id, 1)}>
                      <span className="text-palette-amber mr-2">★</span> Level 1{note.priority_level === 1 && <span className="ml-auto text-xs">✓</span>}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => onSetPriority(note.id, 0)}>
                      Keine Priorität{(!note.priority_level || note.priority_level === 0) && <span className="ml-auto text-xs">✓</span>}
                    </DropdownMenuItem>
                  </DropdownMenuSubContent></DropdownMenuPortal>
                </DropdownMenuSub>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <Clock className="h-3 w-3 mr-2" />Wiedervorlage
                    {note.follow_up_date && <span className="ml-auto text-xs text-palette-amber">●</span>}
                  </DropdownMenuSubTrigger>
                  <DropdownMenuPortal><DropdownMenuSubContent>
                    <DropdownMenuItem onClick={() => onSetFollowUp(note.id, new Date(Date.now() + 7 * 24 * 60 * 60 * 1000))}>In 7 Tagen</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onSetFollowUp(note.id, new Date(Date.now() + 14 * 24 * 60 * 60 * 1000))}>In 14 Tagen</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onSetFollowUp(note.id, new Date(Date.now() + 30 * 24 * 60 * 60 * 1000))}>In 30 Tagen</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => onOpenDatePicker(note)}>
                      <CalendarIcon className="h-3 w-3 mr-2" />Datum wählen...
                    </DropdownMenuItem>
                    {note.follow_up_date && (<><DropdownMenuSeparator /><DropdownMenuItem onClick={() => onSetFollowUp(note.id, null)} className="text-destructive">Wiedervorlage entfernen</DropdownMenuItem></>)}
                  </DropdownMenuSubContent></DropdownMenuPortal>
                </DropdownMenuSub>
                {(note.user_id === userId || note.can_edit === true) && (
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <Palette className="h-3 w-3 mr-2" />Farbe
                      {note.color && <span className="ml-auto w-3 h-3 rounded-full border" style={{ backgroundColor: note.color }} />}
                    </DropdownMenuSubTrigger>
                    <DropdownMenuPortal><DropdownMenuSubContent>
                      <div className="flex flex-wrap gap-1.5 p-2 max-w-[140px]">
                        {noteColors.map((color) => (
                          <button
                            key={color.value || 'default'}
                            onClick={() => onSetColor(note.id, color.value)}
                            className={cn("w-6 h-6 rounded-full border-2 transition-all hover:scale-110", note.color === color.value ? "border-primary ring-2 ring-primary/30" : "border-transparent", !color.value && "bg-background border-border")}
                            style={color.value ? { backgroundColor: color.value } : undefined}
                            title={color.label}
                          />
                        ))}
                      </div>
                      {note.color && (<><DropdownMenuSeparator />
                        <div className="px-2 py-1.5" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }} onPointerDown={(e) => e.stopPropagation()}>
                          <label className="flex items-center gap-2 text-xs cursor-pointer select-none" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }} onPointerDown={(e) => e.stopPropagation()}>
                            <Checkbox checked={note.color_full_card === true} disabled={colorModeUpdating === note.id} onCheckedChange={(checked) => { if (colorModeUpdating !== note.id) onSetColorMode(note.id, checked === true); }} />
                            {colorModeUpdating === note.id ? "Wird gespeichert..." : "Ganze Card einfärben"}
                          </label>
                        </div>
                      </>)}
                    </DropdownMenuSubContent></DropdownMenuPortal>
                  </DropdownMenuSub>
                )}
                {note.user_id === userId && (
                  <DropdownMenuItem onClick={() => onShare(note)}>
                    <Share2 className="h-3 w-3 mr-2" />Freigeben
                    {(note.share_count || 0) > 0 && <span className="ml-auto text-xs text-muted-foreground">{note.share_count}</span>}
                  </DropdownMenuItem>
                )}
                {note.user_id === userId && (
                  <DropdownMenuItem onClick={() => onSplitNote(note)}>
                    <ListTree className="h-3 w-3 mr-2" />In Einzelnotizen aufteilen
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onTogglePin(note)}>
                  <Pin className={cn("h-3 w-3 mr-2", note.is_pinned && "text-palette-amber")} />
                  {note.is_pinned ? 'Loslösen' : 'Anpinnen'}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onArchive(note.id)}>
                  <Archive className="h-3 w-3 mr-2" />Archivieren
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onOpenVersionHistory(note)}>
                  <History className="h-3 w-3 mr-2" />Versionshistorie
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onDelete(note)} className="text-destructive focus:text-destructive">
                  <Trash2 className="h-3 w-3 mr-2" />Löschen
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <div className="px-2 py-1.5 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3 inline mr-1" />
                  Erstellt: {format(new Date(note.created_at), "dd.MM.yyyy HH:mm", { locale: de })}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            {note.pending_for_jour_fixe && !note.meeting_id && (
              <TooltipProvider><Tooltip><TooltipTrigger asChild>
                <Badge variant="outline" className="text-xs px-1 py-0 h-4 text-palette-amber cursor-help">
                  <Hourglass className="h-3 w-3 mr-0.5" />JF
                </Badge>
              </TooltipTrigger><TooltipContent>Wartet auf nächsten Jour Fixe</TooltipContent></Tooltip></TooltipProvider>
            )}
            {showFollowUpBadge && note.follow_up_date && (
              <Badge variant={isPast(new Date(note.follow_up_date)) && !isToday(new Date(note.follow_up_date)) ? "destructive" : "secondary"} className="text-xs px-1 py-0 h-4">
                <Clock className="h-3 w-3 mr-1" />
                {isToday(new Date(note.follow_up_date)) ? "Heute" : format(new Date(note.follow_up_date), "dd.MM.", { locale: de })}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {note.sync_status && <p role="status" className={cn("mt-1 text-xs", note.sync_status === "pending" ? "text-muted-foreground" : "text-destructive")}>
        {note.sync_status === "pending" ? "Auf diesem Gerät gespeichert · Synchronisierung ausstehend" : note.sync_status === "conflict" ? "Synchronisierungskonflikt · lokaler Text bleibt erhalten" : "Synchronisierung fehlgeschlagen · lokaler Text bleibt erhalten"}
      </p>}

      <div
        ref={contentRef}
        className={cn(
          "mt-1 overflow-hidden text-[13px] leading-[1.45] text-foreground prose prose-sm max-w-none [&_*]:text-[13px] [&_*]:leading-[1.45] [&>p]:mb-1 [&>ul]:mb-1 [&>ol]:mb-1",
          !isExpanded && "max-h-[calc(13px*1.45*3)]",
        )}
        style={!isExpanded && truncated ? { WebkitMaskImage: "linear-gradient(to bottom, black 55%, transparent)", maskImage: "linear-gradient(to bottom, black 55%, transparent)" } : undefined}
        dangerouslySetInnerHTML={{ __html: renderChecklistHtml(sanitizeRichHtml(note.content), canEdit) }}
      />
      {truncated && (
        <button
          type="button"
          aria-expanded={isExpanded}
          className="mt-1 inline-flex items-center gap-1 self-start rounded text-xs text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={(e) => { e.stopPropagation(); onToggleExpand(note.id, e); }}
        >
          {isExpanded ? "Weniger anzeigen" : "Mehr anzeigen"}
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-fast", isExpanded && "rotate-180")} />
        </button>
      )}

      <NoteStatusChips
        taskId={note.task_id}
        decisionId={note.decision_id}
        caseItemId={note.case_item_id}
        meetingId={note.meeting_id}
        meetingDate={note.meetings?.meeting_date}
        canEdit={note.user_id === userId}
        onRemoveDecision={() => onRemoveDecision(note)}
        onRemoveFromMeeting={() => onRemoveFromMeeting(note.id)}
      />

      <TooltipProvider>
        <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            <Tooltip><TooltipTrigger asChild>
              <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full border border-border" style={{ backgroundColor: note.color || undefined }} role="img" aria-label={`Farbe: ${colorLabel}`} />
            </TooltipTrigger><TooltipContent>Farbe: {colorLabel}</TooltipContent></Tooltip>
            {prio > 0
              ? <span className="text-warning">★ Prio {prio}</span>
              : <span>Ohne Prio</span>}
            {stale ? (
              <Tooltip><TooltipTrigger asChild>
                <span className="inline-flex items-center gap-1 rounded bg-warning/15 px-1.5 py-0.5 text-warning">
                  <ClockAlert className="h-3 w-3" />{format(changedAt, "dd.MM.", { locale: de })} · {staleWeeks} Wochen
                </span>
              </TooltipTrigger><TooltipContent>Seit über 30 Tagen unverändert</TooltipContent></Tooltip>
            ) : (
              <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{relTime}</span>
            )}
            {hasShared && (
              <Tooltip><TooltipTrigger asChild>
                <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" />{note.is_shared ? (note.owner?.display_name?.split(" ")[0] || "Geteilt") : note.share_count}</span>
              </TooltipTrigger><TooltipContent>
                {note.is_shared ? `Geteilt von ${note.owner?.display_name || "Unbekannt"}` : (note.shared_with_users?.length ? `Geteilt mit ${note.shared_with_users.map(u => u.display_name || "Unbekannt").join(", ")}` : `Mit ${note.share_count} geteilt`)}
              </TooltipContent></Tooltip>
            )}
          </div>
            <div className="flex items-center gap-1 flex-shrink-0 opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-200">
              {note.user_id === userId && (
                <DropdownMenu>
                  <TooltipProvider><Tooltip><TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/80" onClick={(e) => e.stopPropagation()} aria-label="Umwandeln">
                      <Wand2 className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  </TooltipTrigger><TooltipContent side="top">Umwandeln</TooltipContent></Tooltip></TooltipProvider>
                  <DropdownMenuContent align="end" className="w-60" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenuItem onClick={() => (note.task_id ? onRemoveTask(note) : onCreateTask(note))} className={cn(note.task_id && "text-palette-blue")}>
                      <CheckSquare className="h-3 w-3 mr-2" />{note.task_id ? "Aufgabe entfernen" : "Aufgabe"}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => (note.decision_id ? onRemoveDecision(note) : onCreateDecision(note))} className={cn(note.decision_id && "text-palette-purple")}>
                      <Vote className="h-3 w-3 mr-2" />{note.decision_id ? "Entscheidung zurücknehmen" : "Entscheidung"}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => (note.case_item_id ? onRemoveCaseItem(note) : onCreateCaseItem(note))} className={cn(note.case_item_id && "text-palette-teal")}>
                      <FileText className="h-3 w-3 mr-2" />{note.case_item_id ? "Vorgang entfernen" : "Vorgang"}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => (note.meeting_id ? onRemoveFromMeeting(note.id) : onOpenMeetingSelector(note))} className={cn(note.meeting_id && "text-palette-green")}>
                      <CalendarIcon className="h-3 w-3 mr-2" />{note.meeting_id ? "Von Jour Fixe entfernen" : "Jour Fixe"}
                    </DropdownMenuItem>
                    {onTransferToThemenspeicher && (
                      <DropdownMenuItem disabled={isTransferringToThemenspeicher} onClick={() => onTransferToThemenspeicher(note)} className={cn(isInThemenspeicher && "text-palette-amber")}>
                        <Lightbulb className="h-3 w-3 mr-2" />{isInThemenspeicher ? "Im Themenspeicher" : "In Themenspeicher kopieren"}
                      </DropdownMenuItem>
                    )}
                    {onMoveToThemenspeicher && (
                      <DropdownMenuItem disabled={isTransferringToThemenspeicher} onClick={() => onMoveToThemenspeicher(note)}>
                        <Lightbulb className="h-3 w-3 mr-2" />In Themenspeicher verschieben
                      </DropdownMenuItem>
                    )}
                    {onSendToDaySlip && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => onSendToDaySlip(note)}>
                          <NotebookPen className="h-3 w-3 mr-2" />Auf heutigen Tageszettel
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              <div className="flex items-center gap-1 text-muted-foreground">
                {note.user_id === userId && (
                  <TooltipProvider><div className="flex items-center gap-1">
                    <Tooltip><TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground hover:bg-muted/80 rounded-full" onClick={(e) => { e.stopPropagation(); onOpenEdit(note); }}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                    </TooltipTrigger><TooltipContent side="top">Bearbeiten</TooltipContent></Tooltip>
                    <Tooltip><TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground hover:bg-muted/80 rounded-full" onClick={(e) => { e.stopPropagation(); onOpenDatePicker(note); }}>
                        <Clock className="h-3 w-3" />
                      </Button>
                    </TooltipTrigger><TooltipContent side="top">Wiedervorlage</TooltipContent></Tooltip>
                    <Tooltip><TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground hover:bg-muted/80 rounded-full" onClick={(e) => { e.stopPropagation(); onArchive(note.id); }}>
                        <Archive className="h-3 w-3" />
                      </Button>
                    </TooltipTrigger><TooltipContent side="top">Archivieren</TooltipContent></Tooltip>
                    {dragHandleProps && (
                      <div {...dragHandleProps} className="cursor-grab p-1 hover:bg-muted/80 rounded-full">
                        <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                    )}
                  </div></TooltipProvider>
                )}
              </div>
        </div>
      </TooltipProvider>
    </div>
  );
}
