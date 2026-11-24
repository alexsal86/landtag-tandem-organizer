import { useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { notify } from "@/lib/notify";
import { shiftDay } from "@/features/tasks/stafette";
import { Paperclip, Sparkles } from "lucide-react";

const CHANNELS = ["E-Mail", "Brief", "Anrufnotiz", "Foto", "Sprachnotiz"] as const;
const CATEGORIES = [
  { value: "legislation", label: "Gesetzgebung" },
  { value: "committee", label: "Ausschuss" },
  { value: "constituency", label: "Wahlkreis" },
  { value: "personal", label: "Persönlich" },
] as const;
const PRIORITIES = [
  { value: "high", label: "Hoch" },
  { value: "medium", label: "Mittel" },
  { value: "low", label: "Niedrig" },
] as const;

interface RawProposal {
  title?: string;
  next_action?: string;
  due_in_days?: number | null;
  priority?: string;
  category?: string;
  topic?: string | null;
  suggested_owner?: string | null;
  reason?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId?: string;
  userId?: string;
  profiles: Array<{ user_id: string; display_name: string | null }>;
  onCreated: () => void | Promise<void>;
}

const toBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? "").replace(/^data:[^;]+;base64,/, ""));
    reader.onerror = () => reject(reader.error ?? new Error("Datei konnte nicht gelesen werden"));
    reader.readAsDataURL(file);
  });

