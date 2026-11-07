import { supabase } from "@/integrations/supabase/client";
import type { CreatedRecord, StorageObject } from "./types";
import { errorMessage } from "./verify";
import { selftestDatabase } from "./database";

/** Ältere Demo-Daten ohne lokales Laufprotokoll finden; nur eigene Daten im Büro.
 * Diese Funktion löscht nichts. Die zurückgegebenen IDs werden separat bestätigt. */
export async function findLegacySelftestRecords(tenantId: string, userId: string): Promise<CreatedRecord[]> {
  if (!tenantId || !userId) throw new Error("Büro und Anmeldung erforderlich.");
  const sources = [
    ["task_decisions", "title", "created_by"], ["case_items", "subject", "user_id"],
    ["letters", "title", "created_by"], ["tasks", "title", "user_id"],
    ["appointments", "title", "user_id"], ["meetings", "title", "user_id"],
    ["event_plannings", "title", "user_id"], ["daily_briefings", "title", "author_id"],
    ["appointment_requests", "title", "created_by"],
    ["quick_notes", "title", "user_id"], ["contacts", "name", "user_id"],
    ["contact_activities", "title", "created_by"],
  ];
  const records: CreatedRecord[] = [];
  for (const [table, markerColumn, ownerColumn] of sources) {
    const result = await selftestDatabase.from(table).select("id").eq("tenant_id", tenantId).eq(ownerColumn, userId).like(markerColumn, "[SELFTEST]%");
    if (result.error) throw new Error(`${table}: ${result.error.message}`);
    for (const record of result.data ?? []) records.push({ table, id: String(record.id) });
  }
  return records;
}

/** Folgedaten über die aufgezeichneten Eltern finden, auch nach einem Browserabbruch.
 * Scheitert die Suche, bleibt der Elternsatz für einen späteren Versuch erhalten. */
export async function recoverArtifacts(records: CreatedRecord[], storageObjects: StorageObject[]) {
  const recovered = [...records];
  const objects = [...storageObjects];
  const blocked = new Set<string>();
  const errors: string[] = [];
  const add = (record: CreatedRecord) => {
    if (!recovered.some(r => r.table === record.table && r.id === record.id)) recovered.push(record);
  };
  const addFile = (path: string) => {
    if (!objects.some(o => o.bucket === "documents" && o.path === path)) objects.push({ bucket: "documents", path });
  };
  for (const record of records) {
    try {
      if (record.table === "case_items") {
        const tasks = await supabase.from("tasks").select("id").eq("source_type", "case_step").eq("source_id", record.id);
        if (tasks.error) throw tasks.error;
        for (const task of tasks.data ?? []) add({ table: "tasks", id: task.id });
      }
      if (record.table === "appointment_requests") {
        const request = await supabase.from("appointment_requests").select("appointment_id").eq("id", record.id).maybeSingle();
        if (request.error) throw request.error;
        if (request.data?.appointment_id) add({ table: "appointments", id: request.data.appointment_id });
      }
      if (record.table === "letters") {
        const letter = await supabase.from("letters").select("title, subject, tenant_id").eq("id", record.id).maybeSingle();
        if (letter.error) throw letter.error;
        if (!letter.data) continue;
        if (!letter.data.title.startsWith("[SELFTEST]")) throw new Error("Aufgezeichneter Brief ist kein Selbsttest-Brief.");
        const docs = await supabase.from("documents").select("id, file_path").eq("source_letter_id", record.id).eq("tenant_id", letter.data.tenant_id);
        if (docs.error) throw docs.error;
        for (const doc of docs.data ?? []) { add({ table: "documents", id: doc.id }); if (doc.file_path) addFile(doc.file_path); }
        const attachments = await supabase.from("letter_attachments").select("id, file_path").eq("letter_id", record.id);
        if (attachments.error) throw attachments.error;
        for (const attachment of attachments.data ?? []) { add({ table: "letter_attachments", id: attachment.id }); if (attachment.file_path) addFile(attachment.file_path); }
        const tasks = await supabase.from("tasks").select("id").eq("tenant_id", letter.data.tenant_id)
          .like("title", `Abgeordnetenbrief "${letter.data.subject || letter.data.title}" vom %`);
        if (tasks.error) throw tasks.error;
        for (const task of tasks.data ?? []) add({ table: "tasks", id: task.id });
        const prefix = `letter_${letter.data.title.replace(/[^a-zA-Z0-9]/g, "_")}_`;
        const files = await supabase.storage.from("documents").list("archived_letters", { search: prefix, limit: 100 });
        if (files.error) throw files.error;
        for (const file of files.data ?? []) if (file.name.startsWith(prefix)) addFile(`archived_letters/${file.name}`);
      }
    } catch (error) {
      blocked.add(`${record.table}/${record.id}`);
      errors.push(`Folgedaten von ${record.table}/${record.id}: ${errorMessage(error)}`);
    }
  }
  return { records: recovered, storageObjects: objects, blocked, errors };
}
