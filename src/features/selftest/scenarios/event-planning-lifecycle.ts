import { supabase } from "@/integrations/supabase/client";
import type { TestScenario } from "../types";
import { SELFTEST_MARKER, SELFTEST_PREFIX } from "../runner";
import { describeError, expectFields } from "../verify";

const title = (run: string, label: string) => `${SELFTEST_PREFIX} ${label} (${run})`;

const isoDate = (offsetDays: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
};

export const eventPlanningLifecycleScenario: TestScenario = {
  id: "event-planning-lifecycle",
  title: "Event-Planung (komplett: Termine, Speaker, Checkliste, Timeline)",
  description:
    "Erstellt eine Event-Planung mit zwei Terminoptionen, Speakern, Ansprechpartner, Checklisten-Items (inkl. social_media + rsvp) und Timeline-Zuweisung.",
  touches: [
    "event_plannings",
    "event_planning_dates",
    "event_planning_speakers",
    "event_planning_contacts",
    "event_planning_checklist_items",
    "event_planning_timeline_assignments",
  ],
  features: ["event-planning"],
  writes: [
    {
      table: "event_plannings",
      columns: ["title", "description", "location", "background_info", "is_private", "is_digital", "user_id", "tenant_id"],
    },
    { table: "event_planning_dates", columns: ["event_planning_id", "date_time", "is_confirmed"] },
    { table: "event_planning_speakers", columns: ["event_planning_id", "name", "bio", "topic", "order_index"] },
    { table: "event_planning_contacts", columns: ["event_planning_id", "name", "email", "phone", "role"] },
    { table: "event_planning_checklist_items", columns: ["event_planning_id", "title", "is_completed", "order_index", "type"] },
    { table: "event_planning_timeline_assignments", columns: ["event_planning_id", "checklist_item_id", "due_date"] },
  ],
  links: (ctx) => {
    const links: Array<{ label: string; href: string }> = [
      { label: "Planungen-Übersicht", href: "/eventplanning" },
    ];
    if (ctx.data.eventPlanningId) {
      links.push({
        label: "Diese Planung öffnen",
        href: `/eventplanning/${ctx.data.eventPlanningId as string}`,
      });
    }
    return links;
  },
  steps: [
    {
      id: "create-event-planning",
      label: "Event-Planung anlegen",
      run: async (ctx) => {
        const payload = {
          title: title(ctx.runId, "Demo-Veranstaltung"),
          description: `${SELFTEST_MARKER} Großveranstaltung mit Podiumsdiskussion`,
          location: "Stadthalle Karlsruhe",
          background_info: `${SELFTEST_MARKER} Hintergrund zur Veranstaltung`,
          is_private: false,
          is_digital: false,
          user_id: ctx.userId,
          tenant_id: ctx.tenantId,
        };
        const { data, error } = await supabase.from("event_plannings").insert(payload).select("id").single();
        if (error || !data) return { ok: false, message: describeError(error) };
        ctx.created.push({ table: "event_plannings", id: data.id });
        ctx.data.eventPlanningId = data.id;
        return expectFields("event_plannings", data.id, payload, "Event-Planung");
      },
    },
    {
      id: "create-dates",
      label: "Zwei Terminoptionen (eine bestätigt)",
      run: async (ctx) => {
        const epId = ctx.data.eventPlanningId as string;
        const dates = [
          { event_planning_id: epId, date_time: new Date(`${isoDate(14)}T18:00:00Z`).toISOString(), is_confirmed: false },
          { event_planning_id: epId, date_time: new Date(`${isoDate(21)}T18:00:00Z`).toISOString(), is_confirmed: true },
        ];
        const { data, error } = await supabase.from("event_planning_dates").insert(dates).select("id");
        if (error || !data) return { ok: false, message: describeError(error) };
        for (const r of data) ctx.created.push({ table: "event_planning_dates", id: r.id });
        return { ok: true, message: `${data.length} Terminoptionen angelegt.` };
      },
    },
    {
      id: "create-speakers",
      label: "Speaker (2)",
      critical: false,
      run: async (ctx) => {
        const epId = ctx.data.eventPlanningId as string;
        const speakers = [
          { event_planning_id: epId, name: title(ctx.runId, "Speaker A"), bio: "Expertin Klima", topic: "Klimapolitik", order_index: 0 },
          { event_planning_id: epId, name: title(ctx.runId, "Speaker B"), bio: "Mobilitätsexperte", topic: "Verkehrswende", order_index: 1 },
        ];
        const { data, error } = await supabase.from("event_planning_speakers").insert(speakers).select("id");
        if (error || !data) return { ok: false, message: describeError(error) };
        for (const r of data) ctx.created.push({ table: "event_planning_speakers", id: r.id });
        return { ok: true, message: `${data.length} Speaker angelegt.` };
      },
    },
    {
      id: "create-contact",
      label: "Ansprechpartner anlegen",
      critical: false,
      run: async (ctx) => {
        const payload = {
          event_planning_id: ctx.data.eventPlanningId as string,
          name: title(ctx.runId, "Veranstalter"),
          email: "demo@selftest.invalid",
          phone: "+49 721 0000000",
          role: "Hauptansprechpartner",
        };
        const { data, error } = await supabase.from("event_planning_contacts").insert(payload).select("id").single();
        if (error || !data) return { ok: false, message: describeError(error) };
        ctx.created.push({ table: "event_planning_contacts", id: data.id });
        return expectFields("event_planning_contacts", data.id, payload, "Ansprechpartner");
      },
    },
    {
      id: "create-checklist",
      label: "Checkliste mit social_media + rsvp Items",
      run: async (ctx) => {
        const epId = ctx.data.eventPlanningId as string;
        const items = [
          { event_planning_id: epId, title: title(ctx.runId, "Raum buchen"), is_completed: true, order_index: 0, type: "default" },
          { event_planning_id: epId, title: title(ctx.runId, "Social-Media planen"), is_completed: false, order_index: 1, type: "social_media" },
          { event_planning_id: epId, title: title(ctx.runId, "RSVP einrichten"), is_completed: false, order_index: 2, type: "rsvp" },
          { event_planning_id: epId, title: title(ctx.runId, "Bühne aufbauen"), is_completed: false, order_index: 3, type: "default" },
        ];
        const { data, error } = await supabase.from("event_planning_checklist_items").insert(items).select("id, type");
        if (error || !data) return { ok: false, message: describeError(error) };
        for (const r of data) ctx.created.push({ table: "event_planning_checklist_items", id: r.id });
        ctx.data.firstChecklistId = data[0].id;
        return { ok: true, message: `${data.length} Checklist-Items angelegt.` };
      },
    },
    {
      id: "create-timeline",
      label: "Timeline-Zuweisung für erstes Item",
      critical: false,
      run: async (ctx) => {
        const payload = {
          event_planning_id: ctx.data.eventPlanningId as string,
          checklist_item_id: ctx.data.firstChecklistId as string,
          due_date: isoDate(7),
        };
        const { data, error } = await supabase.from("event_planning_timeline_assignments").insert(payload).select("id").single();
        if (error || !data) return { ok: false, message: describeError(error) };
        ctx.created.push({ table: "event_planning_timeline_assignments", id: data.id });
        return expectFields("event_planning_timeline_assignments", data.id, payload, "Timeline");
      },
    },
    {
      id: "verify",
      label: "Vollständigkeit prüfen",
      run: async (ctx) => {
        const epId = ctx.data.eventPlanningId as string;
        const [dates, speakers, contacts, items, timeline] = await Promise.all([
          supabase.from("event_planning_dates").select("id").eq("event_planning_id", epId),
          supabase.from("event_planning_speakers").select("id").eq("event_planning_id", epId),
          supabase.from("event_planning_contacts").select("id").eq("event_planning_id", epId),
          supabase.from("event_planning_checklist_items").select("id, type").eq("event_planning_id", epId),
          supabase.from("event_planning_timeline_assignments").select("id").eq("event_planning_id", epId),
        ]);
        const types = new Set((items.data ?? []).map((i) => i.type));
        const ok = (dates.data?.length ?? 0) >= 2 &&
          (speakers.data?.length ?? 0) >= 2 &&
          (contacts.data?.length ?? 0) >= 1 &&
          (items.data?.length ?? 0) >= 4 &&
          (timeline.data?.length ?? 0) >= 1 &&
          types.has("social_media") && types.has("rsvp");
        return {
          ok,
          message: ok ? "Alle Bestandteile vorhanden." : "Lücken in Event-Planung.",
          details: {
            dates: dates.data?.length ?? 0,
            speakers: speakers.data?.length ?? 0,
            contacts: contacts.data?.length ?? 0,
            checklist: items.data?.length ?? 0,
            timeline: timeline.data?.length ?? 0,
            checklistTypes: Array.from(types),
          },
        };
      },
    },
  ],
};
