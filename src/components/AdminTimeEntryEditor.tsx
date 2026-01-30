import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { format, parseISO } from "date-fns";
import { AlertCircle, UserCircle } from "lucide-react";

export interface AdminEditData {
  work_date: string;
  started_at: string;
  ended_at: string;
  pause_minutes: number;
  notes: string;
  edit_reason: string;
}

interface TimeEntryForEdit {
  id: string;
  work_date: string;
  started_at: string | null;
  ended_at: string | null;
  minutes: number | null;
  pause_minutes?: number;
  notes: string | null;
  user_name?: string;
  edited_by?: string | null;
  edited_at?: string | null;
  edit_reason?: string | null;
}

interface AdminTimeEntryEditorProps {
  entry: TimeEntryForEdit;
  isOpen: boolean;
  onClose: () => void;
  onSave: (entryId: string, data: AdminEditData) => Promise<void>;
  isLoading?: boolean;
}

export function AdminTimeEntryEditor({
  entry,
  isOpen,
  onClose,
  onSave,
  isLoading = false,
}: AdminTimeEntryEditorProps) {
  const [workDate, setWorkDate] = useState(entry.work_date);
  const [startTime, setStartTime] = useState(
    entry.started_at ? format(parseISO(entry.started_at), "HH:mm") : ""
  );
  const [endTime, setEndTime] = useState(
    entry.ended_at ? format(parseISO(entry.ended_at), "HH:mm") : ""
  );
  const [pauseMinutes, setPauseMinutes] = useState(
    (entry.pause_minutes || 30).toString()
  );
  const [notes, setNotes] = useState(entry.notes || "");
  const [editReason, setEditReason] = useState("");

  const handleSave = async () => {
    if (!editReason.trim()) {
      return; // Grund ist Pflichtfeld
    }

    await onSave(entry.id, {
      work_date: workDate,
      started_at: startTime,
      ended_at: endTime,
      pause_minutes: parseInt(pauseMinutes) || 0,
      notes,
      edit_reason: editReason,
    });
  };

  // Berechne Vorschau der Arbeitszeit
  const calculatePreview = () => {
    if (!startTime || !endTime) return null;
    const [startH, startM] = startTime.split(":").map(Number);
    const [endH, endM] = endTime.split(":").map(Number);
    const grossMinutes = (endH * 60 + endM) - (startH * 60 + startM);
    const pause = parseInt(pauseMinutes) || 0;
    const netMinutes = grossMinutes - pause;
    
    if (grossMinutes <= 0) return { error: "Endzeit muss nach Startzeit liegen" };
    if (netMinutes <= 0) return { error: "Nettozeit muss positiv sein" };
    
    const formatTime = (min: number) => `${Math.floor(min / 60)}:${(min % 60).toString().padStart(2, '0')}`;
    
    return {
      gross: formatTime(grossMinutes),
      net: formatTime(netMinutes),
      grossMinutes,
      netMinutes,
    };
  };

  const preview = calculatePreview();

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCircle className="h-5 w-5 text-muted-foreground" />
            Zeiteintrag bearbeiten
          </DialogTitle>
        </DialogHeader>

        {entry.user_name && (
          <div className="bg-muted/50 rounded-md p-3 mb-2">
            <p className="text-sm text-muted-foreground">
              Mitarbeiter: <span className="font-medium text-foreground">{entry.user_name}</span>
            </p>
          </div>
        )}

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="work_date">Datum</Label>
            <Input
              id="work_date"
              type="date"
              value={workDate}
              onChange={(e) => setWorkDate(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="start_time">Startzeit</Label>
              <Input
                id="start_time"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="end_time">Endzeit</Label>
              <Input
                id="end_time"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="pause">Pause (Minuten)</Label>
            <Input
              id="pause"
              type="number"
              min="0"
              max="120"
              value={pauseMinutes}
              onChange={(e) => setPauseMinutes(e.target.value)}
            />
          </div>

          {preview && !("error" in preview) && (
            <div className="bg-muted/50 rounded-md p-3 text-sm">
              <div className="flex justify-between">
                <span>Brutto:</span>
                <span className="font-medium">{preview.gross} Std.</span>
              </div>
              <div className="flex justify-between mt-1">
                <span>Netto (abzgl. Pause):</span>
                <span className="font-medium text-primary">{preview.net} Std.</span>
              </div>
            </div>
          )}

          {preview && "error" in preview && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{preview.error}</AlertDescription>
            </Alert>
          )}

          <div className="grid gap-2">
            <Label htmlFor="notes">Notizen</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optionale Notizen..."
              rows={2}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="edit_reason" className="flex items-center gap-2">
              Grund der Änderung <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="edit_reason"
              value={editReason}
              onChange={(e) => setEditReason(e.target.value)}
              placeholder="z.B. Korrektur der Endzeit, Pausenzeit angepasst..."
              rows={2}
              required
            />
          </div>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Diese Änderung wird protokolliert und ist für den Mitarbeiter sichtbar.
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Abbrechen
          </Button>
          <Button
            onClick={handleSave}
            disabled={isLoading || !editReason.trim() || (preview && "error" in preview)}
          >
            {isLoading ? "Speichern..." : "Änderung speichern"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
