import { useCallback, useEffect, useState } from "react";
import { ShieldCheck, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { notify } from "@/lib/notify";
import {
  LEGAL_BASIS_OPTIONS, SOURCE_ORIGIN_OPTIONS, defaultReviewDate, isReviewDue, labelFor, retentionRuleText,
} from "./retention";

type Privacy = {
  category: string | null; legal_basis: string | null; source_origin: string | null;
  processing_purpose: string | null; retention_review_date: string | null;
};

const fmt = (d: string | null) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString("de-DE") : "—");

export function ContactPrivacyCard({ contactId }: { contactId: string }) {
  const [data, setData] = useState<Privacy | null>(null);

  const load = useCallback(async () => {
    const { data: row } = await supabase.from("contacts")
      .select("category, legal_basis, source_origin, processing_purpose, retention_review_date")
      .eq("id", contactId).single();
    setData(row as Privacy | null);
  }, [contactId]);

  useEffect(() => { void load(); }, [load]);
  if (!data) return null;

  const due = isReviewDue(data.retention_review_date);
  const confirm = async () => {
    const next = defaultReviewDate(data.category);
    const { error } = await supabase.from("contacts")
      .update({ retention_review_date: next, retention_status: "active" }).eq("id", contactId);
    if (error) { notify.error("Prüfung konnte nicht bestätigt werden"); return; }
    notify.success(`Weiterhin benötigt – nächste Prüfung am ${fmt(next)}`);
    void load();
  };

  return (
    <div className={`rounded-md border p-3 text-sm space-y-1 ${due ? "border-warning bg-warning/10" : "border-border bg-muted/30"}`}>
      <div className="flex items-center gap-2 font-medium">
        {due ? <ShieldAlert className="h-4 w-4 text-warning" /> : <ShieldCheck className="h-4 w-4 text-primary" />}
        Datenschutz {due ? "– Prüfung fällig" : ""}
      </div>
      <div className="text-muted-foreground">Rechtsgrundlage: {labelFor(LEGAL_BASIS_OPTIONS, data.legal_basis)}</div>
      <div className="text-muted-foreground">Herkunft: {labelFor(SOURCE_ORIGIN_OPTIONS, data.source_origin)}{data.processing_purpose ? ` · Zweck: ${data.processing_purpose}` : ""}</div>
      <div className="text-muted-foreground">Nächste Prüfung: {fmt(data.retention_review_date)}</div>
      <div className="text-xs text-muted-foreground">{retentionRuleText(data.category)}</div>
      {due && (
        <Button size="sm" variant="outline" className="mt-1" onClick={confirm}>
          Weiterhin benötigt – Frist erneuern
        </Button>
      )}
    </div>
  );
}
