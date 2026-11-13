import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { GDPR_DECLARATION, DEFAULT_GDPR_DECLARATION, hasReadToEnd, type GdprDeclaration } from "./gdpr";

export function GdprDeclarationDialog({ busy, completed, canConfirm, onConfirm, declarationText, declarationVersion, currentDeclaration = DEFAULT_GDPR_DECLARATION }: {
  busy: boolean; completed: boolean; canConfirm: boolean; onConfirm: (version: string) => Promise<boolean>;
  currentDeclaration?: GdprDeclaration;
  declarationText?: string | null; declarationVersion?: string | null;
}) {
  const [displayed, setDisplayed] = useState(currentDeclaration);
  const [open, setOpen] = useState(false);
  const [read, setRead] = useState(false);
  const [error, setError] = useState("");
  const confirm = async () => {
    setError("");
    try {
      if (await onConfirm(displayed.version)) setOpen(false);
      else setError("Bestätigung fehlgeschlagen. Bitte schließen Sie den Dialog und öffnen Sie die aktuelle Fassung erneut.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bestätigung fehlgeschlagen.");
    }
  };
  return <Dialog open={open} onOpenChange={(value) => { if (!busy) { setOpen(value); setRead(false); } }}>
    <Button variant="outline" onClick={() => { setRead(false); setError(""); setDisplayed(currentDeclaration); setOpen(true); }}>DSGVO-Verpflichtung öffnen</Button>
    <DialogContent className="max-w-2xl max-h-[90dvh] flex flex-col">
      <DialogHeader>
        <DialogTitle>{GDPR_DECLARATION.title}</DialogTitle>
        <DialogDescription>Version {declarationVersion ?? displayed.version} · Bitte vollständig lesen und bis zum Ende scrollen.</DialogDescription>
      </DialogHeader>
      <div ref={(el) => { if (el && hasReadToEnd(el.scrollTop, el.clientHeight, el.scrollHeight)) setRead(true); }} role="region" aria-label="Text der DSGVO-Verpflichtung" tabIndex={0}
        className="min-h-0 overflow-y-auto max-h-[55dvh] space-y-4 pr-3"
        onScroll={(event) => { const el = event.currentTarget; if (hasReadToEnd(el.scrollTop, el.clientHeight, el.scrollHeight)) setRead(true); }}>
        <p className="whitespace-pre-wrap text-sm">{declarationText ?? displayed.text}</p>
        <p className="font-semibold">Ende der Verpflichtung</p>
      </div>
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {completed ? (declarationVersion ? "Die persönliche Bestätigung wurde gespeichert." : "Dieser Schritt wurde bereits mit einem bisherigen Nachweis abgeschlossen. Hier sehen Sie die aktuelle Mustervorlage.") : !canConfirm ? "Nur die betroffene Person kann diese Verpflichtung selbst bestätigen." : read ? "Sie können die Verpflichtung jetzt persönlich bestätigen. Benutzerkonto, Zeitpunkt und Textversion werden gespeichert." : "Die Bestätigung wird nach dem Scrollen bis zum Textende freigeschaltet."}
      </p>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {!completed && canConfirm && <Button disabled={!read || busy} onClick={() => void confirm()}>
        {busy ? "Wird gespeichert …" : "Gelesen und verstanden – verbindlich bestätigen"}
      </Button>}
    </DialogContent>
  </Dialog>;
}
