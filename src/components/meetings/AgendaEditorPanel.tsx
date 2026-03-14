import type { SystemAgendaType } from "@/components/meetings/types";
import { debugConsole } from '@/utils/debugConsole';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarDays, Plus, Save, Clock, Users, GripVertical, Trash, ListTodo, Upload, FileText, Download, StickyNote, Eye, EyeOff, Star, Cake, Scale, Briefcase, X } from "lucide-react";
import { RichTextDisplay } from "@/components/ui/RichTextDisplay";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { SystemAgendaItem } from "@/components/meetings/SystemAgendaItem";
import { MultiUserAssignSelect } from "@/components/meetings/MultiUserAssignSelect";
import { UpcomingAppointmentsSection } from "@/components/meetings/UpcomingAppointmentsSection";
import { PendingJourFixeNotes } from "@/components/meetings/PendingJourFixeNotes";
import { PendingJourFixeCaseItems } from "@/components/meetings/PendingJourFixeCaseItems";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { SUBPOINT_OPTIONS } from "@/components/meetings/types";
import type { AgendaItem, Meeting, Profile, LinkedQuickNote, LinkedTask, LinkedCaseItem, RelevantDecision, AgendaDocument } from "@/components/meetings/types";

interface AgendaEditorPanelProps {
  selectedMeeting: Meeting;
  agendaItems: AgendaItem[];
  profiles: Profile[];
  tasks: LinkedTask[];
  taskDocuments: Record<string, AgendaDocument[]>;
  agendaDocuments: Record<string, AgendaDocument[]>;
  linkedQuickNotes: LinkedQuickNote[];
  hasEditPermission: boolean;
  showTaskSelector: { itemIndex: number } | null;
  onSetShowTaskSelector: (v: { itemIndex: number } | null) => void;
  onAddAgendaItem: () => void;
  onAddSystemAgendaItem: (systemType: 'upcoming_appointments' | 'quick_notes' | 'tasks' | 'birthdays' | 'decisions' | 'case_items', parentItem?: AgendaItem) => void;
  onUpdateAgendaItem: (index: number, field: keyof AgendaItem, value: unknown) => void;
  onSaveAgendaItems: () => void;
  onAddTaskToAgenda: (task: LinkedTask, parentItem: AgendaItem, parentIndex: number) => void;
  onAddSubItem: (parent: AgendaItem, title: string) => void;
  onDeleteAgendaItem: (item: AgendaItem, index: number) => void;
  onToggleVisibility: (itemId: string, currentVisibility: boolean) => void;
  onDragEnd: (result: DropResult) => void;
  onUploadAgendaDocument: (agendaItemId: string, file: File) => Promise<AgendaDocument | null>;
  onDeleteAgendaDocument: (documentId: string, agendaItemId: string, filePath: string) => void;
  onSetAgendaItems: React.Dispatch<React.SetStateAction<AgendaItem[]>>;
  meetingLinkedTasks: LinkedTask[];
  meetingLinkedCaseItems: LinkedCaseItem[];
  meetingRelevantDecisions: RelevantDecision[];
}

