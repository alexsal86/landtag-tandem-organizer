import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { MultiSelect } from "@/components/ui/multi-select-simple";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SimpleRichTextEditor from "@/components/ui/SimpleRichTextEditor";
import { TaskCommentSidebar } from "@/components/tasks/TaskCommentSidebar";
import { TaskDecisionCreator } from "@/components/task-decisions/TaskDecisionCreator";
import { TaskDocumentDialog } from "@/components/tasks/TaskDocumentDialog";
import { TaskMeetingSelector } from "@/components/tasks/TaskMeetingSelector";
import { MyWorkTask } from "@/hooks/useMyWorkTasksData";

const DEFAULT_TASK_PRIORITIES = [
  { value: "high", label: "Hoch" },
  { value: "medium", label: "Mittel" },
  { value: "low", label: "Niedrig" },
];

interface Profile {
  user_id: string;
  display_name: string | null;
}

interface MyWorkTaskDialogsProps {
  profiles: Profile[];
  tasks: MyWorkTask[];
  taskSnoozes: Record<string, string>;
  availableTaskStatuses: { name: string; label: string }[];
  availableTaskCategories: { name: string; label: string }[];
  dialogState: {
    snoozeDialogOpen: boolean;
    setSnoozeDialogOpen: (open: boolean) => void;
    snoozeTaskId: string | null;
    assignDialogOpen: boolean;
    setAssignDialogOpen: (open: boolean) => void;
    assignSelectedUserIds: string[];
    setAssignSelectedUserIds: (value: string[]) => void;
    commentSidebarOpen: boolean;
    setCommentSidebarOpen: (open: boolean) => void;
    commentTaskId: string | null;
    setCommentTaskId: (taskId: string | null) => void;
    decisionDialogOpen: boolean;
    setDecisionDialogOpen: (open: boolean) => void;
    decisionTaskId: string | null;
    setDecisionTaskId: (taskId: string | null) => void;
    documentDialogOpen: boolean;
    setDocumentDialogOpen: (open: boolean) => void;
    documentTaskId: string | null;
    setDocumentTaskId: (taskId: string | null) => void;
    meetingSelectorOpen: boolean;
    setMeetingSelectorOpen: (open: boolean) => void;
    meetingTaskId: string | null;
    setMeetingTaskId: (taskId: string | null) => void;
    taskEditDialogOpen: boolean;
    setTaskEditDialogOpen: (open: boolean) => void;
    editTaskTitle: string;
    setEditTaskTitle: (value: string) => void;
    editTaskDescription: string;
    setEditTaskDescription: (value: string) => void;
    editTaskPriority: string;
    setEditTaskPriority: (value: string) => void;
    editTaskStatus: string;
    setEditTaskStatus: (value: string) => void;
    editTaskCategory: string;
    setEditTaskCategory: (value: string) => void;
  };
  getTaskTitle: (taskId: string | null) => string | undefined;
  onSetSnooze: (date: Date) => void;
  onClearSnooze: () => void;
  onUpdateAssignee: (userIds: string[]) => void;
  onSelectMeeting: (meetingId: string, meetingTitle: string) => void;
  onMarkForNextJourFixe: () => void;
  onSaveTaskEdit: () => void;
  onDecisionCreated: () => void;
}

