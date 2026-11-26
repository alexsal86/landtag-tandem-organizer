import { supabase } from "@/integrations/supabase/client";
import { SELFTEST_MARKER, SELFTEST_PREFIX } from "../runner";
import type { TestScenario } from "../types";
import { describeError, expectFields } from "../verify";

const tag = (run: string, label: string) => `${SELFTEST_PREFIX} ${label} (${run})`;
const today = () => new Date().toISOString().slice(0, 10);

/** Die Fallakte ist der Container; der Vorgang bleibt ein eigener Datensatz mit Ball und Schritt. */
export const caseFileLifecycleScenario: TestScenario = {
  id: "case-file-lifecycle",
  title: "Fallakte mit Folgetabellen (Container) im Unterschied zum Vorgang",
  description:
    "Legt eine Fallakte an, prüft Typ, Größe, Sichtbarkeit und den Wechsel des Bearbeitungsstatus, verknüpft Kontakt, Aufgabe, Termin und Brief samt Notizen, Verlauf und Beteiligten und liest die Zählwerte über die Akten-RPC. Anschließend belegt ein Vorgang an derselben Akte den Unterschied: Der Vorgang führt Ball und nächsten Schritt, erbt seine Sichtbarkeit von der Akte und überlebt deren Löschung.",
  touches: [
    "case_files",
    "case_file_participants",
    "case_file_status_history",
    "case_file_notes",
    "case_file_timeline",
    "case_file_contacts",
    "case_file_tasks",
    "case_file_appointments",
    "case_file_letters",
    "case_items",
    "contacts",
    "tasks",
    "appointments",
    "letters",
  ],
  features: ["case-files", "case-items"],
  checks: [
    "Fallakte wird mit Typ, Größe, Status und Standard-Sichtbarkeit „private“ angelegt und zurückgelesen",
    "Ungültige Größe (case_scale) wird von der Datenbank abgewiesen",
    "Bearbeitungsstatus und Statusverlauf werden gespeichert; derselbe Beteiligte kann nicht doppelt eingetragen werden",
    "Kontakt, Aufgabe, Termin und Brief werden über die jeweilige Folgetabelle verknüpft; doppelte Verknüpfungen sind gesperrt",
    "Die Aufgabe entsteht über create_case_file_task als offene Aufgabe für die anlegende Person mit source_type 'case_file' und Quellbezug; eine Wiederholung liefert dieselbe Aufgabe und keine zweite Verknüpfung",
    "get_case_files_with_counts liefert die Verknüpfungen der Akte als Zählwerte",
    "Ein Vorgang an einer privaten Akte ist für Büro-Kolleginnen unsichtbar, an einer öffentlichen Akte sichtbar (Sichtbarkeitsvererbung)",
    "Das Löschen der Akte entfernt ihre Folgetabellen, lässt den Vorgang aber mit case_file_id = null bestehen",
  ],
  limitations: [
    "Die Verknüpfungstabellen für Dokumente und Themen bleiben offen: Eine Dokumentverknüpfung braucht eine echte Datei, und der Themenkatalog gehört einem eigenen Szenario. Die Akte wird deshalb auch ohne tags angelegt, weil sync_tags_to_topics daraus büroweite topics-Zeilen anlegen würde.",
    "Die Sichtbarkeitsvererbung wird über user_can_access_case_item geprüft. Ohne zweite aktive Person im Büro bleibt nur die eigene Sicht und der Schritt meldet das ausdrücklich.",
    "Keine Bedienprüfung der Fallakten-Oberfläche; geprüft werden die Anwendungspfade und Regeln in der Datenbank.",
  ],
  writes: [
    { table: "case_files", columns: ["title", "description", "case_type", "case_scale", "status", "priority", "reference_number", "start_date", "target_date", "user_id", "tenant_id", "visibility", "processing_status", "current_status_note"] },
    { table: "case_file_participants", columns: ["case_file_id", "user_id", "role"] },
    { table: "case_file_status_history", columns: ["case_file_id", "content", "user_id", "user_display_name"] },
    { table: "case_file_notes", columns: ["case_file_id", "user_id", "content", "is_pinned"] },
    { table: "case_file_timeline", columns: ["case_file_id", "event_date", "event_type", "title", "description", "created_by"] },
    { table: "case_file_contacts", columns: ["case_file_id", "contact_id", "role"] },
    { table: "case_file_tasks", columns: ["case_file_id", "task_id"] },
    { table: "case_file_appointments", columns: ["case_file_id", "appointment_id", "notes"] },
    { table: "case_file_letters", columns: ["case_file_id", "letter_id", "notes"] },
    { table: "case_items", columns: ["subject", "summary", "user_id", "tenant_id", "case_file_id", "case_scale"] },
    { table: "contacts", columns: ["name", "user_id", "tenant_id", "category", "notes"] },
    { table: "tasks", columns: ["title", "user_id", "tenant_id", "assigned_to", "priority", "category", "status", "source_type", "source_id"] },
    { table: "appointments", columns: ["title", "user_id", "tenant_id", "start_time", "end_time", "category", "status"] },
    { table: "letters", columns: ["title", "subject", "content", "content_html", "status", "created_by", "tenant_id", "recipient_name", "recipient_address", "letter_date"] },
  ],
  steps: [
    {
      id: "create", label: "Fallakte anlegen und Standardwerte prüfen", critical: true,
      run: async ctx => {
        const payload = {
          title: tag(ctx.runId, "Fallakte"), description: SELFTEST_MARKER, case_type: "citizen_concern",
          case_scale: "small", status: "active", priority: "high", reference_number: tag(ctx.runId, "AZ"),
          start_date: today(), target_date: today(),
          // Bewusst ohne tags: sync_tags_to_topics würde daraus büroweite topics-Zeilen anlegen.
          user_id: ctx.userId, tenant_id: ctx.tenantId,
        };
        const { data, error } = await supabase.from("case_files").insert(payload).select("id").single();
        if (error || !data) return { ok: false, message: `Fallakte: ${describeError(error)}` };
        ctx.data.caseFileId = data.id;
        ctx.trackRecord({ table: "case_files", id: data.id });
        return expectFields("case_files", data.id, { ...payload, visibility: "private" }, "Fallakte");
      },
    },
    {
      id: "scale-guard", label: "Ungültige Akten-Größe wird abgewiesen",
      run: async ctx => {
        const id = ctx.data.caseFileId as string;
        const rejected = await supabase.from("case_files").update({ case_scale: "huge" }).eq("id", id);
        const row = await supabase.from("case_files").select("case_scale").eq("id", id).single();
        if (row.error) return { ok: false, message: `Größe: ${describeError(row.error)}` };
        return {
          ok: rejected.error?.code === "23514" && row.data.case_scale === "small",
          message: "Nur „small“ und „large“ sind erlaubt; der abgewiesene Wert bleibt ohne Wirkung.",
          details: { code: rejected.error?.code, case_scale: row.data.case_scale },
        };
      },
    },
    {
      id: "processing-status", label: "Bearbeitungsstatus setzen und Statusverlauf schreiben",
      run: async ctx => {
        const id = ctx.data.caseFileId as string;
        // Der Katalog ist je Büro getrennt (tenant_id NOT NULL, RLS); ein Büro kann keinen Eintrag haben.
        const status = await supabase.from("case_file_processing_statuses").select("name,label")
          .eq("tenant_id", ctx.tenantId).eq("is_active", true).order("order_index").limit(1).maybeSingle();
        if (status.error) return { ok: false, message: `Bearbeitungsstatus: ${describeError(status.error)}` };
        const statusName = status.data?.name ?? null;
        const note = tag(ctx.runId, "Statusnotiz");
        const updated = await supabase.from("case_files")
          .update({ processing_status: statusName, current_status_note: note, current_status_updated_at: new Date().toISOString() })
          .eq("id", id).select("processing_status,current_status_note").single();
        if (updated.error || !updated.data) return { ok: false, message: `Statuswechsel: ${describeError(updated.error)}` };
        const history = await supabase.from("case_file_status_history")
          .insert({ case_file_id: id, content: note, user_id: ctx.userId, user_display_name: "Selbsttest" })
          .select("id").single();
        if (history.error || !history.data) return { ok: false, message: `Statusverlauf: ${describeError(history.error)}` };
        ctx.trackRecord({ table: "case_file_status_history", id: history.data.id });
        const stored = await supabase.from("case_file_status_history").select("content,user_id").eq("case_file_id", id);
        const checks = {
          statusApplied: (statusName === null || updated.data.processing_status === statusName) && updated.data.current_status_note === note,
          historyWritten: !stored.error && (stored.data ?? []).length === 1
            && stored.data?.[0].content === note && stored.data?.[0].user_id === ctx.userId,
        };
        return {
          ok: Object.values(checks).every(Boolean),
          message: statusName
            ? "Bearbeitungsstatus und Verlaufseintrag sind gespeichert."
            : "Kein Bearbeitungsstatus im Büro konfiguriert; Notiz und Verlaufseintrag sind gespeichert.",
          details: { ...checks, status: statusName ?? "kein Katalogstatus" },
        };
      },
    },
    {
      id: "participants", label: "Beteiligte eintragen; Doppelung ist gesperrt",
      run: async ctx => {
        const id = ctx.data.caseFileId as string;
        const { data, error } = await supabase.from("case_file_participants")
          .insert({ case_file_id: id, user_id: ctx.userId, role: "viewer" }).select("id").single();
        if (error || !data) return { ok: false, message: `Beteiligte: ${describeError(error)}` };
        ctx.trackRecord({ table: "case_file_participants", id: data.id });
        const duplicate = await supabase.from("case_file_participants")
          .insert({ case_file_id: id, user_id: ctx.userId, role: "editor" });
        const read = await supabase.from("case_file_participants").select("role").eq("case_file_id", id);
        const checks = {
          duplicateRejected: duplicate.error?.code === "23505",
          singleRow: !read.error && (read.data ?? []).length === 1,
          roleKept: read.data?.[0]?.role === "viewer",
        };
        return { ok: Object.values(checks).every(Boolean), message: "Eine Person steht genau einmal an der Akte; die Rolle der ersten Zeile bleibt erhalten.", details: { ...checks, code: duplicate.error?.code } };
      },
    },
    {
      id: "notes-and-timeline", label: "Notiz und Verlaufseintrag zur Akte speichern",
      run: async ctx => {
        const id = ctx.data.caseFileId as string;
        const note = await supabase.from("case_file_notes")
          .insert({ case_file_id: id, user_id: ctx.userId, content: tag(ctx.runId, "Aktennotiz"), is_pinned: true })
          .select("id").single();
        if (note.error || !note.data) return { ok: false, message: `Notiz: ${describeError(note.error)}` };
        ctx.trackRecord({ table: "case_file_notes", id: note.data.id });
        const event = await supabase.from("case_file_timeline")
          .insert({ case_file_id: id, event_date: today(), event_type: "note", title: tag(ctx.runId, "Verlauf"), description: SELFTEST_MARKER, created_by: ctx.userId })
          .select("id").single();
        if (event.error || !event.data) return { ok: false, message: `Verlauf: ${describeError(event.error)}` };
        ctx.trackRecord({ table: "case_file_timeline", id: event.data.id });
        const checked = await expectFields("case_file_timeline", event.data.id, { case_file_id: id, event_type: "note", title: tag(ctx.runId, "Verlauf") }, "Verlaufseintrag");
        if (!checked.ok) return checked;
        return expectFields("case_file_notes", note.data.id, { case_file_id: id, is_pinned: true, content: tag(ctx.runId, "Aktennotiz") }, "Aktennotiz");
      },
    },
    {
      id: "links-contact-task", label: "Kontakt verknüpfen und Aufgabe über die Akten-RPC erzeugen",
      run: async ctx => {
        const id = ctx.data.caseFileId as string;
        const contact = await supabase.from("contacts")
          .insert({ name: tag(ctx.runId, "Kontakt"), user_id: ctx.userId, tenant_id: ctx.tenantId, category: "citizen", notes: SELFTEST_MARKER })
          .select("id").single();
        if (contact.error || !contact.data) return { ok: false, message: `Kontakt: ${describeError(contact.error)}` };
        ctx.trackRecord({ table: "contacts", id: contact.data.id });
        const link = await supabase.from("case_file_contacts")
          .insert({ case_file_id: id, contact_id: contact.data.id, role: "stakeholder" }).select("id").single();
        if (link.error || !link.data) return { ok: false, message: `Kontaktverknüpfung: ${describeError(link.error)}` };
        ctx.trackRecord({ table: "case_file_contacts", id: link.data.id });
        const duplicate = await supabase.from("case_file_contacts")
          .insert({ case_file_id: id, contact_id: contact.data.id, role: "stakeholder" });

        const taskId = crypto.randomUUID();
        const title = tag(ctx.runId, "Aktenaufgabe");
        const task = await supabase.rpc("create_case_file_task", { p_id: taskId, p_case_file_id: id, p_title: title });
        if (task.error) return { ok: false, message: `Aktenaufgabe: ${describeError(task.error)}` };
        ctx.trackRecord({ table: "tasks", id: taskId });
        const retry = await supabase.rpc("create_case_file_task", { p_id: taskId, p_case_file_id: id, p_title: title });
        const links = await supabase.from("case_file_tasks").select("id").eq("case_file_id", id);
        const storedTask = await expectFields("tasks", taskId, {
          title, tenant_id: ctx.tenantId, source_type: "case_file", source_id: id,
          status: "todo", priority: "medium", category: "personal", assigned_to: ctx.userId,
        }, "Aktenaufgabe");
        if (!storedTask.ok) return storedTask;
        const checks = {
          duplicateLinkRejected: duplicate.error?.code === "23505",
          sameTaskOnRetry: retry.data === taskId && !retry.error,
          singleLink: !links.error && (links.data ?? []).length === 1,
        };
        return { ok: Object.values(checks).every(Boolean), message: "Kontakt und Aufgabe hängen einmal an der Akte; die RPC liefert bei Wiederholung dieselbe Aufgabe.", details: { ...checks, code: duplicate.error?.code } };
      },
    },
    {
      id: "links-appointment-letter", label: "Termin und Brief mit der Akte verknüpfen",
      run: async ctx => {
        const id = ctx.data.caseFileId as string;
        const start = new Date(Date.now() + 180_000);
        const appointment = await supabase.from("appointments")
          .insert({ title: tag(ctx.runId, "Aktentermin"), user_id: ctx.userId, tenant_id: ctx.tenantId, category: "meeting", status: "planned",
            start_time: start.toISOString(), end_time: new Date(start.getTime() + 1_800_000).toISOString() })
          .select("id").single();
        if (appointment.error || !appointment.data) return { ok: false, message: `Termin: ${describeError(appointment.error)}` };
        ctx.trackRecord({ table: "appointments", id: appointment.data.id });
        const appointmentLink = await supabase.from("case_file_appointments")
          .insert({ case_file_id: id, appointment_id: appointment.data.id }).select("id").single();
        if (appointmentLink.error || !appointmentLink.data) return { ok: false, message: `Terminverknüpfung: ${describeError(appointmentLink.error)}` };
        ctx.trackRecord({ table: "case_file_appointments", id: appointmentLink.data.id });

        const letter = await supabase.from("letters")
          .insert({ title: tag(ctx.runId, "Aktenbrief"), subject: tag(ctx.runId, "Betreff"),
            content: SELFTEST_MARKER, content_html: `<p>${SELFTEST_MARKER}</p>`,
            status: "draft", created_by: ctx.userId, tenant_id: ctx.tenantId,
            recipient_name: "Selbsttest Empfänger", recipient_address: "Teststraße 1\n76133 Karlsruhe", letter_date: today() })
          .select("id").single();
        if (letter.error || !letter.data) return { ok: false, message: `Brief: ${describeError(letter.error)}` };
        ctx.trackRecord({ table: "letters", id: letter.data.id });
        const letterLink = await supabase.from("case_file_letters")
          .insert({ case_file_id: id, letter_id: letter.data.id }).select("id").single();
        if (letterLink.error || !letterLink.data) return { ok: false, message: `Briefverknüpfung: ${describeError(letterLink.error)}` };
        ctx.trackRecord({ table: "case_file_letters", id: letterLink.data.id });

        const duplicate = await supabase.from("case_file_letters").insert({ case_file_id: id, letter_id: letter.data.id });
        return {
          ok: duplicate.error?.code === "23505",
          message: "Termin und Brief hängen an der Akte; eine doppelte Briefverknüpfung wird abgewiesen.",
          details: { code: duplicate.error?.code, appointment: appointment.data.id, letter: letter.data.id },
        };
      },
    },
    {
      id: "counts", label: "Akten-RPC zählt die Verknüpfungen",
      run: async ctx => {
        const id = ctx.data.caseFileId as string;
        const { data, error } = await supabase.rpc("get_case_files_with_counts", { p_tenant_id: ctx.tenantId });
        if (error) return { ok: false, message: `Aktenliste: ${describeError(error)}` };
        const row = (data ?? []).find(entry => entry.id === id);
        if (!row) return { ok: false, message: "Die angelegte Akte fehlt in der Aktenliste." };
        const checks = {
          contacts: row.contacts_count === 1,
          tasks: row.tasks_count === 1,
          appointments: row.appointments_count === 1,
          letters: row.letters_count === 1,
          documents: row.documents_count === 0,
        };
        return {
          ok: Object.values(checks).every(Boolean),
          message: "Die Akte meldet genau die verknüpften Kontakte, Aufgaben, Termine und Briefe.",
          details: { ...checks, counts: { contacts: row.contacts_count, tasks: row.tasks_count, appointments: row.appointments_count, letters: row.letters_count, documents: row.documents_count } },
        };
      },
    },
    {
      id: "vorgang-vs-akte", label: "Unterschied zum Vorgang: eigener Ball, geerbte Sichtbarkeit", critical: false,
      run: async ctx => {
        const id = ctx.data.caseFileId as string;
        const { data, error } = await supabase.from("case_items")
          .insert({ subject: tag(ctx.runId, "Vorgang an der Akte"), summary: SELFTEST_MARKER, user_id: ctx.userId, tenant_id: ctx.tenantId, case_file_id: id })
          .select("id").single();
        if (error || !data) return { ok: false, message: `Vorgang: ${describeError(error)}` };
        ctx.trackRecord({ table: "case_items", id: data.id });
        ctx.data.caseItemId = data.id;

        const item = await supabase.from("case_items")
          .select("status, ball_owner, case_file_id, visible_to_all, case_scale").eq("id", data.id).single();
        if (item.error) return { ok: false, message: `Vorgang lesen: ${describeError(item.error)}` };
        const file = await supabase.from("case_files")
          .select("status, visibility, case_type").eq("id", id).single();
        if (file.error) return { ok: false, message: `Akte lesen: ${describeError(file.error)}` };
        const model = {
          itemHasOwnBall: item.data.ball_owner === "office" && item.data.case_file_id === id,
          fileIsContainer: file.data.status === "active" && file.data.case_type === "citizen_concern" && file.data.visibility === "private",
        };
        const rejectedScale = await supabase.from("case_items").update({ case_scale: "huge" }).eq("id", data.id);

        const peer = await supabase.from("user_tenant_memberships").select("user_id")
          .eq("tenant_id", ctx.tenantId).eq("is_active", true).neq("user_id", ctx.userId).limit(1).maybeSingle();
        if (peer.error) return { ok: false, message: `Zweite Person: ${describeError(peer.error)}` };
        if (!peer.data) {
          return {
            ok: Object.values(model).every(Boolean) && rejectedScale.error?.code === "23514",
            message: "Vorgang und Akte sind getrennt modelliert; ohne zweite aktive Person bleibt die Sichtbarkeitsvererbung ungeprüft.",
            details: { ...model, scaleCode: rejectedScale.error?.code, visibility: "nicht geprüft" },
          };
        }
        const hidden = await supabase.rpc("user_can_access_case_item", { _user_id: peer.data.user_id, _case_item_id: data.id });
        const opened = await supabase.from("case_files").update({ visibility: "public" }).eq("id", id);
        if (opened.error) return { ok: false, message: `Sichtbarkeit: ${describeError(opened.error)}` };
        const visible = await supabase.rpc("user_can_access_case_item", { _user_id: peer.data.user_id, _case_item_id: data.id });
        const checks = {
          ...model,
          scaleRuleForItems: rejectedScale.error?.code === "23514",
          hiddenBehindPrivateFile: hidden.error === null && hidden.data === false,
          visibleWithPublicFile: visible.error === null && visible.data === true,
        };
        return {
          ok: Object.values(checks).every(Boolean),
          message: "Der Vorgang trägt Ball und nächsten Schritt; seine Sichtbarkeit folgt der Akte (privat → unsichtbar, öffentlich → sichtbar).",
          details: { ...checks, hidden: hidden.data, visible: visible.data },
        };
      },
    },
    {
      id: "delete-detaches", label: "Akte löschen: Folgetabellen weg, Vorgang bleibt",
      run: async ctx => {
        const id = ctx.data.caseFileId as string;
        const itemId = ctx.data.caseItemId as string;
        const removed = await supabase.from("case_files").delete().eq("id", id);
        if (removed.error) return { ok: false, message: `Akte löschen: ${describeError(removed.error)}` };
        const gone = await supabase.from("case_files").select("id").eq("id", id).maybeSingle();
        if (gone.error) return { ok: false, message: `Akte prüfen: ${describeError(gone.error)}` };
        const item = await supabase.from("case_items").select("id, case_file_id").eq("id", itemId).maybeSingle();
        if (item.error) return { ok: false, message: `Vorgang prüfen: ${describeError(item.error)}` };
        const orphans = await supabase.from("case_file_notes").select("id").eq("case_file_id", id);
        const counts = await supabase.rpc("get_case_files_with_counts", { p_tenant_id: ctx.tenantId });
        const checks = {
          fileRemoved: !gone.data,
          itemSurvived: Boolean(item.data) && item.data?.case_file_id === null,
          childrenCascaded: !orphans.error && (orphans.data ?? []).length === 0,
          absentFromList: !counts.error && !(counts.data ?? []).some(entry => entry.id === id),
        };
        return {
          ok: Object.values(checks).every(Boolean),
          message: "Die Akte ist samt Folgetabellen entfernt; der Vorgang besteht eigenständig weiter.",
          details: { ...checks, case_file_id: item.data?.case_file_id ?? "Vorgang fehlt" },
        };
      },
    },
  ],
};
