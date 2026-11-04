import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2 } from "lucide-react";
import { QUICK_NOTE_COLORS } from "@/components/my-work/quickNoteColors";
import type { NoteColorDef } from "@/components/my-work/useNoteColorPalette";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  palette: NoteColorDef[];
  onSave: (next: NoteColorDef[]) => void;
}

export function NoteColorPaletteDialog({ open, onOpenChange, palette, onSave }: Props) {
  const [draft, setDraft] = useState<NoteColorDef[]>(palette);
  useEffect(() => { if (open) setDraft(palette); }, [open, palette]);

  const update = (i: number, patch: Partial<NoteColorDef>) =>
    setDraft((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Farben anpassen</DialogTitle>
          <DialogDescription>Gib jeder Farbe eine Bedeutung. Sie erscheint, wenn du mit der Maus über die Farbe fährst.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {draft.map((c, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="color"
                value={c.value}
                onChange={(e) => update(i, { value: e.target.value })}
                className="h-8 w-8 shrink-0 cursor-pointer rounded border bg-transparent p-0"
                aria-label={`Farbton für ${c.name}`}
              />
              <Input value={c.name} onChange={(e) => update(i, { name: e.target.value })} placeholder="Name" className="h-8 w-28" aria-label="Name" />
              <Input value={c.meaning ?? ""} onChange={(e) => update(i, { meaning: e.target.value })} placeholder="Bedeutung, z. B. Dringend" className="h-8 flex-1" aria-label="Bedeutung" />
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" disabled={draft.length <= 1} onClick={() => setDraft((prev) => prev.filter((_, idx) => idx !== i))} aria-label="Farbe löschen">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => setDraft((prev) => [...prev, { name: "Neu", value: "#64748b", meaning: "" }])}>
            <Plus className="h-4 w-4 mr-1.5" />Farbe hinzufügen
          </Button>
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="ghost" onClick={() => setDraft(QUICK_NOTE_COLORS.map((c) => ({ ...c })))}>Zurücksetzen</Button>
          <Button onClick={() => { onSave(draft.filter((c) => c.name.trim())); onOpenChange(false); }}>Speichern</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
