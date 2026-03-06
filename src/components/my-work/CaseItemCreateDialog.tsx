import { useEffect, useState } from "react";
import { addWeeks, format } from "date-fns";
import { Briefcase, Mail, MessageSquare, Phone, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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

const categoryOptions = ["Allgemein", "Bürgeranliegen", "Anfrage", "Beschwerde", "Termin", "Sonstiges"] as const;

const priorityOptions = [
  { value: "low", label: "Niedrig" },
  { value: "medium", label: "Mittel" },
  { value: "high", label: "Hoch" },
  { value: "urgent", label: "Dringend" },
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

  const setDefaultDates = () => {
    const today = format(new Date(), "yyyy-MM-dd");
    setSourceReceivedDate(today);
    setDueDate(format(addWeeks(new Date(`${today}T12:00:00`), 4), "yyyy-MM-dd"));
  };

  useEffect(() => {
    if (open) {
      setSelectedAssigneeIds(defaultAssigneeId ? [defaultAssigneeId] : []);
      setDefaultDates();
    }
  }, [defaultAssigneeId, open]);

  const handleSubmit = async () => {
    if (!subject.trim() || !sourceReceivedDate || !category || !hasContext) return;

    setSubmitError(null);

    setSubmitting(true);

    const newItem = await createCaseItem({
      source_channel: sourceChannel,
      priority,
      status: "neu",
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
    setDefaultDates();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
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
            <Label>Kanal</Label>
            <RadioGroup value={sourceChannel} onValueChange={(value) => setSourceChannel(value as CaseItemFormData["source_channel"])} className="grid gap-2 sm:grid-cols-2">
              {sourceChannelOptions.map((option) => {
                const Icon = option.icon;
                const selected = sourceChannel === option.value;
                const id = `source-channel-${option.value}`;
                return (
                  <label
                    key={option.value}
                    htmlFor={id}
                    className={`flex cursor-pointer items-center gap-2 rounded-md border p-2 text-sm ${selected ? "border-primary bg-primary/5" : "border-border"}`}
                  >
                    <RadioGroupItem id={id} value={option.value} aria-label={`Kanal ${option.label}`} />
                    <Icon className="h-3.5 w-3.5" />
                    <span>{option.label}</span>
                  </label>
                );
              })}
            </RadioGroup>
          </div>

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
            <Label>Kategorie *</Label>
            <RadioGroup value={category} onValueChange={setCategory} className="flex flex-wrap gap-2">
              {categoryOptions.map((option) => {
                const selected = category === option;
                const id = `category-${option}`;
                return (
                  <label
                    key={option}
                    htmlFor={id}
                    className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm ${selected ? "border-primary bg-primary/5" : "border-border"}`}
                  >
                    <RadioGroupItem id={id} value={option} aria-label={`Kategorie ${option}`} />
                    <span>{option}</span>
                  </label>
                );
              })}
            </RadioGroup>
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
            <RadioGroup value={priority} onValueChange={(value) => setPriority(value as NonNullable<CaseItemFormData["priority"]>)} className="flex flex-wrap gap-2">
              {priorityOptions.map((option) => {
                const selected = priority === option.value;
                const id = `priority-${option.value}`;
                return (
                  <label
                    key={option.value}
                    htmlFor={id}
                    className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm ${selected ? "border-primary bg-primary/5" : "border-border"}`}
                  >
                    <RadioGroupItem id={id} value={option.value} aria-label={`Priorität ${option.label}`} />
                    <span>{option.label}</span>
                  </label>
                );
              })}
            </RadioGroup>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
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
