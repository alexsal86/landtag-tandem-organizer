import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { BookmarkPlus, Library, Trash2 } from "lucide-react";
import { usePreparationTemplates } from "@/hooks/usePreparationTemplates";
import { toast } from "@/hooks/use-toast";
import type { AppointmentPreparation } from "@/hooks/useAppointmentPreparation";

interface Props {
  preparation: AppointmentPreparation;
  onApply: (updates: Partial<AppointmentPreparation>) => Promise<void>;
}

export function TemplatesPanel({ preparation, onApply }: Props) {
  const { templates, loading, saveAsTemplate, deleteTemplate } = usePreparationTemplates();
  const [saveOpen, setSaveOpen] = useState(false);
  const [browseOpen, setBrowseOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [anlasstyp, setAnlasstyp] = useState("");

  const handleSave = async () => {
    if (!name.trim()) {
      toast({ title: "Name fehlt", variant: "destructive" });
      return;
    }
    try {
      await saveAsTemplate({ name: name.trim(), description, anlasstyp, preparation });
      toast({ title: "Vorlage gespeichert" });
      setSaveOpen(false);
      setName(""); setDescription(""); setAnlasstyp("");
    } catch (e) {
      toast({ title: "Fehler", description: "Vorlage konnte nicht gespeichert werden.", variant: "destructive" });
    }
  };

  const applyTemplate = async (templateId: string) => {
    const tpl = templates.find((t) => t.id === templateId);
    if (!tpl) return;
    await onApply({
      preparation_data: { ...preparation.preparation_data, ...tpl.preparation_data },
      checklist_items: tpl.checklist_items?.length ? tpl.checklist_items : preparation.checklist_items,
    });
    toast({ title: "Vorlage angewendet", description: tpl.name });
    setBrowseOpen(false);
  };

  return (
    <Card className="bg-card shadow-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Library className="h-4 w-4 text-primary" />
          Vorlagen
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-2">
        <Dialog open={browseOpen} onOpenChange={setBrowseOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline">
              <Library className="h-3.5 w-3.5 mr-1.5" /> Vorlage anwenden
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Vorlagen-Bibliothek</DialogTitle></DialogHeader>
            {loading && <p className="text-sm text-muted-foreground">Lade…</p>}
            {!loading && templates.length === 0 && (
              <p className="text-sm text-muted-foreground">Noch keine Vorlagen vorhanden.</p>
            )}
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {templates.map((t) => (
                <div key={t.id} className="flex items-start justify-between gap-2 rounded-md border p-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm">{t.name}</div>
                    {t.anlasstyp && (
                      <div className="text-[11px] text-muted-foreground uppercase">{t.anlasstyp}</div>
                    )}
                    {t.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{t.description}</p>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button size="sm" variant="default" onClick={() => void applyTemplate(t.id)}>
                      Anwenden
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label="Vorlage löschen"
                      onClick={async () => {
                        try { await deleteTemplate(t.id); toast({ title: "Gelöscht" }); }
                        catch { toast({ title: "Fehler", variant: "destructive" }); }
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="ghost">
              <BookmarkPlus className="h-3.5 w-3.5 mr-1.5" /> Als Vorlage speichern
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Aktuelle Vorbereitung als Vorlage speichern</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Name (z.B. Bürgersprechstunde Standard)" value={name} onChange={(e) => setName(e.target.value)} />
              <Input placeholder="Anlasstyp (optional, z.B. einladung)" value={anlasstyp} onChange={(e) => setAnlasstyp(e.target.value)} />
              <Textarea placeholder="Beschreibung (optional)" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setSaveOpen(false)}>Abbrechen</Button>
              <Button onClick={() => void handleSave()}>Speichern</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
