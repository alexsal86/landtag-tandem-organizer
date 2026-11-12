import { useCallback, useEffect, useState } from "react";
import { ShieldCheck, ShieldAlert, Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { notify } from "@/lib/notify";
import {
  LEGAL_BASIS_OPTIONS, SOURCE_ORIGIN_OPTIONS, defaultReviewDate, isReviewDue, labelFor, retentionRuleText,
} from "./retention";

type Privacy = {
  name: string | null; email: string | null; tenant_id: string; retention_status: string | null;
  category: string | null; legal_basis: string | null; source_origin: string | null;
  processing_purpose: string | null; retention_review_date: string | null;
};

const fmt = (d: string | null) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString("de-DE") : "—");

export function ContactPrivacyCard({ contactId }: { contactId: string }) {
  const [data, setData] = useState<Privacy | null>(null);
  const [pendingDeletion, setPendingDeletion] = useState(false);
  const { user } = useAuth();
  const { currentTenant } = useTenant();

  const load = useCallback(async () => {
    const { data: row } = await supabase.from("contacts")
      .select("name, email, tenant_id, retention_status, category, legal_basis, source_origin, processing_purpose, retention_review_date")
      .eq("id", contactId).single();
    setData(row as Privacy | null);
    const { data: req } = await supabase.from("gdpr_requests").select("id")
      .eq("subject_contact_id", contactId).eq("request_type", "delete").in("status", ["pending", "approved"]).limit(1);
    setPendingDeletion((req?.length ?? 0) > 0);
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

  const requestDeletion = async () => {
    if (!user || !currentTenant) return;
    if (!window.confirm("Löschung dieses Kontakts beantragen? Eine zweite berechtigte Person muss die Löschung bestätigen.")) return;
    const { error } = await supabase.from("gdpr_requests").insert({
      tenant_id: currentTenant.id, request_type: "delete", subject_contact_id: contactId,
      subject_name: data.name, subject_email: data.email, reason: "Datenschutz-Prüfung: nicht mehr benötigt", requested_by: user.id,
    });
    if (error) { notify.error("Löschung konnte nicht beantragt werden", { description: "Nur Abgeordnete und Büroleitung dürfen Löschungen beantragen." }); return; }
    notify.success("Löschung beantragt – wartet auf Bestätigung durch eine zweite Person");
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
      {pendingDeletion ? (
        <div className="text-xs font-medium text-destructive">Löschung beantragt – wartet auf Bestätigung (Verwaltung → DSGVO).</div>
      ) : (
        <div className="flex flex-wrap gap-2 pt-1">
          {due && (
            <Button size="sm" variant="outline" onClick={confirm}>
              Weiterhin benötigt – Frist erneuern
            </Button>
          )}
          <Button size="sm" variant="ghost" className="text-destructive" onClick={requestDeletion}>
            <Trash2 className="h-3.5 w-3.5 mr-1" /> Löschung beantragen
          </Button>
        </div>
      )}
    </div>
  );
}
