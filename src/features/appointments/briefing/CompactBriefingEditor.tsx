import { useAppointmentBriefing } from "./useBriefing";
import { useBriefingEditorView } from "./useBriefingEditorView";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { notify } from "@/lib/notify";
import type { Json } from "@/integrations/supabase/types";
import { briefingDepthLabel, canCompleteBriefing, dossierExtrasLine, mergeLegacy, saveCompact, type CompactValues } from "./briefingModel";

const CORE = [
  { key: "compact_partners", label: "Gesprächspartner", placeholder: "Wer sitzt uns gegenüber? Name, Funktion" },
  { key: "compact_goal", label: "Anlass & Ziel", placeholder: "Wer will was von wem? 2–3 Sätze" },
  { key: "compact_positions", label: "Unsere Position", placeholder: "Ein Stichpunkt pro Zeile" },
  { key: "compact_documents", label: "Unterlagen", placeholder: "Links, Akten, Dokumente" },
] as const;
const EXTRA = [
  { key: "compact_qa", label: "Kritische Fragen & Antworten", placeholder: "Frage → Antwort" },
  { key: "compact_facts", label: "Fakten & Zitate", placeholder: "Zahlen, Zitate, Quellen" },
  { key: "compact_debrief", label: "Nachbereitung", placeholder: "Was wurde vereinbart?" },
] as const;

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  appointmentId: string;
  title: string;
  preparationId?: string;
  embedded?: boolean;
  onSaved?: () => Promise<void>;
  onShowFull?: () => void;
}

