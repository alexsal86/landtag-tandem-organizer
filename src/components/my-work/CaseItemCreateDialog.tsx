import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CaseItemFormData, useCaseItems } from "@/features/cases/items/hooks";

interface CaseItemCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (id: string) => void;
  createCaseItem: ReturnType<typeof useCaseItems>["createCaseItem"];
}

export function CaseItemCreateDialog({ open, onOpenChange, onCreated, createCaseItem }: CaseItemCreateDialogProps) {
  const [title, setTitle] = useState("");
  const [sourceChannel, setSourceChannel] = useState<CaseItemFormData["source_channel"]>("email");
  const [priority, setPriority] = useState<NonNullable<CaseItemFormData["priority"]>>("medium");
  const [dueDate, setDueDate] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim()) return;

    setSubmitting(true);

    const newItem = await createCaseItem({
      source_channel: sourceChannel,
      priority,
      status: "active",
      due_at: dueDate ? new Date(`${dueDate}T12:00:00`).toISOString() : null,
      resolution_summary: title.trim(),
    });

    setSubmitting(false);

    if (!newItem) return;

    onCreated(newItem.id);
    setTitle("");
    setSourceChannel("email");
    setPriority("medium");
    setDueDate("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Neues Anliegen</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="case-item-title">Titel</Label>
            <Input
              id="case-item-title"
              placeholder="Kurzer Titel"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Kanal</Label>
            <Select value={sourceChannel} onValueChange={(value) => setSourceChannel(value as CaseItemFormData["source_channel"])}>
              <SelectTrigger>
                <SelectValue placeholder="Kanal auswählen" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="email">E-Mail</SelectItem>
                <SelectItem value="phone">Telefon</SelectItem>
                <SelectItem value="social">Social Media</SelectItem>
                <SelectItem value="in_person">Persönlich</SelectItem>
                <SelectItem value="other">Sonstiges</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Priorität</Label>
            <Select value={priority} onValueChange={(value) => setPriority(value as NonNullable<CaseItemFormData["priority"]>)}>
              <SelectTrigger>
                <SelectValue placeholder="Priorität auswählen" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Niedrig</SelectItem>
                <SelectItem value="medium">Mittel</SelectItem>
                <SelectItem value="high">Hoch</SelectItem>
                <SelectItem value="urgent">Dringend</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="case-item-due">Frist</Label>
            <Input
              id="case-item-due"
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Abbrechen
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || !title.trim()}>
            Anliegen erstellen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
