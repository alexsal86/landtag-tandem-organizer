import { AgendaRow } from "./agenda-editor/AgendaRow";
import { AgendaInspector } from "./agenda-editor/AgendaInspector";
import { AgendaSummaryBar } from "./agenda-editor/AgendaSummaryBar";
import { AgendaSystemRow } from "./agenda-editor/AgendaSystemRow";
import { AddAgendaMenu } from "./agenda-editor/AddAgendaMenu";
import { agendaTiming } from "./agenda-editor/agendaTiming";
import type { SystemAgendaType } from "@/components/meetings/types";
import { debugConsole } from '@/utils/debugConsole';
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Save, Clock, StickyNote } from "lucide-react";
import { RichTextDisplay } from "@/components/ui/RichTextDisplay";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { SystemAgendaItem } from "@/components/meetings/SystemAgendaItem";
import { UpcomingAppointmentsSection } from "@/components/meetings/UpcomingAppointmentsSection";
import { PendingJourFixeNotes } from "@/components/meetings/PendingJourFixeNotes";
import { PendingJourFixeCaseItems } from "@/components/meetings/PendingJourFixeCaseItems";
import { JourFixeRequestsCard } from "@/features/appointment-requests/JourFixeRequestsCard";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import type { AgendaItem, Meeting, Profile, LinkedQuickNote, LinkedTask, LinkedCaseItem, RelevantDecision, AgendaDocument } from "@/components/meetings/types";
import { notify } from "@/lib/notify";

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
  onAddSystemAgendaItem: (systemType: SystemAgendaType, parentItem?: AgendaItem) => void;
  onUpdateAgendaItem: (index: number, field: keyof AgendaItem, value: unknown) => void;
  onSaveAgendaItems: () => void | boolean | Promise<void | boolean>;
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
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [hideEmpty, setHideEmpty] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [systemCounts, setSystemCounts] = useState<Record<string, number | null>>({});
  const selectedIndex = agendaItems.findIndex((item, index) => getItemKey(item, index) === selectedKey);
  const selectedItem = agendaItems[selectedIndex];
  const change = (index: number, field: keyof AgendaItem, value: unknown) => { setDirty(true); onUpdateAgendaItem(index, field, value); };
  useEffect(() => { setSelectedKey(null); setDirty(false); setSystemCounts({}); }, [selectedMeeting.id]);
  const timing = agendaTiming(agendaItems, selectedMeeting.meeting_time);
  const [collapsedMainItems, setCollapsedMainItems] = useState<Record<string, boolean>>({});

  const getItemKey = (item: AgendaItem, index: number) => item.localKey || item.id || `agenda-${index}`;

  const isMainItemCollapsed = (item: AgendaItem) => {
    const key = item.id || item.localKey;
    if (!key) return false;
    return !!collapsedMainItems[key];
  };

  const hasContentIndicator = (item: AgendaItem) => {
    const hasNotes = !!item.notes?.trim();
    const hasDescription = !!item.description?.trim();
    const hasDocuments = !!(item.id && agendaDocuments[item.id]?.length);
    return hasNotes || hasDescription || hasDocuments;
  };

  const isHiddenByCollapsedParent = (item: AgendaItem) => {
    const parentKey = item.parent_id || item.parentLocalKey;
    if (!parentKey) return false;
    return !!collapsedMainItems[parentKey];
  };

  const hasSubItems = (item: AgendaItem) => {
    const key = item.id || item.localKey;
    if (!key || item.parent_id || item.parentLocalKey) return false;
    return agendaItems.some((candidate) => (candidate.parent_id || candidate.parentLocalKey) === key);
  };

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

    notify.error(titleText[action], {
      description: actionText[action]
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
        notify.success('Dokument hochgeladen', { description: 'Das Dokument wurde erfolgreich hinzugefügt.' 
});
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

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, item: AgendaItem, index: number) => {
    if (!hasEditPermission) return;

    if (e.key === 'Tab' && !e.shiftKey && !(item.parent_id || item.parentLocalKey)) {
      e.preventDefault();
      (setDirty(true), onAddSubItem)(item, '');
      return;
    }

    if (e.key === 'Enter') {
      const value = e.currentTarget.value.trim();
      if (!value) return;

      if (item.parent_id || item.parentLocalKey) return;

      const isLastMainItem = !agendaItems.slice(index + 1).some((nextItem) => !(nextItem.parent_id || nextItem.parentLocalKey));
      if (isLastMainItem) {
        e.preventDefault();
        onAddAgendaItem();
      }
    }
  };

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
      <div className="flex flex-wrap justify-between items-start gap-3">
        <h2 className="text-xl font-semibold">
          Agenda: {selectedMeeting.title} am {format(new Date(selectedMeeting.meeting_date), "EEEE, d. MMMM", { locale: de })}
          {selectedMeeting.meeting_time && ` um ${selectedMeeting.meeting_time.substring(0, 5)} Uhr`}
        </h2>
        {hasEditPermission && (
          <div className="flex gap-2">
            <AddAgendaMenu agendaItems={agendaItems} onAdd={() => { setDirty(true); onAddAgendaItem(); }} onAddSystem={type => { setDirty(true); onAddSystemAgendaItem(type); }} />
            {dirty && <span role="status" className="text-xs text-muted-foreground self-center">Ungespeicherte Änderungen</span>}
            <Button onClick={async () => { const result = await onSaveAgendaItems(); if (result !== false) setDirty(false); }}>
              <Save className="h-4 w-4 mr-2" /> Speichern
            </Button>
          </div>
        )}
      </div>

      <AgendaSummaryBar timing={timing} hideEmpty={hideEmpty} onHideEmptyChange={setHideEmpty} />
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-6 items-start mt-4">
      <div className="min-w-0">
      <DragDropContext onDragEnd={result => { if (result.destination) setDirty(true); onDragEnd(result); }}>
        <Droppable droppableId="agenda-items">
          {(provided) => (
            <div ref={provided.innerRef} {...provided.droppableProps} className="min-w-0">
              {agendaItems.map((item, index) => (
                <Draggable key={item.localKey || item.id || `agenda-${index}`} draggableId={item.localKey || item.id || `agenda-${index}`} index={index} isDragDisabled={!hasEditPermission}>
                  {(provided, snapshot) => (
                    <>
                      {/* System item rendering */}
                      {item.system_type ? (
                        <div ref={provided.innerRef} {...provided.draggableProps} onFocus={() => setSelectedKey(getItemKey(item, index))} onClick={() => setSelectedKey(getItemKey(item, index))}
                          className={cn("transition-shadow", snapshot.isDragging && "shadow-lg", (item.parentLocalKey || item.parent_id) && "ml-7 border-l pl-2", (isHiddenByCollapsedParent(item) || (hideEmpty && systemCounts[getItemKey(item, index)] === 0)) && "hidden")}
                        >
                          <AgendaSystemRow dragHandleProps={provided.dragHandleProps} canEdit={hasEditPermission} selected={getItemKey(item, index) === selectedKey}>
                          <SystemAgendaItem
                            editorRow
                            onCountChange={count => setSystemCounts(prev => prev[getItemKey(item, index)] === count ? prev : {...prev, [getItemKey(item, index)]: count})}
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
                            onUpdateResult={hasEditPermission ? value => change(index, 'result_text', value) : undefined}
                            onDelete={hasEditPermission ? () => onDeleteAgendaItem(item, index) : undefined}
                            isEmbedded={!!(item.parentLocalKey || item.parent_id)}
                            defaultCollapsed={true}
                            agendaNumber={getAgendaNumber(item)}
                            compact={true}
                            title={item.title}
                            canEditTitle={hasEditPermission}
                            onTitleChange={(value) => change(index, 'title', value)}
                          />
                          </AgendaSystemRow>
                        </div>
                      ) : (
                        /* Regular agenda item */
<AgendaRow item={item} index={index} provided={provided} snapshot={snapshot} hasEditPermission={hasEditPermission} selectedKey={selectedKey} setSelectedKey={setSelectedKey} getItemKey={getItemKey} getAgendaNumber={getAgendaNumber} change={change} handleTitleKeyDown={handleTitleKeyDown} hasContentIndicator={hasContentIndicator} hasSubItems={hasSubItems} isMainItemCollapsed={isMainItemCollapsed} setCollapsedMainItems={setCollapsedMainItems} isHiddenByCollapsedParent={isHiddenByCollapsedParent} timing={timing} onToggleVisibility={onToggleVisibility} setDirty={setDirty} onAddSubItem={onAddSubItem} onDeleteAgendaItem={onDeleteAgendaItem} showTaskSelector={showTaskSelector} onSetShowTaskSelector={onSetShowTaskSelector} tasks={tasks} onAddTaskToAgenda={onAddTaskToAgenda} />
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
            {hasEditPermission && <Button onClick={() => { setDirty(true); onAddAgendaItem(); }}>
              <Plus className="h-4 w-4 mr-2" /> Ersten Punkt hinzufügen
            </Button>}
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground mt-4">Enter = neuer Punkt · Tab = Unterpunkt · Ziehen am Griff = sortieren</p>
      </div>
      {selectedItem ? <AgendaInspector key={getItemKey(selectedItem, selectedIndex)} item={selectedItem} index={selectedIndex} profiles={profiles} hasEditPermission={hasEditPermission} agendaDocuments={agendaDocuments} taskDocuments={taskDocuments} onUpdateAgendaItem={change} onDeleteAgendaDocument={onDeleteAgendaDocument} handleAgendaDocumentUpload={handleAgendaDocumentUpload} showDocumentActionError={showDocumentActionError} onDeleteAgendaItem={(item, index) => { setDirty(true); onDeleteAgendaItem(item, index); }} onToggleVisibility={onToggleVisibility} /> : <aside className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground xl:sticky xl:top-4">Wähle einen Punkt aus, um seine Details zu bearbeiten.</aside>}
      </div>
      {/* Pending Jour Fixe Notes Preview */}
      <PendingJourFixeNotes className="mt-4" />
      <PendingJourFixeCaseItems className="mt-4" />
      {!agendaItems.some(item => item.system_type === 'appointment_requests') && <JourFixeRequestsCard className="mt-4" />}

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
              <StickyNote className="h-5 w-5 text-palette-amber" /> Quick Notes für dieses Meeting <Badge variant="secondary">{linkedQuickNotes.length}</Badge>
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
