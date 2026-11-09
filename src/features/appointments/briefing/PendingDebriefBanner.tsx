import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { startOfDay, subDays } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { notify } from "@/lib/notify";
import { needsQuickDebrief, quickDebriefNotes } from "./debriefActions";

/** Start-page hint: yesterday's appointments without notes, with a 3-line quick debrief. */
export function PendingDebriefBanner() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  const qc = useQueryClient();
  const { user } = useAuth();
  const [openId, setOpenId] = useState<string | null>(null);
  const [result, setResult] = useState("");
  const [next, setNext] = useState("");
  const [saving, setSaving] = useState(false);

  const { data = [] } = useQuery({
    queryKey: ["pending-debriefs", tenantId], enabled: !!tenantId, staleTime: 5 * 60_000,
    queryFn: async () => {
      const today = startOfDay(new Date());
      const { data: apts, error } = await supabase.from("appointments").select("id, title")
        .eq("tenant_id", tenantId!).gte("start_time", subDays(today, 1).toISOString()).lt("start_time", today.toISOString()).limit(50);
      if (error) throw error;
      const ids = (apts ?? []).map((a) => a.id);
      if (!ids.length) return [];
      const fb = await supabase.from("appointment_feedback").select("id, appointment_id, notes, feedback_status").in("appointment_id", ids).limit(200);
      if (fb.error) throw fb.error;
      return (apts ?? []).map((a) => ({ ...a, feedback: fb.data?.find((f) => f.appointment_id === a.id) ?? null }))
        .filter((a) => needsQuickDebrief(a.feedback));
    },
  });

  if (!data.length) return null;
  const current = data.find((a) => a.id === openId);

  const save = async () => {
    const notes = quickDebriefNotes(result, next);
    if (!current || !notes) return;
    setSaving(true);
    const { error } = current.feedback
      ? await supabase.from("appointment_feedback").update({ notes }).eq("id", current.feedback.id)
      : await supabase.from("appointment_feedback").insert({ appointment_id: current.id, user_id: user!.id, tenant_id: tenantId!, event_type: "appointment", feedback_status: "pending", notes });
    setSaving(false);
    if (error) return notify.error(error.message);
    setOpenId(null); setResult(""); setNext("");
    notify.success("Stichpunkte gespeichert.");
    void qc.invalidateQueries({ queryKey: ["pending-debriefs", tenantId] });
  };

  return (
    <div className="mb-4 space-y-2 rounded-lg border bg-muted/40 p-3">
      <p className="text-sm font-medium">{data.length === 1 ? "1 Termin von gestern wartet" : `${data.length} Termine von gestern warten`} auf kurze Stichpunkte</p>
      <div className="flex flex-wrap gap-2">
        {data.map((a) => <Button key={a.id} size="sm" variant={a.id === openId ? "default" : "outline"} onClick={() => setOpenId(a.id === openId ? null : a.id)}>{a.title}</Button>)}
      </div>
      {current && (
        <div className="space-y-2">
          <Input placeholder="Ergebnis?" value={result} onChange={(e) => setResult(e.target.value)} aria-label="Ergebnis" />
          <Input placeholder="Nächster Schritt?" value={next} onChange={(e) => setNext(e.target.value)} aria-label="Nächster Schritt" />
          <Button size="sm" onClick={() => void save()} disabled={saving || !quickDebriefNotes(result, next)}>Fertig</Button>
        </div>
      )}
    </div>
  );
}
