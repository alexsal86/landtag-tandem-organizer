import { supabase } from "@/integrations/supabase/client";
import type { TestScenario } from "../types";
import { SELFTEST_MARKER, SELFTEST_PREFIX } from "../runner";
import { describeError, expectFields } from "../verify";
import { resolveDuplicateContact } from "@/components/contact-import/duplicateResolution";

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
      id: "import-duplicate-resolution",
      label: "Import-Duplikate werden zusammengeführt oder überschrieben statt neu angelegt",
      kind: "logic",
      run: async () => {
        const existing = { name: "Erika Muster", email: "erika@example.org", phone: "+49 721 123456", organization: "Bürgerverein Südstadt", notes: "Erstkontakt", tags: ["verein"] };
        const incoming = { name: "Erika Muster", email: "erika.neu@example.org", phone: "+49 721 123456", mobile_phone: "+49 170 1234567", organization: "Bürgerverein Süd", organization_id: "org-2", notes: "Rückruf", tags: ["presse"] };
        const merged = resolveDuplicateContact(existing, incoming, "merge");
        const overwritten = resolveDuplicateContact(existing, incoming, "overwrite");
        const unchanged = resolveDuplicateContact(existing, { name: "Erika Muster", email: "erika@example.org" }, "merge");
        const protectedAttempt = resolveDuplicateContact(existing, { ...incoming, id: "fremd", tenant_id: "fremd", user_id: "fremd", created_at: "2020-01-01" }, "overwrite");
        const checks = {
          mergeKeepsExistingEmail: merged.payload.email === undefined,
          mergeFillsGap: merged.payload.mobile_phone === "+49 170 1234567",
          mergeKeepsExistingOrganization: merged.payload.organization === undefined,
          mergeAppendsNotes: merged.payload.notes === "Erstkontakt\n\nRückruf",
          mergeUnitesTags: (merged.payload.tags ?? []).join(",") === "verein,presse",
          overwriteReplacesEmail: overwritten.payload.email === "erika.neu@example.org",
          overwriteReplacesOrganization: overwritten.payload.organization === "Bürgerverein Süd" && overwritten.payload.organization_id === "org-2",
          overwriteKeepsTags: (overwritten.payload.tags ?? []).join(",") === "verein,presse",
          identicalRowChangesNothing: Object.keys(unchanged.payload).length === 0,
          protectedColumnsUntouched: ["id", "tenant_id", "user_id", "created_at"].every((key) => !(key in protectedAttempt.payload)),
        };
        const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name);
        return {
          ok: failed.length === 0,
          message: failed.length === 0
            ? "Zusammenführen füllt nur Lücken und vereinigt Notizen/Tags; Überschreiben ersetzt Konflikte; Identität, Mandant und Auditfelder bleiben unangetastet."
            : `Fehlgeschlagen: ${failed.join(", ")}`,
        };
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
