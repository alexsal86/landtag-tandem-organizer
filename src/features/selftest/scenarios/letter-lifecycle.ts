import { supabase } from "@/integrations/supabase/client";
import { canTransitionStatus } from "@/components/letters/types";
import { persistLetterTransition, uploadLetterAttachment } from "@/services/letterWorkflow";
import type { TestScenario, TestStep } from "../types";
import { SELFTEST_MARKER, SELFTEST_PREFIX } from "../runner";
import { describeError, expectFields } from "../verify";

const tag = (run: string, label: string) => `${SELFTEST_PREFIX} ${label} (${run})`;
const transition = (from: string, to: string, label: string): TestStep => ({
  id: to, label, kind: "workflow",
  run: async ctx => {
    await persistLetterTransition(ctx.data.letterId as string, from, to, ctx.userId);
    return expectFields("letters", ctx.data.letterId as string, { status: to }, label);
  },
});

export const letterLifecycleScenario: TestScenario = {
  id: "letter-lifecycle",
  title: "Brief-Lifecycle (Entwurf → Prüfung → Freigabe → Archiv und Folgeaufgabe)",
  description: "Lädt eine echte Testdatei hoch und nutzt die Funktionen des Briefeditors für Statuswechsel und Archivierung. Prüft danach Dokument, PDF und Folgeaufgabe.",
  touches: ["letters", "letter_attachments", "documents", "tasks"], features: ["letters", "documents", "tasks"],
  checks: ["Datei hochladen und wieder herunterladen", "Prüfung und Freigabe über Anwendungsfunktionen", "Archivfunktion erzeugt PDF, Dokument und Folgeaufgabe"],
  limitations: ["Kein E-Mail-Versand an einen Empfänger", "Prüfung und Freigabe erfolgen mit dem aktuellen Konto", "Die Bedienung des Briefeditors wird separat getestet"],
  writes: [
    { table: "letters", columns: ["title", "subject", "content", "content_html", "status", "created_by", "tenant_id", "recipient_name", "recipient_address", "letter_date", "submitted_for_review_at", "submitted_for_review_by", "approved_at", "approved_by", "sent_at", "sent_by", "sent_date", "workflow_locked", "archived_document_id"] },
    { table: "letter_attachments", columns: ["letter_id", "file_name", "file_path", "file_type", "file_size", "uploaded_by"] },
  ],
  collectArtifacts: async ctx => {
    const id = ctx.data.letterId as string | undefined;
    if (!id || !ctx.data.archiveAttempted) return;
    const docs = await supabase.from("documents").select("id, file_path").eq("tenant_id", ctx.tenantId).eq("source_letter_id", id);
    if (docs.error) throw new Error(docs.error.message);
    for (const doc of docs.data ?? []) {
      ctx.trackRecord({ table: "documents", id: doc.id });
      if (doc.file_path) ctx.trackStorage({ bucket: "documents", path: doc.file_path });
    }
    const tasks = await supabase.from("tasks").select("id").eq("tenant_id", ctx.tenantId).eq("user_id", ctx.userId).ilike("title", `%${ctx.runId}%`);
    if (tasks.error) throw new Error(tasks.error.message);
    for (const task of tasks.data ?? []) ctx.trackRecord({ table: "tasks", id: task.id });
    // Auch Uploads vor einem fehlgeschlagenen Dokument-INSERT finden.
    const prefix = `letter_${tag(ctx.runId, "Brief").replace(/[^a-zA-Z0-9]/g, "_")}_`;
    const files = await supabase.storage.from("documents").list("archived_letters", { search: prefix, limit: 100 });
    if (files.error) throw new Error(files.error.message);
    for (const file of files.data ?? []) {
      if (file.name.startsWith(prefix)) ctx.trackStorage({ bucket: "documents", path: `archived_letters/${file.name}` });
    }
  },
  steps: [
    {
      id: "create-letter", label: "Briefentwurf mit Empfänger anlegen",
      run: async ctx => {
        const payload = { title: tag(ctx.runId, "Brief"), subject: tag(ctx.runId, "Betreff"),
          content: `${SELFTEST_MARKER} Testinhalt`, content_html: `<p>${SELFTEST_MARKER} Testinhalt</p>`,
          status: "draft", created_by: ctx.userId, tenant_id: ctx.tenantId,
          recipient_name: "Selbsttest Empfaenger", recipient_address: "Teststrasse 1\n76133 Karlsruhe", letter_date: new Date().toISOString().slice(0, 10) };
        const { data, error } = await supabase.from("letters").insert(payload).select("id").single();
        if (error || !data) return { ok: false, message: describeError(error) };
        ctx.data.letterId = data.id;
        ctx.trackRecord({ table: "letters", id: data.id });
        return expectFields("letters", data.id, payload, "Entwurf");
      },
    },
    {
      id: "invalid-transition", label: "Direkter Sprung vom Entwurf zu versendet ist verboten", kind: "logic",
      run: async () => ({ ok: !canTransitionStatus("draft", "sent"), message: "Freigaberegel aus dem Briefeditor geprüft." }),
    },
    {
      id: "attachment", label: "Echte Anlage hochladen und Inhalt zurücklesen", kind: "workflow",
      run: async ctx => {
        const content = `${SELFTEST_MARKER} Anlage ${ctx.runId}`;
        const file = new File([content], "selbsttest.txt", { type: "text/plain" });
        const attachment = await uploadLetterAttachment(file, ctx.data.letterId as string, ctx.userId,
          path => ctx.trackStorage({ bucket: "documents", path }));
        ctx.trackRecord({ table: "letter_attachments", id: attachment.id });
        if (!attachment.file_path) return { ok: false, message: "Gespeicherter Dateipfad fehlt." };
        const download = await supabase.storage.from("documents").download(attachment.file_path);
        if (download.error || !download.data) return { ok: false, message: download.error?.message ?? "Anlage nicht lesbar." };
        const actual = await download.data.text();
        return { ok: actual === content, message: actual === content ? "Anlageninhalt unverändert." : "Anlageninhalt weicht ab.", details: { expected: content, actual } };
      },
    },
    transition("draft", "review", "Zur Kollegenprüfung einreichen"),
    transition("review", "pending_approval", "Nach Prüfung zur Freigabe einreichen"),
    transition("pending_approval", "approved", "Brief freigeben"),
    {
      id: "archive", label: "Versandstatus, Archiv-PDF und Folgeaufgabe über Anwendungsfunktion", kind: "workflow",
      run: async ctx => {
        ctx.data.archiveAttempted = true;
        const result = await persistLetterTransition(ctx.data.letterId as string, "approved", "sent", ctx.userId);
        if (result.archive?.documentId) ctx.trackRecord({ table: "documents", id: result.archive.documentId });
        if (result.archive?.followUpTaskId) ctx.trackRecord({ table: "tasks", id: result.archive.followUpTaskId });
        ctx.data.documentId = result.archive?.documentId;
        ctx.data.followUpTaskId = result.archive?.followUpTaskId;
        if (!result.archive?.documentId || !result.archive.followUpTaskId) return { ok: false, message: "Archivdokument oder Folgeaufgabe fehlt.", details: result.archive };
        return expectFields("letters", ctx.data.letterId as string, { status: "sent", workflow_locked: true, archived_document_id: result.archive.documentId, sent_by: ctx.userId }, "Archivierung");
      },
    },
    {
      id: "verify-archive", label: "Archivdatei und Folgeaufgabe sind tatsächlich vorhanden",
      run: async ctx => {
        const doc = await supabase.from("documents").select("file_path, source_letter_id, tenant_id").eq("id", ctx.data.documentId as string).single();
        if (doc.error || !doc.data?.file_path) return { ok: false, message: describeError(doc.error) };
        ctx.trackStorage({ bucket: "documents", path: doc.data.file_path });
        const download = await supabase.storage.from("documents").download(doc.data.file_path);
        if (download.error || !download.data) return { ok: false, message: download.error?.message ?? "Archiv-PDF fehlt." };
        const signature = new TextDecoder().decode((await download.data.arrayBuffer()).slice(0, 5));
        if (signature !== "%PDF-") return { ok: false, message: "Archivdatei ist kein PDF." };
        const task = await expectFields("tasks", ctx.data.followUpTaskId as string, { tenant_id: ctx.tenantId, user_id: ctx.userId, status: "todo" }, "Folgeaufgabe");
        if (!task.ok) return task;
        return expectFields("documents", ctx.data.documentId as string, { tenant_id: ctx.tenantId, source_letter_id: ctx.data.letterId }, "Archivdokument");
      },
    },
  ],
};
