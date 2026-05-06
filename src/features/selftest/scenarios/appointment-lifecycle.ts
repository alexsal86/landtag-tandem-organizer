import { supabase } from "@/integrations/supabase/client";
import type { TestScenario } from "../types";
import { SELFTEST_MARKER, SELFTEST_PREFIX } from "../runner";
import { describeError, expectFields } from "../verify";

const title = (run: string, label: string) => `${SELFTEST_PREFIX} ${label} (${run})`;

export const appointmentLifecycleScenario: TestScenario = {
  id: "appointment-lifecycle",
  title: "Termin-Lifecycle (Kalender + Briefing + Feedback)",
  description:
    "Erzeugt einen vollständigen Kalender-Termin inkl. Vorbereitung/Briefing (visit_reason, conversation_partners, companions, program, sections) und Feedback. Verifiziert jedes geschriebene Feld.",
  touches: ["appointments", "appointment_preparations", "appointment_feedback"],
  features: ["appointments", "briefings"],
  writes: [
    {
      table: "appointments",
      columns: [
        "title", "description", "start_time", "end_time", "location", "category",
        "priority", "status", "is_all_day", "user_id", "tenant_id", "reminder_minutes",
      ],
    },
    {
      table: "appointment_preparations",
      columns: ["appointment_id", "tenant_id", "created_by", "title", "status", "preparation_data", "checklist_items", "notes"],
    },
    {
      table: "appointment_feedback",
      columns: ["appointment_id", "user_id", "tenant_id", "feedback_status", "notes", "event_type", "completed_at"],
    },
  ],
  links: (ctx) => {
    const links: Array<{ label: string; href: string }> = [
      { label: "Kalender öffnen", href: "/calendar" },
    ];
    if (ctx.data.appointmentId) {
      links.push({
        label: "Termin im Kalender hervorheben",
        href: `/calendar?highlight=${ctx.data.appointmentId as string}`,
      });
    }
    return links;
  },
  steps: [
    {
      id: "create-appointment",
      label: "Termin anlegen (heute, 2h Block)",
      run: async (ctx) => {
        const start = new Date();
        start.setHours(start.getHours() + 2, 0, 0, 0);
        const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
        const payload = {
          title: title(ctx.runId, "Demo-Termin"),
          description: `${SELFTEST_MARKER} Bürgersprechstunde mit Ortsbesichtigung`,
          start_time: start.toISOString(),
          end_time: end.toISOString(),
          location: "Bürgerhaus Karlsruhe-Mitte",
          category: "buergersprechstunde",
          priority: "high",
          status: "planned",
          is_all_day: false,
          reminder_minutes: 30,
          user_id: ctx.userId,
          tenant_id: ctx.tenantId,
        };
        const { data, error } = await supabase.from("appointments").insert(payload).select("id").single();
        if (error || !data) return { ok: false, message: describeError(error) };
        ctx.created.push({ table: "appointments", id: data.id });
        ctx.data.appointmentId = data.id;
        return expectFields("appointments", data.id, payload, "Termin");
      },
    },
    {
      id: "create-preparation",
      label: "Briefing/Vorbereitung mit allen Strukturfeldern",
      run: async (ctx) => {
        const preparation_data = {
          visit_reason: "einladung" as const,
          conversation_partners: [
            { id: crypto.randomUUID(), name: "Dr. Beispiel", role: "Ortsvorsteherin", organization: "Stadt Karlsruhe", note: "Ansprechpartnerin vor Ort" },
          ],
          companions: [
            { id: crypto.randomUUID(), name: "Mitarbeiter Müller", type: "mitarbeiter" as const, note: "Protokoll" },
          ],
          has_parking: true,
          social_media_planned: true,
          press_planned: false,
          program: [
            { id: crypto.randomUUID(), time: "14:00", item: "Begrüßung", notes: "Kurze Vorstellung" },
            { id: crypto.randomUUID(), time: "14:15", item: "Rundgang", notes: "Mit Fotograf" },
          ],
          sections: [
            { type: "appointment_preparation_section" as const, status: "in_progress" as const, id: crypto.randomUUID(), title: "Hintergrund", content: `${SELFTEST_MARKER} Hintergrundinfos` },
          ],
        };
        const checklist_items = [
          { id: crypto.randomUUID(), label: "Anfahrt prüfen", completed: true },
          { id: crypto.randomUUID(), label: "Sprechzettel mitnehmen", completed: false },
        ];
        const payload = {
          appointment_id: ctx.data.appointmentId as string,
          tenant_id: ctx.tenantId,
          created_by: ctx.userId,
          title: title(ctx.runId, "Vorbereitung"),
          status: "in_progress",
          preparation_data,
          checklist_items,
          notes: `${SELFTEST_MARKER} Briefing-Notiz`,
        };
        const { data, error } = await supabase.from("appointment_preparations").insert(payload).select("id").single();
        if (error || !data) return { ok: false, message: describeError(error) };
        ctx.created.push({ table: "appointment_preparations", id: data.id });
        ctx.data.preparationId = data.id;
        return expectFields("appointment_preparations", data.id, payload, "Vorbereitung");
      },
    },
    {
      id: "create-feedback",
      label: "Feedback (abgeschlossen, mit Notizen)",
      critical: false,
      run: async (ctx) => {
        const payload = {
          appointment_id: ctx.data.appointmentId as string,
          user_id: ctx.userId,
          tenant_id: ctx.tenantId,
          feedback_status: "completed",
          notes: `${SELFTEST_MARKER} Sehr produktives Gespräch.`,
          event_type: "appointment",
          completed_at: new Date().toISOString(),
        };
        const { data, error } = await supabase.from("appointment_feedback").insert(payload).select("id").single();
        if (error || !data) return { ok: false, message: describeError(error) };
        ctx.created.push({ table: "appointment_feedback", id: data.id });
        return expectFields("appointment_feedback", data.id, payload, "Feedback");
      },
    },
  ],
};