/** Compact editor for the same canonical fields used by the full preparation and PDF. */
export function CompactBriefingEditor({ open, onOpenChange, appointmentId, title, preparationId, embedded = false, onSaved, onShowFull }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { rememberView } = useBriefingEditorView();
  const savedPreparationId = useRef<string | null>(null);
  const { data: briefingAssignment } = useAppointmentBriefing(appointmentId);
  const requestedDepth = briefingAssignment?.briefing_depth;
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const { currentTenant } = useTenant();
  const navigate = useNavigate();
  const [prepId, setPrepId] = useState<string | null>(null);
  const [base, setBase] = useState<Record<string, Json>>({});
  const [values, setValues] = useState<Record<string, string>>({});
  const [extras, setExtras] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [liveNotes, setLiveNotes] = useState<string>("");
  const [status, setStatus] = useState<string | null>(null);
  const [canEdit, setCanEdit] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true); setLoadError(false);
    (async () => {
      let query = supabase.from("appointment_preparations").select("id, preparation_data, created_by").eq("appointment_id", appointmentId).eq("is_archived", false);
      if (preparationId) query = query.eq("id", preparationId);
      const { data, error } = await query.order("created_at", { ascending: true }).limit(1).maybeSingle();
      if (cancelled) return;
      if (error) { setLoadError(true); setLoading(false); notify.error("Briefing konnte nicht geladen werden."); return; }
      const pd = (data?.preparation_data && typeof data.preparation_data === "object" && !Array.isArray(data.preparation_data) ? data.preparation_data : {}) as Record<string, Json>;
      setPrepId(data?.id ?? null);
      savedPreparationId.current = data?.id ?? null;
      setBase(pd);
      const v: Record<string, string> = { ...mergeLegacy(pd) };
      const [{ data: fb }, { data: appt }] = await Promise.all([
        supabase.from("appointment_feedback").select("notes").eq("appointment_id", appointmentId).maybeSingle(),
        supabase.from("appointments").select("briefing_status,briefing_assignee_id,user_id").eq("id", appointmentId).maybeSingle(),
      ]);
      if (cancelled) return;
      setCanEdit(!data || data.created_by === user?.id || appt?.user_id === user?.id || appt?.briefing_assignee_id === user?.id);
      const notes = fb?.notes ?? "";
      setLiveNotes(notes);
      setStatus(appt?.briefing_status ?? null);
      if (!v.compact_debrief && notes) v.compact_debrief = notes;
      setValues(v);
      setDirty(false);
      setLoading(false);
      setExtras(EXTRA.filter((f) => v[f.key]).map((f) => f.key));
    })();
    return () => { cancelled = true; };
  }, [open, appointmentId, preparationId, user?.id]);

  const save = async (close = true): Promise<boolean> => {
    if (!user || !currentTenant || loading || loadError || !canEdit || saving) return false;
    if (!dirty && prepId) {
      rememberView(prepId, "compact");
      if (close && !embedded) onOpenChange(false);
      return true;
    }
    setSaving(true);
    try {
      const preparation_data = saveCompact(base, values as CompactValues) as Record<string, Json>;
      const res = prepId
        ? await supabase.from("appointment_preparations").update({ preparation_data }).eq("id", prepId).select("id").single()
        : await supabase.from("appointment_preparations").insert({ appointment_id: appointmentId, tenant_id: currentTenant.id, created_by: user.id, title, status: "in_progress", preparation_data }).select("id").single();
      if (res.error) { notify.error(res.error.message); return false; }
      setPrepId(res.data.id);
      savedPreparationId.current = res.data.id;
      rememberView(res.data.id, "compact");
      setBase(preparation_data);
      setDirty(false);
      void queryClient.invalidateQueries({ queryKey: ["appointment-briefing"] });
      if (onSaved) await onSaved();
      notify.success("Briefing gespeichert.");
      if (close && !embedded) onOpenChange(false);
      return true;
    } catch {
      notify.error("Briefing konnte nicht gespeichert werden.");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const openDossier = async () => {
    if (canEdit && dirty && !(await save(false))) return;
    const targetId = savedPreparationId.current ?? prepId;
    if (targetId) rememberView(targetId, "full");
    if (onShowFull) { onShowFull(); return; }
    navigate(targetId ? `/appointment-preparation/${targetId}?view=${canEdit ? "preparation" : "briefing"}&depth=full` : `/appointment-preparation?appointmentId=${appointmentId}&view=preparation&depth=full`);
  };

  const complete = async () => {
    if (!(await save(false))) return;
    const { error } = await supabase.rpc("complete_appointment_briefing", { _appointment_id: appointmentId });
    if (error) { notify.error(error.message); return; }
    notify.success("Briefing abgeschlossen.");
  };
  const extrasLine = dossierExtrasLine(base);

  const field = (f: { key: string; label: string; placeholder: string }) => (
    <div key={f.key} className="space-y-1">
      <label className="text-caption font-medium text-muted-foreground">{f.label}</label>
      <Textarea readOnly={!canEdit || loading || loadError} rows={3} value={values[f.key] ?? ""} placeholder={f.placeholder} onChange={(e) => { setDirty(true); setValues((s) => ({ ...s, [f.key]: e.target.value })); }} />
    </div>
  );

  const heading = embedded ? (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-lg font-semibold">Terminvorbereitung</h2>
      <div className="inline-flex rounded-md border p-1" role="group" aria-label="Briefing-Ansicht">
        <Button size="sm" variant="default" aria-pressed={true}>Kurzbriefing</Button>
        <Button size="sm" variant="ghost" aria-pressed={false} disabled={saving || loading || loadError} onClick={() => void openDossier()}>Langbriefing</Button>
      </div>
    </div>
  ) : (
    <DialogHeader>
      <div className="flex items-center justify-between gap-2 pr-6">
        <DialogTitle>Briefing: {title}</DialogTitle>
        <Button size="sm" variant="ghost" disabled={saving || loading || loadError} onClick={() => void openDossier()}>Langbriefing</Button>
      </div>
    </DialogHeader>
  );
  const content = <>
    {heading}
    {!embedded && <div className="rounded-md bg-muted/50 px-3 py-2 text-sm"><p className="font-medium">Beauftragtes Briefing: {loading ? "Wird geladen…" : status === "none" ? "Kein Briefing beauftragt" : status === "undecided" ? "Noch nicht beauftragt" : briefingDepthLabel(requestedDepth)}</p><p className="mt-1 text-xs text-muted-foreground">Der Ansichtswechsel ändert den Auftrag nicht.</p></div>}
        {!loading && !canEdit && <p className="text-sm text-muted-foreground">Für das Team sichtbar · Bearbeitung durch die beauftragte Person.</p>}
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
          <Button variant="link" className="px-0" onClick={openDossier} disabled={saving || loading || loadError}>{canEdit ? "Zum Dossier erweitern" : "Dossier ansehen"}</Button>
          <div className="flex gap-2">
            {canEdit && canCompleteBriefing(status, values.compact_debrief ?? "") && <Button variant="outline" onClick={complete} disabled={saving}>Nachbereitet – abschließen</Button>}
            {canEdit && <Button onClick={() => void save()} disabled={saving || loading || loadError}>Speichern</Button>}
          </div>
        </div>
  </>;

  return embedded ? <div className="mt-4 space-y-4 rounded-lg border bg-card p-4">{content}</div> : (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">{content}</DialogContent>
    </Dialog>
  );
}
