import { supabase } from "@/integrations/supabase/client";
import type { TestScenario } from "../types";
import { SELFTEST_MARKER, SELFTEST_PREFIX } from "../runner";
import { describeError, expectFields } from "../verify";

export const contactLifecycleScenario: TestScenario = {
  id: "contact-lifecycle",
  title: "Kontakt-Lifecycle (Anlegen → Kategorie/Tags → Aktivität → Suche)",
  description: "Legt einen vollständigen Kontakt an, ändert Kategorie und Schlagworte, protokolliert eine Aktivität und prüft, dass er über die Suche gefunden wird.",
  touches: ["contacts", "contact_activities"],
  features: ["contacts"],
  writes: [
    { table: "contacts", columns: ["name", "user_id", "tenant_id", "email", "phone", "organization", "title", "category", "tags", "notes"] },
    { table: "contact_activities", columns: ["contact_id", "tenant_id", "created_by", "activity_type", "title", "description"] },
  ],
  links: (ctx) => ctx.data.contactId ? [{ label: "Kontakt öffnen", href: `/contacts/${ctx.data.contactId}` }] : [],
  steps: [
    {
      id: "create", label: "Kontakt mit allen Stammdaten anlegen", critical: true,
      run: async (ctx) => {
        const payload = { name: `${SELFTEST_PREFIX} Erika Muster (${ctx.runId})`, user_id: ctx.userId, tenant_id: ctx.tenantId, email: "erika.muster@example.org", phone: "+49 721 123456", organization: "Bürgerverein Südstadt", title: "Vorsitzende", category: "citizen", tags: ["selbsttest"], notes: SELFTEST_MARKER };
        const { data, error } = await supabase.from("contacts").insert(payload).select("id").single();
        if (error || !data) return { ok: false, message: describeError(error) };
        ctx.trackRecord({ table: "contacts", id: data.id });
        ctx.data.contactId = data.id;
        return expectFields("contacts", data.id, payload, "Kontakt");
      },
    },
    {
      id: "categorize", label: "Kategorie + Schlagworte ändern",
      run: async (ctx) => {
        const id = ctx.data.contactId as string;
        const update = { category: "organization", tags: ["selbsttest", "verein", "südstadt"] };
        const { error } = await supabase.from("contacts").update(update).eq("id", id);
        if (error) return { ok: false, message: describeError(error) };
        return expectFields("contacts", id, update, "Kategorie");
      },
    },
    {
      id: "activity", label: "Aktivität protokollieren",
      run: async (ctx) => {
        const payload = { contact_id: ctx.data.contactId as string, tenant_id: ctx.tenantId, created_by: ctx.userId, activity_type: "call", title: `${SELFTEST_PREFIX} Telefonat`, description: SELFTEST_MARKER };
        const { data, error } = await supabase.from("contact_activities").insert(payload).select("id").single();
        if (error || !data) return { ok: false, message: describeError(error) };
        ctx.trackRecord({ table: "contact_activities", id: data.id });
        return expectFields("contact_activities", data.id, payload, "Aktivität");
      },
    },
    {
      id: "search", label: "Kontakt über Namenssuche auffindbar",
      run: async (ctx) => {
        const { data, error } = await supabase.from("contacts").select("id").eq("tenant_id", ctx.tenantId).ilike("name", `%Erika Muster (${ctx.runId})%`);
        if (error) return { ok: false, message: describeError(error) };
        return data?.some((r) => r.id === ctx.data.contactId) ? { ok: true, message: "Gefunden." } : { ok: false, message: "Nicht gefunden." };
      },
    },
  ],
};
