import { useId, useState } from "react";
import { MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { notify } from "@/lib/notify";
import { readOfficeFeedbackDraft, writeOfficeFeedbackDraft } from "@/features/appointments/briefing/officeFeedbackDraft";

export function RunningAppointmentFeedback({ draftKey }: { draftKey: string }) {
  const panel = useId();
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(() => readOfficeFeedbackDraft(draftKey));
  const [draft, setDraft] = useState(saved);

  return <div className="space-y-2">
    <Button type="button" className="bg-[#38761c] text-white hover:bg-[#2b5e15]" aria-expanded={open} aria-controls={open ? panel : undefined}
      onClick={() => { if (!open) setDraft(saved); setOpen(!open); }}>
      <MessageSquare aria-hidden="true" />{saved ? "Rückmeldung bearbeiten" : "Rückmeldung hinterlegen"}
    </Button>
    {open && <form id={panel} className="space-y-2" onSubmit={event => {
      event.preventDefault();
      try {
        const value = draft.trim();
        writeOfficeFeedbackDraft(draftKey, value);
        setSaved(value);
        setOpen(false);
        notify.success(value ? "Entwurf gespeichert." : "Entwurf entfernt.");
      } catch {
        notify.error("Entwurf konnte in diesem Browser nicht gespeichert werden.");
      }
    }}>
      <Textarea autoFocus aria-label="Rückmeldung zum laufenden Termin" placeholder="Was soll das Büro wissen?"
        rows={3} maxLength={12000} value={draft} onChange={event => setDraft(event.target.value)} />
      <p className="text-xs text-muted-foreground">Den Entwurf kannst du nach dem Termin unter „Rückmeldung ans Büro“ senden.</p>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={!draft.trim() && !saved}>Entwurf speichern</Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Abbrechen</Button>
      </div>
    </form>}
  </div>;
}
