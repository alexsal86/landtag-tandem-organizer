import { supabase } from "@/integrations/supabase/client";
import type { TestScenario } from "../types";
import { SELFTEST_MARKER, SELFTEST_PREFIX } from "../runner";

const title = (run: string, label: string) => `${SELFTEST_PREFIX} ${label} (${run})`;

const SYSTEM_TYPES = [
  "birthdays",
  "upcoming_appointments",
  "quick_notes",
  "tasks",
  "case_items",
  "decisions",
] as const;

export const meetingLifecycleScenario: TestScenario = {
  id: "meeting-lifecycle",
  title: "Meeting-Lifecycle (vollständig)",
  description:
    "Erstellt ein Meeting mit Termin, Teilnehmer, regulären und allen System-Agenda-Punkten (Geburtstage, Termine, Quick-Notes, Aufgaben, Vorgänge, Entscheidungen), Sub-Item, Dokument, Aufgabe, Carry-Over und Folge-Meeting. Verifiziert alle Verknüpfungen und räumt am Ende auf.",
  steps: [
    {
      id: "create-meeting",
      label: "Meeting anlegen",
      run: async (ctx) => {
        const { data, error } = await supabase
          .from("meetings")
          .insert({
            title: title(ctx.runId, "Meeting"),
            description: SELFTEST_MARKER,
            meeting_date: new Date().toISOString().slice(0, 10),
            meeting_time: "10:00",
            status: "planned",
            user_id: ctx.userId,
            tenant_id: ctx.tenantId,
            is_public: false,
          })
          .select("id")
          .single();
        if (error || !data) return { ok: false, message: error?.message ?? "Insert lieferte keine Daten" };
        ctx.created.push({ table: "meetings", id: data.id });
        ctx.data.meetingId = data.id;
        return { ok: true, message: `Meeting ${data.id} angelegt.` };
      },
    },
    {
      id: "create-appointment",
      label: "Verknüpften Kalender-Termin erzeugen",
      run: async (ctx) => {
        const start = new Date();
        start.setHours(10, 0, 0, 0);
        const end = new Date(start.getTime() + 60 * 60 * 1000);
        const { data, error } = await supabase
          .from("appointments")
          .insert({
            title: title(ctx.runId, "Termin"),
            description: SELFTEST_MARKER,
            start_time: start.toISOString(),
            end_time: end.toISOString(),
            category: "meeting",
            status: "planned",
            user_id: ctx.userId,
            tenant_id: ctx.tenantId,
            meeting_id: ctx.data.meetingId as string,
          })
          .select("id")
          .single();
        if (error || !data) return { ok: false, message: error?.message ?? "Insert lieferte keine Daten" };
        ctx.created.push({ table: "appointments", id: data.id });
        ctx.data.appointmentId = data.id;
        return { ok: true, message: "Termin verknüpft." };
      },
    },
    {
      id: "add-participant",
      label: "Teilnehmer (sich selbst) hinzufügen",
      run: async (ctx) => {
        const { data, error } = await supabase
          .from("meeting_participants")
          .insert({
            meeting_id: ctx.data.meetingId as string,
            user_id: ctx.userId,
            role: "organizer",
            status: "confirmed",
          })
          .select("id")
          .single();
        if (error || !data) return { ok: false, message: error?.message ?? "Insert lieferte keine Daten" };
        ctx.created.push({ table: "meeting_participants", id: data.id });
        return { ok: true, message: "Teilnehmer ergänzt." };
      },
    },
    {
      id: "add-regular-agenda",
      label: "Reguläre Agenda-Punkte (3) anlegen",
      run: async (ctx) => {
        const meetingId = ctx.data.meetingId as string;
        const items = [0, 1, 2].map((i) => ({
          meeting_id: meetingId,
          title: title(ctx.runId, `Agenda ${i + 1}`),
          description: SELFTEST_MARKER,
          order_index: i,
          is_completed: false,
          is_recurring: false,
        }));
        const { data, error } = await supabase
          .from("meeting_agenda_items")
          .insert(items)
          .select("id");
        if (error || !data) return { ok: false, message: error?.message ?? "Insert lieferte keine Daten" };
        for (const row of data) ctx.created.push({ table: "meeting_agenda_items", id: row.id });
        ctx.data.firstAgendaId = data[0].id;
        return { ok: true, message: `${data.length} Agenda-Punkte angelegt.` };
      },
    },
    {
      id: "add-system-agenda",
      label: "System-Agenda-Punkte (Geburtstage, Termine, Notes, Aufgaben, Vorgänge, Entscheidungen)",
      critical: false,
      run: async (ctx) => {
        const meetingId = ctx.data.meetingId as string;
        const rows = SYSTEM_TYPES.map((type, idx) => ({
          meeting_id: meetingId,
          title: title(ctx.runId, `System ${type}`),
          description: SELFTEST_MARKER,
          order_index: 10 + idx,
          is_completed: false,
          is_recurring: false,
          system_type: type,
          is_visible: true,
          is_optional: true,
        }));
        const { data, error } = await supabase
          .from("meeting_agenda_items")
          .insert(rows)
          .select("id, system_type");
        if (error || !data) return { ok: false, message: error?.message ?? "Insert lieferte keine Daten" };
        for (const row of data) ctx.created.push({ table: "meeting_agenda_items", id: row.id });
        return {
          ok: data.length === SYSTEM_TYPES.length,
          message: `${data.length}/${SYSTEM_TYPES.length} System-Punkte angelegt.`,
          details: data.map((d) => d.system_type),
        };
      },
    },
    {
      id: "add-sub-agenda",
      label: "Sub-Agenda-Punkt mit parent_id anlegen",
      critical: false,
      run: async (ctx) => {
        const { data, error } = await supabase
          .from("meeting_agenda_items")
          .insert({
            meeting_id: ctx.data.meetingId as string,
            parent_id: ctx.data.firstAgendaId as string,
            title: title(ctx.runId, "Unterpunkt"),
            description: SELFTEST_MARKER,
            order_index: 0,
            is_completed: false,
            is_recurring: false,
          })
          .select("id")
          .single();
        if (error || !data) return { ok: false, message: error?.message ?? "Insert lieferte keine Daten" };
        ctx.created.push({ table: "meeting_agenda_items", id: data.id });
        ctx.data.subAgendaId = data.id;
        return { ok: true, message: "Hierarchie ok." };
      },
    },
    {
      id: "add-agenda-document",
      label: "Agenda-Dokument anhängen",
      critical: false,
      run: async (ctx) => {
        const { data, error } = await supabase
          .from("meeting_agenda_documents")
          .insert({
            meeting_agenda_item_id: ctx.data.firstAgendaId as string,
            user_id: ctx.userId,
            file_name: title(ctx.runId, "Dokument") + ".pdf",
            file_path: `${ctx.userId}/selftest/${ctx.runId}.pdf`,
            file_type: "application/pdf",
            file_size: 1024,
          })
          .select("id")
          .single();
        if (error || !data) return { ok: false, message: error?.message ?? "Insert lieferte keine Daten" };
        ctx.created.push({ table: "meeting_agenda_documents", id: data.id });
        return { ok: true, message: "Dokument verknüpft." };
      },
    },
    {
      id: "create-task-link",
      label: "Aufgabe erzeugen und mit Sub-Agenda verknüpfen",
      run: async (ctx) => {
        const { data, error } = await supabase
          .from("tasks")
          .insert({
            title: title(ctx.runId, "Aufgabe"),
            description: SELFTEST_MARKER,
            status: "todo",
            priority: "medium",
            user_id: ctx.userId,
            tenant_id: ctx.tenantId,
          })
          .select("id")
          .single();
        if (error || !data) return { ok: false, message: error?.message ?? "Insert lieferte keine Daten" };
        ctx.created.push({ table: "tasks", id: data.id });
        ctx.data.taskId = data.id;

        if (ctx.data.subAgendaId) {
          const { error: linkErr } = await supabase
            .from("meeting_agenda_items")
            .update({ task_id: data.id })
            .eq("id", ctx.data.subAgendaId as string);
          if (linkErr) return { ok: false, message: `Aufgabe angelegt, Verknüpfung fehlgeschlagen: ${linkErr.message}` };
        }
        return { ok: true, message: "Aufgabe erstellt und verknüpft." };
      },
    },
    {
      id: "complete-agenda-item",
      label: "Agenda-Punkt abschließen (notes + result)",
      critical: false,
      run: async (ctx) => {
        const { error } = await supabase
          .from("meeting_agenda_items")
          .update({
            is_completed: true,
            notes: `${SELFTEST_MARKER} Notizen`,
            result_text: `${SELFTEST_MARKER} Ergebnis`,
          })
          .eq("id", ctx.data.firstAgendaId as string);
        if (error) return { ok: false, message: error.message };
        return { ok: true, message: "Agenda-Punkt abgeschlossen." };
      },
    },
    {
      id: "mark-carryover",
      label: "Carry-Over markieren",
      critical: false,
      run: async (ctx) => {
        const agendaItems = ctx.created.filter((c) => c.table === "meeting_agenda_items");
        const carryId = agendaItems[1]?.id;
        if (!carryId) return { ok: false, message: "Kein Agenda-Punkt für Carry-Over verfügbar." };
        const { error } = await supabase
          .from("meeting_agenda_items")
          .update({
            carry_over_to_next: true,
            carryover_notes: `${SELFTEST_MARKER} Bitte nächstes Mal besprechen`,
          })
          .eq("id", carryId);
        if (error) return { ok: false, message: error.message };
        ctx.data.carryoverSourceId = carryId;
        return { ok: true, message: "Carry-Over markiert." };
      },
    },
    {
      id: "create-followup-meeting",
      label: "Folge-Meeting (rekursiv) mit Carry-Over anlegen",
      critical: false,
      run: async (ctx) => {
        const meetingId = ctx.data.meetingId as string;
        const next = new Date();
        next.setDate(next.getDate() + 7);
        const { data: m, error } = await supabase
          .from("meetings")
          .insert({
            title: title(ctx.runId, "Folge-Meeting"),
            description: SELFTEST_MARKER,
            meeting_date: next.toISOString().slice(0, 10),
            meeting_time: "10:00",
            status: "planned",
            user_id: ctx.userId,
            tenant_id: ctx.tenantId,
            is_public: false,
            parent_meeting_id: meetingId,
            is_recurring_instance: true,
          })
          .select("id")
          .single();
        if (error || !m) return { ok: false, message: error?.message ?? "Insert lieferte keine Daten" };
        ctx.created.push({ table: "meetings", id: m.id });
        ctx.data.followupMeetingId = m.id;

        const { data: ag, error: agErr } = await supabase
          .from("meeting_agenda_items")
          .insert({
            meeting_id: m.id,
            title: title(ctx.runId, "Carry-Over"),
            description: SELFTEST_MARKER,
            order_index: 0,
            is_completed: false,
            is_recurring: false,
            carried_over_from: ctx.data.carryoverSourceId as string,
            original_meeting_date: new Date().toISOString().slice(0, 10),
            original_meeting_title: title(ctx.runId, "Meeting"),
          })
          .select("id")
          .single();
        if (agErr || !ag) return { ok: false, message: agErr?.message ?? "Carry-Over Insert fehlgeschlagen" };
        ctx.created.push({ table: "meeting_agenda_items", id: ag.id });
        return { ok: true, message: "Folge-Meeting + Carry-Over angelegt." };
      },
    },
    {
      id: "verify-links",
      label: "Verknüpfungen vollständig prüfen",
      run: async (ctx) => {
        const meetingId = ctx.data.meetingId as string;
        const [appt, agenda, parts, docs, followup] = await Promise.all([
          supabase.from("appointments").select("id").eq("meeting_id", meetingId),
          supabase.from("meeting_agenda_items").select("id, system_type, parent_id, task_id").eq("meeting_id", meetingId),
          supabase.from("meeting_participants").select("id").eq("meeting_id", meetingId),
          supabase.from("meeting_agenda_documents").select("id").eq("meeting_agenda_item_id", ctx.data.firstAgendaId as string),
          supabase.from("meetings").select("id").eq("parent_meeting_id", meetingId),
        ]);

        const systemFound = new Set(
          (agenda.data ?? []).map((a) => a.system_type).filter(Boolean) as string[],
        );
        const missingSystem = SYSTEM_TYPES.filter((t) => !systemFound.has(t));
        const hasSub = (agenda.data ?? []).some((a) => a.parent_id);
        const hasTaskLink = (agenda.data ?? []).some((a) => a.task_id);

        const ok =
          (appt.data?.length ?? 0) >= 1 &&
          (parts.data?.length ?? 0) >= 1 &&
          (docs.data?.length ?? 0) >= 1 &&
          (followup.data?.length ?? 0) >= 1 &&
          hasSub &&
          hasTaskLink &&
          missingSystem.length === 0;

        return {
          ok,
          message: ok
            ? "Alle Verknüpfungen vorhanden."
            : `Lücken: ${missingSystem.length ? `Sys=${missingSystem.join(",")} ` : ""}${hasSub ? "" : "Sub fehlt "}${hasTaskLink ? "" : "TaskLink fehlt"}`,
          details: {
            appointments: appt.data?.length ?? 0,
            participants: parts.data?.length ?? 0,
            agendaItems: agenda.data?.length ?? 0,
            documents: docs.data?.length ?? 0,
            followups: followup.data?.length ?? 0,
            systemTypes: Array.from(systemFound),
          },
        };
      },
    },
    {
      id: "complete-task",
      label: "Aufgabe abschließen",
      run: async (ctx) => {
        const taskId = ctx.data.taskId as string;
        const { error } = await supabase.from("tasks").update({ status: "completed" }).eq("id", taskId);
        if (error) return { ok: false, message: error.message };
        return { ok: true, message: "Aufgabe completed." };
      },
    },
    {
      id: "archive-meetings",
      label: "Meetings archivieren",
      run: async (ctx) => {
        const ids = [ctx.data.meetingId, ctx.data.followupMeetingId].filter(Boolean) as string[];
        const { error } = await supabase.from("meetings").update({ status: "archived" }).in("id", ids);
        if (error) return { ok: false, message: error.message };
        return { ok: true, message: `${ids.length} Meeting(s) archiviert.` };
      },
    },
  ],
};
