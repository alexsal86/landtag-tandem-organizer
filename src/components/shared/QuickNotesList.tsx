import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  StickyNote, ChevronDown, Clock, Search, Hourglass, X
} from "lucide-react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { cn } from "@/lib/utils";
import { stripHtml, useQuickNotes } from "@/hooks/useQuickNotes";
import { useNotificationHighlight } from "@/hooks/useNotificationHighlight";
import { NoteCard } from "@/components/shared/NoteCard";
import { NoteDialogs } from "@/components/shared/NoteDialogs";
import { useTopicBacklog } from "@/features/redaktion/hooks/useTopicBacklog";
import { supabase } from "@/integrations/supabase/client";
import { notify } from "@/lib/notify";
import { sendToDaySlip } from "@/lib/daySlipBridge";
import { matchesNoteFilter, toggleChecklistItem, type QuickNoteFilter } from "@/components/shared/quickNoteBoard";
// Type for archived info from database (JSON)
type ArchivedInfo = { id: string; title: string; archived_at: string } | null;

export interface QuickNote {
  id: string;
  title: string | null;
  content: string;
  topic_backlog_id?: string | null;
  color: string | null;
  color_full_card?: boolean;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
  task_id?: string;
  meeting_id?: string;
  decision_id?: string;
  case_item_id?: string;
  priority_level?: number;
  follow_up_date?: string;
  is_archived?: boolean;
  user_id?: string;
  is_shared?: boolean;
  share_count?: number;
  pending_for_jour_fixe?: boolean;
  can_edit?: boolean;
  task_archived_info?: ArchivedInfo | unknown;
  decision_archived_info?: ArchivedInfo | unknown;
  meeting_archived_info?: ArchivedInfo | unknown;
  shared_with_users?: Array<{
    id: string;
    display_name: string | null;
  }>;
  owner?: {
    display_name: string | null;
    avatar_url: string | null;
  } | null;
  meetings?: {
    title: string;
    meeting_date: string;
    status: string | null;
  } | null;
}

interface QuickNotesListProps {
  refreshTrigger?: number;
  showHeader?: boolean;
  maxHeight?: string;
  onNoteClick?: (note: QuickNote) => void;
  searchPlacement?: "top" | "hidden";
  searchQuery?: string;
  onSearchQueryChange?: (value: string) => void;
  onCountsChange?: (counts: { filteredCount: number; totalCount: number }) => void;
  /** "list" = classic priority groups with drag & drop, "grid" = Keep-style board */
  layout?: "list" | "grid";
  filter?: QuickNoteFilter;
  colorFilter?: string | null;
  selectable?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (noteId: string) => void;
  onVisibleIdsChange?: (ids: string[]) => void;
}

