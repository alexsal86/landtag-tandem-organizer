import { supabase } from "@/integrations/supabase/client";
import type { TestScenario } from "../types";
import { SELFTEST_MARKER, SELFTEST_PREFIX } from "../runner";
import { describeError, expectFields } from "../verify";

export const quickNoteLifecycleScenario: TestScenario = {
  id: "quick-note-lifecycle",
  title: "Notizen-Lifecycle (Anlegen → Priorität → Anheften → Aufgabe → Archiv)",
  description: "Legt eine Notiz mit Priorität, Farbe und Schlagworten an, heftet sie an, macht daraus eine Aufgabe und archiviert sie. Jeder Schritt liest seine Felder zurück.",
  touches: ["quick_notes", "tasks"],
  features: ["quick-notes", "tasks"],
  writes: [
    { table: "quick_notes", columns: ["title", "content", "user_id", "tenant_id", "priority_level", "color", "category", "tags", "is_pinned", "task_id", "is_archived", "archived_at"] },
    { table: "tasks", columns: ["title", "description", "user_id", "tenant_id", "status", "priority", "category"] },
  ],
  links: () => [{ label: "Notizen öffnen", href: "/mywork?tab=capture" }],
  steps: [
    {
      id: "create", label: "Notiz mit Priorität, Farbe und Schlagworten anlegen", critical: true,
      run: async (ctx) => {
        const payload = { title: `${SELFTEST_PREFIX} Notiz (${ctx.runId})`, content: `<p>${SELFTEST_MARKER} Rückruf Bürgerin wegen Lärmschutz</p>`, user_id: ctx.userId, tenant_id: ctx.tenantId, priority_level: 2, color: "#f59e0b", category: "general", tags: ["selbsttest", "lärmschutz"] };
        const { data, error } = await supabase.from("quick_notes").insert(payload).select("id").single();
        if (error || !data) return { ok: false, message: describeError(error) };
        ctx.created.push({ table: "quick_notes", id: data.id });
        ctx.data.noteId = data.id;
        return expectFields("quick_notes", data.id, { ...payload, is_pinned: false, is_archived: false }, "Notiz");
      },
    },
    {
      id: "pin", label: "Anheften + Priorität erhöhen",
      run: async (ctx) => {
        const id = ctx.data.noteId as string;
        const update = { is_pinned: true, priority_level: 3 };
        const { error } = await supabase.from("quick_notes").update(update).eq("id", id);
        if (error) return { ok: false, message: describeError(error) };
        return expectFields("quick_notes", id, update, "Anheften");
      },
    },
    {
      id: "to-task", label: "Aus Notiz eine Aufgabe machen (verknüpft)",
      run: async (ctx) => {
        const id = ctx.data.noteId as string;
        const task = { title: `${SELFTEST_PREFIX} Aufgabe aus Notiz (${ctx.runId})`, description: SELFTEST_MARKER, user_id: ctx.userId, tenant_id: ctx.tenantId, status: "todo", priority: "high", category: "personal" };
        const { data, error } = await supabase.from("tasks").insert(task).select("id").single();
        if (error || !data) return { ok: false, message: describeError(error) };
        ctx.created.splice(0, 0, { table: "tasks", id: data.id }); // Aufgabe zuletzt löschen
        const { error: le } = await supabase.from("quick_notes").update({ task_id: data.id }).eq("id", id);
        if (le) return { ok: false, message: describeError(le) };
        return expectFields("quick_notes", id, { task_id: data.id }, "Verknüpfung");
      },
    },
    {
      id: "archive", label: "Archivieren",
      run: async (ctx) => {
        const id = ctx.data.noteId as string;
        const update = { is_archived: true, archived_at: new Date().toISOString(), is_pinned: false };
        const { error } = await supabase.from("quick_notes").update(update).eq("id", id);
        if (error) return { ok: false, message: describeError(error) };
        return expectFields("quick_notes", id, update, "Archiv");
      },
    },
  ],
};
