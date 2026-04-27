import { useState, useEffect } from "react";
import { trackPageVisit } from "@/hooks/useRecentlyVisited";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useCaseFileDetails } from "@/features/cases/files/hooks";
import { useCaseFiles } from "@/features/cases/files/hooks";
import { useCaseFileTopics } from "@/hooks/useTopics";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, MessageSquare, FileText, Phone, Mail, Users, Vote } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CaseFileEditDialog } from "./CaseFileEditDialog";
import { CaseFileDetailHeader } from "./CaseFileDetailHeader";
import { CaseFileLeftSidebar } from "./CaseFileLeftSidebar";
import { CaseFileRightSidebar } from "./CaseFileRightSidebar";
import { CaseFileUnifiedTimeline } from "./CaseFileUnifiedTimeline";

// Tab dialogs — still needed for Add actions
import { CaseFileContactsTab } from "./tabs/CaseFileContactsTab";
import { CaseFileDocumentsTab } from "./tabs/CaseFileDocumentsTab";
import { CaseFileTasksTab } from "./tabs/CaseFileTasksTab";
import { CaseFileAppointmentsTab } from "./tabs/CaseFileAppointmentsTab";
import { CaseFileLettersTab } from "./tabs/CaseFileLettersTab";
import { CaseFileNotesTab } from "./tabs/CaseFileNotesTab";
import { CaseFileTimelineTab } from "./tabs/CaseFileTimelineTab";
import { StandaloneDecisionCreator } from "@/components/task-decisions/StandaloneDecisionCreator";

interface CaseFileDetailProps {
  caseFileId: string;
  onBack: () => void;
}

