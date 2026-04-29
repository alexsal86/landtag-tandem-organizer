import { useState } from "react";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle } from "lucide-react";
import type { EntryType } from "@/features/timetracking/components/AdminTimeEntryEditor";
import { fmt } from "../utils/timeFormatting";
import type { NewEntryFormData } from "../hooks/useAdminEntryCreation";
import type { Employee } from "../types";

interface AdminCreateEntryDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  selectedEmployee: Employee | undefined;
  yearlyBalance: number;
  dailyHours: number;
  isSaving: boolean;
  onSave: (data: NewEntryFormData) => Promise<void>;
}

export function AdminCreateEntryDialog({
  isOpen,
  onOpenChange,
  selectedEmployee,
  yearlyBalance,
  dailyHours,
  isSaving,
  onSave,
}: AdminCreateEntryDialogProps) {
  const [newEntryDate, setNewEntryDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [newEntryStartTime, setNewEntryStartTime] = useState("09:00");
  const [newEntryEndTime, setNewEntryEndTime] = useState("17:00");
  const [newEntryPause, setNewEntryPause] = useState("30");
  const [newEntryType, setNewEntryType] = useState<EntryType>("work");
  const [newEntryReason, setNewEntryReason] = useState("");

  const dailyMinutes = Math.round(dailyHours * 60);

  const handleSave = async () => {
    await onSave({
      type: newEntryType,
      date: newEntryDate,
      startTime: newEntryStartTime,
      endTime: newEntryEndTime,
      pauseMinutes: parseInt(newEntryPause) || 0,
      reason: newEntryReason,
    });
    // Reset form on success
    setNewEntryDate(format(new Date(), "yyyy-MM-dd"));
    setNewEntryStartTime("09:00");
    setNewEntryEndTime("17:00");
    setNewEntryPause("30");
    setNewEntryType("work");
    setNewEntryReason("");
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Eintrag für {selectedEmployee?.display_name} erstellen</DialogTitle>
          <DialogDescription>
            Erstellen Sie einen neuen Zeit- oder Abwesenheitseintrag.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid gap-2">
            <Label>Eintragstyp</Label>
            <select
              value={newEntryType}
              onChange={(e) => setNewEntryType(e.target.value as EntryType)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="work">📋 Arbeit</option>
              <option value="vacation">🏖️ Urlaub</option>
              <option value="sick">🤒 Krankheit</option>
              <option value="overtime_reduction">⏰ Überstundenabbau</option>
            </select>
            {newEntryType === "overtime_reduction" && yearlyBalance < dailyMinutes && (
              <div className="bg-amber-50 border border-amber-200 rounded-md p-2 text-sm text-amber-800">
                ⚠️ Nicht genügend Überstunden vorhanden (Saldo: {fmt(yearlyBalance)}, benötigt:{" "}
                {fmt(dailyMinutes)})
              </div>
            )}
          </div>

          <div className="grid gap-2">
            <Label>Datum</Label>
            <Input
              type="date"
              value={newEntryDate}
              onChange={(e) => setNewEntryDate(e.target.value)}
            />
          </div>

          {newEntryType === "work" && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Start</Label>
                  <Input
                    type="time"
                    value={newEntryStartTime}
                    onChange={(e) => setNewEntryStartTime(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Ende</Label>
                  <Input
                    type="time"
                    value={newEntryEndTime}
                    onChange={(e) => setNewEntryEndTime(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label>Pause (Minuten)</Label>
                <Input
                  type="number"
                  min="0"
                  max="120"
                  value={newEntryPause}
                  onChange={(e) => setNewEntryPause(e.target.value)}
                />
              </div>
            </>
          )}

          <div className="grid gap-2">
            <Label>Notizen/Grund</Label>
            <Textarea
              value={newEntryReason}
              onChange={(e) => setNewEntryReason(e.target.value)}
              placeholder={
                newEntryType === "work"
                  ? "z.B. Nachträgliche Erfassung..."
                  : "z.B. Nachträgliche Genehmigung..."
              }
              rows={2}
            />
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5" />
              <p className="text-sm text-blue-800">
                Dieser Eintrag wird als Admin-Eintrag gekennzeichnet und ist für den Mitarbeiter
                sichtbar.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Abbrechen
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Erstellen..." : "Eintrag erstellen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
