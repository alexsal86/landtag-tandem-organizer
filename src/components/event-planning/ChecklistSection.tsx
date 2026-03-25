import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, GripVertical, MessageCircle, Paperclip, ListTodo, Mail, Download, Edit2, X, ExternalLink, Bot, Users, CalendarClock, Palette } from "lucide-react";
import type { DraggableProvided, DraggableProvidedDragHandleProps, DraggableStateSnapshot } from "@hello-pangea/dnd";
import { Droppable, Draggable } from "@hello-pangea/dnd";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { debounce } from "@/utils/debounce";
import type { ChecklistItem, PlanningSubtask, PlanningComment, PlanningDocument, Profile } from "./types";
import type { ChecklistAutomationAction } from "@/components/planning/sharedTypes";

interface ChecklistSectionProps {
  checklistItems: ReadonlyArray<ChecklistItem>;
  newChecklistItem: string;
  setNewChecklistItem: (value: string) => void;
  newChecklistItemType: "none" | "social_media" | "rsvp";
  setNewChecklistItemType: (value: "none" | "social_media" | "rsvp") => void;
  toggleChecklistItem: (itemId: string, isCompleted: boolean) => void;
  updateChecklistItemTitle: (itemId: string, title: string) => void;
  updateChecklistItemColor: (itemId: string, color: string) => void;
  addChecklistItem: () => void;
  deleteChecklistItem: (itemId: string) => void;
  itemSubtasks: { [itemId: string]: PlanningSubtask[] };
  itemComments: { [itemId: string]: PlanningComment[] };
  itemDocuments: { [itemId: string]: PlanningDocument[] };
  showItemSubtasks: { [itemId: string]: boolean };
  setShowItemSubtasks: (value: { [itemId: string]: boolean } | ((prev: { [itemId: string]: boolean }) => { [itemId: string]: boolean })) => void;
  showItemComments: { [itemId: string]: boolean };
  setShowItemComments: (value: { [itemId: string]: boolean } | ((prev: { [itemId: string]: boolean }) => { [itemId: string]: boolean })) => void;
  showItemDocuments: { [itemId: string]: boolean };
  setShowItemDocuments: (value: { [itemId: string]: boolean } | ((prev: { [itemId: string]: boolean }) => { [itemId: string]: boolean })) => void;
  allProfiles: ReadonlyArray<Profile>;
  user: { id: string } | null;
  uploading: boolean;
  itemEmailActions: Record<string, ChecklistAutomationAction | undefined>;
  itemSocialPlannerActions: Record<string, ChecklistAutomationAction | undefined>;
  editingComment: { [commentId: string]: string };
  setEditingComment: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  addItemSubtask: (description?: string, assignedTo?: string, dueDate?: string, itemId?: string) => void;
  addItemCommentForItem: (itemId: string, comment: string) => void;
  handleItemFileUpload: (event: React.ChangeEvent<HTMLInputElement>, itemId: string) => void;
  deleteItemDocument: (doc: PlanningDocument) => void;
  downloadItemDocument: (doc: PlanningDocument) => void;
  deleteItemComment: (comment: PlanningComment) => void;
  updateItemComment: (commentId: string, newContent: string) => void;
  setCompletingSubtask: (id: string | null) => void;
  setCompletionResult: (value: string) => void;
  loadItemSubtasks: (itemId: string) => void;
  loadAllItemCounts: () => void;
  setEmailDialogOpen: (open: boolean) => void;
  setSelectedEmailItemId: (id: string | null) => void;
  toggleSubItem: (itemId: string, subItemIndex: number, isCompleted: boolean) => void;
  updateSubItemTitle: (itemId: string, subItemIndex: number, title: string) => void;
  removeSubItem: (itemId: string, subItemIndex: number) => void;
  timelineDueDates?: Record<string, string>;
  onSetTimelineDueDate?: (item: { id: string; title: string }, dueDate: string) => void;
  registerChecklistItemRef?: (itemId: string, element: HTMLDivElement | null) => void;
  hoveredChecklistItemId?: string | null;
  onHoverItem?: (itemId: string) => void;
  onUnhoverItem?: () => void;
  addPhaseItem?: (title: string) => void;
}

