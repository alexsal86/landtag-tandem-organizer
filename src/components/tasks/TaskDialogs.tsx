import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { AlarmClock } from "lucide-react";
import { TaskArchiveModal } from "@/features/tasks/components/TaskArchiveModal";
import { SnoozeManagementSidebar } from "@/components/notifications/SnoozeManagementSidebar";
import { TodoCreateDialog } from "@/features/tasks/components/TodoCreateDialog";
import { CelebrationAnimationSystem } from "../celebrations";
import type { SnoozeEntry } from "./types";

interface TaskDialogsProps {
  // Archive
  archiveModalOpen: boolean;
  setArchiveModalOpen: (open: boolean) => void;
  onTaskRestored: () => void;
  // Snooze dialog
  snoozeDialogOpen: { type: 'task' | 'subtask'; id: string } | null;
  setSnoozeDialogOpen: (v: { type: 'task' | 'subtask'; id: string } | null) => void;
  onSnoozeSubmit: (type: 'task' | 'subtask', id: string, snoozeUntil: string) => void;
  // Snooze management
  snoozeManagementOpen: boolean;
  setSnoozeManagementOpen: (open: boolean) => void;
  allSnoozes: SnoozeEntry[];
  onUpdateSnooze: (snoozeId: string, newDate: string) => void;
  onDeleteSnooze: (snoozeId: string) => void;
  hideSnoozeSubtasks: boolean;
  onToggleHideSnoozeSubtasks: (hide: boolean) => void;
  // Subtask completion
  completingSubtask: string | null;
  setCompletingSubtask: (v: string | null) => void;
  onSubtaskComplete: (subtaskId: string, isCompleted: boolean, result: string) => void;
  // Todo create
  todoCreateOpen: boolean;
  setTodoCreateOpen: (open: boolean) => void;
  onTodoCreated: () => void;
  // Quick note
  quickNoteDialog: { open: boolean; taskId: string | null };
  setQuickNoteDialog: (v: { open: boolean; taskId: string | null }) => void;
  onCreateQuickNote: (taskId: string, content: string) => Promise<boolean | undefined>;
  // Celebration
  showCelebration: boolean;
  onCelebrationComplete: () => void;
}

export function TaskDialogs({
  archiveModalOpen, setArchiveModalOpen, onTaskRestored,
  snoozeDialogOpen, setSnoozeDialogOpen, onSnoozeSubmit,
  snoozeManagementOpen, setSnoozeManagementOpen, allSnoozes,
  onUpdateSnooze, onDeleteSnooze, hideSnoozeSubtasks, onToggleHideSnoozeSubtasks,
  completingSubtask, setCompletingSubtask, onSubtaskComplete,
  todoCreateOpen, setTodoCreateOpen, onTodoCreated,
  quickNoteDialog, setQuickNoteDialog, onCreateQuickNote,
  showCelebration, onCelebrationComplete,
}: TaskDialogsProps) {
  const [snoozeDate, setSnoozeDate] = useState('');
  const [completionResult, setCompletionResult] = useState('');
  const [quickNoteContent, setQuickNoteContent] = useState('');

  const handleSnoozeSubmit = () => {
    if (!snoozeDialogOpen || !snoozeDate) return;
    onSnoozeSubmit(snoozeDialogOpen.type, snoozeDialogOpen.id, new Date(snoozeDate).toISOString());
    setSnoozeDialogOpen(null);
    setSnoozeDate('');
  };

  return (
    <>
      <TaskArchiveModal
        isOpen={archiveModalOpen}
        onClose={() => setArchiveModalOpen(false)}
        onTaskRestored={onTaskRestored}
      />

      {/* Subtask Completion Dialog */}
      <Dialog open={!!completingSubtask} onOpenChange={() => { setCompletingSubtask(null); setCompletionResult(''); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Unteraufgabe als erledigt markieren</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Wie wurde die Aufgabe gelöst?</Label>
              <Textarea
                value={completionResult}
                onChange={(e) => setCompletionResult(e.target.value)}
                placeholder="Beschreiben Sie kurz, wie die Aufgabe erledigt wurde..."
                className="mt-2"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setCompletingSubtask(null); setCompletionResult(''); }} className="flex-1">
                Abbrechen
              </Button>
              <Button onClick={() => { if (completingSubtask) { onSubtaskComplete(completingSubtask, true, completionResult); setCompletingSubtask(null); setCompletionResult(''); } }} className="flex-1">
                Als erledigt markieren
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Snooze Dialog */}
      <Dialog open={!!snoozeDialogOpen} onOpenChange={() => setSnoozeDialogOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {snoozeDialogOpen?.type === 'task' ? 'Aufgabe' : 'Unteraufgabe'} auf Wiedervorlage setzen
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Wiedervorlage-Datum</Label>
              <Input type="datetime-local" value={snoozeDate} onChange={(e) => setSnoozeDate(e.target.value)} className="mt-2" />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setSnoozeDialogOpen(null); setSnoozeDate(''); }} className="flex-1">
                Abbrechen
              </Button>
              <Button onClick={handleSnoozeSubmit} disabled={!snoozeDate}>
                <AlarmClock className="h-4 w-4 mr-2" />
                Wiedervorlage setzen
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <SnoozeManagementSidebar
        isOpen={snoozeManagementOpen}
        onClose={() => setSnoozeManagementOpen(false)}
        snoozes={allSnoozes}
        onUpdateSnooze={onUpdateSnooze}
        onDeleteSnooze={onDeleteSnooze}
        hideSnoozeSubtasks={hideSnoozeSubtasks}
        onToggleHideSnoozeSubtasks={onToggleHideSnoozeSubtasks}
      />

      <TodoCreateDialog
        open={todoCreateOpen}
        onOpenChange={setTodoCreateOpen}
        onTodoCreated={onTodoCreated}
      />

      {/* Quick Note Dialog */}
      <Dialog open={quickNoteDialog.open} onOpenChange={(open) => { setQuickNoteDialog({ open, taskId: null }); setQuickNoteContent(''); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Quick Note zur Aufgabe erstellen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Notiz-Inhalt</Label>
              <Textarea
                value={quickNoteContent}
                onChange={(e) => setQuickNoteContent(e.target.value)}
                placeholder="Schreiben Sie Ihre Notiz zur Aufgabe..."
                className="mt-2 min-h-[120px]"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setQuickNoteDialog({ open: false, taskId: null }); setQuickNoteContent(''); }} className="flex-1">
                Abbrechen
              </Button>
              <Button
                onClick={async () => {
                  if (quickNoteDialog.taskId) {
                    const success = await onCreateQuickNote(quickNoteDialog.taskId, quickNoteContent);
                    if (success) { setQuickNoteDialog({ open: false, taskId: null }); setQuickNoteContent(''); }
                  }
                }}
                disabled={!quickNoteContent.trim()}
                className="flex-1"
              >
                Notiz erstellen
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <CelebrationAnimationSystem isVisible={showCelebration} onAnimationComplete={onCelebrationComplete} />
    </>
  );
}
