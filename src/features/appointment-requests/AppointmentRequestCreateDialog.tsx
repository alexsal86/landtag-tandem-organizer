import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarClock, Loader2 } from "lucide-react";
import { notify } from "@/lib/notify";
import { CHANNEL_LABELS, type RequestChannel } from "./logic";
import { useAppointmentRequestMutations, type NewRequestInput } from "./useAppointmentRequests";
import type { RequestPrefill } from "./events";

interface Props {
  open: boolean;
  prefill: RequestPrefill;
  onOpenChange: (open: boolean) => void;
}

const empty = (p: RequestPrefill): NewRequestInput => ({
  title: p.title ?? "",
  requester: p.requester ?? "",
  channel: "email",
  requested_date: p.date ?? "",
  requested_time: p.time ?? "",
  duration_minutes: 60,
  location: p.location ?? "",
  response_deadline: "",
  notes: p.notes ?? "",
});

export function AppointmentRequestCreateDialog({ open, prefill, onOpenChange }: Props) {
  const [form, setForm] = useState<NewRequestInput>(() => empty(prefill));
  const [showMore, setShowMore] = useState(false);
  const { create } = useAppointmentRequestMutations();

  useEffect(() => {
    if (open) {
      setForm(empty(prefill));
      setShowMore(false);
    }
  }, [open, prefill]);

  const set = <K extends keyof NewRequestInput>(k: K, v: NewRequestInput[K]) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.title.trim() || !form.requested_date) {
      notify.error("Bitte Anlass und Datum angeben");
      return;
    }
    try {
      await create.mutateAsync(form);
      notify.success("Anfrage vorgemerkt", { description: "Sie steht jetzt gestrichelt im Kalender." });
      onOpenChange(false);
    } catch (e) {
      notify.error("Anfrage konnte nicht gespeichert werden", { description: e instanceof Error ? e.message : undefined });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-primary" />
            Terminanfrage vormerken
          </DialogTitle>
          <DialogDescription>Erscheint als Platzhalter im Kalender. Entschieden wird im Jour fixe – oder sofort, wenn es eilt.</DialogDescription>
        </DialogHeader>

        <form
          className="grid grid-cols-1 gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <div className="sm:col-span-2">
            <Label htmlFor="req-requester">Wer fragt an?</Label>
            <Input id="req-requester" autoFocus value={form.requester} onChange={(e) => set("requester", e.target.value)} placeholder="z. B. Handwerkskammer Karlsruhe" />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="req-title">Anlass *</Label>
            <Input id="req-title" value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="z. B. Jahresempfang" />
          </div>
          <div>
            <Label htmlFor="req-date">Datum *</Label>
            <Input id="req-date" type="date" value={form.requested_date} onChange={(e) => set("requested_date", e.target.value)} />
          </div>
          <div>
            <Label htmlFor="req-time">Uhrzeit</Label>
            <Input id="req-time" type="time" value={form.requested_time} onChange={(e) => set("requested_time", e.target.value)} />
          </div>
          <div>
            <Label htmlFor="req-location">Ort</Label>
            <Input id="req-location" value={form.location} onChange={(e) => set("location", e.target.value)} placeholder="Wahlkreis, Landtag, Digital …" />
          </div>
          <div>
            <Label>Eingang per</Label>
            <Select value={form.channel} onValueChange={(v) => set("channel", v as RequestChannel)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(CHANNEL_LABELS) as RequestChannel[]).map((c) => (
                  <SelectItem key={c} value={c}>{CHANNEL_LABELS[c]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {showMore ? (
            <>
              <div>
                <Label htmlFor="req-deadline">Rückmeldung bis</Label>
                <Input id="req-deadline" type="date" value={form.response_deadline} onChange={(e) => set("response_deadline", e.target.value)} />
              </div>
              <div>
                <Label htmlFor="req-duration">Dauer (Minuten)</Label>
                <Input id="req-duration" type="number" min={15} step={15} value={form.duration_minutes} onChange={(e) => set("duration_minutes", Math.max(15, Number(e.target.value) || 60))} />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="req-notes">Notiz</Label>
                <Textarea id="req-notes" rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
              </div>
            </>
          ) : (
            <button type="button" className="sm:col-span-2 text-left text-sm text-muted-foreground hover:text-foreground" onClick={() => setShowMore(true)}>
              + Rückmeldefrist, Dauer, Notiz
            </button>
          )}

          <DialogFooter className="sm:col-span-2 gap-2 pt-2">
            <span className="mr-auto self-center text-xs text-muted-foreground">Strg/⌘ + Shift + .</span>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Vormerken
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