export function MyWorkTaskDialogs({
  profiles,
  tasks,
  taskSnoozes,
  availableTaskStatuses,
  availableTaskCategories,
  dialogState,
  getTaskTitle,
  onSetSnooze,
  onClearSnooze,
  onUpdateAssignee,
  onSelectMeeting,
  onMarkForNextJourFixe,
  onSaveTaskEdit,
  onDecisionCreated,
}: MyWorkTaskDialogsProps) {
  const getTask = (taskId: string | null) => (taskId ? tasks.find((task) => task.id === taskId) : undefined);

  return (
    <>
      <Dialog open={dialogState.snoozeDialogOpen} onOpenChange={dialogState.setSnoozeDialogOpen}>
        <DialogContent className="sm:max-w-[350px]">
          <DialogHeader>
            <DialogTitle>Wiedervorlage setzen</DialogTitle>
          </DialogHeader>
          <Calendar
            mode="single"
            selected={dialogState.snoozeTaskId && taskSnoozes[dialogState.snoozeTaskId] ? new Date(taskSnoozes[dialogState.snoozeTaskId]) : undefined}
            onSelect={(date) => date && onSetSnooze(date)}
            disabled={(date) => date < new Date()}
            initialFocus
          />
          {dialogState.snoozeTaskId && taskSnoozes[dialogState.snoozeTaskId] && (
            <Button variant="outline" size="sm" className="mt-3 w-full" onClick={onClearSnooze}>
              Wiedervorlage entfernen
            </Button>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={dialogState.assignDialogOpen} onOpenChange={dialogState.setAssignDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Aufgabe zuweisen</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <div className="space-y-3">
              <MultiSelect
                options={profiles.map((profile) => ({ value: profile.user_id, label: profile.display_name || "Unbekannter Benutzer" }))}
                selected={dialogState.assignSelectedUserIds}
                onChange={dialogState.setAssignSelectedUserIds}
                placeholder="Personen auswählen"
              />
              <div className="flex justify-end">
                <Button onClick={() => onUpdateAssignee(dialogState.assignSelectedUserIds)}>Zuweisung speichern</Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogState.taskEditDialogOpen} onOpenChange={dialogState.setTaskEditDialogOpen}>
        <DialogContent className="sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle>Aufgabe bearbeiten</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="text-sm font-medium">Titel</div>
              <Input value={dialogState.editTaskTitle} onChange={(e) => dialogState.setEditTaskTitle(e.target.value)} placeholder="Titel" />
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium">Beschreibung</div>
              <SimpleRichTextEditor
                initialContent={dialogState.editTaskDescription}
                onChange={dialogState.setEditTaskDescription}
                placeholder="Beschreibung eingeben..."
                minHeight="180px"
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <div className="text-sm font-medium">Priorität</div>
                <Select value={dialogState.editTaskPriority} onValueChange={dialogState.setEditTaskPriority}>
                  <SelectTrigger>
                    <SelectValue placeholder="Priorität wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {DEFAULT_TASK_PRIORITIES.map((priority) => (
                      <SelectItem key={priority.value} value={priority.value}>{priority.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium">Status</div>
                <Select value={dialogState.editTaskStatus} onValueChange={dialogState.setEditTaskStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="Status wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableTaskStatuses.map((status) => (
                      <SelectItem key={status.name} value={status.name}>{status.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium">Kategorie</div>
                <Select value={dialogState.editTaskCategory} onValueChange={dialogState.setEditTaskCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="Kategorie wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableTaskCategories.map((category) => (
                      <SelectItem key={category.name} value={category.name}>{category.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={onSaveTaskEdit}>Speichern</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <TaskCommentSidebar
        taskId={dialogState.commentTaskId}
        taskTitle={getTaskTitle(dialogState.commentTaskId)}
        isOpen={dialogState.commentSidebarOpen}
        onOpenChange={(open) => {
          dialogState.setCommentSidebarOpen(open);
          if (!open) dialogState.setCommentTaskId(null);
        }}
      />

      {dialogState.decisionTaskId && (
        <TaskDecisionCreator
          taskId={dialogState.decisionTaskId}
          isOpen={dialogState.decisionDialogOpen}
          onOpenChange={(open) => {
            dialogState.setDecisionDialogOpen(open);
            if (!open) dialogState.setDecisionTaskId(null);
          }}
          initialTitle={getTask(dialogState.decisionTaskId)?.title}
          initialDescription={getTask(dialogState.decisionTaskId)?.description || undefined}
          onDecisionCreated={() => {
            dialogState.setDecisionDialogOpen(false);
            dialogState.setDecisionTaskId(null);
            onDecisionCreated();
          }}
        />
      )}

      <TaskDocumentDialog
        taskId={dialogState.documentTaskId}
        taskTitle={getTaskTitle(dialogState.documentTaskId)}
        isOpen={dialogState.documentDialogOpen}
        onOpenChange={(open) => {
          dialogState.setDocumentDialogOpen(open);
          if (!open) dialogState.setDocumentTaskId(null);
        }}
      />

      <TaskMeetingSelector
        open={dialogState.meetingSelectorOpen}
        onOpenChange={(open) => {
          dialogState.setMeetingSelectorOpen(open);
          if (!open) dialogState.setMeetingTaskId(null);
        }}
        onSelect={onSelectMeeting}
        onMarkForNextJourFixe={onMarkForNextJourFixe}
      />
    </>
  );
}
