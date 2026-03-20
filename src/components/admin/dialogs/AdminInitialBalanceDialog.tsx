import { useState } from "react";
import { getYear } from "date-fns";
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
import { fmt } from "../utils/timeFormatting";
import type { Employee } from "../types";

interface AdminInitialBalanceDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  selectedEmployee: Employee | undefined;
  currentMonth: Date;
  onSave: (minutes: number) => Promise<void>;
}

export function AdminInitialBalanceDialog({
  isOpen,
  onOpenChange,
  selectedEmployee,
  currentMonth,
  onSave,
}: AdminInitialBalanceDialogProps) {
  const [initialBalanceMinutes, setInitialBalanceMinutes] = useState("");

  const handleSave = async () => {
    const minutes = parseInt(initialBalanceMinutes);
    await onSave(minutes);
    setInitialBalanceMinutes("");
    onOpenChange(false);
  };

  const parsedMinutes = parseInt(initialBalanceMinutes);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Anfangsbestand {getYear(currentMonth)}</DialogTitle>
          <DialogDescription>
            Übertrag des Überstundensaldos aus dem Vorjahr ({getYear(currentMonth) - 1}) für{" "}
            {selectedEmployee?.display_name}. Wird als Korrektur zum 01.01.{getYear(currentMonth)}{" "}
            gespeichert.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Übertrag (in Minuten)</Label>
            <Input
              type="number"
              value={initialBalanceMinutes}
              onChange={(e) => setInitialBalanceMinutes(e.target.value)}
              placeholder="z.B. 480 für +8 Stunden"
            />
            <p className="text-xs text-muted-foreground">
              Positiv = Überstunden aus Vorjahr, Negativ = Minusstunden aus Vorjahr.
              {initialBalanceMinutes && !isNaN(parsedMinutes) && (
                <>
                  {" "}
                  Entspricht: <strong>{fmt(parsedMinutes)}</strong>
                </>
              )}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button
            onClick={handleSave}
            disabled={!initialBalanceMinutes || isNaN(parseInt(initialBalanceMinutes))}
          >
            Anfangsbestand speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
