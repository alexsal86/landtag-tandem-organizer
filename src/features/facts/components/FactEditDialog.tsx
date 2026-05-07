import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { FactRow, FactInput } from "../types";

interface Props {
  fact: FactRow | null;
  dossiers: Array<{ id: string; title: string }>;
  defaultContactId?: string | null;
  onClose: () => void;
  onSave: (input: FactInput) => Promise<void>;
}

export function FactEditDialog({ fact, dossiers, defaultContactId, onClose, onSave }: Props) {
  const [text, setText] = useState("");
  const [source, setSource] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [dossierId, setDossierId] = useState<string>("none");
  const [validUntil, setValidUntil] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setText(fact?.text ?? "");
    setSource(fact?.source ?? "");
    setTagsInput((fact?.tags ?? []).join(", "));
    setDossierId(fact?.dossier_id ?? "none");
    setValidUntil(fact?.valid_until ?? "");
  }, [fact]);

  const handleSave = async () => {
    if (!text.trim()) return;
    setSaving(true);
    try {
      await onSave({
        id: fact?.id,
        text: text.trim(),
        source: source.trim() || null,
        tags: tagsInput.split(",").map((t) => t.trim()).filter(Boolean),
        dossier_id: dossierId === "none" ? null : dossierId,
        contact_id: fact?.contact_id ?? defaultContactId ?? null,
        valid_until: validUntil || null,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{fact ? "Fakt bearbeiten" : "Neuer Fakt"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="fact-text">Fakt</Label>
            <Textarea
              id="fact-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="z. B. Investitionsstau (BWKG): 2,3 Mrd. EUR · KHG-Quote BW 7,1 %"
              rows={3}
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="fact-source">Quelle</Label>
              <Input
                id="fact-source"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                placeholder="RWI 2025, BWKG-Schätzung…"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fact-valid">Gültig bis</Label>
              <Input
                id="fact-valid"
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fact-tags">Tags (Komma-getrennt)</Label>
            <Input
              id="fact-tags"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="krankenhausreform, bw, investition"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Verknüpftes Dossier</Label>
            <Select value={dossierId} onValueChange={setDossierId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Keines</SelectItem>
                {dossiers.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Abbrechen
          </Button>
          <Button onClick={handleSave} disabled={saving || !text.trim()}>
            Speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
