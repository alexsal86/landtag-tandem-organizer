import { supabase } from "@/integrations/supabase/client";
import type { TestScenario } from "../types";
import { SELFTEST_MARKER, SELFTEST_PREFIX } from "../runner";
import { describeError, expectFields } from "../verify";

const tag = (run: string, label: string) => `${SELFTEST_PREFIX} ${label} (${run})`;

export const letterLifecycleScenario: TestScenario = {
  id: "letter-lifecycle",
  title: "Brief-Lifecycle (Entwurf → Prüfung → Genehmigt → Versendet)",
  description:
    "Erstellt einen Brief, hängt eine Anlage an, durchläuft den Workflow draft → review → approved → sent inkl. verknüpfter Entscheidung. Jeder Schritt liest seine geschriebenen Felder zurück.",
  touches: ["letters", "letter_attachments", "task_decisions"],
  features: ["letters", "decisions"],
  writes: [
    { table: "letters", columns: ["title", "subject", "content", "content_html", "status", "created_by", "tenant_id", "letter_date", "recipient_name", "recipient_address", "submitted_for_review_at", "submitted_for_review_by", "submitted_to_user", "approved_at", "approved_by", "sent_at", "sent_by", "sent_method", "sent_date"] },
    { table: "letter_attachments", columns: ["letter_id", "file_name", "file_path", "file_type", "file_size", "uploaded_by"] },
    { table: "task_decisions", columns: ["title", "description", "status", "created_by", "tenant_id", "visible_to_all"] },
  ],
  steps: [
    {
      id: "create-letter",
      label: "Brief anlegen (draft)",
      run: async (ctx) => {
        const payload = {
          title: tag(ctx.runId, "Brief"),
          subject: tag(ctx.runId, "Betreff"),
          content: `${SELFTEST_MARKER} Inhalt`,
          content_html: `<p>${SELFTEST_MARKER} Inhalt</p>`,
          status: "draft",
          created_by: ctx.userId,
          tenant_id: ctx.tenantId,
          letter_date: new Date().toISOString().slice(0, 10),
        };
        const { data, error } = await supabase.from("letters").insert(payload).select("id").single();
        if (error || !data) return { ok: false, message: describeError(error) };
        ctx.created.push({ table: "letters", id: data.id });
        ctx.data.letterId = data.id;
        return expectFields("letters", data.id, payload, "Brief");
      },
    },
    {
      id: "add-attachment",
      label: "Anlage anhängen",
      critical: false,
      run: async (ctx) => {
        const payload = {
          letter_id: ctx.data.letterId as string,
          file_name: tag(ctx.runId, "Anlage") + ".pdf",
          file_path: `${ctx.userId}/selftest/letter-${ctx.runId}.pdf`,
          file_type: "application/pdf",
          file_size: 2048,
          uploaded_by: ctx.userId,
        };
        const { data, error } = await supabase.from("letter_attachments").insert(payload).select("id").single();
        if (error || !data) return { ok: false, message: describeError(error) };
        ctx.created.push({ table: "letter_attachments", id: data.id });
        return expectFields("letter_attachments", data.id, payload, "Anlage");
      },
    },
    {
      id: "set-recipient",
      label: "Empfänger setzen",
      run: async (ctx) => {
        const id = ctx.data.letterId as string;
        const update = {
          recipient_name: `${SELFTEST_MARKER} Max Mustermann`,
          recipient_address: `${SELFTEST_MARKER}\nMusterstraße 1\n12345 Musterstadt`,
        };
        const { error } = await supabase.from("letters").update(update).eq("id", id);
        if (error) return { ok: false, message: describeError(error) };
        return expectFields("letters", id, update, "Empfänger");
      },
    },
    {
      id: "submit-review",
      label: "Zur Prüfung einreichen (review)",
      run: async (ctx) => {
        const id = ctx.data.letterId as string;
        const update = {
          status: "review",
          submitted_for_review_at: new Date().toISOString(),
          submitted_for_review_by: ctx.userId,
          submitted_to_user: ctx.userId,
        };
        const { error } = await supabase.from("letters").update(update).eq("id", id);
        if (error) return { ok: false, message: describeError(error) };
        return expectFields("letters", id, update, "Review");
      },
    },
    {
      id: "approve",
      label: "Genehmigen (approved)",
      run: async (ctx) => {
        const id = ctx.data.letterId as string;
        const update = {
          status: "approved",
          approved_at: new Date().toISOString(),
          approved_by: ctx.userId,
        };
        const { error } = await supabase.from("letters").update(update).eq("id", id);
        if (error) return { ok: false, message: describeError(error) };
        return expectFields("letters", id, update, "Approval");
      },
    },
    {
      id: "link-decision",
      label: "Verknüpfte Entscheidung anlegen",
      critical: false,
      run: async (ctx) => {
        const { data, error } = await supabase
          .from("task_decisions")
          .insert({
            title: tag(ctx.runId, "Brief-Entscheidung"),
            description: `${SELFTEST_MARKER} Bitte freigeben`,
            status: "active",
            created_by: ctx.userId,
            tenant_id: ctx.tenantId,
            visible_to_all: false,
          })
          .select("id")
          .single();
        if (error || !data) return { ok: false, message: error?.message ?? "Insert leer" };
        ctx.created.push({ table: "task_decisions", id: data.id });
        return { ok: true, message: "Entscheidung angelegt." };
      },
    },
    {
      id: "send",
      label: "Versenden (sent)",
      run: async (ctx) => {
        const { error } = await supabase
          .from("letters")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
            sent_by: ctx.userId,
            sent_method: "email",
            sent_date: new Date().toISOString().slice(0, 10),
          })
          .eq("id", ctx.data.letterId as string);
        if (error) return { ok: false, message: error.message };
        return { ok: true, message: "Versendet." };
      },
    },
    {
      id: "verify",
      label: "Verifikation",
      run: async (ctx) => {
        const letterId = ctx.data.letterId as string;
        const [letter, atts] = await Promise.all([
          supabase.from("letters").select("status, recipient_name, sent_at").eq("id", letterId).single(),
          supabase.from("letter_attachments").select("id").eq("letter_id", letterId),
        ]);
        if (letter.error) return { ok: false, message: letter.error.message };
        const ok =
          letter.data?.status === "sent" &&
          !!letter.data?.recipient_name &&
          !!letter.data?.sent_at &&
          (atts.data?.length ?? 0) >= 1;
        return {
          ok,
          message: ok ? "Brief vollständig." : "Verifikation fehlgeschlagen.",
          details: { status: letter.data?.status, attachments: atts.data?.length ?? 0 },
        };
      },
    },
  ],
};