export function QuickNotesList({
  refreshTrigger,
  showHeader = true,
  maxHeight = "400px",
  onNoteClick,
  searchPlacement = "top",
  searchQuery,
  onSearchQueryChange,
  onCountsChange,
  layout = "list",
  filter = "all",
  colorFilter = null,
  selectable = false,
  selectedIds,
  onToggleSelect,
  onVisibleIdsChange,
}: QuickNotesListProps) {
  const hook = useQuickNotes(refreshTrigger, searchQuery);
  const { isHighlighted, highlightRef } = useNotificationHighlight();
  const { createTopic } = useTopicBacklog();
  const [topicActionNoteId, setTopicActionNoteId] = useState<string | null>(null);

  const effectiveSearchQuery = searchQuery ?? hook.searchQuery;
  const handleSearchQueryChange = useMemo(
    () => onSearchQueryChange ?? hook.setSearchQuery,
    [onSearchQueryChange, hook.setSearchQuery]
  );

  const matches = (note: QuickNote) => matchesNoteFilter(note, filter, colorFilter);
  const visibleNotes = hook.filteredNotes.filter(matches);
  const visibleIdsKey = visibleNotes.map((n) => n.id).join(",");

  useEffect(() => {
    onCountsChange?.({
      filteredCount: visibleNotes.length,
      totalCount: hook.notes.length,
    });
  }, [visibleNotes.length, hook.notes.length, onCountsChange]);

  useEffect(() => {
    onVisibleIdsChange?.(visibleIdsKey ? visibleIdsKey.split(",") : []);
  }, [visibleIdsKey, onVisibleIdsChange]);

  if (hook.loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 bg-muted animate-pulse rounded-md" />
        ))}
      </div>
    );
  }

  if (hook.notes.length === 0) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <StickyNote className="h-10 w-10 mx-auto mb-2 opacity-50" />
        <p>Noch keine Notizen</p>
        <p className="text-sm">Nutze Quick Capture zum Starten</p>
      </div>
    );
  }

  const buildTopicPayload = (note: QuickNote) => {
    const fallbackTitle = stripHtml(note.content).slice(0, 100);
    const topicTitle = stripHtml(note.title || "") || fallbackTitle;

    return {
      topicTitle,
      shortDescription: stripHtml(note.content) || null,
    };
  };

  const ensureTopicBacklogLink = async (note: QuickNote) => {
    if (!hook.user?.id) {
      notify.error("Nicht angemeldet");
      return null;
    }

    if (note.topic_backlog_id) {
      return note.topic_backlog_id;
    }

    const { topicTitle, shortDescription } = buildTopicPayload(note);

    if (!topicTitle) {
      notify.error("Die Notiz enthält keinen übernehmbaren Titel");
      return null;
    }

    setTopicActionNoteId(note.id);

    try {
      const createdTopic = await createTopic({
        topic: topicTitle,
        status: "idea",
        priority: 1,
        short_description: shortDescription,
      });

      if (!createdTopic?.id) {
        throw new Error("Themenspeicher-Eintrag konnte nicht erstellt werden");
      }

      const { error } = await supabase
        .from("quick_notes")
        .update({
          topic_backlog_id: createdTopic.id,
        })
        .eq("id", note.id)
        .eq("user_id", hook.user.id);

      if (error) {
        throw error;
      }

      await hook.loadNotes();
      notify.success("Notiz in den Themenspeicher kopiert");
      return createdTopic.id;
    } catch (error) {
      console.error("Error transferring quick note to themenspeicher:", error);
      notify.error("Notiz konnte nicht in den Themenspeicher kopiert werden");
      return null;
    } finally {
      setTopicActionNoteId(null);
    }
  };

  const handleCopyToThemenspeicher = async (note: QuickNote) => {
    const linkedTopicId = await ensureTopicBacklogLink(note);
    if (linkedTopicId) {
      await hook.loadNotes();
    }
  };

  const handleMoveToThemenspeicher = async (note: QuickNote) => {
    const linkedTopicId = await ensureTopicBacklogLink(note);
    if (!linkedTopicId || !hook.user?.id) return;

    setTopicActionNoteId(note.id);

    try {
      const { error } = await supabase
        .from("quick_notes")
        .update({
          deleted_at: new Date().toISOString(),
          permanent_delete_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          topic_backlog_id: linkedTopicId,
        })
        .eq("id", note.id)
        .eq("user_id", hook.user.id);

      if (error) {
        throw error;
      }

      await hook.loadNotes();
      notify.success("Notiz in den Themenspeicher verschoben");
    } catch (error) {
      console.error("Error moving quick note to themenspeicher:", error);
      notify.error("Notiz konnte nicht in den Themenspeicher verschoben werden");
    } finally {
      setTopicActionNoteId(null);
    }
  };

  const handleSendToDaySlip = (note: QuickNote) => {
    const text = stripHtml(note.title || "") || stripHtml(note.content).slice(0, 160);
    if (!text) { notify.error("Die Notiz ist leer"); return; }
    sendToDaySlip({ text: `📝 ${text}`, source: { type: "note", id: note.id } });
  };

  const handleToggleChecklist = async (note: QuickNote, index: number) => {
    const { error } = await supabase
      .from("quick_notes")
      .update({ content: toggleChecklistItem(note.content, index) })
      .eq("id", note.id);
    if (error) { notify.error("Punkt konnte nicht abgehakt werden"); return; }
    await hook.loadNotes();
  };

  const noteCardProps = (note: QuickNote) => ({
    onSendToDaySlip: handleSendToDaySlip,
    onToggleChecklist: handleToggleChecklist,
    selectable,
    selected: selectedIds?.has(note.id) ?? false,
    onToggleSelect,
    note,
    userId: hook.user?.id,
    isExpanded: hook.expandedNotes.has(note.id),
    isDetailsExpanded: hook.expandedDetails.has(note.id),
    colorModeUpdating: hook.colorModeUpdating,
    className: isHighlighted(note.id) ? 'notification-highlight' : undefined,
    highlightRef: isHighlighted(note.id) ? highlightRef(note.id) : undefined,
    onNoteClick,
    onToggleExpand: hook.toggleNoteExpand,
    onToggleDetailsExpand: hook.toggleDetailsExpand,
    onTogglePin: hook.handleTogglePin,
    onDelete: hook.handleDeleteWithConfirmation,
    onArchive: hook.handleArchive,
    onSetPriority: hook.handleSetPriority,
    onSetColor: hook.handleSetColor,
    onSetColorMode: hook.handleSetColorMode,
    onSetFollowUp: hook.handleSetFollowUp,
    onOpenDatePicker: (n: QuickNote) => { hook.setNoteForDatePicker(n); hook.setDatePickerOpen(true); },
    onCreateTask: hook.createTaskFromNote,
    onRemoveTask: hook.setConfirmDeleteTaskNote,
    onCreateDecision: (n: QuickNote) => { hook.setNoteForDecision(n); hook.setDecisionCreatorOpen(true); },
    onRemoveDecision: hook.setConfirmRemoveDecision,
    onOpenMeetingSelector: (n: QuickNote) => { hook.setNoteForMeeting(n); hook.setMeetingSelectorOpen(true); },
    onRemoveFromMeeting: hook.removeNoteFromMeeting,
    onOpenEdit: hook.openEditDialog,
    onOpenVersionHistory: hook.openVersionHistory,
    onSplitNote: hook.splitNoteIntoBullets,
    onShare: (n: QuickNote) => { hook.setNoteForShare(n); hook.setShareDialogOpen(true); },
    onCreateCaseItem: hook.createCaseItemFromNote,
    onRemoveCaseItem: hook.setConfirmRemoveCaseItem,
    onTransferToThemenspeicher: handleCopyToThemenspeicher,
    onMoveToThemenspeicher: handleMoveToThemenspeicher,
    isInThemenspeicher: !!note.topic_backlog_id,
    isTransferringToThemenspeicher: topicActionNoteId === note.id,
  });

  const dialogs = (
      <NoteDialogs
        meetingSelectorOpen={hook.meetingSelectorOpen}
        setMeetingSelectorOpen={hook.setMeetingSelectorOpen}
        noteForMeeting={hook.noteForMeeting}
        addNoteToMeeting={hook.addNoteToMeeting}
        markForNextJourFixe={hook.markForNextJourFixe}
        datePickerOpen={hook.datePickerOpen}
        setDatePickerOpen={hook.setDatePickerOpen}
        noteForDatePicker={hook.noteForDatePicker}
        handleSetFollowUp={hook.handleSetFollowUp}
        editDialogOpen={hook.editDialogOpen}
        setEditDialogOpen={hook.setEditDialogOpen}
        editingNote={hook.editingNote}
        editTitle={hook.editTitle}
        setEditTitle={hook.setEditTitle}
        editContent={hook.editContent}
        setEditContent={hook.setEditContent}
        handleSaveEdit={hook.handleSaveEdit}
        shareDialogOpen={hook.shareDialogOpen}
        setShareDialogOpen={hook.setShareDialogOpen}
        noteForShare={hook.noteForShare}
        setNoteForShare={hook.setNoteForShare}
        loadNotes={hook.loadNotes}
        globalShareDialogOpen={hook.globalShareDialogOpen}
        setGlobalShareDialogOpen={hook.setGlobalShareDialogOpen}
        decisionCreatorOpen={hook.decisionCreatorOpen}
        setDecisionCreatorOpen={hook.setDecisionCreatorOpen}
        noteForDecision={hook.noteForDecision}
        setNoteForDecision={hook.setNoteForDecision}
        versionHistoryOpen={hook.versionHistoryOpen}
        setVersionHistoryOpen={hook.setVersionHistoryOpen}
        versionHistoryNote={hook.versionHistoryNote}
        versions={hook.versions}
        restoreVersion={hook.restoreVersion}
        confirmDeleteTaskNote={hook.confirmDeleteTaskNote}
        setConfirmDeleteTaskNote={hook.setConfirmDeleteTaskNote}
        removeTaskFromNote={hook.removeTaskFromNote}
        confirmRemoveDecision={hook.confirmRemoveDecision}
        setConfirmRemoveDecision={hook.setConfirmRemoveDecision}
        removeDecisionFromNote={hook.removeDecisionFromNote}
        confirmRemoveCaseItem={hook.confirmRemoveCaseItem}
        setConfirmRemoveCaseItem={hook.setConfirmRemoveCaseItem}
        removeCaseItemFromNote={hook.removeCaseItemFromNote}
        confirmDeleteLinkedNote={hook.confirmDeleteLinkedNote}
        setConfirmDeleteLinkedNote={hook.setConfirmDeleteLinkedNote}
        deleteLinkedTask={hook.deleteLinkedTask}
        setDeleteLinkedTask={hook.setDeleteLinkedTask}
        deleteLinkedDecision={hook.deleteLinkedDecision}
        setDeleteLinkedDecision={hook.setDeleteLinkedDecision}
        deleteLinkedCaseItem={hook.deleteLinkedCaseItem}
        setDeleteLinkedCaseItem={hook.setDeleteLinkedCaseItem}
        deleteLinkedMeeting={hook.deleteLinkedMeeting}
        setDeleteLinkedMeeting={hook.setDeleteLinkedMeeting}
        handleDeleteNoteWithLinks={hook.handleDeleteNoteWithLinks}
      />
  );

  if (layout === "grid") {
    const byPriority = (a: QuickNote, b: QuickNote) =>
      (b.priority_level || 0) - (a.priority_level || 0) ||
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    const due = hook.followUpNotes.filter(matches);
    const scheduled = hook.scheduledFollowUps.filter(matches);
    const rest = hook.groups.flatMap((g) => g.notes).filter(matches).sort(byPriority);
    const pinned = rest.filter((n) => n.is_pinned);
    const others = rest.filter((n) => !n.is_pinned);
    const board = (notes: QuickNote[], followUp = false) => (
      <div className="columns-1 sm:columns-2 xl:columns-3 gap-4">
        {notes.map((note) => (
          <div key={note.id} className="mb-4 break-inside-avoid">
            <NoteCard {...noteCardProps(note)} showFollowUpBadge={followUp} />
          </div>
        ))}
      </div>
    );
    const section = (label: string, notes: QuickNote[], icon?: ReactNode, followUp = false) =>
      notes.length > 0 && (
        <section className="space-y-2">
          <div className="section-label flex items-center gap-1.5">{icon}{label}<span className="tabular-nums">· {notes.length}</span></div>
          {board(notes, followUp)}
        </section>
      );

    return (
      <>
        <div className="space-y-6">
          {visibleNotes.length === 0 && (
            <div className="p-6 text-center text-muted-foreground">
              <StickyNote className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Keine Notizen für diesen Filter</p>
            </div>
          )}
          {section("Fällige Wiedervorlagen", due, <Clock className="h-3.5 w-3.5 text-palette-amber" />, true)}
          {section("Angeheftet", pinned)}
          {section(pinned.length > 0 ? "Weitere" : "Notizen", others)}
          {scheduled.length > 0 && (
            <Collapsible open={hook.scheduledFollowUpsExpanded} onOpenChange={hook.setScheduledFollowUpsExpanded}>
              <CollapsibleTrigger className="section-label flex items-center gap-1.5 rounded px-1 py-1 hover:bg-muted/50">
                <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", !hook.scheduledFollowUpsExpanded && "-rotate-90")} />
                <Hourglass className="h-3.5 w-3.5" />Geplant (bis zum Datum ausgeblendet)<span className="tabular-nums">· {scheduled.length}</span>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2">{board(scheduled, true)}</CollapsibleContent>
            </Collapsible>
          )}
        </div>
        {dialogs}
      </>
    );
  }

  return (
    <>
      {searchPlacement === "top" && (
        <div className="px-4 pt-3 pb-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Notizen durchsuchen..."
              value={effectiveSearchQuery}
              onChange={(e) => handleSearchQueryChange(e.target.value)}
              className="h-8 pl-8 pr-8 text-sm"
            />
            {effectiveSearchQuery && (
              <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6" onClick={() => handleSearchQueryChange("")}>
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
          {effectiveSearchQuery && (
            <p className="text-xs text-muted-foreground mt-1.5">
              {hook.filteredNotes.length} von {hook.notes.length} Notizen gefunden
            </p>
          )}
        </div>
      )}

      <ScrollArea style={{ height: maxHeight }}>
        <DragDropContext onDragEnd={hook.handleNoteDragEnd}>
          <div className="space-y-4 p-4 pt-0">
            {/* Follow-up Section */}
            {hook.followUpNotes.length > 0 && (
              <>
                <Collapsible open={hook.followUpExpanded} onOpenChange={hook.setFollowUpExpanded}>
                  <CollapsibleTrigger className="flex items-center justify-between w-full px-2 py-1.5 rounded hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-2">
                      <ChevronDown className={cn("h-4 w-4 transition-transform", !hook.followUpExpanded && "-rotate-90")} />
                      <Clock className="h-4 w-4 text-palette-amber" />
                      <span className="text-xs font-medium text-palette-amber">Fällige Wiedervorlagen</span>
                      <Badge variant="destructive" className="text-xs px-1.5 py-0">{hook.followUpNotes.length}</Badge>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="space-y-2 mt-2">
                      {hook.followUpNotes.map(note => (
                        <NoteCard key={note.id} {...noteCardProps(note)} showFollowUpBadge />
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
                <Separator className="my-3" />
              </>
            )}

            {/* Priority Groups */}
            {hook.groups.map((group, index) => (
              <div key={group.level}>
                {index > 0 && <Separator className="my-3" />}
                <div className="flex items-center gap-2 mb-2">
                  {group.level > 0 && <span className="text-palette-amber text-sm">{'★'.repeat(group.level)}</span>}
                  <span className="text-xs font-medium text-muted-foreground">{group.label}</span>
                </div>
                <Droppable droppableId={`level-${group.level}`}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={cn("space-y-2 min-h-[40px] rounded-lg transition-colors", snapshot.isDraggingOver && "bg-primary/5 ring-1 ring-primary/20")}
                    >
                      {group.notes.map((note, noteIndex) => (
                        <Draggable key={note.id} draggableId={note.id} index={noteIndex} isDragDisabled={note.user_id !== hook.user?.id}>
                          {(provided, snapshot) => (
                            <div ref={provided.innerRef} {...provided.draggableProps} className={cn(snapshot.isDragging && "opacity-90")}>
                              <NoteCard {...noteCardProps(note)} dragHandleProps={provided.dragHandleProps} />
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            ))}

            {/* Scheduled Follow-ups */}
            {hook.scheduledFollowUps.length > 0 && (
              <>
                <Separator className="my-3" />
                <Collapsible open={hook.scheduledFollowUpsExpanded} onOpenChange={hook.setScheduledFollowUpsExpanded}>
                  <CollapsibleTrigger className="flex items-center justify-between w-full px-2 py-1.5 rounded hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-2">
                      <ChevronDown className={cn("h-4 w-4 transition-transform", !hook.scheduledFollowUpsExpanded && "-rotate-90")} />
                      <Hourglass className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs font-medium text-muted-foreground">Geplant (bis zum Datum ausgeblendet)</span>
                      <Badge variant="secondary" className="text-xs px-1.5 py-0">{hook.scheduledFollowUps.length}</Badge>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="space-y-2 mt-2">
                      {hook.scheduledFollowUps.map(note => (
                        <NoteCard key={note.id} {...noteCardProps(note)} showFollowUpBadge />
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </>
            )}
          </div>
        </DragDropContext>
      </ScrollArea>

      {dialogs}
    </>
  );
}
