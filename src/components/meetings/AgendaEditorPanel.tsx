import { NotesInspector } from "./agenda-editor/NotesInspector";
import { stripHtml } from "@/utils/textDiff";
import { AppointmentInspector } from "./agenda-editor/AppointmentInspector";
import type { GeneratedAgendaEntry } from "./agenda-editor/SystemSubpointScope";
import { AgendaDragHandle } from "./agenda-editor/AgendaDragHandle";
import { Textarea } from "@/components/ui/textarea";
import { LiveAgendaNavigation } from "./agenda-editor/LiveAgendaNavigation";
import { LiveAgendaResult } from "./agenda-editor/LiveAgendaResult";
import { flattenLiveAgenda, liveAgendaPosition } from "./agenda-editor/liveAgenda";
import { LiveAgendaSystemContent, liveAgendaSystemTypes, type LiveAgendaSystemData } from "./LiveAgendaSystemContent";
import type { AgendaResult } from "./AgendaResultEditor";
import { PencilSparkles } from "@/components/icons/PencilSparkles";
import { AgendaReadyBanner } from "./agenda-editor/AgendaReadyBanner";
import { AgendaCompletionCheckbox, AgendaRowDetails } from "./agenda-editor/AgendaRowDetails";
import { AgendaRow } from "./agenda-editor/AgendaRow";
import { AgendaInspector } from "./agenda-editor/AgendaInspector";
import { AgendaSummaryBar } from "./agenda-editor/AgendaSummaryBar";
import { ZombiePointsNotice } from "./agenda-editor/ZombiePointsNotice";
import type { DecisionLinkResult } from "@/features/meetings/components/MeetingDecisionDialog";
import { actualTotalMinutes } from "./agenda-editor/agendaElapsed";
import { useAgendaTimer } from "./hooks/useAgendaTimer";
import { AgendaSystemRow } from "./agenda-editor/AgendaSystemRow";
import { AddAgendaMenu } from "./agenda-editor/AddAgendaMenu";
import { agendaItemKey, resolveAgendaDrop } from "./agenda-editor/agendaDrop";
import { agendaTiming } from "./agenda-editor/agendaTiming";
import { buildSystemDescriptions, resolveAgendaDescription } from "./agenda-editor/agendaDescriptions";
import { createAgendaNumbering } from "./agenda-editor/agendaNumbering";
import { useAgendaDocuments } from "./agenda-editor/useAgendaDocuments";
import type { SystemAgendaType } from "@/components/meetings/types";
import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Clock } from "lucide-react";
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
  type DragUpdate,
} from "@hello-pangea/dnd";
import { SystemAgendaItem } from "@/components/meetings/SystemAgendaItem";
import { UpcomingAppointmentsSection } from "@/components/meetings/UpcomingAppointmentsSection";
import { openAppointmentRequestCreate } from "@/features/appointment-requests/events";
import { JourFixeRequestsCard } from "@/features/appointment-requests/JourFixeRequestsCard";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { cn } from "@/lib/utils";
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
  onUpdateSystemResult?: (id: string, field: "result_text", value: string) => void;
  live?: LiveAgendaSystemData & {
    currentKey: string | null;
    onPositionChange: (key: string) => void;
    onOpenFocus: () => void;
    onStop: () => void;
    onArchive: () => Promise<void>;
    onUpdateResult: (itemId: string, field: "result_text" | "agenda_result" | "carry_over_to_next", value: unknown) => void;
  };
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
  /** Nach dem Anlegen eines Beschlusses: Entscheidungsliste neu laden. */
  onDecisionSaved?: () => void;
  /** Nach dem Verknüpfen: Ergebnisblock der Agenda nachziehen. */
  onDecisionLinked?: (result: DecisionLinkResult) => void;
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
  onUpdateSystemResult,
  live,
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
  onDecisionSaved,
  onDecisionLinked,
}: AgendaEditorPanelProps) {
  const [detailContainer, setDetailContainer] = useState<HTMLDivElement | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [hideEmpty, setHideEmpty] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [archiving, setArchiving] = useState(false);
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
  const [remoteDescriptions, setRemoteDescriptions] = useState<Record<string, string>>({});
  const getItemKey = agendaItemKey;
  const [dragging, setDragging] = useState(false);
  const [dragUpdate, setDragUpdate] = useState<DragUpdate | null>(null);
  const selectedIndex = agendaItems.findIndex(
    (item, index) => getItemKey(item, index) === selectedKey,
  );
  const inspectorKey = live?.currentKey ?? selectedKey;
  const generatedParent = inspectorKey?.startsWith("system:") ? inspectorKey.split(":")[1] : undefined;
  const selectedItem = agendaItems[selectedIndex];
  const appointmentParent = agendaItems.find(item => item.system_type === "upcoming_appointments" &&
    ((item.localKey || item.id) === generatedParent || item === selectedItem));
  const notesParent = agendaItems.find(item => item.system_type === "quick_notes" &&
    ((item.localKey || item.id) === generatedParent || item === selectedItem));
  const systemInspectorItem = appointmentParent ?? notesParent ?? agendaItems.find(item =>
    generatedParent && (item.localKey || item.id) === generatedParent,
  );
  const inspectorItem = systemInspectorItem ?? selectedItem;
  const inspectorIndex = inspectorItem ? agendaItems.indexOf(inspectorItem) : -1;
  const meetingNotes = linkedQuickNotes.filter(note => note.meeting_id === selectedMeeting.id);
  const descriptions = buildSystemDescriptions({
    profiles,
    meetingNotes,
    meetingLinkedTasks,
    meetingLinkedCaseItems,
    meetingRelevantDecisions,
  });
  const descriptionFor = (item: AgendaItem, index: number) =>
    resolveAgendaDescription(item, index, {
      meetingId: selectedMeeting.id,
      getItemKey,
      systemCounts,
      remoteDescriptions,
      descriptions,
      upcomingAppointmentCount: live?.upcomingAppointments.length,
    });
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
  const agendaList = useRef<HTMLDivElement>(null);
  const [generatedEntries, setGeneratedEntries] = useState<Record<string, GeneratedAgendaEntry[]>>({});
  const onSystemEntries = useCallback((parentKey: string, entries: GeneratedAgendaEntry[]) => {
    setGeneratedEntries((current) => {
      const previous = current[parentKey] ?? [];
      if (previous.length === entries.length && previous.every((entry, index) =>
        entry.id === entries[index].id && entry.title === entries[index].title && entry.number === entries[index].number,
      )) return current;
      return { ...current, [parentKey]: entries };
    });
  }, []);
  const steps = flattenLiveAgenda(timing.main, agendaItems, generatedEntries);
  const initialMain = timing.main[liveAgendaPosition(timing.main)];
  const initialKey = initialMain?.localKey || initialMain?.id;
  const liveStep = live ? (steps.find((step) => step.key === live.currentKey) ??
    steps.find((step) => step.key === initialKey)) : undefined;
  const livePosition = liveStep ? steps.indexOf(liveStep) : -1;
  const currentLiveKey = liveStep?.key;
  const isLiveCurrent = (item: AgendaItem) => Boolean(currentLiveKey && (item.localKey || item.id) === currentLiveKey);
  const liveRoot = steps.find((step) => step.key === liveStep?.rootKey)?.item;
  const isLiveGroup = (item: AgendaItem) => {
    if (!liveStep) return false;
    const root = liveRoot;
    return (item.localKey || item.id) === liveStep.rootKey || Boolean(
      (root?.id && item.parent_id === root.id) ||
      (root?.localKey && item.parentLocalKey === root.localKey),
    );
  };
  const selectedStep = live ? liveStep : steps.find((step) => step.key === selectedKey);
  const hasSelectedChild = (item: AgendaItem) => {
    const key = item.localKey || item.id;
    return Boolean(key && selectedStep?.key !== key &&
      (selectedStep?.parentKey === key || selectedStep?.rootKey === key));
  };
  const selectStep = (key?: string) => {
    if (!key) return;
    live?.onPositionChange(key);
    setSelectedKey(key);
  };
  const setLivePositionKey = live?.onPositionChange;
  const storedLiveKey = live?.currentKey;
  useEffect(() => {
    if (!currentLiveKey) return;
    if (!storedLiveKey) setLivePositionKey?.(currentLiveKey);
    setSelectedKey(currentLiveKey);
    const frame = requestAnimationFrame(() => {
      agendaList.current?.querySelector("[data-live-agenda-current]")?.scrollIntoView({ block: "nearest" });
    });
    return () => cancelAnimationFrame(frame);
  }, [currentLiveKey, storedLiveKey, setLivePositionKey]);

  const saveLiveResult = (item: AgendaItem, index: number, result: AgendaResult) => {
    setDirty(true);
    if (item.id && live) live.onUpdateResult(item.id, "agenda_result", result);
    else onSetAgendaItems((items) => items.map((entry, itemIndex) => itemIndex === index ? { ...entry, ...result } : entry));
  };

  const [collapsedMainItems, setCollapsedMainItems] = useState<
    Record<string, boolean>
  >({});

  const [systemExpanded, setSystemExpanded] = useState<Record<string, boolean>>(
    {},
  );
  const expandableMain = agendaItems.filter(
    (item) =>
      !item.system_type &&
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
    if (live) return !isLiveGroup(item);
    const parent = agendaItems.find(
      (candidate) =>
        candidate.id === parentKey || candidate.localKey === parentKey,
    );
    const key = parent?.localKey || parent?.id || parentKey;
    return parent?.system_type ? systemExpanded[key] === false : !!collapsedMainItems[key];
  };

  const getSubItemCount = (item: AgendaItem) => {
    const key = item.localKey || item.id;
    if (!key || item.parent_id || item.parentLocalKey) return 0;
    return agendaItems.filter(
      (candidate) =>
        (item.id && candidate.parent_id === item.id) ||
        (item.localKey && candidate.parentLocalKey === item.localKey),
    ).length;
  };

  const itemIsHidden = (item: AgendaItem, index: number) => {
    if (isHiddenByCollapsedParent(item)) return true;
    if (live || !hideEmpty || item.parent_id || item.parentLocalKey) return false;
    if (getSubItemCount(item) > 0) return false;
    if (item.system_type) return systemCounts[getItemKey(item, index)] === 0;

    const hasText = [item.description, item.notes, item.result_text, item.result_html]
      .some((value) => value && stripHtml(value).replace(/&nbsp;/gi, " ").trim());
    const hasAttachment = item.file_path || (item.id && agendaDocuments[item.id]?.length);
    return !hasText && !hasAttachment && !item.task_id;
  };
  const hiddenItems = new Set(agendaItems.filter(itemIsHidden));
  const dropPreview = dragUpdate && resolveAgendaDrop(agendaItems, dragUpdate, hiddenItems);

  const { handleAgendaDocumentUpload, showDocumentActionError } = useAgendaDocuments({
    meetingId: selectedMeeting.id,
    onSetAgendaItems,
    onUploadAgendaDocument,
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

  const agendaTimer = useAgendaTimer({
    meetingId: selectedMeeting.id,
    items: agendaItems,
    currentKey: live ? currentLiveKey ?? null : null,
    active: Boolean(live),
  });
  const actualMinutes = actualTotalMinutes(agendaItems);

  const getAgendaNumber = createAgendaNumbering({
    agendaItems,
    getItemKey,
    generatedEntries,
    systemCounts,
    generatedEntryCounts: {
      upcoming_appointments: live?.upcomingAppointments.length ?? 0,
      quick_notes: linkedQuickNotes.length,
      tasks: meetingLinkedTasks.length,
      case_items: meetingLinkedCaseItems.length,
    },
  });

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
        live={Boolean(live)}
        timerLabel={live ? agendaTimer.elapsedLabel : null}
        timerCaption={live ? "Dieser Punkt" : undefined}
        onStart={onStartMeeting && (async () => {
          if (!dirty || await saveAgenda()) onStartMeeting();
        })}
      />

      <ZombiePointsNotice items={agendaItems} />

      <div className={cn("grid items-start gap-4", (selectedItem || appointmentParent || notesParent) && "2xl:grid-cols-[minmax(0,1fr)_19rem]")}>
        <div ref={agendaList} className="min-w-0 rounded-2xl border bg-card shadow-sm [--agenda-subpoint-bg:color(srgb_0.956863_0.964706_0.952941_/_0.7)] [--agenda-row-divider:rgb(227,232,223)]">
          {live ? (
            <LiveAgendaNavigation
              position={livePosition}
              count={steps.length}
              title={liveStep?.title}
              agendaNumber={liveStep?.number ?? (liveStep?.item ? getAgendaNumber(liveStep.item) : undefined)}
              onMove={(offset) => selectStep(steps[livePosition + offset]?.key)}
              onOpenFocus={async () => {
                if (!dirty || await saveAgenda()) live.onOpenFocus();
              }}
              onStop={live.onStop}
              onArchive={async () => {
                setArchiving(true);
                try {
                  if (!dirty || await saveAgenda()) await live.onArchive();
                } finally {
                  setArchiving(false);
                }
              }}
              busy={saving || archiving}
            />
          ) : (
            <AgendaSummaryBar
              allCollapsed={allCollapsed}
              onToggleAll={toggleAll}
              timing={timing}
              actualTotal={actualMinutes}
              hideEmpty={hideEmpty}
              onHideEmptyChange={setHideEmpty}
              onOpenCarryover={onOpenCarryover}
            />
          )}

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
                              onFocus={(event) => {
                                if (!live && !(event.target instanceof Element && event.target.closest("[data-system-subpoint]"))) {
                                  setSelectedKey(getItemKey(item, index));
                                }
                              }}
                              aria-current={isLiveCurrent(item) ? "step" : undefined}
                              tabIndex={live ? 0 : undefined}
                              onKeyDown={(event) => {
                                if (live && event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
                                  event.preventDefault();
                                  selectStep(getItemKey(item, index));
                                }
                              }}
                              onClick={(event) => {
                                if (event.target instanceof Element && event.target.closest("[data-system-subpoint]")) return;
                                if (!live || !(event.target instanceof Element && event.target.closest("button, a"))) selectStep(getItemKey(item, index));
                              }}
                              className={cn(
                                "scroll-mt-24 transition-shadow",
                                snapshot.isDragging && "shadow-lg",
                                dropPreview?.marker === item &&
                                  (dragUpdate?.combine ? "ring-2 ring-inset ring-primary" : "shadow-[inset_0_2px_0] shadow-primary"),
                                hiddenItems.has(item) && "hidden",
                              )}
                            >
                              <AgendaSystemRow
                                scope={{
                                  parentKey: getItemKey(item, index),
                                  meetingId: selectedMeeting.id,
                                  selectedKey: live ? currentLiveKey ?? null : selectedKey,
                                  liveKey: currentLiveKey,
                                  detailContainer,
                                  onSelect: selectStep,
                                  onEntries: onSystemEntries,
                                }}
                              >
                                <SystemAgendaItem
                                  expandedOverride={
                                    live ? isLiveGroup(item) : (systemExpanded[getItemKey(item, index)] ?? true)
                                  }
                                  onExpandedChange={(expanded) =>
                                    setSystemExpanded((prev) => ({
                                      ...prev,
                                      [getItemKey(item, index)]: expanded,
                                    }))
                                  }
                                  editorRow
                                  manualSubpointCount={getSubItemCount(item)}
                                  editorSelected={getItemKey(item, index) === (live ? currentLiveKey : selectedKey)}
                                  editorHasSelectedChild={hasSelectedChild(item)}
                                  editorLiveCurrent={isLiveCurrent(item)}
                                  editorDragHandle={hasEditPermission && provided.dragHandleProps ? (
                                    <AgendaDragHandle dragHandleProps={provided.dragHandleProps} dragging={snapshot.isDragging} className="h-5" />
                                  ) : undefined}
                                  editorLive={Boolean(live)}
                                  editorLiveContent={
                                    live && hasEditPermission && item.id &&
                                    liveAgendaSystemTypes.includes(item.system_type) ? (
                                      <LiveAgendaSystemContent
                                        key={getItemKey(item, index)}
                                        {...live}
                                        item={item}
                                        agendaNumber={getAgendaNumber(item)}
                                        profiles={profiles}
                                        linkedQuickNotes={linkedQuickNotes}
                                        linkedTasks={meetingLinkedTasks}
                                        linkedCaseItems={meetingLinkedCaseItems}
                                        relevantDecisions={meetingRelevantDecisions}
                                        onUpdateResult={live.onUpdateResult}
                                      />
                                    ) : undefined
                                  }
                                  editorCompleted={item.is_completed}
                                  editorDescription={descriptionFor(item, index)}
                                  editorLeading={
                                    (item.parent_id || item.parentLocalKey) && (
                                      <AgendaCompletionCheckbox
                                        item={item}
                                        onComplete={hasEditPermission ? (completed) => change(index, "is_completed", completed) : undefined}
                                      />
                                    )
                                  }
                                  editorDetails={
                                    <AgendaRowDetails
                                      item={item}
                                      profiles={profiles}
                                      onComplete={hasEditPermission ? (completed) => change(index, "is_completed", completed) : undefined}
                                    />
                                  }
                                  onDescriptionChange={(description) => {
                                    const key = `${selectedMeeting.id}:${getItemKey(item, index)}`;
                                    setRemoteDescriptions(prev => prev[key] === description ? prev : { ...prev, [key]: description });
                                  }}
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
                                      ? (value) => {
                                          if (item.id && onUpdateSystemResult) onUpdateSystemResult(item.id, "result_text", value);
                                          else change(index, "result_text", value);
                                        }
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
                              liveCurrent={isLiveCurrent(item)}
                              onLiveSelect={live ? () => selectStep(getItemKey(item, index)) : undefined}
                              liveContent={live && isLiveCurrent(item) && hasEditPermission && !item.parent_id && !item.parentLocalKey ? (
                                <LiveAgendaResult
                                  meeting={selectedMeeting}
                                  item={item}
                                  onChange={(result) => saveLiveResult(item, index, result)}
                                  onTransfer={(value) => item.id && live.onUpdateResult(item.id, "carry_over_to_next", value)}
                                  onDecisionSaved={onDecisionSaved}
                                  onDecisionLinked={onDecisionLinked}
                                />
                              ) : undefined}
                              dropTarget={dropPreview?.marker === item ? (dragUpdate?.combine ? "inside" : "before") : undefined}
                              index={index}
                              provided={provided}
                              snapshot={snapshot}
                              hasEditPermission={hasEditPermission}
                              selectedKey={live ? currentLiveKey ?? null : selectedKey}
                              setSelectedKey={setSelectedKey}
                              getItemKey={getItemKey}
                              getAgendaNumber={getAgendaNumber}
                              change={change}
                              handleTitleKeyDown={handleTitleKeyDown}
                              subItemCount={live ? 0 : getSubItemCount(item)}
                              documentCount={item.id ? (agendaDocuments[item.id]?.length ?? 0) : 0}
                              isMainItemCollapsed={isMainItemCollapsed}
                              setCollapsedMainItems={setCollapsedMainItems}
                              isHiddenByCollapsedParent={(row) => hiddenItems.has(row)}
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
        {inspectorItem && (
          <div className="min-w-0 space-y-4">
        <div ref={setDetailContainer} className="empty:hidden" />
        {inspectorItem.system_type === "appointment_requests" && !generatedParent && hasEditPermission && (
          <Button variant="outline" size="sm" onClick={() => openAppointmentRequestCreate()}>
            <Plus className="mr-1 size-4" /> Terminanfrage vormerken
          </Button>
        )}
        {live && hasEditPermission && selectedItem && !selectedItem.system_type &&
          (selectedItem.parent_id || selectedItem.parentLocalKey) && (
            <LiveAgendaResult
              meeting={selectedMeeting}
              item={selectedItem}
              onChange={(result) => saveLiveResult(selectedItem, selectedIndex, result)}
              onTransfer={(value) => selectedItem.id && live.onUpdateResult(selectedItem.id, "carry_over_to_next", value)}
              onDecisionSaved={onDecisionSaved}
              onDecisionLinked={onDecisionLinked}
            />
          )}
        {appointmentParent ? (
          <AppointmentInspector meeting={selectedMeeting} parent={appointmentParent}
            number={getAgendaNumber(appointmentParent)} selectedKey={inspectorKey} onSelect={selectStep}
            onChange={hasEditPermission ? (value) => {
              if (appointmentParent.id && onUpdateSystemResult) onUpdateSystemResult(appointmentParent.id, "result_text", value);
              else change(agendaItems.indexOf(appointmentParent), "result_text", value);
            } : undefined} />
        ) : notesParent ? (
          <NotesInspector parent={notesParent} notes={linkedQuickNotes} number={getAgendaNumber(notesParent)}
            selectedKey={inspectorKey} onSelect={selectStep}
            onChange={hasEditPermission ? (value) => {
              if (notesParent.id && onUpdateSystemResult) onUpdateSystemResult(notesParent.id, "result_text", value);
              else change(agendaItems.indexOf(notesParent), "result_text", value);
            } : undefined} />
        ) : null}
        {inspectorItem && (
          <AgendaInspector
            startTime={timing.starts.get(
              inspectorItem.parent_id || inspectorItem.parentLocalKey
                ? agendaItems.find(
                    (parent) =>
                      parent.id ===
                        (inspectorItem.parent_id ||
                          inspectorItem.parentLocalKey) ||
                      parent.localKey ===
                        (inspectorItem.parentLocalKey || inspectorItem.parent_id),
                  )!
                : inspectorItem,
            )}
            key={getItemKey(inspectorItem, inspectorIndex)}
            item={{ ...inspectorItem, description: descriptionFor(inspectorItem, inspectorIndex) }}
            index={inspectorIndex}
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
        )}
          </div>
        )}
      </div>
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
                    <p className="whitespace-pre-wrap break-words text-sm">{stripHtml(note.content)}</p>
                    {live && hasEditPermission ? (
                      <label className="block space-y-1 text-xs">
                        <span>Ergebnis</span>
                        <Textarea value={note.meeting_result || ""} onChange={(event) => live.onUpdateNoteResult(note.id, event.target.value)} />
                      </label>
                    ) : note.meeting_result && (
                      <p className="mt-1 text-xs text-muted-foreground">Ergebnis: {note.meeting_result}</p>
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