type PhaseGroup = {
  phaseItem: ChecklistItem | null;
  phaseName: string | null;
  items: ChecklistItem[];
};

const DEFAULT_PHASE_COLOR = "#65a30d";
const SYSTEM_POINT_BUTTONS = [
  { key: "social_media" as const, label: "Social Media" },
  { key: "rsvp" as const, label: "Einladungen & RSVP" },
];

function hexToRgba(hex: string, alpha: number) {
  const normalized = hex.replace("#", "");
  const safe = normalized.length === 3
    ? normalized.split("").map((char) => char + char).join("")
    : normalized;
  const num = Number.parseInt(safe, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function getPhaseColor(item: ChecklistItem | null | undefined) {
  return item?.color || DEFAULT_PHASE_COLOR;
}

function groupItemsByPhase(items: ReadonlyArray<ChecklistItem>): ReadonlyArray<PhaseGroup> {
  const groups: PhaseGroup[] = [];
  let currentGroup: PhaseGroup = { phaseItem: null, phaseName: null, items: [] };

  for (const item of items) {
    if (item.type === "phase_start") {
      if (currentGroup.items.length > 0 || currentGroup.phaseName !== null) {
        groups.push(currentGroup);
      }
      currentGroup = { phaseItem: item, phaseName: item.title, items: [] };
    } else {
      currentGroup.items.push(item);
    }
  }

  if (currentGroup.items.length > 0 || currentGroup.phaseName !== null) {
    groups.push(currentGroup);
  }

  return groups;
}

function EditableTitleInput({
  itemId,
  value,
  className,
  placeholder,
  style,
  onCommit,
}: {
  itemId: string;
  value: string;
  className?: string;
  placeholder?: string;
  style?: React.CSSProperties;
  onCommit: (itemId: string, value: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const isEditingRef = useRef(false);

  useEffect(() => {
    if (!isEditingRef.current) {
      setDraft(value);
    }
  }, [value]);

  const debouncedCommit = useMemo(
    () => debounce((nextValue: string) => onCommit(itemId, nextValue), 250),
    [itemId, onCommit],
  );

  useEffect(() => () => debouncedCommit.cancel(), [debouncedCommit]);

  const commitImmediately = useCallback(() => {
    debouncedCommit.cancel();
    if (draft !== value) {
      onCommit(itemId, draft);
    }
  }, [debouncedCommit, draft, itemId, onCommit, value]);

  return (
    <Input
      value={draft}
      onChange={(e) => {
        isEditingRef.current = true;
        const nextValue = e.target.value;
        setDraft(nextValue);
        debouncedCommit(nextValue);
      }}
      onBlur={() => {
        isEditingRef.current = false;
        commitImmediately();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          (e.currentTarget as HTMLInputElement).blur();
        }
        if (e.key === "Escape") {
          debouncedCommit.cancel();
          isEditingRef.current = false;
          setDraft(value);
          (e.currentTarget as HTMLInputElement).blur();
        }
      }}
      className={className}
      placeholder={placeholder}
      style={style}
    />
  );
}

export function ChecklistSection(props: ChecklistSectionProps) {
  const {
    checklistItems, newChecklistItem, setNewChecklistItem, newChecklistItemType, setNewChecklistItemType,
    toggleChecklistItem, updateChecklistItemTitle, updateChecklistItemColor, addChecklistItem, deleteChecklistItem,
    itemSubtasks, itemComments, itemDocuments,
    showItemSubtasks, setShowItemSubtasks, showItemComments, setShowItemComments,
    showItemDocuments, setShowItemDocuments,
    allProfiles, user, uploading, itemEmailActions, itemSocialPlannerActions,
    editingComment, setEditingComment,
    addItemSubtask, addItemCommentForItem,
    handleItemFileUpload, deleteItemDocument, downloadItemDocument,
    deleteItemComment, updateItemComment,
    setCompletingSubtask, setCompletionResult,
    loadItemSubtasks, loadAllItemCounts,
    setEmailDialogOpen, setSelectedEmailItemId,
    toggleSubItem, updateSubItemTitle, removeSubItem,
    timelineDueDates,
    onSetTimelineDueDate,
    registerChecklistItemRef,
    hoveredChecklistItemId,
    onHoverItem,
    onUnhoverItem,
    addPhaseItem,
  } = props;

  const phaseGroups = useMemo(() => groupItemsByPhase(checklistItems), [checklistItems]);
  const hasPhases = phaseGroups.some((g) => g.phaseName !== null);

  const renderChecklistItem = (item: ChecklistItem, _index: number, provided: DraggableProvided, snapshot: DraggableStateSnapshot) => {
    if (item.type === "separator") {
      return (
        <div ref={provided.innerRef} {...provided.draggableProps} className={cn("group", snapshot.isDragging && "z-50")}>
          <div className="flex items-center gap-2 py-3 group">
            <button {...provided.dragHandleProps} className="-ml-7 flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" aria-label="Trenner verschieben">
              <GripVertical className="h-4 w-4" />
            </button>
            <div className="flex-1 border-t border-dashed border-border"></div>
            <EditableTitleInput itemId={item.id} value={item.title || "Trenner"} onCommit={updateChecklistItemTitle} className="text-muted-foreground italic text-sm px-2 border-none bg-transparent text-center w-32" placeholder="Trenner-Text eingeben..." />
            <div className="flex-1 border-t border-dashed border-border"></div>
            <Button variant="ghost" size="sm" onClick={() => deleteChecklistItem(item.id)} className="text-destructive hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity" title="Trenner löschen">
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
      );
    }

    if (item.type === "phase_start") {
      return <div ref={provided.innerRef} {...provided.draggableProps} className="hidden" />;
    }

    const isHovered = hoveredChecklistItemId === item.id;

    return (
      <div ref={provided.innerRef} {...provided.draggableProps} className={cn("group relative", snapshot.isDragging && "z-50") }>
        <button
          {...provided.dragHandleProps}
          className="absolute -left-5 top-2.5 flex h-6 w-5 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-muted group-hover:opacity-100"
          aria-label="Punkt verschieben"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <div className="space-y-2">
          <div
            className={cn(
              "group/checklist-item flex items-start space-x-2 rounded-md border bg-background px-3 py-2 transition-all",
              isHovered ? "border-primary/50 ring-1 ring-primary/20 bg-primary/5" : "border-border hover:bg-muted/50",
            )}
            ref={(element) => registerChecklistItemRef?.(item.id, element)}
            onMouseEnter={() => onHoverItem?.(item.id)}
            onMouseLeave={() => onUnhoverItem?.()}
          >
            <div className="mt-0.5">
              <Checkbox checked={item.is_completed} onCheckedChange={() => toggleChecklistItem(item.id, item.is_completed)} />
            </div>
            <div className="min-w-0 flex-1">
              <EditableTitleInput itemId={item.id} value={item.title} onCommit={updateChecklistItemTitle} className={cn("w-full border-none bg-transparent focus:bg-background text-sm whitespace-normal", item.is_completed && "line-through text-muted-foreground")} />
            </div>

            <div className="ml-auto flex shrink-0 items-center gap-1">
              <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover/checklist-item:opacity-100">
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 relative" onClick={() => setShowItemSubtasks(prev => ({ ...prev, [item.id]: !prev[item.id] }))}>
                <ListTodo className="h-3 w-3" />
                {(itemSubtasks[item.id]?.length || 0) > 0 && <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground rounded-full text-[10px] w-4 h-4 flex items-center justify-center">{itemSubtasks[item.id]?.length}</span>}
              </Button>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 relative" onClick={() => setShowItemComments(prev => ({ ...prev, [item.id]: !prev[item.id] }))}>
                <MessageCircle className="h-3 w-3" />
                {(itemComments[item.id]?.length || 0) > 0 && <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground rounded-full text-[10px] w-4 h-4 flex items-center justify-center">{itemComments[item.id]?.length}</span>}
              </Button>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 relative" onClick={() => setShowItemDocuments(prev => ({ ...prev, [item.id]: !prev[item.id] }))}>
                <Paperclip className="h-3 w-3" />
                {(itemDocuments[item.id]?.length || 0) > 0 && <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground rounded-full text-[10px] w-4 h-4 flex items-center justify-center">{itemDocuments[item.id]?.length}</span>}
              </Button>
              <Button variant="ghost" size="sm" className={cn("h-7 w-7 p-0", itemEmailActions[item.id]?.is_enabled && "text-blue-500")} onClick={() => { setSelectedEmailItemId(item.id); setEmailDialogOpen(true); }}>
                <Mail className="h-3 w-3" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => deleteChecklistItem(item.id)} className="h-7 w-7 p-0 text-destructive hover:text-destructive">
                <Trash2 className="h-3 w-3" />
              </Button>
              </div>
              <div className="relative h-8 w-[132px]">
                <div className={cn("absolute inset-0 flex items-center justify-end gap-2 rounded-md border border-dashed border-transparent px-2 text-xs text-muted-foreground transition-all duration-200 group-hover/checklist-item:translate-x-[-8px] group-hover/checklist-item:opacity-0", timelineDueDates?.[item.id] ? "opacity-100" : "opacity-70")} title={timelineDueDates?.[item.id] ? `Frist: ${format(new Date(timelineDueDates[item.id]), "dd.MM.yyyy", { locale: de })}` : "Frist hinzufügen"}>
                  <CalendarClock className="h-3.5 w-3.5" />
                  <span className="truncate">
                    {timelineDueDates?.[item.id] ? format(new Date(timelineDueDates[item.id]), "dd.MM.yyyy", { locale: de }) : "Frist"}
                  </span>
                </div>
                <Input type="date" value={timelineDueDates?.[item.id] || ""} onChange={(e) => onSetTimelineDueDate?.({ id: item.id, title: item.title }, e.target.value)} className="absolute inset-0 h-8 w-full translate-x-3 text-xs opacity-0 transition-all duration-200 group-hover/checklist-item:translate-x-0 group-hover/checklist-item:opacity-100 focus:translate-x-0 focus:opacity-100" title="Frist für Zeitstrahl" />
              </div>
            </div>
          </div>

          {(() => {
            const action = itemSocialPlannerActions[item.id];
            if (!action?.action_config) return null;
            const config = action.action_config;
            return (
            <div className="ml-8 mt-2 flex flex-wrap items-center gap-2 rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
              {action.action_type === "rsvp" ? (
                <>
                  <Users className="h-3.5 w-3.5 text-primary" />
                  <span>Systempunkt aktiv: RSVP-Einladungen{config.guest_count != null && <> ({config.guest_count} Gäste, {config.sent_count || 0} eingeladen)</>}</span>
                  <a href={String(config.rsvp_url || "#")} className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
                    {String(config.label || "Einladungen verwalten")}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </>
              ) : (
                <>
                  <Bot className="h-3.5 w-3.5 text-primary" />
                  <span>Systempunkt aktiv: Social Planner-Eintrag wurde automatisch angelegt.</span>
                  <a href={String(config.planner_url || "/mywork?tab=redaktion")} className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
                    {String(config.label || "Im Social Planner öffnen")}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </>
              )}
            </div>
            );
          })()}

          {showItemSubtasks[item.id] && (
            <div className="ml-8 space-y-2 border-l-2 border-border pl-4">
              <div className="flex items-center space-x-2 text-sm font-medium text-muted-foreground"><ListTodo className="h-4 w-4" />Unteraufgaben</div>
              {itemSubtasks[item.id]?.map((subtask) => (
                <div key={subtask.id} className="space-y-2 p-2 border border-border rounded bg-muted/30">
                  <div className="flex items-center space-x-2">
                    <Checkbox checked={subtask.is_completed} onCheckedChange={(checked) => {
                      if (checked) { setCompletingSubtask(subtask.id); setCompletionResult(''); }
                      else { supabase.from('planning_item_subtasks').update({ is_completed: false, result_text: null, completed_at: null }).eq('id', subtask.id).then(() => { loadItemSubtasks(item.id); loadAllItemCounts(); }); }
                    }} />
                    <Input value={subtask.description} onChange={(e) => { supabase.from('planning_item_subtasks').update({ description: e.target.value }).eq('id', subtask.id).then(() => { loadItemSubtasks(item.id); }); }} className={cn("flex-1 text-sm border-none bg-transparent focus:bg-background", subtask.is_completed && "line-through text-muted-foreground")} />
                    <Select value={subtask.assigned_to || 'unassigned'} onValueChange={(value) => { supabase.from('planning_item_subtasks').update({ assigned_to: value === 'unassigned' ? null : value }).eq('id', subtask.id).then(() => { loadItemSubtasks(item.id); }); }}>
                      <SelectTrigger className="h-8 w-[140px] text-xs"><SelectValue placeholder="Zuweisen..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">Niemand</SelectItem>
                        {allProfiles.map((profile) => <SelectItem key={profile.user_id} value={profile.user_id}>{profile.display_name || 'Unbekannt'}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Input type="date" value={subtask.due_date ? format(new Date(subtask.due_date), "yyyy-MM-dd") : ''} onChange={(e) => { supabase.from('planning_item_subtasks').update({ due_date: e.target.value || null }).eq('id', subtask.id).then(() => { loadItemSubtasks(item.id); }); }} className="w-[130px] h-8 text-xs" placeholder="Frist..." />
                    <Button variant="ghost" size="sm" onClick={() => { supabase.from('planning_item_subtasks').delete().eq('id', subtask.id).then(() => { loadItemSubtasks(item.id); loadAllItemCounts(); }); }} className="h-6 w-6 p-0 text-destructive hover:text-destructive"><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </div>
              ))}
              <div className="space-y-2 pt-2">
                <Input placeholder="Neue Unteraufgabe..." className="text-sm" onKeyPress={(e) => { if (e.key === 'Enter') { const input = e.target as HTMLInputElement; if (input.value.trim() && user) { addItemSubtask(input.value.trim(), 'unassigned', '', item.id); input.value = ''; } } }} />
              </div>
            </div>
          )}

          {showItemComments[item.id] && (
            <div className="ml-8 space-y-2 border-l-2 border-border pl-4">
              <div className="flex items-center space-x-2 text-sm font-medium text-muted-foreground"><MessageCircle className="h-4 w-4" />Kommentare</div>
              {itemComments[item.id]?.map((comment) => (
                <div key={comment.id} className="p-2 border border-border rounded bg-muted/30">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-medium">{comment.profile?.display_name || 'Unbekannt'}</span>
                      <span className="text-xs text-muted-foreground">{format(new Date(comment.created_at), "dd.MM.yyyy HH:mm", { locale: de })}</span>
                    </div>
                    {comment.user_id === user?.id && (
                      <div className="flex space-x-1">
                        <Button variant="ghost" size="sm" onClick={() => setEditingComment((prev) => ({ ...prev, [comment.id]: comment.content }))} className="h-6 w-6 p-0"><Edit2 className="h-3 w-3" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => deleteItemComment(comment)} className="h-6 w-6 p-0 text-destructive hover:text-destructive"><Trash2 className="h-3 w-3" /></Button>
                      </div>
                    )}
                  </div>
                  {editingComment[comment.id] !== undefined ? (
                    <div className="space-y-2">
                      <Input value={editingComment[comment.id]} onChange={(e) => setEditingComment((prev) => ({ ...prev, [comment.id]: e.target.value }))} className="text-sm" onKeyPress={(e) => { if (e.key === 'Enter') updateItemComment(comment.id, editingComment[comment.id]); if (e.key === 'Escape') setEditingComment((prev) => { const ns = { ...prev }; delete ns[comment.id]; return ns; }); }} />
                      <div className="flex space-x-2">
                        <Button size="sm" onClick={() => updateItemComment(comment.id, editingComment[comment.id])} className="h-6 text-xs">Speichern</Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingComment((prev) => { const ns = { ...prev }; delete ns[comment.id]; return ns; })} className="h-6 text-xs">Abbrechen</Button>
                      </div>
                    </div>
                  ) : <p className="text-sm">{comment.content}</p>}
                </div>
              ))}
              <div className="pt-2"><Input placeholder="Kommentar hinzufügen..." className="text-sm" onKeyPress={(e) => { if (e.key === 'Enter') { const input = e.target as HTMLInputElement; if (input.value.trim()) { addItemCommentForItem(item.id, input.value); input.value = ''; } } }} /></div>
            </div>
          )}

          {showItemDocuments[item.id] && (
            <div className="ml-8 space-y-2 border-l-2 border-border pl-4">
              <div className="flex items-center space-x-2 text-sm font-medium text-muted-foreground"><Paperclip className="h-4 w-4" />Dokumente</div>
              {itemDocuments[item.id]?.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between p-2 border border-border rounded bg-muted/30">
                  <div className="flex items-center space-x-2"><Paperclip className="h-3 w-3" /><span className="text-sm break-words">{doc.file_name}</span></div>
                  <div className="flex space-x-1">
                    <Button variant="ghost" size="sm" onClick={() => downloadItemDocument(doc)}><Download className="h-3 w-3" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => deleteItemDocument(doc)} className="text-destructive hover:text-destructive"><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </div>
              ))}
              <div className="pt-2"><Input type="file" onChange={(e) => handleItemFileUpload(e, item.id)} className="text-sm" disabled={uploading} /></div>
            </div>
          )}

          {item.sub_items && Array.isArray(item.sub_items) && item.sub_items.length > 0 && (
            <div className="ml-12 space-y-1">
              {item.sub_items.map((subItem, subIndex: number) => (
                <div key={subIndex} className="flex items-center space-x-2">
                  <Checkbox checked={subItem.is_completed || false} onCheckedChange={() => toggleSubItem(item.id, subIndex, subItem.is_completed || false)} />
                  <Input value={subItem.title || ''} onChange={(e) => updateSubItemTitle(item.id, subIndex, e.target.value)} className={cn("flex-1 text-sm", subItem.is_completed && "line-through text-muted-foreground")} placeholder="Unterpunkt..." />
                  <Button variant="ghost" size="sm" onClick={() => removeSubItem(item.id, subIndex)} className="text-muted-foreground hover:text-destructive"><X className="h-3 w-3" /></Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderPhaseHeader = (group: PhaseGroup, dragHandleProps?: DraggableProvidedDragHandleProps | null) => {
    if (!group.phaseItem) return null;
    const phaseItem = group.phaseItem;
    const itemCount = group.items.filter((i) => i.type !== "separator").length;
    const phaseColor = getPhaseColor(phaseItem);

    return (
      <div className="group/phase mt-4 first:mt-0 pl-2">
          <div className="relative py-2">
            <button
            {...dragHandleProps}
            className="absolute -left-5 top-1.5 flex h-6 w-5 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-muted group-hover/phase:opacity-100"
            aria-label="Phase verschieben"
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <div className="absolute inset-x-0 bottom-0 h-px" style={{ backgroundColor: hexToRgba(phaseColor, 0.45) }} />
          <div className="flex items-center gap-2">
            <div className="flex min-w-0 items-center gap-1.5">
              <EditableTitleInput itemId={phaseItem.id} value={phaseItem.title} onCommit={updateChecklistItemTitle} className="h-7 min-w-0 border-none bg-transparent px-0 text-sm font-semibold focus:bg-transparent" placeholder="Phasenname..." style={{ color: phaseColor }} />
              <Badge className="border-0 px-1.5 text-[10px]" style={{ backgroundColor: hexToRgba(phaseColor, 0.14), color: phaseColor }}>{itemCount}</Badge>
            </div>
            <div className="ml-auto flex items-center gap-1 opacity-0 transition-opacity group-hover/phase:opacity-100">
            <label className="flex cursor-pointer items-center gap-1 rounded-md border px-2 py-1 text-xs text-muted-foreground hover:text-foreground">
              <Palette className="h-3 w-3" />
              <span>Farbe</span>
              <input type="color" value={phaseColor} onChange={(e) => void updateChecklistItemColor(phaseItem.id, e.target.value)} className="h-5 w-5 cursor-pointer border-0 bg-transparent p-0" />
            </label>
            <Button variant="ghost" size="sm" onClick={() => deleteChecklistItem(phaseItem.id)} className="h-7 w-7 p-0 text-destructive hover:text-destructive" title="Phase löschen"><Trash2 className="h-3 w-3" /></Button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Card className="bg-card shadow-card border-border">
      <CardHeader>
        <CardTitle>Checkliste</CardTitle>
      </CardHeader>
      <CardContent className="p-6 pt-0 pl-5 pr-6">
        <div className="space-y-2">
          <Droppable droppableId="checklist">
            {(provided) => (
              <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
                {hasPhases ? (
                  phaseGroups.map((group, groupIndex) => (
                    <div key={groupIndex} className="space-y-2">
                      {group.phaseName !== null && (
                        <Draggable key={group.phaseItem?.id} draggableId={group.phaseItem!.id} index={checklistItems.indexOf(group.phaseItem!)}>
                          {(dragProvided) => (
                            <div ref={dragProvided.innerRef} {...dragProvided.draggableProps} className="group relative">
                              {renderPhaseHeader(group, dragProvided.dragHandleProps)}
                            </div>
                          )}
                        </Draggable>
                      )}
                      {group.phaseName !== null && group.items.length === 0 && <div className="py-2 pl-10 text-xs italic text-muted-foreground">Keine Punkte in dieser Phase</div>}
                      {group.items.map((item) => {
                        const globalIndex = checklistItems.indexOf(item);
                        return <Draggable key={item.id} draggableId={item.id} index={globalIndex}>{(dragProvided, dragSnapshot) => renderChecklistItem(item, globalIndex, dragProvided, dragSnapshot)}</Draggable>;
                      })}
                    </div>
                  ))
                ) : (
                  checklistItems.map((item, index) => <Draggable key={item.id} draggableId={item.id} index={index}>{(dragProvided, dragSnapshot) => renderChecklistItem(item, index, dragProvided, dragSnapshot)}</Draggable>)
                )}
                {provided.placeholder}
              </div>
            )}
          </Droppable>

          <div className="mt-4 flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant={newChecklistItemType === "none" ? "default" : "outline"} size="sm" onClick={() => setNewChecklistItemType("none")}>Standardpunkt</Button>
              {SYSTEM_POINT_BUTTONS.map((button) => (
                <Button key={button.key} type="button" variant={newChecklistItemType === button.key ? "default" : "outline"} size="sm" onClick={() => {
                  setNewChecklistItemType(button.key);
                  if (button.key === "social_media" && !newChecklistItem.trim()) setNewChecklistItem("Social Media");
                  if (button.key === "rsvp" && !newChecklistItem.trim()) setNewChecklistItem("Einladungen & RSVP");
                }}>{button.label}</Button>
              ))}
              {addPhaseItem && <Button variant="outline" onClick={() => addPhaseItem("Neue Phase")} className="text-primary border-primary/30">Phase</Button>}
            </div>
            <div className="flex gap-2">
              <Input value={newChecklistItem} onChange={(e) => setNewChecklistItem(e.target.value)} placeholder={newChecklistItemType === "social_media" ? "Systempunkt wird als Social Media angelegt..." : "Neuen Punkt hinzufügen (--- für Trenner)..."} onKeyPress={(e) => e.key === "Enter" && addChecklistItem()} />
              <Button onClick={addChecklistItem}><Plus className="h-4 w-4" /></Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
