import { supabase } from "@/integrations/supabase/client";
import type { TestScenario } from "../types";
import { SELFTEST_MARKER, SELFTEST_PREFIX } from "../runner";

const title = (run: string, label: string) => `${SELFTEST_PREFIX} ${label} (${run})`;

export const meetingLifecycleScenario: TestScenario = {
  id: "meeting-lifecycle",
  title: "Meeting-Lifecycle",
  description:
    "Erstellt ein Meeting mit Kalendertermin, Teilnehmer, Agenda-Punkt und einer abgeleiteten Aufgabe. Verifiziert Verknüpfungen und räumt am Ende auf.",
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
        const meetingId = ctx.data.meetingId as string;
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
            meeting_id: meetingId,
          })
          .select("id")
          .single();
        if (error || !data) return { ok: false, message: error?.message ?? "Insert lieferte keine Daten" };
        ctx.created.push({ table: "appointments", id: data.id });
        ctx.data.appointmentId = data.id;
        return { ok: true, message: `Termin verknüpft.` };
      },
    },
    {
      id: "add-participant",
      label: "Teilnehmer (sich selbst) hinzufügen",
      run: async (ctx) => {
        const meetingId = ctx.data.meetingId as string;
        const { data, error } = await supabase
          .from("meeting_participants")
          .insert({
            meeting_id: meetingId,
            user_id: ctx.userId,
            role: "organizer",
            status: "accepted",
          })
          .select("id")
          .single();
        if (error || !data) return { ok: false, message: error?.message ?? "Insert lieferte keine Daten" };
        ctx.created.push({ table: "meeting_participants", id: data.id });
        return { ok: true, message: "Teilnehmer ergänzt." };
      },
    },
    {
      id: "add-agenda-item",
      label: "Agenda-Punkt anlegen",
      run: async (ctx) => {
        const meetingId = ctx.data.meetingId as string;
        const { data, error } = await supabase
          .from("meeting_agenda_items")
          .insert({
            meeting_id: meetingId,
            title: title(ctx.runId, "Agenda"),
            description: SELFTEST_MARKER,
            order_index: 0,
            is_completed: false,
            is_recurring: false,
          })
          .select("id")
          .single();
        if (error || !data) return { ok: false, message: error?.message ?? "Insert lieferte keine Daten" };
        ctx.created.push({ table: "meeting_agenda_items", id: data.id });
        ctx.data.agendaItemId = data.id;
        return { ok: true, message: "Agenda-Punkt erstellt." };
      },
    },
    {
      id: "create-task",
      label: "Aufgabe aus Meeting erzeugen",
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
        return { ok: true, message: "Aufgabe erstellt." };
      },
    },
    {
      id: "verify-links",
      label: "Verknüpfungen prüfen",
      run: async (ctx) => {
        const meetingId = ctx.data.meetingId as string;
        const { data: appt, error: e1 } = await supabase
          .from("appointments")
          .select("id, meeting_id")
          .eq("meeting_id", meetingId);
        if (e1) return { ok: false, message: `Termin-Lookup fehlgeschlagen: ${e1.message}` };
        const { data: agenda, error: e2 } = await supabase
          .from("meeting_agenda_items")
          .select("id")
          .eq("meeting_id", meetingId);
        if (e2) return { ok: false, message: `Agenda-Lookup fehlgeschlagen: ${e2.message}` };

        const apptOk = (appt?.length ?? 0) >= 1;
        const agendaOk = (agenda?.length ?? 0) >= 1;
        return {
          ok: apptOk && agendaOk,
          message: `Termine: ${appt?.length ?? 0}, Agenda: ${agenda?.length ?? 0}`,
        };
      },
    },
    {
      id: "complete-task",
      label: "Aufgabe abschließen",
      run: async (ctx) => {
        const taskId = ctx.data.taskId as string;
        const { error } = await supabase
          .from("tasks")
          .update({ status: "completed" })
          .eq("id", taskId);
        if (error) return { ok: false, message: error.message };
        const { data, error: readErr } = await supabase
          .from("tasks")
          .select("status")
          .eq("id", taskId)
          .single();
        if (readErr) return { ok: false, message: readErr.message };
        return {
          ok: data?.status === "completed",
          message: `Status nach Update: ${data?.status}`,
        };
      },
    },
    {
      id: "archive-meeting",
      label: "Meeting auf 'archiviert' setzen",
      run: async (ctx) => {
        const meetingId = ctx.data.meetingId as string;
        const { error } = await supabase
          .from("meetings")
          .update({ status: "archived" })
          .eq("id", meetingId);
        if (error) return { ok: false, message: error.message };
        return { ok: true, message: "Meeting archiviert." };
      },
    },
  ],
};
