import { PencilSparkles } from "@/components/icons/PencilSparkles";
import { AgendaReadyBanner } from "./agenda-editor/AgendaReadyBanner";
import { AgendaRowDetails } from "./agenda-editor/AgendaRowDetails";
import { AgendaRow } from "./agenda-editor/AgendaRow";
import { AgendaInspector } from "./agenda-editor/AgendaInspector";
import { AgendaSummaryBar } from "./agenda-editor/AgendaSummaryBar";
import { AgendaSystemRow } from "./agenda-editor/AgendaSystemRow";
import { AddAgendaMenu } from "./agenda-editor/AddAgendaMenu";
import { agendaItemKey, resolveAgendaDrop } from "./agenda-editor/agendaDrop";
import { agendaTiming } from "./agenda-editor/agendaTiming";
import type { SystemAgendaType } from "@/components/meetings/types";
import { debugConsole } from "@/utils/debugConsole";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Clock } from "lucide-react";
import { RichTextDisplay } from "@/components/ui/RichTextDisplay";
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
  type DragUpdate,
} from "@hello-pangea/dnd";
import { SystemAgendaItem } from "@/components/meetings/SystemAgendaItem";
import { UpcomingAppointmentsSection } from "@/components/meetings/UpcomingAppointmentsSection";
import { PendingJourFixeNotes } from "@/components/meetings/PendingJourFixeNotes";
import { PendingJourFixeCaseItems } from "@/components/meetings/PendingJourFixeCaseItems";
import { JourFixeRequestsCard } from "@/features/appointment-requests/JourFixeRequestsCard";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import type {
  AgendaItem,
  Meeting,
  Profile,
  LinkedQuickNote,
  LinkedTask,
  LinkedCaseItem,
  RelevantDecision,
  AgendaDocument,
} from "@/components/meetings/types";
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
  onStartMeeting?: () => void;
  onOpenCarryover?: () => void;
  onAddSystemAgendaItem: (
    systemType: SystemAgendaType,
    parentItem?: AgendaItem,
  ) => void;
  onUpdateAgendaItem: (
    index: number,
    field: keyof AgendaItem,
    value: unknown,
  ) => void;
  onSaveAgendaItems: () => void | boolean | Promise<void | boolean>;
  onAddTaskToAgenda: (
    task: LinkedTask,
    parentItem: AgendaItem,
    parentIndex: number,
  ) => void;
  onAddSubItem: (parent: AgendaItem, title: string) => void;
  onDeleteAgendaItem: (item: AgendaItem, index: number) => void;
  onToggleVisibility: (itemId: string, currentVisibility: boolean) => void;
  onDragEnd: (result: DropResult, hiddenItems?: ReadonlySet<AgendaItem>) => void;
  onUploadAgendaDocument: (
    agendaItemId: string,
    file: File,
  ) => Promise<AgendaDocument | null>;
  onDeleteAgendaDocument: (
    documentId: string,
    agendaItemId: string,
    filePath: string,
  ) => void;
  onSetAgendaItems: React.Dispatch<React.SetStateAction<AgendaItem[]>>;
  meetingLinkedTasks: LinkedTask[];
  meetingLinkedCaseItems: LinkedCaseItem[];
  meetingRelevantDecisions: RelevantDecision[];
}

