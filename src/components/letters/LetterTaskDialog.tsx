import React from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface ParentTaskOption {
  id: string;
  title: string;
}

interface LetterTaskDialogProps {
  mode: 'task' | 'subtask' | null;
  taskTitle: string;
  setTaskTitle: (v: string) => void;
  taskDescription: string;
  setTaskDescription: (v: string) => void;
  parentTaskId: string;
  setParentTaskId: (v: string) => void;
  availableParentTasks: ParentTaskOption[];
  isCreating: boolean;
  onClose: () => void;
  onCreate: () => void;
}

export const LetterTaskDialog: React.FC<LetterTaskDialogProps> = ({
  mode, taskTitle, setTaskTitle, taskDescription, setTaskDescription,
  parentTaskId, setParentTaskId, availableParentTasks, isCreating,
  onClose, onCreate,
}) => {
  return (
    <Dialog open={mode !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === 'task' ? 'Aufgabe aus Brief erstellen' : 'Unteraufgabe aus Brief erstellen'}</DialogTitle>
          <DialogDescription>
            {mode === 'task' ? 'Erstellen Sie direkt aus diesem Brief eine neue Aufgabe.' : 'Wählen Sie eine bestehende Aufgabe aus, zu der diese Unteraufgabe gehören soll.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="letter-task-title">Titel</Label>
            <Input id="letter-task-title" value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} placeholder="Titel der Aufgabe" />
          </div>
          {mode === 'subtask' && (
            <div className="space-y-2">
              <Label htmlFor="letter-parent-task">Übergeordnete Aufgabe</Label>
              <Select value={parentTaskId} onValueChange={setParentTaskId}>
                <SelectTrigger id="letter-parent-task"><SelectValue placeholder="Bitte Aufgabe wählen" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Bitte wählen</SelectItem>
                  {availableParentTasks.map((task) => (<SelectItem key={task.id} value={task.id}>{task.title}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          )}
          {mode === 'task' && (
            <div className="space-y-2">
              <Label htmlFor="letter-task-description">Beschreibung</Label>
              <Textarea id="letter-task-description" value={taskDescription} onChange={(e) => setTaskDescription(e.target.value)} placeholder="Beschreibung (optional)" rows={5} />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isCreating}>Abbrechen</Button>
          <Button onClick={onCreate} disabled={isCreating}>
            {isCreating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {mode === 'task' ? 'Aufgabe erstellen' : 'Unteraufgabe erstellen'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
