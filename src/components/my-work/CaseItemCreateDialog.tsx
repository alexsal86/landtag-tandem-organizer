import { useEffect, useState } from "react";
import { addWeeks, format } from "date-fns";
import { Briefcase, Mail, MessageSquare, Phone, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CaseItemFormData, useCaseItems } from "@/features/cases/items/hooks";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";

interface CaseItemCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (id: string) => void;
  createCaseItem: ReturnType<typeof useCaseItems>["createCaseItem"];
  assignees: Array<{ id: string; name: string }>;
  defaultAssigneeId: string | null;
}

const sourceChannelOptions = [
  { value: "email", label: "E-Mail", icon: Mail },
  { value: "phone", label: "Telefon", icon: Phone },
  { value: "social", label: "Social Media", icon: MessageSquare },
  { value: "in_person", label: "Persönlich", icon: UserRound },
  { value: "other", label: "Sonstiges", icon: Briefcase },
] as const;

export function CaseItemCreateDialog({ open, onOpenChange, onCreated, createCaseItem, assignees, defaultAssigneeId }: CaseItemCreateDialogProps) {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const [subject, setSubject] = useState("");
  const [sourceChannel, setSourceChannel] = useState<CaseItemFormData["source_channel"]>("email");
  const [priority, setPriority] = useState<NonNullable<CaseItemFormData["priority"]>>("medium");
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState<string[]>(defaultAssigneeId ? [defaultAssigneeId] : []);
  const [category, setCategory] = useState("");
  const [sourceReceivedDate, setSourceReceivedDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const hasContext = Boolean(user && currentTenant);

  useEffect(() => {
    if (open) {
      setSelectedAssigneeIds(defaultAssigneeId ? [defaultAssigneeId] : []);
    }
  }, [defaultAssigneeId, open]);

  const handleSubmit = async () => {
    if (!subject.trim() || !sourceReceivedDate || !category || !hasContext) return;

    setSubmitError(null);

    setSubmitting(true);

    const newItem = await createCaseItem({
      source_channel: sourceChannel,
      priority,
      status: "active",
      due_at: dueDate ? new Date(`${dueDate}T12:00:00`).toISOString() : null,
      source_received_at: new Date(`${sourceReceivedDate}T12:00:00`).toISOString(),
      owner_user_id: selectedAssigneeIds[0] || null,
      intake_payload: {
        category,
        assignee_ids: selectedAssigneeIds,
      },
      subject: subject.trim(),
      summary: subject.trim(),
      resolution_summary: subject.trim(),
    });

    setSubmitting(false);

    if (!newItem) {
      setSubmitError("Vorgang konnte nicht erstellt werden. Details siehe Benachrichtigung.");
      return;
    }

    onCreated(newItem.id);
    setSubject("");
    setSourceChannel("email");
    setPriority("medium");
    setSelectedAssigneeIds(defaultAssigneeId ? [defaultAssigneeId] : []);
    setCategory("");
    setSourceReceivedDate("");
    setDueDate("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Neuer Vorgang</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {!hasContext && (
            <p className="text-sm text-destructive">
              Kein aktiver Mandanten-/Sitzungskontext vorhanden. Bitte neu anmelden oder Mandant auswählen.
            </p>
          )}

          {submitError && <p className="text-sm text-destructive">{submitError}</p>}

          <div className="space-y-2">
            <Label htmlFor="case-item-subject">Betreff</Label>
            <Input
              id="case-item-subject"
              placeholder="Kurzer Betreff"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Kanal</Label>
            <Select value={sourceChannel} onValueChange={(value) => setSourceChannel(value as CaseItemFormData["source_channel"])}>
              <SelectTrigger>
                <SelectValue placeholder="Kanal auswählen" />
              </SelectTrigger>
              <SelectContent>
                {sourceChannelOptions.map((option) => {
                  const Icon = option.icon;
                  return (
                    <SelectItem key={option.value} value={option.value}>
                      <span className="inline-flex items-center gap-2">
                        <Icon className="h-3.5 w-3.5" />
                        {option.label}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Kategorie *</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Kategorie auswählen" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Allgemein">Allgemein</SelectItem>
                <SelectItem value="Bürgeranliegen">Bürgeranliegen</SelectItem>
                <SelectItem value="Anfrage">Anfrage</SelectItem>
                <SelectItem value="Beschwerde">Beschwerde</SelectItem>
                <SelectItem value="Termin">Termin</SelectItem>
                <SelectItem value="Sonstiges">Sonstiges</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Bearbeiter (mehrfach)</Label>
            <div className="flex flex-wrap gap-2">
              {assignees.map((assignee) => {
                const selected = selectedAssigneeIds.includes(assignee.id);
                return (
                  <Button
                    key={assignee.id}
                    type="button"
                    size="sm"
                    variant={selected ? "default" : "outline"}
                    onClick={() => {
                      setSelectedAssigneeIds((prev) => selected ? prev.filter((id) => id !== assignee.id) : [...prev, assignee.id]);
                    }}
                  >
                    {assignee.name}
                  </Button>
                );
              })}
            </div>
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
            <Label htmlFor="case-item-received">Eingangsdatum</Label>
            <Input
              id="case-item-received"
              type="date"
              value={sourceReceivedDate}
              onChange={(event) => {
                const value = event.target.value;
                setSourceReceivedDate(value);
                if (value) {
                  setDueDate(format(addWeeks(new Date(`${value}T12:00:00`), 4), "yyyy-MM-dd"));
                } else {
                  setDueDate("");
                }
              }}
              required
            />
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
          <Button onClick={handleSubmit} disabled={submitting || !subject.trim() || !sourceReceivedDate || !category || !hasContext}>
            Vorgang erstellen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