export function AgendaEditorPanel({
  selectedMeeting,
  agendaItems,
  profiles,
  tasks,
  taskDocuments,
  agendaDocuments,
  linkedQuickNotes,
  hasEditPermission,
  showTaskSelector,
  onSetShowTaskSelector,
  onAddAgendaItem,
  onStartMeeting,
  onOpenCarryover,
  onAddSystemAgendaItem,
  onUpdateAgendaItem,
  onSaveAgendaItems,
  onAddTaskToAgenda,
  onAddSubItem,
  onDeleteAgendaItem,
  onToggleVisibility,
  onDragEnd,
  onUploadAgendaDocument,
  onDeleteAgendaDocument,
  onSetAgendaItems,
  meetingLinkedTasks,
  meetingLinkedCaseItems,
  meetingRelevantDecisions,
}: AgendaEditorPanelProps) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [hideEmpty, setHideEmpty] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const saveAgenda = async () => {
    setSaving(true);
    try {
      if ((await onSaveAgendaItems()) === false) return false;
      setDirty(false);
      setSaved(true);
      return true;
    } finally {
      setSaving(false);
    }
  };
  const [systemCounts, setSystemCounts] = useState<
    Record<string, number | null>
  >({});
  const getItemKey = agendaItemKey;
  const [dragging, setDragging] = useState(false);
  const [dragUpdate, setDragUpdate] = useState<DragUpdate | null>(null);
  const selectedIndex = agendaItems.findIndex(
    (item, index) => getItemKey(item, index) === selectedKey,
  );
  const selectedItem = agendaItems[selectedIndex];
  const hasSelectedChild = (item: AgendaItem) => Boolean(
    (item.id && selectedItem?.parent_id === item.id) ||
    (item.localKey && selectedItem?.parentLocalKey === item.localKey),
  );
  const change = (index: number, field: keyof AgendaItem, value: unknown) => {
    if (!hasEditPermission) return;
    setDirty(true);
    onUpdateAgendaItem(index, field, value);
  };
  useEffect(() => {
    setSaved(false);
    setSelectedKey(null);
    setDirty(false);
    setSystemCounts({});
  }, [selectedMeeting.id]);
  const timing = agendaTiming(agendaItems, selectedMeeting.meeting_time);
  const [collapsedMainItems, setCollapsedMainItems] = useState<
    Record<string, boolean>
  >({});

  const [systemExpanded, setSystemExpanded] = useState<Record<string, boolean>>(
    {},
  );
  const expandableMain = agendaItems.filter(
    (item) =>
      !item.parent_id &&
      !item.parentLocalKey &&
      agendaItems.some(
        (child) =>
          (item.id && child.parent_id === item.id) ||
          (item.localKey && child.parentLocalKey === item.localKey),
      ),
  );
  const systemItems = agendaItems.filter((item) => item.system_type);
  const allCollapsed =
    expandableMain.length + systemItems.length > 0 &&
    expandableMain.every(
      (item) => !!collapsedMainItems[item.localKey || item.id || ""],
    ) &&
    systemItems.every(
      (item) => systemExpanded[item.localKey || item.id || ""] === false,
    );
  const toggleAll = () => {
    const expand = allCollapsed;
    setCollapsedMainItems(
      Object.fromEntries(
        expandableMain.map((item) => [item.localKey || item.id || "", !expand]),
      ),
    );
    setSystemExpanded(
      Object.fromEntries(
        systemItems.map((item) => [item.localKey || item.id || "", expand]),
      ),
    );
  };
  const isMainItemCollapsed = (item: AgendaItem) => {
    const key = item.localKey || item.id;
    if (!key) return false;
    return !!collapsedMainItems[key];
  };

  const isHiddenByCollapsedParent = (item: AgendaItem) => {
    const parentKey = item.parent_id || item.parentLocalKey;
    if (!parentKey) return false;
    const parent = agendaItems.find(
      (candidate) =>
        candidate.id === parentKey || candidate.localKey === parentKey,
    );
    return !!collapsedMainItems[parent?.localKey || parent?.id || parentKey];
  };

  const itemIsHidden = (item: AgendaItem, index: number) =>
    isHiddenByCollapsedParent(item) ||
    Boolean(item.system_type && hideEmpty && systemCounts[getItemKey(item, index)] === 0);
  const hiddenItems = new Set(agendaItems.filter(itemIsHidden));
  const dropPreview = dragUpdate && resolveAgendaDrop(agendaItems, dragUpdate, hiddenItems);

  const getSubItemCount = (item: AgendaItem) => {
    const key = item.localKey || item.id;
    if (!key || item.parent_id || item.parentLocalKey) return 0;
    return agendaItems.filter(
      (candidate) =>
        (item.id && candidate.parent_id === item.id) ||
        (item.localKey && candidate.parentLocalKey === item.localKey),
    ).length;
  };

  const showDocumentActionError = (
    action: "download" | "upload" | "delete",
    error: unknown,
  ) => {
    debugConsole.error(
      `${action[0].toUpperCase()}${action.slice(1)} error:`,
      error,
    );

    const actionText: Record<typeof action, string> = {
      download: "Datei konnte nicht heruntergeladen werden.",
      upload: "Dokument konnte nicht hochgeladen werden.",
      delete: "Dokument konnte nicht gelöscht werden.",
    };

    const titleText: Record<typeof action, string> = {
      download: "Download-Fehler",
      upload: "Upload-Fehler",
      delete: "Lösch-Fehler",
    };

    notify.error(titleText[action], {
      description: actionText[action],
    });
  };

  const persistAgendaItemIfNeeded = async (item: AgendaItem, index: number) => {
    if (item.id) return item.id;

    const { data: savedItem, error: saveError } = await supabase
      .from("meeting_agenda_items")
      .insert([
        {
          meeting_id: selectedMeeting.id!,
          title: item.title || "Agenda-Punkt",
          description: item.description || "",
          notes: item.notes || "",
          parent_id: item.parent_id || null,
          order_index: item.order_index,
          icon_config: item.icon_config ?? null,
          duration_minutes:
            item.parent_id || item.parentLocalKey
              ? null
              : (item.duration_minutes ?? null),
          assigned_to: item.assigned_to,
          carry_over_to_next: item.carry_over_to_next,
          is_completed: Boolean(item.is_completed),
          is_recurring: Boolean(item.is_recurring),
        },
      ])
      .select()
      .single();

    if (saveError) throw saveError;

    onSetAgendaItems((prevItems) =>
      prevItems.map((prevItem, prevIndex) =>
        prevIndex === index ? { ...prevItem, id: savedItem.id } : prevItem,
      ),
    );

    return savedItem.id;
  };

  const handleAgendaDocumentUpload = async (
    item: AgendaItem,
    index: number,
  ) => {
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = ".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg";

    fileInput.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];

      if (!file || !selectedMeeting?.id) return;

      try {
        const itemId = await persistAgendaItemIfNeeded(item, index);
        await onUploadAgendaDocument(itemId, file);
        notify.success("Dokument hochgeladen", {
          description: "Das Dokument wurde erfolgreich hinzugefügt.",
        });
      } catch (error) {
        showDocumentActionError("upload", error);
      }
    };

    fileInput.click();
  };

  const parentByItemKey = new Map<string, AgendaItem>();
  agendaItems.forEach((agendaItem) => {
    if (agendaItem.id) parentByItemKey.set(agendaItem.id, agendaItem);
    if (agendaItem.localKey)
      parentByItemKey.set(agendaItem.localKey, agendaItem);
  });

  const mainItems = agendaItems
    .filter(
      (agendaItem) => !(agendaItem.parentLocalKey || agendaItem.parent_id),
    )
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

  const handleTitleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    item: AgendaItem,
    index: number,
  ) => {
    if (!hasEditPermission) return;

    if (
      e.key === "Tab" &&
      !e.shiftKey &&
      !(item.parent_id || item.parentLocalKey)
    ) {
      e.preventDefault();
      setDirty(true);
      onAddSubItem(item, "");
      return;
    }

    if (e.key === "Enter") {
      const value = e.currentTarget.value.trim();
      if (!value) return;

      if (item.parent_id || item.parentLocalKey) return;

      const isLastMainItem = !agendaItems
        .slice(index + 1)
        .some((nextItem) => !(nextItem.parent_id || nextItem.parentLocalKey));
      if (isLastMainItem) {
        e.preventDefault();
        setDirty(true);
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
        <div>
          <h2 className="text-xl font-semibold">{selectedMeeting.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {format(new Date(selectedMeeting.meeting_date), "EEEE, d. MMMM", {
              locale: de,
            })}
            {selectedMeeting.meeting_time &&
              `, ${selectedMeeting.meeting_time.substring(0, 5)} Uhr`}
            {selectedMeeting.location && `, ${selectedMeeting.location}`}
          </p>
        </div>
        {hasEditPermission && (
          <div className="flex flex-wrap gap-2">
            <AddAgendaMenu
              agendaItems={agendaItems}
              onAdd={() => {
                setDirty(true);
                onAddAgendaItem();
              }}
              onAddSystem={(type) => {
                setDirty(true);
                onAddSystemAgendaItem(type);
              }}
            />
            <Button disabled={saving} onClick={() => void saveAgenda()}>
              {saved && !dirty ? "Gespeichert" : "Speichern"}
            </Button>
          </div>
        )}
      </div>

      <AgendaReadyBanner
        timing={timing}
        startDisabled={saving}
        onStart={onStartMeeting && (async () => {
          if (!dirty || await saveAgenda()) onStartMeeting();
        })}
      />

      <div className={cn("grid items-start gap-4", selectedItem && "2xl:grid-cols-[minmax(0,1fr)_19rem]")}>
        <div className="min-w-0 rounded-2xl border bg-card shadow-sm [--agenda-subpoint-bg:color(srgb_0.956863_0.964706_0.952941_/_0.7)] [--agenda-row-divider:rgb(227,232,223)]">
          <AgendaSummaryBar
            allCollapsed={allCollapsed}
            onToggleAll={toggleAll}
            timing={timing}
            hideEmpty={hideEmpty}
            onHideEmptyChange={setHideEmpty}
            onOpenCarryover={onOpenCarryover}
          />

          <div role="status" className="pointer-events-none sticky top-2 z-20 flex h-0 justify-end px-3">
            {dragging && (
              <p className="h-fit max-w-[90%] rounded-md border border-primary/30 bg-card px-3 py-2 text-sm shadow-sm">
                {dropPreview?.parent
                  ? `Als Unterpunkt zu „${dropPreview.parent.title}“ ablegen`
                  : dropPreview
                    ? "Als Hauptpunkt ablegen"
                    : "Zwischen Gruppen als Hauptpunkt ablegen. Auf einen Punkt ziehen, um ihn unterzuordnen."}
              </p>
            )}
          </div>
          <DragDropContext
            onDragStart={() => setDragging(true)}
            onDragUpdate={setDragUpdate}
            onDragEnd={(result) => {
              setDragging(false);
              setDragUpdate(null);
              if (result.reason === "CANCEL") return;
              const drop = resolveAgendaDrop(agendaItems, result, hiddenItems);
              if (!drop) return;
              setDirty(true);
              if (drop.parent) {
                const key = drop.parent.localKey || drop.parent.id;
                if (key) setCollapsedMainItems((prev) => ({ ...prev, [key]: false }));
              }
              onDragEnd(result, hiddenItems);
            }}
          >
            <Droppable droppableId="agenda-items" isCombineEnabled>
              {(provided) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className="min-w-0"
                >
                  {agendaItems.map((item, index) => (
                    <Draggable
                      key={item.localKey || item.id || `agenda-${index}`}
                      draggableId={
                        item.localKey || item.id || `agenda-${index}`
                      }
                      index={index}
                      isDragDisabled={!hasEditPermission}
                    >
                      {(provided, snapshot) => (
                        <>
                          {/* System item rendering */}
                          {item.system_type ? (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              onFocus={() =>
                                setSelectedKey(getItemKey(item, index))
                              }
                              onClick={() =>
                                setSelectedKey(getItemKey(item, index))
                              }
                              className={cn(
                                "transition-shadow",
                                snapshot.isDragging && "shadow-lg",
                                dropPreview?.marker === item &&
                                  (dragUpdate?.combine ? "ring-2 ring-inset ring-primary" : "shadow-[inset_0_2px_0] shadow-primary"),
                                hiddenItems.has(item) && "hidden",
                              )}
                            >
                              <AgendaSystemRow
                                dragHandleProps={provided.dragHandleProps}
                                canEdit={hasEditPermission}
                                dragging={snapshot.isDragging}
                                hasSelectedChild={hasSelectedChild(item)}
                                nested={Boolean(item.parentLocalKey || item.parent_id)}
                                selected={
                                  getItemKey(item, index) === selectedKey
                                }
                              >
                                <SystemAgendaItem
                                  expandedOverride={
                                    systemExpanded[getItemKey(item, index)] ??
                                    true
                                  }
                                  onExpandedChange={(expanded) =>
                                    setSystemExpanded((prev) => ({
                                      ...prev,
                                      [getItemKey(item, index)]: expanded,
                                    }))
                                  }
                                  editorRow
                                  editorCompleted={item.is_completed}
                                  editorDescription={item.description ?? undefined}
                                  editorDetails={
                                    <AgendaRowDetails
                                      item={item}
                                      profiles={profiles}
                                      onComplete={hasEditPermission ? (completed) => change(index, "is_completed", completed) : undefined}
                                    />
                                  }
                                  onCountChange={(count) =>
                                    setSystemCounts((prev) =>
                                      prev[getItemKey(item, index)] === count
                                        ? prev
                                        : {
                                            ...prev,
                                            [getItemKey(item, index)]: count,
                                          },
                                    )
                                  }
                                  systemType={
                                    item.system_type as SystemAgendaType
                                  }
                                  meetingDate={selectedMeeting.meeting_date}
                                  meetingId={selectedMeeting.id}
                                  allowStarring={false}
                                  linkedQuickNotes={linkedQuickNotes}
                                  linkedTasks={meetingLinkedTasks}
                                  linkedDecisions={meetingRelevantDecisions}
                                  linkedCaseItems={meetingLinkedCaseItems}
                                  profiles={profiles}
                                  resultText={item.result_text}
                                  onUpdateResult={
                                    hasEditPermission
                                      ? (value) =>
                                          change(index, "result_text", value)
                                      : undefined
                                  }
                                  onDelete={
                                    hasEditPermission
                                      ? () => {
                                          setDirty(true);
                                          onDeleteAgendaItem(item, index);
                                        }
                                      : undefined
                                  }
                                  isEmbedded={
                                    !!(item.parentLocalKey || item.parent_id)
                                  }
                                  defaultCollapsed={false}
                                  agendaNumber={getAgendaNumber(item)}
                                  compact={true}
                                  title={item.title}
                                  canEditTitle={hasEditPermission}
                                  onTitleChange={(value) =>
                                    change(index, "title", value)
                                  }
                                />
                              </AgendaSystemRow>
                            </div>
                          ) : (
                            /* Regular agenda item */
                            <AgendaRow
                              item={item}
                              hasSelectedChild={hasSelectedChild(item)}
                              dropTarget={dropPreview?.marker === item ? (dragUpdate?.combine ? "inside" : "before") : undefined}
                              index={index}
                              provided={provided}
                              snapshot={snapshot}
                              hasEditPermission={hasEditPermission}
                              selectedKey={selectedKey}
                              setSelectedKey={setSelectedKey}
                              getItemKey={getItemKey}
                              getAgendaNumber={getAgendaNumber}
                              change={change}
                              handleTitleKeyDown={handleTitleKeyDown}
                              subItemCount={getSubItemCount(item)}
                              documentCount={item.id ? (agendaDocuments[item.id]?.length ?? 0) : 0}
                              isMainItemCollapsed={isMainItemCollapsed}
                              setCollapsedMainItems={setCollapsedMainItems}
                              isHiddenByCollapsedParent={
                                isHiddenByCollapsedParent
                              }
                              profiles={profiles}
                              onToggleVisibility={onToggleVisibility}
                              setDirty={setDirty}
                              onAddSubItem={onAddSubItem}
                              onDeleteAgendaItem={onDeleteAgendaItem}
                              showTaskSelector={showTaskSelector}
                              onSetShowTaskSelector={onSetShowTaskSelector}
                              tasks={tasks}
                              onAddTaskToAgenda={onAddTaskToAgenda}
                            />
                          )}
                        </>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                  {dropPreview && !dropPreview.marker && (
                    <span aria-hidden="true" className="pointer-events-none block h-0 ring-1 ring-primary" />
                  )}
                </div>
              )}
            </Droppable>
          </DragDropContext>

          {agendaItems.length === 0 && (
            <Card>
              <CardContent className="p-8 text-center">
                <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium">Keine Agenda-Punkte</h3>
                <p className="text-muted-foreground mb-4">
                  Fügen Sie Punkte zur Agenda hinzu oder importieren Sie
                  Aufgaben
                </p>
                {hasEditPermission && (
                  <Button
                    onClick={() => {
                      setDirty(true);
                      onAddAgendaItem();
                    }}
                  >
                    <Plus className="h-4 w-4 mr-2" /> Ersten Punkt hinzufügen
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {hasEditPermission && (
            <div className="space-y-2 p-4">
              <Button
                variant="outline"
                className="w-full border-dashed bg-card py-5 shadow-none"
                onClick={() => {
                  setDirty(true);
                  onAddAgendaItem();
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                Neuer Punkt
              </Button>
              <p className="text-xs text-muted-foreground">
                Enter = neuer Punkt · Tab = Unterpunkt · Ziehen am Griff = sortieren
              </p>
            </div>
          )}
        </div>
        {selectedItem ? (
          <AgendaInspector
            startTime={timing.starts.get(
              selectedItem.parent_id || selectedItem.parentLocalKey
                ? agendaItems.find(
                    (parent) =>
                      parent.id ===
                        (selectedItem.parent_id ||
                          selectedItem.parentLocalKey) ||
                      parent.localKey ===
                        (selectedItem.parentLocalKey || selectedItem.parent_id),
                  )!
                : selectedItem,
            )}
            key={getItemKey(selectedItem, selectedIndex)}
            item={selectedItem}
            index={selectedIndex}
            profiles={profiles}
            hasEditPermission={hasEditPermission}
            agendaDocuments={agendaDocuments}
            taskDocuments={taskDocuments}
            onUpdateAgendaItem={change}
            onDeleteAgendaDocument={onDeleteAgendaDocument}
            handleAgendaDocumentUpload={handleAgendaDocumentUpload}
            showDocumentActionError={showDocumentActionError}
            onDeleteAgendaItem={(item, index) => {
              setDirty(true);
              onDeleteAgendaItem(item, index);
            }}
            onToggleVisibility={onToggleVisibility}
          />
        ) : null}
      </div>
      {/* Pending Jour Fixe Notes Preview */}
      <PendingJourFixeNotes className="mt-4" />
      <PendingJourFixeCaseItems className="mt-4" />
      {!agendaItems.some(
        (item) => item.system_type === "appointment_requests",
      ) && <JourFixeRequestsCard className="mt-4" />}

      {/* Upcoming Appointments Preview */}
      {!agendaItems.some(
        (item) => item.system_type === "upcoming_appointments",
      ) && (
        <Card className="mt-4">
          <CardContent className="p-4">
            <UpcomingAppointmentsSection
              meetingDate={selectedMeeting.meeting_date}
              meetingId={selectedMeeting.id}
              defaultCollapsed={false}
              allowStarring={true}
            />
          </CardContent>
        </Card>
      )}

      {/* Quick Notes Preview */}
      {!agendaItems.some((item) => item.system_type === "quick_notes") &&
        linkedQuickNotes.length > 0 && (
          <Card className="mt-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <PencilSparkles className="h-5 w-5 text-palette-amber" /> Quick
                Notes für dieses Meeting{" "}
                <Badge variant="secondary">{linkedQuickNotes.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {linkedQuickNotes.map((note) => (
                  <div key={note.id} className="p-3 bg-muted/50 rounded-md">
                    {note.title && (
                      <h4 className="font-semibold text-sm mb-1">
                        {note.title}
                      </h4>
                    )}
                    <RichTextDisplay
                      content={note.content}
                      className="text-sm"
                    />
                    {note.meeting_result && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Ergebnis: {note.meeting_result}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
    </>
  );
}
