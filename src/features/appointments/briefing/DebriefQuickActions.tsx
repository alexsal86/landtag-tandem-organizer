import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { notify } from "@/lib/notify";
import { debriefTopic, promiseTask } from "./debriefActions";

interface Props { appointmentId: string; title: string; debrief: string; preparationId?: string | null }
interface ContactOption { id: string; name: string }

/** Quick actions under the debrief: editorial hand-off, promise tracker, contact insight. */
export function DebriefQuickActions({ appointmentId, title, debrief, preparationId }: Props) {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const [contacts, setContacts] = useState<ContactOption[]>([]);
  const [contactId, setContactId] = useState("");
  const [promise, setPromise] = useState("");
  const [due, setDue] = useState("");
  const [insight, setInsight] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.from("appointment_contacts").select("contact_id, contacts(id, name)").eq("appointment_id", appointmentId).limit(50);
      const list = (data ?? []).flatMap((row) => (row.contacts ? [{ id: row.contacts.id, name: row.contacts.name }] : []));
      setContacts(list);
      if (list[0]) setContactId(list[0].id);
    })();
  }, [appointmentId]);

  const contactName = contacts.find((c) => c.id === contactId)?.name ?? null;

  const toRedaktion = async () => {
    if (!currentTenant || !user) return;
    setBusy("redaktion");
    const profile = await supabase.from("profiles").select("id").eq("user_id", user.id).maybeSingle();
    const { error } = await supabase.from("topic_backlog").insert({ tenant_id: currentTenant.id, created_by: profile.data?.id ?? user.id, ...debriefTopic(title, debrief) });
    setBusy(null);
    if (error) return notify.error("Konnte nicht an die Redaktion übergeben werden.");
    notify.success("Thema liegt jetzt im Themenspeicher der Redaktion.");
  };

  const savePromise = async () => {
    const task = promiseTask(promise, contactName);
    if (!task) return;
    setBusy("promise");
    const { error } = await supabase.rpc("create_briefing_follow_up_task", {
      _appointment_id: appointmentId, _title: task.title, _description: task.description,
      _due: due ? new Date(`${due}T12:00:00`).toISOString() : undefined, _priority: "high",
    });
    setBusy(null);
    if (error) return notify.error("Zusage konnte nicht gespeichert werden.");
    setPromise(""); setDue("");
    notify.success("Zusage als Aufgabe angelegt – sie liegt jetzt bei dir.");
  };

  const saveInsight = async () => {
    if (!currentTenant || !contactId || !insight.trim()) return;
    setBusy("insight");
    const { error } = await supabase.from("contact_briefing_memory").insert({
      tenant_id: currentTenant.id, contact_id: contactId, kind: "role_note", content: insight.trim(),
      source_preparation_id: preparationId ?? null, pinned_by: user?.id ?? null,
    });
    setBusy(null);
    if (error) return notify.error("Erkenntnis konnte nicht gespeichert werden.");
    setInsight("");
    notify.success("Gemerkt – wird beim nächsten Briefing vorgeschlagen.");
  };

  return (
    <div className="space-y-3 rounded-md border border-dashed p-3">
      <p className="section-label">Aus der Nachbereitung weitergeben</p>
      <Button size="sm" variant="outline" onClick={() => void toRedaktion()} disabled={busy !== null}>In die Redaktion geben</Button>
      <div className="flex flex-wrap items-center gap-2">
        <Input className="min-w-[200px] flex-1" placeholder="Zusage, z. B. „Wir haken beim Ministerium nach“" value={promise} onChange={(e) => setPromise(e.target.value)} aria-label="Zusage" />
        <Input type="date" className="w-40" value={due} onChange={(e) => setDue(e.target.value)} aria-label="Frist der Zusage" />
        <Button size="sm" onClick={() => void savePromise()} disabled={busy !== null || !promise.trim()}>Zusage festhalten</Button>
      </div>
      {contacts.length > 0 ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <span>Wichtig für künftige Treffen mit</span>
            <select className="rounded-md border bg-background px-2 py-1 text-sm" value={contactId} onChange={(e) => setContactId(e.target.value)} aria-label="Kontakt">
              {contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <Textarea rows={2} value={insight} onChange={(e) => setInsight(e.target.value)} placeholder="z. B. Legt Wert auf einen Anruf vor Pressemitteilungen." />
          <Button size="sm" variant="outline" onClick={() => void saveInsight()} disabled={busy !== null || !insight.trim()}>Beim Kontakt merken</Button>
        </div>
      ) : <p className="text-caption text-muted-foreground">Für Erkenntnisse zu Personen zuerst Kontakte am Termin hinterlegen.</p>}
    </div>
  );
}
