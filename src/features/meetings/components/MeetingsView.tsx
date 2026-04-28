import { Card, CardContent } from "@/components/ui/card";
import { Users } from "lucide-react";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { MeetingArchiveView } from "./MeetingArchiveView";
import { MeetingProtocolView } from "./MeetingProtocolView";
import { FocusModeView } from "@/components/meetings/FocusModeView";
import { ActiveMeetingPanel } from "@/components/meetings/ActiveMeetingPanel";
import { MeetingSidebar } from "@/components/meetings/MeetingSidebar";
import { AgendaEditorPanel } from "@/components/meetings/AgendaEditorPanel";
import { useMeetingsData } from "@/components/meetings/hooks/useMeetingsData";
import { useMeetingArchive } from "@/components/meetings/hooks/useMeetingArchive";
import { useAgendaOperations } from "@/components/meetings/hooks/useAgendaOperations";
import { useMeetingCreate } from "@/components/meetings/hooks/useMeetingCreate";

export function MeetingsView() {
  const data = useMeetingsData();
  const { archiveMeeting, loadAndApplyCarryoverItems } = useMeetingArchive({
    user: data.user, currentTenant: data.currentTenant, toast: data.toast,
    profiles: data.profiles, linkedQuickNotes: data.linkedQuickNotes,
    meetingLinkedCaseItems: data.meetingLinkedCaseItems,
    loadMeetings: data.loadMeetings, loadCarryoverBufferItems: data.loadCarryoverBufferItems,
    loadAgendaItems: data.loadAgendaItems,
    setActiveMeeting: data.setActiveMeeting, setActiveMeetingId: data.setActiveMeetingId,
    setAgendaItems: data.setAgendaItems, setLinkedQuickNotes: data.setLinkedQuickNotes,
    setSelectedMeeting: data.setSelectedMeeting, setIsFocusMode: data.setIsFocusMode,
    setArchivedMeetingId: data.setArchivedMeetingId,
  });
  const agendaOps = useAgendaOperations({
    selectedMeeting: data.selectedMeeting, activeMeeting: data.activeMeeting,
    agendaItems: data.agendaItems, setAgendaItems: data.setAgendaItems,
    setActiveMeeting: data.setActiveMeeting,
    user: data.user, toast: data.toast,
    taskDocuments: data.taskDocuments, agendaDocuments: data.agendaDocuments,
    setAgendaDocuments: data.setAgendaDocuments,
    profiles: data.profiles, loadAgendaItems: data.loadAgendaItems,
    updateTimeouts: data.updateTimeouts, uploadAgendaDocument: data.uploadAgendaDocument,
  });
  const { createMeeting } = useMeetingCreate({
    user: data.user, currentTenant: data.currentTenant, toast: data.toast,
    newMeeting: data.newMeeting, newMeetingTime: data.newMeetingTime,
    newMeetingParticipants: data.newMeetingParticipants,
    newMeetingRecurrence: data.newMeetingRecurrence,
    meetingTemplates: data.meetingTemplates,
    meetings: data.meetings, profiles: data.profiles,
    setMeetings: data.setMeetings, setSelectedMeeting: data.setSelectedMeeting,
    setAgendaItems: data.setAgendaItems, setIsNewMeetingOpen: data.setIsNewMeetingOpen,
    setNewMeeting: data.setNewMeeting, setNewMeetingParticipants: data.setNewMeetingParticipants,
    setNewMeetingRecurrence: data.setNewMeetingRecurrence,
    loadAgendaItems: data.loadAgendaItems,
    loadAndApplyCarryoverItems,
  });

  // Show archive view
  if (data.showArchive) {
    return <MeetingArchiveView onBack={() => data.setShowArchive(false)} />;
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

  // Show focus mode
  if (data.isFocusMode && data.activeMeeting) {
    return (
      <FocusModeView
        meeting={data.activeMeeting}
        agendaItems={data.agendaItems}
        profiles={data.profiles}
        linkedQuickNotes={data.linkedQuickNotes}
        linkedTasks={data.meetingLinkedTasks}
        linkedCaseItems={data.meetingLinkedCaseItems}
        upcomingAppointments={data.meetingUpcomingAppointments}
        starredAppointmentIds={data.starredAppointmentIds}
        onToggleStar={data.toggleStarAppointment}
        onClose={() => data.setIsFocusMode(false)}
        onUpdateItem={agendaOps.updateAgendaItem}
        onUpdateResult={agendaOps.updateAgendaItemResult}
        onUpdateNoteResult={data.updateQuickNoteResult}
        onArchive={() => archiveMeeting(data.activeMeeting!)}
        relevantDecisions={data.meetingRelevantDecisions}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle p-4">
      <ResizablePanelGroup direction="horizontal" className="min-h-[calc(100vh-2rem)] rounded-lg" autoSaveId="meetings-panels">
        <ResizablePanel defaultSize={28} minSize={22} maxSize={38}>
          <MeetingSidebar
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
            onSelectMeeting={(meeting) => { data.setSelectedMeeting(meeting); data.setAgendaItems([]); }}
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
            onStartMeeting={data.startMeeting}
            onStopMeeting={data.stopMeeting}
            onShowArchive={() => data.setShowArchive(true)}
            onLoadCarryoverBufferItems={data.loadCarryoverBufferItems}
            loadAgendaItems={data.loadAgendaItems}
          />
        </ResizablePanel>

        <ResizableHandle withHandle />

        <ResizablePanel defaultSize={72}>
          <div className="pl-4">
            {/* Active Meeting View */}
            {data.activeMeeting && (
              <ActiveMeetingPanel
                meeting={data.activeMeeting}
                meetingItems={data.activeMeetingItems}
                allAgendaItems={data.agendaItems}
                profiles={data.profiles}
                linkedQuickNotes={data.linkedQuickNotes}
                linkedTasks={data.meetingLinkedTasks}
                linkedCaseItems={data.meetingLinkedCaseItems}
                relevantDecisions={data.meetingRelevantDecisions}
                upcomingAppointments={data.meetingUpcomingAppointments}
                starredAppointmentIds={data.starredAppointmentIds}
                expandedApptNotes={data.expandedApptNotes}
                onExpandApptNote={(id) => data.setExpandedApptNotes(prev => new Set(prev).add(id))}
                onSetFocusMode={() => data.setIsFocusMode(true)}
                onStopMeeting={data.stopMeeting}
                onArchiveMeeting={() => archiveMeeting(data.activeMeeting!)}
                onUpdateAgendaItem={agendaOps.updateAgendaItem}
                onUpdateResult={agendaOps.updateAgendaItemResult}
                onUpdateNoteResult={data.updateQuickNoteResult}
                onToggleStar={data.toggleStarAppointment}
                onToggleVisibility={agendaOps.toggleOptionalItemVisibility}
                isLoading={data.isMeetingLinkedDataLoading}
              />
            )}

            {/* Agenda Editor */}
            <div className="space-y-4">
              {data.selectedMeeting && !data.activeMeeting ? (
                <AgendaEditorPanel
                  selectedMeeting={data.selectedMeeting}
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
              ) : !data.activeMeeting ? (
                <Card>
                  <CardContent className="p-8 text-center">
                    <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium">Kein Meeting ausgewählt</h3>
                    <p className="text-muted-foreground">Wählen Sie ein Meeting aus der Liste links aus, um die Agenda zu bearbeiten</p>
                  </CardContent>
                </Card>
              ) : null}
            </div>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
