import { normalizeBriefingData, type AppointmentPreparation } from "@/hooks/useAppointmentPreparation";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { notify } from "@/lib/notify";
import type { Json } from "@/integrations/supabase/types";
import { canCompleteBriefing, dossierExtrasLine, mergeLegacy, saveCompact, type CompactValues } from "./briefingModel";

const CORE = [
  { key: "compact_partners", label: "Gesprächspartner", placeholder: "Wer sitzt uns gegenüber? Name, Funktion" },
  { key: "visit_reason_details", label: "Anlass & Ziel", placeholder: "Wer will was von wem? 2–3 Sätze" },
  { key: "position_statements", label: "Unsere Position", placeholder: "Ein Stichpunkt pro Zeile" },
  { key: "talking_points", label: "Talking Points", placeholder: "Ein Gesprächspunkt pro Zeile" },
  { key: "materials_needed", label: "Unterlagen", placeholder: "Links, Akten, Dokumente" },
] as const;
const EXTRA = [
  { key: "questions_answers", label: "Kritische Fragen & Antworten", placeholder: "Frage → Antwort" },
  { key: "facts_figures", label: "Fakten & Zitate", placeholder: "Zahlen, Zitate, Quellen" },
  { key: "debrief_summary", label: "Nachbereitung", placeholder: "Was wurde vereinbart?" },
] as const;

interface Props { open: boolean; onOpenChange: (o: boolean) => void; appointmentId: string; title: string }

/** Compact editor for the same canonical fields used by the full preparation and PDF. */
export function CompactBriefingEditor({ open, onOpenChange, appointmentId, title }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const { currentTenant } = useTenant();
  const navigate = useNavigate();
  const [prepId, setPrepId] = useState<string | null>(null);
  const [base, setBase] = useState<Record<string, Json>>({});
  const [values, setValues] = useState<Record<string, string>>({});
  const [extras, setExtras] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [liveNotes, setLiveNotes] = useState<string>("");
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true); setLoadError(false);
    (async () => {
      const { data, error } = await supabase.from("appointment_preparations").select("id, preparation_data")
        .eq("appointment_id", appointmentId).eq("is_archived", false).order("created_at", { ascending: true }).limit(1).maybeSingle();
      if (cancelled) return;
      if (error) { setLoadError(true); setLoading(false); notify.error("Briefing konnte nicht geladen werden."); return; }
      const pd = (data?.preparation_data && typeof data.preparation_data === "object" && !Array.isArray(data.preparation_data) ? data.preparation_data : {}) as Record<string, Json>;
      setPrepId(data?.id ?? null);
      setBase(pd);
      const v: Record<string, string> = { ...mergeLegacy(pd) };
      const [{ data: fb }, { data: appt }] = await Promise.all([
        supabase.from("appointment_feedback").select("notes").eq("appointment_id", appointmentId).maybeSingle(),
        supabase.from("appointments").select("briefing_status").eq("id", appointmentId).maybeSingle(),
      ]);
      const notes = fb?.notes ?? "";
      setLiveNotes(notes);
      setStatus(appt?.briefing_status ?? null);
      if (!v.compact_debrief && notes) v.compact_debrief = notes;
      setValues(v);
      setLoading(false);
      setExtras(EXTRA.filter((f) => v[f.key]).map((f) => f.key));
    })();
    return () => { cancelled = true; };
  }, [open, appointmentId]);

  const save = async () => {
    if (!user || !currentTenant || loading || loadError) return;
    setSaving(true);
    const preparation_data = saveCompact(base, values as CompactValues) as Record<string, Json>;
    const res = prepId
      ? await supabase.from("appointment_preparations").update({ preparation_data }).eq("id", prepId)
      : await supabase.from("appointment_preparations").insert({ appointment_id: appointmentId, tenant_id: currentTenant.id, created_by: user.id, title: `Briefing: ${title}`, status: "in_progress", preparation_data });
    setSaving(false);
    if (res.error) { notify.error(res.error.message); return; }
    void queryClient.invalidateQueries({ queryKey: ["appointment-briefing"] });
    notify.success("Briefing gespeichert.");
    onOpenChange(false);
  };

  const openDossier = async () => {
    await supabase.rpc("set_appointment_briefing_depth", { _appointment_id: appointmentId, _depth: "full" });
    navigate(`/appointment-preparation?appointmentId=${appointmentId}`);
  };

  const complete = async () => {
    await save();
    const { error } = await supabase.rpc("complete_appointment_briefing", { _appointment_id: appointmentId });
    if (error) { notify.error(error.message); return; }
    notify.success("Briefing abgeschlossen.");
  };
  const extrasLine = dossierExtrasLine(base);

  const field = (f: { key: string; label: string; placeholder: string }) => (
    <div key={f.key} className="space-y-1">
      <label className="text-caption font-medium text-muted-foreground">{f.label}</label>
      <Textarea rows={3} value={values[f.key] ?? ""} placeholder={f.placeholder} onChange={(e) => setValues((s) => ({ ...s, [f.key]: e.target.value }))} />
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2 pr-6">
            <DialogTitle>Briefing: {title}</DialogTitle>
            <div className="flex rounded-md border p-0.5 text-caption">
              <span className="rounded-sm bg-muted px-2 py-0.5 font-medium">Kompakt</span>
              <button type="button" className="px-2 py-0.5 text-muted-foreground hover:text-foreground" onClick={openDossier}>Dossier</button>
            </div>
          </div>
        </DialogHeader>
        {extrasLine && <p className="rounded-md bg-muted/50 px-3 py-2 text-caption text-muted-foreground">{extrasLine}</p>}
        <div className="space-y-3">
          {CORE.map(field)}
          {EXTRA.filter((f) => extras.includes(f.key)).map(field)}
          <div className="flex flex-wrap gap-2">
            {EXTRA.filter((f) => !extras.includes(f.key)).map((f) => (
              <Button key={f.key} size="sm" variant="ghost" onClick={() => setExtras((s) => [...s, f.key])}>+ {f.label}</Button>
            ))}
          </div>
        </div>
        <div className="flex justify-between gap-2 pt-2">
          <Button variant="link" className="px-0" onClick={openDossier}>Zum Dossier erweitern</Button>
          <div className="flex gap-2">
            {canCompleteBriefing(status, values.compact_debrief ?? "") && <Button variant="outline" onClick={complete} disabled={saving}>Nachbereitet – abschließen</Button>}
            <Button onClick={save} disabled={saving}>Speichern</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