export function CaseFileDetail({ caseFileId, onBack }: CaseFileDetailProps) {
  const details = useCaseFileDetails(caseFileId);
  const { deleteCaseFile } = useCaseFiles();
  const { assignedTopics, setTopics: setAssignedTopics } = useCaseFileTopics(caseFileId);

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Dialog states for quick-add actions
  const [showAddContact, setShowAddContact] = useState(false);
  const [showAddDocument, setShowAddDocument] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const [showAddAppointment, setShowAddAppointment] = useState(false);
  const [showAddLetter, setShowAddLetter] = useState(false);
  const [showAddNote, setShowAddNote] = useState(false);
  const [showAddTimeline, setShowAddTimeline] = useState(false);
  const [showAddDecision, setShowAddDecision] = useState(false);

  const {
    caseFile,
    contacts,
    documents,
    tasks,
    appointments,
    letters,
    notes,
    timeline,
    interactions,
    loading,
  } = details;

  useEffect(() => {
    if (caseFile?.title) {
      trackPageVisit(`casefile-${caseFileId}`, caseFile.title, 'Briefcase', `/cases?tab=files&id=${caseFileId}`);
    }
  }, [caseFileId, caseFile?.title]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-48" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!caseFile) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Zurück
        </Button>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Fallakte nicht gefunden</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleArchive = async () => {
    const nextStatus = caseFile.status === "archived" ? "active" : "archived";
    const { error } = await supabase.from("case_files").update({ status: nextStatus }).eq("id", caseFile.id);
    if (error) {
      toast.error("Fallakte konnte nicht archiviert werden.");
      return;
    }
    toast.success(nextStatus === "archived" ? "Fallakte archiviert." : "Fallakte wiederhergestellt.");
    await details.refresh();
    if (nextStatus === "archived") onBack();
  };

  const handleDelete = async () => {
    const success = await deleteCaseFile(caseFile.id);
    if (success) onBack();
    setDeleteDialogOpen(false);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <CaseFileDetailHeader
        caseFile={caseFile}
        onBack={onBack}
        onDelete={() => setDeleteDialogOpen(true)}
        onArchive={handleArchive}
        onEdit={() => setEditDialogOpen(true)}
      />

      {/* Three-Column Layout */}
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Left Sidebar */}
        <div className="w-full lg:w-[280px] lg:shrink-0">
          <CaseFileLeftSidebar
            caseFile={caseFile}
            contacts={contacts}
            documents={documents}
            assignedTopics={assignedTopics}
            onTopicsChange={setAssignedTopics}
            onAddContact={() => setShowAddContact(true)}
            onAssignUser={(userId) => details.updateAssignedTo(userId)}
          />
        </div>

        {/* Center: Unified Timeline */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Interaction Bar */}
          <div className="rounded-md border bg-background p-3 space-y-2">
            <p className="font-bold">Interaktion erfassen</p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => setShowAddTimeline(true)}>
                <Phone className="mr-1.5 h-3.5 w-3.5" />
                Anruf
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowAddTimeline(true)}>
                <Mail className="mr-1.5 h-3.5 w-3.5" />
                Mail
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowAddAppointment(true)}>
                <Users className="mr-1.5 h-3.5 w-3.5" />
                Treffen
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowAddDocument(true)}>
                <FileText className="mr-1.5 h-3.5 w-3.5" />
                Dokument
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowAddNote(true)}>
                <MessageSquare className="mr-1.5 h-3.5 w-3.5" />
                Notiz
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowAddDecision(true)}>
                <Vote className="mr-1.5 h-3.5 w-3.5" />
                Entscheidung
              </Button>
            </div>
          </div>

          <CaseFileUnifiedTimeline
            timeline={timeline}
            notes={notes}
            documents={documents}
            tasks={tasks}
            appointments={appointments}
            letters={letters}
            interactions={interactions}
            onAddTimelineEntry={() => setShowAddTimeline(true)}
            onDeleteTimelineEntry={details.deleteTimelineEntry}
          />
        </div>

        {/* Right Sidebar */}
        <div className="w-full lg:w-[300px] lg:shrink-0">
          <CaseFileRightSidebar
            caseFile={caseFile}
            tasks={tasks}
            documents={documents}
            caseFileId={caseFileId}
            onUpdateCurrentStatus={details.updateCurrentStatus}
            onUpdateProcessingStatuses={details.updateProcessingStatuses}
            onUpdateRisksOpportunities={details.updateRisksOpportunities}
            onCompleteTask={details.completeTask}
            onAddTask={details.addTask}
            onAddDocument={() => setShowAddDocument(true)}
            onRefresh={details.refresh}
          />
        </div>
      </div>

      {/* ---- Dialogs ---- */}

      {/* Edit Dialog */}
      <CaseFileEditDialog
        caseFile={caseFile}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Fallakte löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Diese Aktion kann nicht rückgängig gemacht werden. Die Fallakte und
              alle Verknüpfungen werden permanent gelöscht.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground"
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Contact Dialog (reuses existing tab as dialog) */}
      {showAddContact && (
        <DialogWrapper open={showAddContact} onClose={() => setShowAddContact(false)} title="Kontakt verknüpfen">
          <CaseFileContactsTab
            contacts={contacts}
            onAdd={async (...args) => {
              const result = await details.addContact(...args);
              if (result) setShowAddContact(false);
              return result;
            }}
            onRemove={details.removeContact}
          />
        </DialogWrapper>
      )}

      {/* Add Document Dialog */}
      {showAddDocument && (
        <DialogWrapper open={showAddDocument} onClose={() => setShowAddDocument(false)} title="Dokument verknüpfen">
          <CaseFileDocumentsTab
            documents={documents}
            onAdd={async (...args) => {
              const result = await details.addDocument(...args);
              if (result) setShowAddDocument(false);
              return result;
            }}
            onRemove={details.removeDocument}
          />
        </DialogWrapper>
      )}

      {/* Add Task Dialog */}
      {showAddTask && (
        <DialogWrapper open={showAddTask} onClose={() => setShowAddTask(false)} title="Aufgabe verknüpfen">
          <CaseFileTasksTab
            tasks={tasks}
            onAdd={async (...args) => {
              const result = await details.addTask(...args);
              if (result) setShowAddTask(false);
              return result;
            }}
            onRemove={details.removeTask}
          />
        </DialogWrapper>
      )}

      {/* Add Appointment Dialog */}
      {showAddAppointment && (
        <DialogWrapper open={showAddAppointment} onClose={() => setShowAddAppointment(false)} title="Termin verknüpfen">
          <CaseFileAppointmentsTab
            appointments={appointments}
            onAdd={async (...args) => {
              const result = await details.addAppointment(...args);
              if (result) setShowAddAppointment(false);
              return result;
            }}
            onRemove={details.removeAppointment}
          />
        </DialogWrapper>
      )}

      {/* Add Note Dialog */}
      {showAddNote && (
        <DialogWrapper open={showAddNote} onClose={() => setShowAddNote(false)} title="Notiz hinzufügen">
          <CaseFileNotesTab
            notes={notes}
            onAdd={async (content) => {
              const result = await details.addNote(content);
              if (result) setShowAddNote(false);
              return result;
            }}
            onUpdate={details.updateNote}
            onDelete={details.deleteNote}
          />
        </DialogWrapper>
      )}

      {showAddDecision && (
        <StandaloneDecisionCreator
          isOpen={showAddDecision}
          onOpenChange={setShowAddDecision}
          onDecisionCreated={() => {
            setShowAddDecision(false);
            details.refresh();
          }}
        />
      )}

      {/* Add Timeline Entry Dialog */}
      {showAddTimeline && (
        <DialogWrapper open={showAddTimeline} onClose={() => setShowAddTimeline(false)} title="Ereignis hinzufügen">
          <CaseFileTimelineTab
            timeline={timeline}
            onAddEntry={async (entry) => {
              const result = await details.addTimelineEntry(entry);
              if (result) setShowAddTimeline(false);
              return result;
            }}
            onDeleteEntry={details.deleteTimelineEntry}
          />
        </DialogWrapper>
      )}
    </div>
  );
}

// Simple full-screen dialog wrapper for reusing tab components
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function DialogWrapper({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}
