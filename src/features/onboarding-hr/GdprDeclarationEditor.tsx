import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { isValidDeclaration, type GdprDeclaration } from "./gdpr";

export function GdprDeclarationEditor({ declaration, busy, onSave }: {
  declaration: GdprDeclaration;
  busy: boolean;
  onSave: (text: string, expectedVersion: string) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [version, setVersion] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const start = () => {
    setText(declaration.text);
    setVersion(declaration.version);
    setError("");
    setSaved(false);
    setOpen(true);
  };
  const save = async () => {
    setError("");
    try {
      if (await onSave(text, version)) {
        setOpen(false);
        setSaved(true);
      } else {
        setError("Speichern fehlgeschlagen. Bitte die Fehlermeldung im HR-Bereich beachten. Ihre Änderungen bleiben hier erhalten.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Speichern fehlgeschlagen.");
    }
  };
  return <div className="space-y-2 rounded-md border p-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div><h3 className="font-semibold">Datenschutz-Verpflichtung</h3>
        <p className="text-sm text-muted-foreground">Den Text für das Onboarding in diesem Büro ändern oder ergänzen.</p>
      </div>
      <Button variant="outline" onClick={start} disabled={busy}>Datenschutztext bearbeiten</Button>
    </div>
    {saved && <p role="status" className="text-sm">Der Datenschutztext wurde als neue Fassung gespeichert.</p>}
    <Dialog open={open} onOpenChange={(value) => { if (!busy) setOpen(value); }}>
      <DialogContent className="max-w-3xl max-h-[90dvh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Datenschutztext bearbeiten</DialogTitle>
          <DialogDescription>Änderungen gelten für noch nicht bestätigte DSGVO-Schritte in diesem Büro. Bereits bestätigte Texte und Nachweise bleiben erhalten.</DialogDescription>
        </DialogHeader>
        <Label htmlFor="hr-gdpr-text">Text der Verpflichtung</Label>
        <Textarea id="hr-gdpr-text" className="min-h-0 h-[45dvh] shrink overflow-y-auto" value={text} onChange={e => setText(e.target.value)} maxLength={50000} disabled={busy} />
        <p className="text-sm text-muted-foreground">{text.length.toLocaleString("de-DE")} / 50.000 Zeichen · mindestens 100 Zeichen</p>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Abbrechen</Button>
          <Button onClick={() => void save()} disabled={busy || !isValidDeclaration(text) || text === declaration.text}>
            {busy ? "Wird gespeichert …" : "Neue Fassung speichern"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  </div>;
}