/** Posteingang → Aufgabe: Text, Foto oder Sprachnotiz werden zu einem prüfbaren Vorschlag. */
export function TaskIntakeDialog({ open, onOpenChange, tenantId, userId, profiles, onCreated }: Props) {
  const [text, setText] = useState("");
  const [channel, setChannel] = useState<(typeof CHANNELS)[number]>("E-Mail");
  const [reading, setReading] = useState(false);
  const [proposing, setProposing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reason, setReason] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [dueInDays, setDueInDays] = useState("");
  const [priority, setPriority] = useState<string>("medium");
  const [category, setCategory] = useState<string>("personal");
  const [assignee, setAssignee] = useState<string>("none");
  const fileInput = useRef<HTMLInputElement>(null);

  const reset = () => {
    setText("");
    setChannel("E-Mail");
    setTitle("");
    setNextAction("");
    setDueInDays("");
    setPriority("medium");
    setCategory("personal");
    setAssignee("none");
    setReason(null);
  };

  const readAttachment = async (file: File) => {
    setReading(true);
    try {
      const base64 = await toBase64(file);
      if (file.type.startsWith("image/")) {
        const { data, error } = await supabase.functions.invoke("extract-photo-data", {
          body: { imageBase64: base64, mimeType: file.type, mode: "letter" },
        });
        if (error) throw error;
        const letter = (data as { data?: { letter?: { full_text?: string; subject?: string; body_excerpt?: string } } } | null)?.data?.letter;
        const extracted = [letter?.subject, letter?.full_text ?? letter?.body_excerpt].filter(Boolean).join("\n\n").trim();
        if (!extracted) throw new Error("Im Bild wurde kein Text erkannt");
        setText((current) => [current.trim(), extracted].filter(Boolean).join("\n\n"));
        setChannel("Foto");
      } else if (file.type.startsWith("audio/")) {
        const { data, error } = await supabase.functions.invoke("transcribe-voice-note", {
          body: { audioBase64: base64, mimeType: file.type, language: "de" },
        });
        if (error) throw error;
        const transcript = ((data as { text?: string } | null)?.text ?? "").trim();
        if (!transcript) throw new Error("Die Sprachnotiz konnte nicht transkribiert werden");
        setText((current) => [current.trim(), transcript].filter(Boolean).join("\n\n"));
        setChannel("Sprachnotiz");
      } else {
        throw new Error("Bitte ein Bild oder eine Audiodatei anhängen");
      }
    } catch (error) {
      notify.error("Anhang nicht lesbar", { description: error instanceof Error ? error.message : undefined });
    } finally {
      setReading(false);
    }
  };

  const propose = async () => {
    if (text.trim().length < 10) {
      notify.error("Bitte zuerst den Eingang einfügen (mind. 10 Zeichen)");
      return;
    }
    setProposing(true);
    try {
      const { data: topics } = tenantId
        ? await supabase.from("topics").select("name").eq("tenant_id", tenantId).eq("is_active", true).limit(50)
        : { data: null };
      const { data, error } = await supabase.functions.invoke("propose-task-from-intake", {
        body: {
          text: text.trim(),
          channel,
          today: shiftDay(null, 0),
          people: profiles.map((profile) => profile.display_name).filter(Boolean),
          topics: (topics ?? []).map((topic) => topic.name),
        },
      });
      if (error) throw error;
      const proposal = (data as { proposal?: RawProposal } | null)?.proposal;
      if (!proposal?.title) throw new Error("Die KI hat keinen Titel geliefert");
      setTitle(proposal.title.slice(0, 200));
      setNextAction((proposal.next_action ?? "").slice(0, 300));
      setDueInDays(typeof proposal.due_in_days === "number" ? String(proposal.due_in_days) : "");
      setPriority(proposal.priority === "high" || proposal.priority === "low" ? proposal.priority : "medium");
      setCategory(["legislation", "committee", "constituency", "personal"].includes(proposal.category ?? "") ? proposal.category! : "personal");
      const owner = profiles.find((profile) => profile.display_name === proposal.suggested_owner);
      if (owner) setAssignee(owner.user_id);
      setReason([proposal.reason, proposal.topic ? `Thema: ${proposal.topic}` : null].filter(Boolean).join(" · ") || null);
    } catch (error) {
      notify.error("Vorschlag fehlgeschlagen", { description: error instanceof Error ? error.message : undefined });
    } finally {
      setProposing(false);
    }
  };

  const create = async () => {
    if (!tenantId || !userId) return;
    if (!title.trim()) {
      notify.error("Bitte einen Titel eintragen");
      return;
    }
    setSaving(true);
    try {
      const days = dueInDays.trim() === "" ? null : Number(dueInDays);
      if (days !== null && (!Number.isFinite(days) || days < 0 || days > 365)) {
        notify.error("Frist muss zwischen 0 und 365 Tagen liegen");
        return;
      }
      const timeline: Json = [{
        id: crypto.randomUUID(),
        type: "system",
        at: new Date().toISOString(),
        text: `Aus Posteingang übernommen (${channel})`,
      }];
      const { error } = await supabase.from("tasks").insert({
        tenant_id: tenantId,
        user_id: userId,
        title: title.trim(),
        description: text.trim() || null,
        status: "todo",
        priority,
        category,
        ball_owner: "office",
        ball_assignee_id: assignee === "none" ? null : assignee,
        next_action: nextAction.trim() || null,
        next_action_due: days === null ? null : shiftDay(null, days),
        timeline,
      });
      if (error) throw error;
      notify.success("Aufgabe aus dem Posteingang angelegt");
      reset();
      onOpenChange(false);
      await onCreated();
    } catch (error) {
      notify.error("Aufgabe konnte nicht angelegt werden", { description: error instanceof Error ? error.message : undefined });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) reset(); onOpenChange(next); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Posteingang → Aufgabe</DialogTitle>
          <DialogDescription>
            Eingang einfügen oder Anhang lesen lassen. Der Vorschlag ist nur ein Entwurf und wird erst mit „Aufgabe anlegen“ gespeichert.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-40 flex-1">
              <Label htmlFor="task-intake-channel">Kanal</Label>
              <Select value={channel} onValueChange={(value) => setChannel(value as (typeof CHANNELS)[number])}>
                <SelectTrigger id="task-intake-channel"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CHANNELS.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <input
              ref={fileInput}
              type="file"
              accept="image/*,audio/*"
              className="hidden"
              onChange={(event) => { const file = event.target.files?.[0]; if (file) void readAttachment(file); event.target.value = ""; }}
            />
            <Button type="button" variant="outline" disabled={reading} onClick={() => fileInput.current?.click()}>
              <Paperclip />{reading ? "Liest …" : "Foto oder Sprachnotiz"}
            </Button>
          </div>

          <div>
            <Label htmlFor="task-intake-text">Eingang</Label>
            <Textarea
              id="task-intake-text"
              value={text}
              onChange={(event) => setText(event.target.value)}
              rows={6}
              placeholder="E-Mail, Brieftext, Gesprächsnotiz oder Transkript einfügen …"
            />
          </div>

          <Button type="button" onClick={() => void propose()} disabled={proposing || reading}>
            <Sparkles />{proposing ? "Vorschlag läuft …" : "Vorschlag erzeugen"}
          </Button>

          {(title || nextAction) && (
            <div className="space-y-3 rounded-md border p-3">
              {reason && <p className="text-xs text-muted-foreground">{reason}</p>}
              <div>
                <Label htmlFor="task-intake-title">Titel</Label>
                <Input id="task-intake-title" value={title} maxLength={200} onChange={(event) => setTitle(event.target.value)} />
              </div>
              <div>
                <Label htmlFor="task-intake-next">Nächster Schritt</Label>
                <Input id="task-intake-next" value={nextAction} maxLength={300} onChange={(event) => setNextAction(event.target.value)} />
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <Label htmlFor="task-intake-due">Frist in Tagen (leer = keine)</Label>
                  <Input id="task-intake-due" inputMode="numeric" value={dueInDays} onChange={(event) => setDueInDays(event.target.value.replace(/[^0-9]/g, ""))} />
                </div>
                <div>
                  <Label htmlFor="task-intake-owner">Zuständig</Label>
                  <Select value={assignee} onValueChange={setAssignee}>
                    <SelectTrigger id="task-intake-owner"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Noch offen</SelectItem>
                      {profiles.map((profile) => (
                        <SelectItem key={profile.user_id} value={profile.user_id}>{profile.display_name ?? "Unbenannt"}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="task-intake-priority">Priorität</Label>
                  <Select value={priority} onValueChange={setPriority}>
                    <SelectTrigger id="task-intake-priority"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PRIORITIES.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="task-intake-category">Kategorie</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger id="task-intake-category"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Abbrechen</Button>
          <Button onClick={() => void create()} disabled={saving || !title.trim()}>
            {saving ? "Legt an …" : "Aufgabe anlegen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
