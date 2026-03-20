import { useState } from "react";
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
import type { Employee } from "../types";

interface AdminCorrectionDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  selectedEmployee: Employee | undefined;
  onSave: (minutes: number, reason: string) => Promise<void>;
}

export function AdminCorrectionDialog({
  isOpen,
  onOpenChange,
  selectedEmployee,
  onSave,
}: AdminCorrectionDialogProps) {
  const [correctionMinutes, setCorrectionMinutes] = useState("");
  const [correctionReason, setCorrectionReason] = useState("");

  const handleSave = async () => {
    const minutes = parseInt(correctionMinutes);
    await onSave(minutes, correctionReason);
    setCorrectionMinutes("");
    setCorrectionReason("");
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Saldo-Korrektur hinzufügen</DialogTitle>
          <DialogDescription>
            Korrigieren Sie den Stundensaldo für {selectedEmployee?.display_name}. Positive Werte
            fügen Stunden hinzu, negative ziehen Stunden ab.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Korrektur (in Minuten)</Label>
            <Input
              type="number"
              value={correctionMinutes}
              onChange={(e) => setCorrectionMinutes(e.target.value)}
              placeholder="z.B. -120 für -2 Stunden"
            />
            <p className="text-xs text-muted-foreground">
              Um Überstunden auf Null zu setzen, geben Sie den negativen Wert des aktuellen Saldos
              ein.
            </p>
          </div>

          <div className="space-y-2">
            <Label>
              Grund der Korrektur <span className="text-destructive">*</span>
            </Label>
            <Textarea
              value={correctionReason}
              onChange={(e) => setCorrectionReason(e.target.value)}
              placeholder="z.B. Überstundenabbau zum Jahresende, Korrektur nach Abstimmung..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button
            onClick={handleSave}
            disabled={!correctionMinutes || !correctionReason.trim()}
          >
            Korrektur speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
