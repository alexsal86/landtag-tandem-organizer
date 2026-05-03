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
  History, ArrowRight, Palette, X, FileText, Lightbulb
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { format, isPast, isToday } from "date-fns";
import { de } from "date-fns/locale";
import { NoteLinkedBadge } from "@/components/shared/NoteLinkedBadge";
import { NoteLinkedDetails } from "@/components/shared/NoteLinkedDetails";
import { RichTextDisplay } from "@/components/ui/RichTextDisplay";
import { sanitizeRichHtml } from "@/utils/htmlSanitizer";
import { noteColors, getCardBackground, stripHtml } from "@/hooks/useQuickNotes";
import type { QuickNote } from "@/components/shared/QuickNotesList";

interface NoteCardProps {
  note: QuickNote;
  userId?: string;
  showFollowUpBadge?: boolean;
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
}: NoteCardProps) {
  const [transferPopoverOpen, setTransferPopoverOpen] = useState(false);
  const fullText = note.content.replace(/<[^>]*>/g, '');
  const needsTruncation = fullText.length > 150;
  const hasLinkedItems = note.task_id || note.decision_id || note.meeting_id;
  const hasShared = (note.share_count || 0) > 0 || note.is_shared === true;

  return (
    <div
      key={note.id}
      ref={highlightRef}
      className={cn("p-3 pb-12 rounded-lg border transition-all hover:shadow-sm border-l-4 group relative", className)}
      style={{
        borderLeftColor: note.color || "#3b82f6",
        backgroundColor: note.color && note.color_full_card === true
          ? getCardBackground(note.color)
          : undefined
      }}
      onClick={() => onNoteClick?.(note)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2">
            {note.title && (
              <div className="font-semibold text-base break-words line-clamp-2 mb-1 flex-1 [&_p]:inline [&_p]:m-0">
                <RichTextDisplay content={note.title} />
              </div>
            )}
            {showFollowUpBadge && note.follow_up_date && (
              <div className="flex items-center gap-1 flex-shrink-0">
                <Badge variant="outline" className="text-xs px-1.5 py-0 h-5 text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-900/30">
                  <Clock className="h-3 w-3 mr-1" />
                  {format(new Date(note.follow_up_date), "dd.MM.yy", { locale: de })}
                </Badge>
                <Button
                  variant="ghost" size="icon"
                  className="h-5 w-5 hover:bg-destructive/10 rounded-full"
                  onClick={(e) => { e.stopPropagation(); onSetFollowUp(note.id, null); }}
                  title="Wiedervorlage entfernen"
                >
                  <X className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                </Button>
              </div>
            )}
          </div>
          {isExpanded ? (
            <div>
              <div
                className="text-sm text-muted-foreground/70 prose prose-sm max-w-none [&>p]:mb-1 [&>ul]:mb-1 [&>ol]:mb-1"
                dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(note.content) }}
              />
              {needsTruncation && (
                <button className="inline-flex items-center mt-1 text-primary hover:underline" onClick={(e) => onToggleExpand(note.id, e)}>
                  <ChevronUp className="h-3.5 w-3.5" strokeWidth={2.5} />
                  <span className="text-xs ml-0.5">Weniger</span>
                </button>
              )}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground/70">
              <div className="line-clamp-2 prose prose-sm max-w-none [&>p]:mb-0 [&>ul]:mb-0 [&>ol]:mb-0" dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(note.content) }} />
              {needsTruncation && (
                <button className="inline-flex items-center text-primary hover:underline align-baseline mt-0.5" onClick={(e) => onToggleExpand(note.id, e)}>
                  <ArrowRight className="h-3.5 w-3.5 inline ml-0.5" strokeWidth={2.5} />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Bottom bar */}
        {(hasLinkedItems || hasShared || note.user_id === userId) && (
          <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className="flex items-center gap-1.5 group-hover:hidden">
                {note.task_id && <div className="w-1.5 h-1.5 bg-blue-500" title="Aufgabe" />}
                {note.decision_id && <div className="w-1.5 h-1.5 bg-purple-500" title="Entscheidung" />}
                {note.case_item_id && <div className="w-1.5 h-1.5 bg-teal-500" title="Vorgang" />}
                {note.meeting_id && <div className="w-1.5 h-1.5 bg-emerald-500" title="Jour Fixe" />}
                {hasShared && <div className="w-1.5 h-1.5 bg-violet-500" title={note.is_shared ? `Geteilt von ${note.owner?.display_name || 'Unbekannt'}` : "Geteilt"} />}
              </div>
              <div className="hidden group-hover:flex items-center gap-1.5 flex-wrap">
                {note.task_id && <NoteLinkedBadge type="task" id={note.task_id} label="Aufgabe" />}
                {note.decision_id && <NoteLinkedBadge type="decision" id={note.decision_id} label="Entscheidung" />}
                {note.case_item_id && <NoteLinkedBadge type="case_item" id={note.case_item_id} label="Vorgang" />}
                {note.meeting_id && (
                  <NoteLinkedBadge type="meeting" id={note.meeting_id} label={note.meetings?.meeting_date ? `JF: ${format(new Date(note.meetings.meeting_date), "dd.MM.", { locale: de })}` : "Jour Fixe"} />
                )}
                {(note.share_count || 0) > 0 && (
                  <TooltipProvider><Tooltip><TooltipTrigger asChild>
                    <Badge variant="outline" className="text-xs px-1.5 py-0 h-4 text-violet-600 border-violet-300 bg-violet-50 dark:bg-violet-900/30 cursor-help">
                      <Users className="h-3 w-3 mr-0.5" />{note.share_count}
                    </Badge>
                  </TooltipTrigger><TooltipContent>
                    <div className="space-y-1"><p className="font-medium">Geteilt mit:</p>
                      {note.shared_with_users && note.shared_with_users.length > 0
                        ? note.shared_with_users.map(u => <p key={u.id} className="text-sm">{u.display_name || 'Unbekannt'}</p>)
                        : <p className="text-sm">Mit {note.share_count} {note.share_count === 1 ? 'Person' : 'Personen'} geteilt</p>}
                    </div>
                  </TooltipContent></Tooltip></TooltipProvider>
                )}
                {note.is_shared && note.owner && (
                  <TooltipProvider><Tooltip><TooltipTrigger asChild>
                    <Badge variant="secondary" className="text-xs px-1.5 py-0 h-4 cursor-help">
                      <Share2 className="h-3 w-3 mr-0.5" />{note.owner.display_name?.split(' ')[0] || 'Geteilt'}
                    </Badge>
                  </TooltipTrigger><TooltipContent>Geteilt von {note.owner.display_name || 'Unbekannt'}</TooltipContent></Tooltip></TooltipProvider>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              {hasLinkedItems && <span className="text-sm text-muted-foreground hidden group-hover:inline group-hover:opacity-0">→</span>}
              <div className={cn("flex items-center gap-1", "opacity-0 group-hover:opacity-100 transition-opacity duration-200")}>
                {hasLinkedItems && (
                  <>
                    <button className="text-xs text-muted-foreground hover:text-foreground flex items-center" onClick={(e) => onToggleDetailsExpand(note.id, e)}>
                      {isDetailsExpanded ? <ChevronUp className="h-3 w-3" strokeWidth={2.5} /> : <ChevronDown className="h-3 w-3" strokeWidth={2.5} />}
                      <span className="ml-0.5">Details</span>
                    </button>
                    {note.user_id === userId && <div className="h-4 w-px bg-border mx-1" />}
                  </>
                )}
                {note.user_id === userId && (
                  <TooltipProvider><div className="flex items-center gap-1">
                    <Tooltip><TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-muted/80 rounded-full" onClick={(e) => { e.stopPropagation(); onOpenEdit(note); }}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                    </TooltipTrigger><TooltipContent side="top">Bearbeiten</TooltipContent></Tooltip>
                    <Tooltip><TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className={cn("h-6 w-6 hover:bg-muted/80 rounded-full", note.task_id && "text-blue-600")} onClick={(e) => { e.stopPropagation(); note.task_id ? onRemoveTask(note) : onCreateTask(note); }}>
                        <CheckSquare className="h-3 w-3" />
                      </Button>
                    </TooltipTrigger><TooltipContent side="top">{note.task_id ? "Aufgabe entfernen" : "Als Aufgabe"}</TooltipContent></Tooltip>
                    <Tooltip><TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className={cn("h-6 w-6 hover:bg-muted/80 rounded-full", note.decision_id && "text-purple-600")} onClick={(e) => { e.stopPropagation(); note.decision_id ? onRemoveDecision(note) : onCreateDecision(note); }}>
                        <Vote className="h-3 w-3" />
                      </Button>
                    </TooltipTrigger><TooltipContent side="top">{note.decision_id ? "Entscheidung zurücknehmen" : "Als Entscheidung"}</TooltipContent></Tooltip>
                    <Tooltip><TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className={cn("h-6 w-6 hover:bg-muted/80 rounded-full", note.case_item_id && "text-teal-600")} onClick={(e) => { e.stopPropagation(); note.case_item_id ? onRemoveCaseItem(note) : onCreateCaseItem(note); }}>
                        <FileText className="h-3 w-3" />
                      </Button>
                    </TooltipTrigger><TooltipContent side="top">{note.case_item_id ? "Vorgang entfernen" : "Als Vorgang"}</TooltipContent></Tooltip>
                    <Tooltip><TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className={cn("h-6 w-6 hover:bg-muted/80 rounded-full", note.follow_up_date && "text-amber-600")} onClick={(e) => { e.stopPropagation(); onOpenDatePicker(note); }}>
                        <Clock className="h-3 w-3" />
                      </Button>
                    </TooltipTrigger><TooltipContent side="top">Wiedervorlage</TooltipContent></Tooltip>
                    <Tooltip><TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className={cn("h-6 w-6 hover:bg-muted/80 rounded-full", note.meeting_id && "text-emerald-600")} onClick={(e) => { e.stopPropagation(); note.meeting_id ? onRemoveFromMeeting(note.id) : onOpenMeetingSelector(note); }}>
                        <CalendarIcon className="h-3 w-3" />
                      </Button>
                    </TooltipTrigger><TooltipContent side="top">{note.meeting_id ? "Von Jour Fixe entfernen" : "Auf Jour Fixe"}</TooltipContent></Tooltip>
                    <Tooltip><TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-muted/80 rounded-full" onClick={(e) => { e.stopPropagation(); onArchive(note.id); }}>
                        <Archive className="h-3 w-3" />
                      </Button>
                    </TooltipTrigger><TooltipContent side="top">Archivieren</TooltipContent></Tooltip>
                    {onTransferToThemenspeicher && (
                      <Popover open={transferPopoverOpen} onOpenChange={setTransferPopoverOpen}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <PopoverTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className={cn(
                                  "h-6 w-6 hover:bg-muted/80 rounded-full",
                                  isInThemenspeicher && "text-amber-600",
                                )}
                                disabled={isTransferringToThemenspeicher}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onTransferToThemenspeicher(note);
                                  setTransferPopoverOpen(true);
                                }}
                              >
                                <Lightbulb className="h-3 w-3" />
                              </Button>
                            </PopoverTrigger>
                          </TooltipTrigger>
                          <TooltipContent side="top">In Themenspeicher verschieben</TooltipContent>
                        </Tooltip>
                        <PopoverContent
                          side="top"
                          align="end"
                          className="w-64 p-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted text-left"
                            disabled={isTransferringToThemenspeicher}
                            onClick={(e) => {
                              e.stopPropagation();
                              onMoveToThemenspeicher?.(note);
                              setTransferPopoverOpen(false);
                            }}
                          >
                            <Lightbulb className="h-4 w-4 text-amber-500" />
                            <span>In Themenspeicher verschieben</span>
                          </button>
                        </PopoverContent>
                      </Popover>
                    )}
                    {dragHandleProps && (
                      <div {...dragHandleProps} className="cursor-grab p-1 hover:bg-muted/80 rounded-full">
                        <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                    )}
                  </div></TooltipProvider>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Right column: menu */}
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          <div className="flex items-center gap-0.5">
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
                  <DropdownMenuItem onClick={() => onRemoveTask(note)} className="text-blue-600">
                    <CheckSquare className="h-3 w-3 mr-2" />Aufgabe entfernen
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={() => onCreateTask(note)}>
                    <CheckSquare className="h-3 w-3 mr-2" />Als Aufgabe
                  </DropdownMenuItem>
                )}
                {note.decision_id ? (
                  <DropdownMenuItem disabled className="text-purple-600">
                    <Vote className="h-3 w-3 mr-2" />Entscheidung aktiv
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={() => onCreateDecision(note)}>
                    <Vote className="h-3 w-3 mr-2" />Als Entscheidung
                  </DropdownMenuItem>
                )}
                {note.case_item_id ? (
                  <DropdownMenuItem onClick={() => onRemoveCaseItem(note)} className="text-teal-600">
                    <FileText className="h-3 w-3 mr-2" />Vorgang entfernen
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={() => onCreateCaseItem(note)}>
                    <FileText className="h-3 w-3 mr-2" />Als Vorgang
                  </DropdownMenuItem>
                )}
                {note.meeting_id ? (
                  <DropdownMenuItem onClick={() => onRemoveFromMeeting(note.id)} className="text-emerald-600">
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
                      <span className="text-amber-500 mr-2">★★★</span> Level 3{note.priority_level === 3 && <span className="ml-auto text-xs">✓</span>}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onSetPriority(note.id, 2)}>
                      <span className="text-amber-500 mr-2">★★</span> Level 2{note.priority_level === 2 && <span className="ml-auto text-xs">✓</span>}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onSetPriority(note.id, 1)}>
                      <span className="text-amber-500 mr-2">★</span> Level 1{note.priority_level === 1 && <span className="ml-auto text-xs">✓</span>}
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
                    {note.follow_up_date && <span className="ml-auto text-xs text-amber-600">●</span>}
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
                  <Pin className={cn("h-3 w-3 mr-2", note.is_pinned && "text-amber-500")} />
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
                <Badge variant="outline" className="text-xs px-1 py-0 h-4 text-amber-600 cursor-help">
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

      {note.is_pinned && (
        <div className="absolute top-0 right-0 w-0 h-0 border-t-[16px] border-l-[16px] border-t-amber-400 border-l-transparent rounded-tr-lg" title="Angepinnt" />
      )}

      {hasLinkedItems && (
        <NoteLinkedDetails
          taskId={note.task_id}
          decisionId={note.decision_id}
          caseItemId={note.case_item_id}
          meetingId={note.meeting_id}
          isExpanded={isDetailsExpanded}
        />
      )}
    </div>
  );
}
