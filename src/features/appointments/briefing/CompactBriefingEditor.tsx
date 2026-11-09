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
      const canonical = normalizeBriefingData(pd as AppointmentPreparation["preparation_data"]);
      setBase(canonical as Record<string, Json>);
      const v: Record<string, string> = {};
      for (const f of [...CORE, ...EXTRA]) v[f.key] = typeof canonical[f.key as keyof typeof canonical] === "string" ? String(canonical[f.key as keyof typeof canonical]) : "";
      v.compact_partners = (canonical.conversation_partners ?? []).map(p => p.name).join("\n");
      v.position_statements = canonical.position_statements ?? "";
      v.questions_answers = canonical.questions_answers || (canonical.qa_pairs ?? []).map(q => `${q.question} → ${q.answer}`).join("\n");
      setValues(v);
      setLoading(false);
      setExtras(EXTRA.filter((f) => v[f.key]).map((f) => f.key));
    })();
    return () => { cancelled = true; };
  }, [open, appointmentId]);

  const save = async () => {
    if (!user || !currentTenant || loading || loadError) return;
    setSaving(true);
    const { compact_partners, ...fields } = values;
    const canonicalBase = { ...base };
    for (const key of Object.keys(canonicalBase)) if (key.startsWith("compact_")) delete canonicalBase[key];
    const previous = (base.conversation_partners ?? []) as unknown as Array<{id: string; name: string}>;
    const canonical = normalizeBriefingData(base as AppointmentPreparation["preparation_data"]);
    const talkingPoints = fields.talking_points === canonical.talking_points
      ? canonical.talking_point_items ?? []
      : (fields.talking_points ?? "").split("\n").filter(p => p.trim()).map(point => ({ id: crypto.randomUUID(), point, background: "" }));
    const qaPairs = fields.questions_answers === canonical.questions_answers
      ? canonical.qa_pairs ?? []
      : (fields.questions_answers ?? "").split("\n").filter(q => q.trim()).map(line => {
          const [question, ...answer] = line.split("→");
          return { id: crypto.randomUUID(), question: question.trim(), answer: answer.join("→").trim() };
        });
    const preparation_data = {
      ...canonicalBase, ...fields,
      talking_point_items: talkingPoints,
      qa_pairs: qaPairs,
      conversation_partners: (compact_partners ?? "").split("\n").filter(n => n.trim()).map((name, i) => ({ ...previous[i], id: previous[i]?.id ?? crypto.randomUUID(), name })),
    };
    const res = prepId
      ? await supabase.from("appointment_preparations").update({ preparation_data }).eq("id", prepId)
      : await supabase.from("appointment_preparations").insert({ appointment_id: appointmentId, tenant_id: currentTenant.id, created_by: user.id, title: `Briefing: ${title}`, status: "in_progress", preparation_data });
    setSaving(false);
    if (res.error) { notify.error(res.error.message); return; }
    void queryClient.invalidateQueries({ queryKey: ["appointment-briefing"] });
    notify.success("Briefing gespeichert.");
    onOpenChange(false);
  };

  const field = (f: { key: string; label: string; placeholder: string }) => (
    <div key={f.key} className="space-y-1">
      <label className="text-caption font-medium text-muted-foreground">{f.label}</label>
      <Textarea rows={3} value={values[f.key] ?? ""} placeholder={f.placeholder} onChange={(e) => setValues((s) => ({ ...s, [f.key]: e.target.value }))} />
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>Briefing: {title}</DialogTitle></DialogHeader>
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
          <Button variant="link" className="px-0" onClick={() => navigate(prepId ? `/appointment-preparation/${prepId}` : `/appointment-preparation?appointmentId=${appointmentId}&title=${encodeURIComponent(title)}`)}>Ausführliche Ansicht</Button>
          <Button onClick={save} disabled={saving || loading || loadError}>Speichern</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