export function AgendaEditorPanel({
  selectedMeeting, agendaItems, profiles, tasks, taskDocuments, agendaDocuments,
  linkedQuickNotes, hasEditPermission, showTaskSelector,
  onSetShowTaskSelector, onAddAgendaItem, onAddSystemAgendaItem, onUpdateAgendaItem,
  onSaveAgendaItems, onAddTaskToAgenda, onAddSubItem, onDeleteAgendaItem,
  onToggleVisibility, onDragEnd, onUploadAgendaDocument, onDeleteAgendaDocument,
  onSetAgendaItems, meetingLinkedTasks, meetingLinkedCaseItems, meetingRelevantDecisions,
}: AgendaEditorPanelProps) {
  const { toast } = useToast();

  const showDocumentActionError = (action: 'download' | 'upload' | 'delete', error: unknown) => {
    debugConsole.error(`${action[0].toUpperCase()}${action.slice(1)} error:`, error);

    const actionText: Record<typeof action, string> = {
      download: 'Datei konnte nicht heruntergeladen werden.',
      upload: 'Dokument konnte nicht hochgeladen werden.',
      delete: 'Dokument konnte nicht gelöscht werden.',
    };

    const titleText: Record<typeof action, string> = {
      download: 'Download-Fehler',
      upload: 'Upload-Fehler',
      delete: 'Lösch-Fehler',
    };

    toast({
      title: titleText[action],
      description: actionText[action],
      variant: 'destructive',
    });
  };

  const persistAgendaItemIfNeeded = async (item: AgendaItem, index: number) => {
    if (item.id) return item.id;

    const { data: savedItem, error: saveError } = await supabase
      .from('meeting_agenda_items')
      .insert([
        {
          meeting_id: selectedMeeting.id!,
          title: item.title || 'Agenda-Punkt',
          description: item.description || '',
          notes: item.notes || '',
          parent_id: item.parent_id || null,
          order_index: item.order_index,
          is_completed: false,
          is_recurring: false,
        },
      ])
      .select()
      .single();

    if (saveError) throw saveError;

    onSetAgendaItems((prevItems) => prevItems.map((prevItem, prevIndex) => (
      prevIndex === index ? { ...prevItem, id: savedItem.id } : prevItem
    )));

    return savedItem.id;
  };

  const handleAgendaDocumentUpload = async (item: AgendaItem, index: number) => {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.pdf,.doc,.docx,.txt,.png,.jpg,.jpeg';

    fileInput.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];

      if (!file || !selectedMeeting?.id) return;

      try {
        const itemId = await persistAgendaItemIfNeeded(item, index);
        await onUploadAgendaDocument(itemId, file);
        toast({ title: 'Dokument hochgeladen', description: 'Das Dokument wurde erfolgreich hinzugefügt.' });
      } catch (error) {
        showDocumentActionError('upload', error);
      }
    };

    fileInput.click();
  };

  const parentByItemKey = new Map<string, AgendaItem>();
  agendaItems.forEach((agendaItem) => {
    if (agendaItem.id) parentByItemKey.set(agendaItem.id, agendaItem);
    if (agendaItem.localKey) parentByItemKey.set(agendaItem.localKey, agendaItem);
  });

  const mainItems = agendaItems
    .filter((agendaItem) => !(agendaItem.parentLocalKey || agendaItem.parent_id))
    .sort((a, b) => a.order_index - b.order_index);

  const mainNumberByKey = new Map<string, number>();
  const subNumberByKey = new Map<string, number>();

  mainItems.forEach((mainItem, mainIndex) => {
    const number = mainIndex + 1;
    if (mainItem.id) mainNumberByKey.set(mainItem.id, number);
    if (mainItem.localKey) mainNumberByKey.set(mainItem.localKey, number);

    const subItems = agendaItems
      .filter((agendaItem) => {
        if (!mainItem.id && !mainItem.localKey) return false;
        return (
          (mainItem.id && agendaItem.parent_id === mainItem.id) ||
          (mainItem.localKey && agendaItem.parentLocalKey === mainItem.localKey)
        );
      })
      .sort((a, b) => a.order_index - b.order_index);

    subItems.forEach((subItem, subIndex) => {
      const subNumber = subIndex + 1;
      if (subItem.id) subNumberByKey.set(subItem.id, subNumber);
      if (subItem.localKey) subNumberByKey.set(subItem.localKey, subNumber);
    });
  });

  const getAgendaNumber = (agendaItem: AgendaItem) => {
    const key = agendaItem.id || agendaItem.localKey;
    if (!key) return undefined;

    const directMain = mainNumberByKey.get(key);
    if (directMain) return `${directMain}.`;

    const parentKey = agendaItem.parent_id || agendaItem.parentLocalKey;
    if (!parentKey) return undefined;

    const parentMain = mainNumberByKey.get(parentKey);
    const subNumber = subNumberByKey.get(key);
    if (parentMain && subNumber) return `${parentMain}.${subNumber}`;

    const parentItem = parentByItemKey.get(parentKey);
    if (!parentItem) return undefined;
    const fallbackParentKey = parentItem.id || parentItem.localKey;
    if (!fallbackParentKey) return undefined;
    const fallbackMain = mainNumberByKey.get(fallbackParentKey);
    if (!fallbackMain || !subNumber) return undefined;
    return `${fallbackMain}.${subNumber}`;
  };

  return (
    <>
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">
          Agenda: {selectedMeeting.title} am {format(new Date(selectedMeeting.meeting_date), "EEEE, d. MMMM", { locale: de })}
          {selectedMeeting.meeting_time && ` um ${selectedMeeting.meeting_time.substring(0, 5)} Uhr`}
        </h2>
        {hasEditPermission && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={onAddAgendaItem}>
              <Plus className="h-4 w-4 mr-2" /> Punkt
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  <CalendarDays className="h-4 w-4 mr-2" /> System
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56">
                <div className="space-y-2">
                  <p className="text-sm font-medium mb-2">Dynamischen Punkt hinzufügen</p>
                  {([
                    { type: 'upcoming_appointments' as const, label: 'Kommende Termine', Icon: CalendarDays, color: 'blue' },
                    { type: 'quick_notes' as const, label: 'Meine Notizen', Icon: StickyNote, color: 'amber' },
                    { type: 'tasks' as const, label: 'Aufgaben', Icon: ListTodo, color: 'green' },
                    { type: 'birthdays' as const, label: 'Geburtstage', Icon: Cake, color: 'pink' },
                    { type: 'decisions' as const, label: 'Entscheidungen', Icon: Scale, color: 'slate' },
                    { type: 'case_items' as const, label: 'Vorgänge', Icon: Briefcase, color: 'teal' },
                  ]).map(({ type, label, Icon, color }) => (
                    <Button key={type} variant="outline"
                      className={`w-full justify-start border-${color}-200 text-${color}-700 dark:border-${color}-800 dark:text-${color}-400`}
                      onClick={() => onAddSystemAgendaItem(type)}
                      disabled={agendaItems.some(i => i.system_type === type)}
                    >
                      <Icon className="h-4 w-4 mr-2" /> {label}
                    </Button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
            <Button onClick={onSaveAgendaItems}>
              <Save className="h-4 w-4 mr-2" /> Speichern
            </Button>
          </div>
        )}
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="agenda-items">
          {(provided) => (
            <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-2 mt-4">
              {agendaItems.map((item, index) => (
                <Draggable key={item.id || item.localKey || `agenda-${index}`} draggableId={item.id || item.localKey || `agenda-${index}`} index={index} isDragDisabled={!hasEditPermission}>
                  {(provided, snapshot) => (
                    <>
                      {/* System item rendering */}
                      {item.system_type ? (
                        <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps}
                          className={cn("transition-shadow", snapshot.isDragging && "shadow-lg", (item.parentLocalKey || item.parent_id) && "ml-8 border-l-4 border-l-primary/30")}
                        >
                          <SystemAgendaItem
                            systemType={item.system_type as SystemAgendaType}
                            meetingDate={selectedMeeting.meeting_date}
                            meetingId={selectedMeeting.id}
                            allowStarring={false}
                            linkedQuickNotes={linkedQuickNotes}
                            linkedTasks={meetingLinkedTasks}
                            linkedDecisions={meetingRelevantDecisions}
                            linkedCaseItems={meetingLinkedCaseItems}
                            profiles={profiles}
                            resultText={item.result_text}
                            onDelete={hasEditPermission ? () => onDeleteAgendaItem(item, index) : undefined}
                            isEmbedded={!!(item.parentLocalKey || item.parent_id)}
                            defaultCollapsed={true}
                            agendaNumber={getAgendaNumber(item)}
                            compact={true}
                          />
                        </div>
                      ) : (
                        /* Regular agenda item */
                        <div ref={provided.innerRef} {...provided.draggableProps}
                          className={cn(
                            "transition-colors border-b border-border/60 hover:bg-muted/30",
                            snapshot.isDragging && "shadow-lg bg-card rounded-lg border",
                            (item.parentLocalKey || item.parent_id) && "pl-8 border-l-4 border-l-primary/30",
                            item.is_optional && "border-dashed",
                            item.is_optional && item.is_visible === false && "opacity-50"
                          )}
                        >
                          <div className="py-2 px-3">
                            <div className="space-y-3">
                              <div className="flex items-center gap-2 group">
                                {hasEditPermission && (
                                  <div {...provided.dragHandleProps} className="cursor-grab active:cursor-grabbing">
                                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                                  </div>
                                )}
                                <span className="text-muted-foreground font-medium min-w-[2.25rem] text-right">
                                  {getAgendaNumber(item)}
                                </span>
                                <Input value={item.title} onChange={(e) => onUpdateAgendaItem(index, 'title', e.target.value)}
                                  placeholder={item.parentLocalKey || item.parent_id ? "Unterpunkt-Titel" : "Agenda-Punkt Titel"}
                                  className={cn("font-semibold", !(item.parentLocalKey || item.parent_id) && "text-lg")}
                                  readOnly={!hasEditPermission}
                                />
                                {/* Carryover badge */}
                                {item.source_meeting_id && (
                                  <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 whitespace-nowrap">
                                    ↩ {item.original_meeting_title ? `von ${item.original_meeting_title}` : 'Übertragen'}
                                  </Badge>
                                )}
                                {/* Optional visibility toggle */}
                                {item.is_optional && item.id && hasEditPermission && (
                                  <Button size="icon" variant="ghost" className="shrink-0 h-7 w-7" onClick={() => onToggleVisibility(item.id!, item.is_visible !== false)}>
                                    {item.is_visible !== false ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
                                  </Button>
                                )}
                                {/* Carry over checkbox */}
                                {!(item.parentLocalKey || item.parent_id) && hasEditPermission && (
                                  <label className="flex items-center gap-1 shrink-0 cursor-pointer" title="Auf nächstes Meeting übertragen">
                                    <Checkbox checked={!!item.carry_over_to_next} onCheckedChange={(checked) => onUpdateAgendaItem(index, 'carry_over_to_next', !!checked)} />
                                    <span className="text-xs text-muted-foreground">↩</span>
                                  </label>
                                )}
                                {/* Sub-items button */}
                                {!(item.parentLocalKey || item.parent_id) && hasEditPermission && (
                                  <Popover>
                                    <PopoverTrigger asChild>
                                      <Button size="icon" variant="ghost" className="shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity">
                                        <Plus className="h-4 w-4" />
                                      </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-64">
                                      <div className="space-y-2">
                                        <p className="text-sm font-medium mb-2">Unterpunkt hinzufügen</p>
                                        {SUBPOINT_OPTIONS[item.title]?.map((sub) => (
                                          <Button key={sub} variant="outline" className="w-full justify-start text-xs h-auto py-2 whitespace-normal text-left" onClick={() => onAddSubItem(item, sub)}>
                                            {sub}
                                          </Button>
                                        ))}
                                        <Button variant="secondary" className="w-full" onClick={() => onAddSubItem(item, '')}>
                                          <Plus className="h-4 w-4 mr-2" /> Freien Unterpunkt hinzufügen
                                        </Button>
                                        {/* System items as sub-items */}
                                        <div className="border-t pt-2 mt-2">
                                          <p className="text-xs text-muted-foreground mb-1">System-Punkt als Unterpunkt:</p>
                                          {([
                                            { type: 'upcoming_appointments' as const, label: 'Kommende Termine', Icon: CalendarDays, color: 'blue' },
                                            { type: 'quick_notes' as const, label: 'Meine Notizen', Icon: StickyNote, color: 'amber' },
                                            { type: 'tasks' as const, label: 'Aufgaben', Icon: ListTodo, color: 'green' },
                                            { type: 'birthdays' as const, label: 'Geburtstage', Icon: Cake, color: 'pink' },
                                            { type: 'decisions' as const, label: 'Entscheidungen', Icon: Scale, color: 'slate' },
                                            { type: 'case_items' as const, label: 'Vorgänge', Icon: Briefcase, color: 'teal' },
                                          ]).map(({ type, label, Icon, color }) => (
                                            <Button key={type} variant="outline"
                                              className={`w-full justify-start border-${color}-200 text-${color}-700 dark:border-${color}-800 dark:text-${color}-400`}
                                              onClick={() => onAddSystemAgendaItem(type, item)}
                                              disabled={agendaItems.some(i => i.system_type === type)}
                                            >
                                              <Icon className="h-4 w-4 mr-2" /> {label}
                                            </Button>
                                          ))}
                                        </div>
                                      </div>
                                    </PopoverContent>
                                  </Popover>
                                )}
                                {/* Task button */}
                                {!(item.parentLocalKey || item.parent_id) && hasEditPermission && (
                                  <Popover open={showTaskSelector?.itemIndex === index} onOpenChange={(open) => onSetShowTaskSelector(open ? { itemIndex: index } : null)}>
                                    <PopoverTrigger asChild>
                                      <Button size="icon" variant="ghost" className="shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity" aria-label="Aufgabe hinzufügen">
                                        <ListTodo className="h-4 w-4" />
                                      </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[min(92vw,32rem)]">
                                      <div className="space-y-2">
                                        <div className="text-sm font-medium mb-3">Aufgabe als Unterpunkt hinzufügen</div>
                                        {tasks.length > 0 ? (
                                          <div className="space-y-2 max-h-60 overflow-y-auto">
                                            {tasks.map((task) => (
                                              <Button key={task.id} variant="outline" className="w-full justify-start text-left h-auto p-3 whitespace-normal"
                                                onClick={() => onAddTaskToAgenda(task, item, index)}>
                                                <div><div className="font-medium whitespace-normal break-words">{task.title}</div></div>
                                              </Button>
                                            ))}
                                          </div>
                                        ) : (
                                          <div className="text-sm text-muted-foreground text-center py-4">Keine offenen Aufgaben verfügbar</div>
                                        )}
                                      </div>
                                    </PopoverContent>
                                  </Popover>
                                )}
                                {/* Delete button */}
                                {hasEditPermission && (
                                  <Button size="icon" variant="ghost" className="shrink-0 text-destructive hover:text-destructive opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                                    onClick={() => onDeleteAgendaItem(item, index)} aria-label="Punkt löschen">
                                    <Trash className="h-4 w-4" />
                                  </Button>
                                )}
                                {/* Checkbox at end for main items */}
                                {!(item.parentLocalKey || item.parent_id) && (
                                  <Checkbox checked={item.is_completed} onCheckedChange={(checked) => onUpdateAgendaItem(index, 'is_completed', !!checked)} className="ml-1" />
                                )}
                              </div>

                              {/* Sub-item details */}
                              {(item.parentLocalKey || item.parent_id) && (
                                <>
                                  {item.description && /<[a-z][\s\S]*>/i.test(item.description) ? (
                                    <RichTextDisplay content={item.description} className="text-sm text-muted-foreground" />
                                  ) : (
                                    <Textarea value={item.description || ''} onChange={(e) => onUpdateAgendaItem(index, 'description', e.target.value)} placeholder="Beschreibung" className="min-h-[60px]" />
                                  )}
                                  <MultiUserAssignSelect assignedTo={item.assigned_to ?? null} profiles={profiles}
                                    onChange={(userIds) => onUpdateAgendaItem(index, 'assigned_to', userIds.length > 0 ? userIds : null)} size="sm" />

                                  {/* Task documents */}
                                  {item.task_id && taskDocuments[item.task_id] && taskDocuments[item.task_id].length > 0 && (
                                    <div className="mb-3">
                                      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                                        <FileText className="h-3 w-3" /><span>Aufgaben-Dokumente:</span>
                                      </div>
                                      <div className="space-y-1">
                                        {taskDocuments[item.task_id].map((doc, docIndex) => (
                                          <div key={docIndex} className="flex items-center justify-between py-1 px-2 hover:bg-muted/30 rounded text-xs">
                                            <span className="text-muted-foreground truncate">{doc.file_name || 'Dokument'}</span>
                                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                                              onClick={async () => {
                                                try {
                                                  const { data, error } = await supabase.storage.from('task-documents').download(doc.file_path);
                                                  if (error) throw error;
                                                  const url = URL.createObjectURL(data);
                                                  const a = document.createElement('a'); a.href = url; a.download = doc.file_name || 'download'; a.click(); URL.revokeObjectURL(url);
                                                 } catch (error) { showDocumentActionError('download', error); }
                                              }}>
                                              <Download className="h-3 w-3" />
                                            </Button>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  <div>
                                    <label className="text-sm font-medium">Notizen</label>
                                    <Textarea value={item.notes || ''} onChange={(e) => onUpdateAgendaItem(index, 'notes', e.target.value)} placeholder="Notizen und Hinweise" className="min-h-[80px]" />
                                  </div>

                                  <div>
                                    {/* Agenda documents */}
                                    {agendaDocuments[item.id!] && agendaDocuments[item.id!].length > 0 && (
                                      <div className="mb-4 bg-muted/30 p-3 rounded-lg border">
                                        <h4 className="text-sm font-medium mb-2">Angehängte Dokumente:</h4>
                                        <div className="space-y-2">
                                          {agendaDocuments[item.id!].map((doc, docIndex) => (
                                            <div key={docIndex} className="flex items-center justify-between p-2 bg-background rounded border">
                                              <div className="flex items-center gap-2">
                                                <FileText className="h-4 w-4 text-blue-600" />
                                                <span className="text-sm">{doc.file_name}</span>
                                              </div>
                                              <div className="flex gap-1">
                                                <Button variant="ghost" size="sm"
                                                  onClick={async () => {
                                                    try {
                                                      const { data, error } = await supabase.storage.from('documents').download(doc.file_path);
                                                      if (error) throw error;
                                                      const url = URL.createObjectURL(data); const a = document.createElement('a'); a.href = url; a.download = doc.file_name; a.click(); URL.revokeObjectURL(url);
                                                    } catch (error) { showDocumentActionError('download', error); }
                                                  }}>
                                                  <Download className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="sm" onClick={() => onDeleteAgendaDocument(doc.id, item.id!, doc.file_path)}>
                                                  <X className="h-4 w-4" />
                                                </Button>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                    <label className="text-sm font-medium">Dokument hinzufügen</label>
                                    <div className="flex items-center gap-2">
                                      <Button variant="outline" size="sm" className="flex-1"
                                        onClick={() => handleAgendaDocumentUpload(item, index)}>
                                        <Upload className="h-4 w-4 mr-2" /> Dokument hinzufügen
                                      </Button>
                                    </div>
                                  </div>
                                </>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      )}
                    </>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      {agendaItems.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium">Keine Agenda-Punkte</h3>
            <p className="text-muted-foreground mb-4">Fügen Sie Punkte zur Agenda hinzu oder importieren Sie Aufgaben</p>
            <Button onClick={onAddAgendaItem}>
              <Plus className="h-4 w-4 mr-2" /> Ersten Punkt hinzufügen
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Pending Jour Fixe Notes Preview */}
      <PendingJourFixeNotes className="mt-4" />
      <PendingJourFixeCaseItems className="mt-4" />

      {/* Upcoming Appointments Preview */}
      {!agendaItems.some(item => item.system_type === 'upcoming_appointments') && (
        <Card className="mt-4">
          <CardContent className="p-4">
            <UpcomingAppointmentsSection meetingDate={selectedMeeting.meeting_date} meetingId={selectedMeeting.id} defaultCollapsed={true} allowStarring={true} />
          </CardContent>
        </Card>
      )}

      {/* Quick Notes Preview */}
      {!agendaItems.some(item => item.system_type === 'quick_notes') && linkedQuickNotes.length > 0 && (
        <Card className="mt-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <StickyNote className="h-5 w-5 text-amber-500" /> Quick Notes für dieses Meeting <Badge variant="secondary">{linkedQuickNotes.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {linkedQuickNotes.map((note) => (
                <div key={note.id} className="p-3 bg-muted/50 rounded-md">
                  {note.title && <h4 className="font-semibold text-sm mb-1">{note.title}</h4>}
                  <RichTextDisplay content={note.content} className="text-sm" />
                  {note.meeting_result && <p className="text-xs text-muted-foreground mt-1">Ergebnis: {note.meeting_result}</p>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}
