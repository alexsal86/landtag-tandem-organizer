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
  { key: "compact_goal", label: "Anlass & Ziel", placeholder: "Wer will was von wem? 2–3 Sätze" },
  { key: "compact_positions", label: "Unsere Position", placeholder: "Ein Stichpunkt pro Zeile" },
  { key: "compact_documents", label: "Unterlagen", placeholder: "Links, Akten, Dokumente" },
] as const;
const EXTRA = [
  { key: "compact_qa", label: "Kritische Fragen & Antworten", placeholder: "Frage → Antwort" },
  { key: "compact_facts", label: "Fakten & Zitate", placeholder: "Zahlen, Zitate, Quellen" },
  { key: "compact_debrief", label: "Nachbereitung", placeholder: "Was wurde vereinbart?" },
] as const;

interface Props { open: boolean; onOpenChange: (o: boolean) => void; appointmentId: string; title: string }

/** One-pager briefing stored in appointment_preparations.preparation_data (compact_* keys). */
export function CompactBriefingEditor({ open, onOpenChange, appointmentId, title }: Props) {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const navigate = useNavigate();
  const [prepId, setPrepId] = useState<string | null>(null);
  const [base, setBase] = useState<Record<string, Json>>({});
  const [values, setValues] = useState<Record<string, string>>({});
  const [extras, setExtras] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data } = await supabase.from("appointment_preparations").select("id, preparation_data")
        .eq("appointment_id", appointmentId).eq("is_archived", false).order("created_at", { ascending: true }).limit(1).maybeSingle();
      const pd = (data?.preparation_data && typeof data.preparation_data === "object" && !Array.isArray(data.preparation_data) ? data.preparation_data : {}) as Record<string, Json>;
      setPrepId(data?.id ?? null);
      setBase(pd);
      const v: Record<string, string> = {};
      for (const f of [...CORE, ...EXTRA]) v[f.key] = typeof pd[f.key] === "string" ? (pd[f.key] as string) : "";
      setValues(v);
      setExtras(EXTRA.filter((f) => v[f.key]).map((f) => f.key));
    })();
  }, [open, appointmentId]);

  const save = async () => {
    if (!user || !currentTenant) return;
    setSaving(true);
    const preparation_data = { ...base, ...values };
    const res = prepId
      ? await supabase.from("appointment_preparations").update({ preparation_data }).eq("id", prepId)
      : await supabase.from("appointment_preparations").insert({ appointment_id: appointmentId, tenant_id: currentTenant.id, created_by: user.id, title: `Briefing: ${title}`, status: "in_progress", preparation_data });
    setSaving(false);
    if (res.error) { notify.error(res.error.message); return; }
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
          <Button variant="link" className="px-0" onClick={() => navigate(`/appointment-preparation?appointmentId=${appointmentId}`)}>Ausführliche Ansicht</Button>
          <Button onClick={save} disabled={saving}>Speichern</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
