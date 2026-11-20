import { useEffect, useRef, useState } from "react";
import type { ImperativePanelHandle } from "react-resizable-panels";
import { Card, CardContent } from "@/components/ui/card";
import { Users } from "lucide-react";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { MeetingArchiveView } from "@/features/meetings/components/MeetingArchiveView";
import { PreviousMeetingReview } from "./PreviousMeetingReview";
import { MeetingProtocolView } from "@/features/meetings/components/MeetingProtocolView";
import { MeetingSidebar } from "@/components/meetings/MeetingSidebar";
import { AgendaEditorPanel } from "@/components/meetings/AgendaEditorPanel";
import { useMeetingsData } from "@/components/meetings/hooks/useMeetingsData";
import { useMeetingArchive } from "@/components/meetings/hooks/useMeetingArchive";
import { useAgendaOperations } from "@/components/meetings/hooks/useAgendaOperations";
import { useMeetingCreate } from "@/components/meetings/hooks/useMeetingCreate";
import { toast } from "@/hooks/use-toast";

export function MeetingsView() {
  const data = useMeetingsData();
  const sidebarPanel = useRef<ImperativePanelHandle>(null);
  const expandedSidebarSize = useRef(28);
  const hasSelectedMeeting = !!data.selectedMeeting;
  const [reviewMeetingId, setReviewMeetingId] = useState<string | null>(null);
  const [liveAgendaKey, setLiveAgendaKey] = useState<string | null>(null);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const compactSidebar = hasSelectedMeeting && !sidebarExpanded;
  useEffect(() => {
    const panel = sidebarPanel.current;
    if (!panel) return;
    const from = panel.getSize();
    if (compactSidebar)
      expandedSidebarSize.current = Math.max(from, expandedSidebarSize.current);
    const to = compactSidebar
      ? Math.max(12, expandedSidebarSize.current / 2)
      : expandedSidebarSize.current;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      panel.resize(to);
      return;
    }
    const start = performance.now();
    let frame = 0;
    const animate = (now: number) => {
      const progress = Math.min(1, (now - start) / 320);
      panel.resize(from + (to - from) * (1 - Math.pow(1 - progress, 3)));
      if (progress < 1) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [compactSidebar]);
  const { archiveMeeting, loadAndApplyCarryoverItems } = useMeetingArchive({
    user: data.user,
    currentTenant: data.currentTenant,
    toast: data.toast,
    profiles: data.profiles,
    linkedQuickNotes: data.linkedQuickNotes,
    meetingLinkedCaseItems: data.meetingLinkedCaseItems,
    loadMeetings: data.loadMeetings,
    loadCarryoverBufferItems: data.loadCarryoverBufferItems,
    loadAgendaItems: data.loadAgendaItems,
    setActiveMeeting: data.setActiveMeeting,
    setActiveMeetingId: data.setActiveMeetingId,
    setAgendaItems: data.setAgendaItems,
    setLinkedQuickNotes: data.setLinkedQuickNotes,
    setSelectedMeeting: data.setSelectedMeeting,
    setArchivedMeetingId: data.setArchivedMeetingId,
    agendaItems: data.agendaItems,
    updateTimeouts: data.updateTimeouts,
  });
  const agendaOps = useAgendaOperations({
    selectedMeeting: data.selectedMeeting,
    activeMeeting: data.activeMeeting,
    agendaItems: data.agendaItems,
    setAgendaItems: data.setAgendaItems,
    setActiveMeeting: data.setActiveMeeting,
    user: data.user,
    toast: data.toast,
    taskDocuments: data.taskDocuments,
    agendaDocuments: data.agendaDocuments,
    setAgendaDocuments: data.setAgendaDocuments,
    profiles: data.profiles,
    loadAgendaItems: data.loadAgendaItems,
    updateTimeouts: data.updateTimeouts,
    uploadAgendaDocument: data.uploadAgendaDocument,
  });
  const { createMeeting } = useMeetingCreate({
    user: data.user,
    currentTenant: data.currentTenant,
    toast: data.toast,
    newMeeting: data.newMeeting,
    newMeetingTime: data.newMeetingTime,
    newMeetingParticipants: data.newMeetingParticipants,
    newMeetingRecurrence: data.newMeetingRecurrence,
    meetingTemplates: data.meetingTemplates,
    meetings: data.meetings,
    profiles: data.profiles,
    setMeetings: data.setMeetings,
    setSelectedMeeting: data.setSelectedMeeting,
    setAgendaItems: data.setAgendaItems,
    setIsNewMeetingOpen: data.setIsNewMeetingOpen,
    setNewMeeting: data.setNewMeeting,
    setNewMeetingParticipants: data.setNewMeetingParticipants,
    setNewMeetingRecurrence: data.setNewMeetingRecurrence,
    loadAgendaItems: data.loadAgendaItems,
    loadAndApplyCarryoverItems,
  });

  // Show archive view
  if (data.showArchive) {
    return <MeetingArchiveView onBack={() => data.setShowArchive(false)} />;
  }

  if (reviewMeetingId) {
    return <MeetingProtocolView meetingId={reviewMeetingId} onBack={() => setReviewMeetingId(null)} returnLabel="Zurück zur Tagesordnung" />;
  }

  // Show protocol after archiving
  if (data.archivedMeetingId) {
    return (
      <div className="min-h-screen bg-gradient-subtle p-4">
        <MeetingProtocolView
          meetingId={data.archivedMeetingId}
          onBack={() => data.setArchivedMeetingId(null)}
          isPostArchive
        />
      </div>
    );
  }

  const agendaMeeting = data.selectedMeeting;
  const selectedMeetingIsLive = Boolean(agendaMeeting?.id && agendaMeeting.id === data.activeMeetingId);
  const agendaTenant = agendaMeeting?.tenant_id ?? data.currentTenant?.id;

  return (
    <div className="min-h-screen bg-gradient-subtle p-4">
      <ResizablePanelGroup
        direction="horizontal"
        className="min-h-[calc(100vh-2rem)] rounded-lg"
        autoSaveId="meetings-panels"
      >
        <ResizablePanel
          ref={sidebarPanel}
          defaultSize={28}
          minSize={12}
          maxSize={38}
        >
          <MeetingSidebar
            compact={compactSidebar}
            onToggleCompact={() => setSidebarExpanded((value) => !value)}
            meetings={data.meetings}
            upcomingMeetings={data.upcomingMeetings}
            selectedMeeting={data.selectedMeeting}
            activeMeetingId={data.activeMeetingId}
            editingMeeting={data.editingMeeting}
            isNewMeetingOpen={data.isNewMeetingOpen}
            newMeeting={data.newMeeting}
            newMeetingTime={data.newMeetingTime}
            newMeetingParticipants={data.newMeetingParticipants}
            newMeetingRecurrence={data.newMeetingRecurrence}
            meetingTemplates={data.meetingTemplates}
            showCarryoverBuffer={data.showCarryoverBuffer}
            carryoverBufferItems={data.carryoverBufferItems}
            isHighlighted={data.isHighlighted}
            highlightRef={data.highlightRef}
            onSelectMeeting={(meeting) => {
              data.setSelectedMeeting(meeting);
              data.setAgendaItems([]);
            }}
            onSetEditingMeeting={data.setEditingMeeting}
            onSetIsNewMeetingOpen={data.setIsNewMeetingOpen}
            onSetNewMeeting={data.setNewMeeting}
            onSetNewMeetingTime={data.setNewMeetingTime}
            onSetNewMeetingParticipants={data.setNewMeetingParticipants}
            onSetNewMeetingRecurrence={data.setNewMeetingRecurrence}
            onSetShowCarryoverBuffer={data.setShowCarryoverBuffer}
            onCreateMeeting={createMeeting}
            onUpdateMeeting={data.updateMeeting}
            onDeleteMeeting={data.deleteMeeting}
            onStopMeeting={data.stopMeeting}
            onShowArchive={() => data.setShowArchive(true)}
            onLoadCarryoverBufferItems={data.loadCarryoverBufferItems}
            loadAgendaItems={data.loadAgendaItems}
          />
        </ResizablePanel>

        <ResizableHandle withHandle />

        <ResizablePanel defaultSize={72}>
          <div className="pl-4">
            {agendaMeeting?.id && agendaTenant && (
              <PreviousMeetingReview meeting={agendaMeeting} tenantId={agendaTenant} onOpen={setReviewMeetingId} />
            )}
            <div className="space-y-4">
              {agendaMeeting ? (
                <AgendaEditorPanel
                  key={agendaMeeting.id}
                  selectedMeeting={agendaMeeting}
                  onStartMeeting={!data.activeMeetingId ? () => {
                    setLiveAgendaKey(null);
                    data.startMeeting(agendaMeeting);
                  } : undefined}
                  live={selectedMeetingIsLive ? {
                    currentKey: liveAgendaKey,
                    onPositionChange: setLiveAgendaKey,
                    onStop: data.stopMeeting,
                    onArchive: () => archiveMeeting(agendaMeeting),
                    onUpdateResult: agendaOps.updateAgendaItemResult,
                    onUpdateNoteResult: data.updateQuickNoteResult,
                    upcomingAppointments: data.meetingUpcomingAppointments,
                    starredAppointmentIds: data.starredAppointmentIds,
                    onToggleStar: data.toggleStarAppointment,
                    isLoading: data.isMeetingLinkedDataLoading,
                  } : undefined}
                  onOpenCarryover={async () => {
                    await data.loadCarryoverBufferItems();
                    data.setShowCarryoverBuffer(true);
                  }}
                  agendaItems={data.agendaItems}
                  profiles={data.profiles}
                  tasks={data.tasks}
                  taskDocuments={data.taskDocuments}
                  agendaDocuments={data.agendaDocuments}
                  linkedQuickNotes={data.linkedQuickNotes}
                  hasEditPermission={data.hasEditPermission}
                  showTaskSelector={data.showTaskSelector}
                  onSetShowTaskSelector={data.setShowTaskSelector}
                  onAddAgendaItem={agendaOps.addAgendaItem}
                  onAddSystemAgendaItem={agendaOps.addSystemAgendaItem}
                  onUpdateAgendaItem={agendaOps.updateAgendaItem}
                  onSaveAgendaItems={agendaOps.saveAgendaItems}
                  onAddTaskToAgenda={agendaOps.addTaskToAgenda}
                  onAddSubItem={agendaOps.addSubItem}
                  onDeleteAgendaItem={agendaOps.deleteAgendaItem}
                  onToggleVisibility={agendaOps.toggleOptionalItemVisibility}
                  onDragEnd={agendaOps.onDragEnd}
                  onUploadAgendaDocument={data.uploadAgendaDocument}
                  onDeleteAgendaDocument={data.deleteAgendaDocument}
                  onSetAgendaItems={data.setAgendaItems}
                  meetingLinkedTasks={data.meetingLinkedTasks}
                  meetingLinkedCaseItems={data.meetingLinkedCaseItems}
                  meetingRelevantDecisions={data.meetingRelevantDecisions}
                />
              ) : (
                <Card>
                  <CardContent className="p-8 text-center">
                    <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium">
                      Kein Meeting ausgewählt
                    </h3>
                    <p className="text-muted-foreground">
                      Wählen Sie ein Meeting aus der Liste links aus, um die
                      Agenda zu bearbeiten
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
