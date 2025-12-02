import { useState } from "react";
import { useCaseFiles, CaseFileFormData, CASE_TYPES, CASE_STATUSES } from "@/hooks/useCaseFiles";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { CaseFile } from "@/hooks/useCaseFiles";

interface CaseFileCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (caseFile: CaseFile) => void;
}

export function CaseFileCreateDialog({ open, onOpenChange, onSuccess }: CaseFileCreateDialogProps) {
  const { createCaseFile } = useCaseFiles();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<CaseFileFormData>({
    title: "",
    description: "",
    case_type: "general",
    status: "active",
    priority: "medium",
    reference_number: "",
    is_private: false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) return;

    setIsSubmitting(true);
    const result = await createCaseFile(formData);
    setIsSubmitting(false);

    if (result) {
      setFormData({
        title: "",
        description: "",
        case_type: "general",
        status: "active",
        priority: "medium",
        reference_number: "",
        is_private: false,
      });
      onOpenChange(false);
      onSuccess?.(result);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Neue FallAkte erstellen</DialogTitle>
            <DialogDescription>
              Erstellen Sie eine neue FallAkte, um Dokumente, Kontakte und Aufgaben zu einem Sachverhalt zu bündeln.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="title">Titel *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="z.B. Gesetzesinitiative Klimaschutz"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">Beschreibung</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Kurze Beschreibung des Sachverhalts..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="case_type">Typ</Label>
                <Select
                  value={formData.case_type}
                  onValueChange={(value) => setFormData({ ...formData, case_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CASE_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="priority">Priorität</Label>
                <Select
                  value={formData.priority}
                  onValueChange={(value) => setFormData({ ...formData, priority: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Niedrig</SelectItem>
                    <SelectItem value="medium">Mittel</SelectItem>
                    <SelectItem value="high">Hoch</SelectItem>
                    <SelectItem value="urgent">Dringend</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="reference_number">Aktenzeichen</Label>
              <Input
                id="reference_number"
                value={formData.reference_number}
                onChange={(e) => setFormData({ ...formData, reference_number: e.target.value })}
                placeholder="z.B. GV-2024-001"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="start_date">Startdatum</Label>
                <Input
                  id="start_date"
                  type="date"
                  value={formData.start_date || ""}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="target_date">Zieldatum</Label>
                <Input
                  id="target_date"
                  type="date"
                  value={formData.target_date || ""}
                  onChange={(e) => setFormData({ ...formData, target_date: e.target.value })}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="is_private"
                checked={formData.is_private}
                onCheckedChange={(checked) => setFormData({ ...formData, is_private: checked })}
              />
              <Label htmlFor="is_private">Privat (nur für mich sichtbar)</Label>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={isSubmitting || !formData.title.trim()}>
              {isSubmitting ? "Erstelle..." : "Erstellen"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
