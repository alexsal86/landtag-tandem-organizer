import { supabase } from "@/integrations/supabase/client";
import type { TestScenario } from "../types";
import { SELFTEST_MARKER, SELFTEST_PREFIX } from "../runner";
import { describeError, expectFields } from "../verify";
import { MANUAL_MERGE_FIELDS, resolveDuplicateContact } from "@/components/contact-import/duplicateResolution";

/**
 * Kern-Lifecycle eines Kontakts. Die weiterführenden Datenbank-Workflows
 * (Datenschutz, Themen, Dubletten-Scan, Sammelbearbeitung, Verteiler,
 * Briefingwissen, Förderungen) liegen im separaten Szenario
 * `contact-relations`, damit ein Policy-Fehler dort diese Prüfungen nicht
 * überspringt.
 */
export const contactLifecycleScenario: TestScenario = {
  id: "contact-lifecycle",
  title: "Kontakt-Lifecycle (Anlegen → Kategorie/Tags → Aktivität → Suche)",
  description: "Legt einen vollständigen Kontakt an, ändert Kategorie und Schlagworte, protokolliert eine Aktivität und prüft, dass er über die Suche gefunden wird.",
  touches: ["contacts", "contact_activities", "contact_usage_stats"],
  features: ["contacts"],
  writes: [
    { table: "contacts", columns: ["name", "user_id", "tenant_id", "email", "phone", "organization", "title", "category", "tags", "notes"] },
    { table: "contact_activities", columns: ["contact_id", "tenant_id", "created_by", "activity_type", "title", "description"] },
    { table: "contact_usage_stats", columns: ["contact_id", "tenant_id", "user_id", "usage_count"] },
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
        const manualMergeFills = MANUAL_MERGE_FIELDS.filter((field) => (resolveDuplicateContact({}, { [field]: "Wert" }, "merge").payload as Record<string, unknown>)[field] !== "Wert");
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
          manualMergeFieldsWritable: manualMergeFills.length === 0,
        };
        const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name);
        return {
          ok: failed.length === 0,
          message: failed.length === 0
            ? "Zusammenführen füllt nur Lücken und vereinigt Notizen/Tags; Überschreiben ersetzt Konflikte; Identität, Mandant und Auditfelder bleiben unangetastet; alle Felder des manuellen Merges sind durch dieselben Regeln abgedeckt."
            : `Fehlgeschlagen: ${failed.join(", ")}${manualMergeFills.length > 0 ? ` (nicht abgedeckt: ${manualMergeFills.join(", ")})` : ""}`,
        };
      },
    },
    {
      id: "merge-contact-guardrails",
      label: "Zusammenführen verlangt gültige Kontakte und unveränderliche Identitätsfelder",
      kind: "workflow",
      run: async (ctx) => {
        const target = ctx.data.contactId as string;
        const [unknownSource, sameContact, protectedField] = await Promise.all([
          supabase.rpc("merge_contacts", { p_target: target, p_source: crypto.randomUUID(), p_updates: {} }),
          supabase.rpc("merge_contacts", { p_target: target, p_source: target, p_updates: {} }),
          supabase.rpc("merge_contacts", { p_target: target, p_source: crypto.randomUUID(), p_updates: { tenant_id: ctx.tenantId } }),
        ]);
        const checks = {
          unbekannterKontaktAbgelehnt: unknownSource.error?.code === "22023",
          selbstZusammenfuehrenAbgelehnt: sameContact.error?.code === "22023",
          identitaetsfeldAbgelehnt: protectedField.error?.code === "22023",
        };
        const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name);
        return {
          ok: failed.length === 0,
          message: failed.length === 0
            ? "Fremde bzw. unbekannte Kontakte werden abgewiesen und Mandanten-/Identitätsfelder können nicht über die Zusammenführung geschrieben werden."
            : `Fehlgeschlagen: ${failed.join(", ")}`,
        };
      },
    },
    {
      id: "merge-contact-atomic",
      label: "Zusammenführen ist atomar: Verknüpfungen wandern, Kollisionen behalten ihre Daten",
      kind: "workflow",
      run: async (ctx) => {
        const targetId = ctx.data.contactId as string;
        const { data: secondary, error: secondaryError } = await supabase
          .from("contacts")
          .insert({ name: `${SELFTEST_PREFIX} Erika Doppelt (${ctx.runId})`, user_id: ctx.userId, tenant_id: ctx.tenantId, email: "erika.doppelt@example.org", notes: SELFTEST_MARKER, tags: ["selbsttest"] })
          .select("id")
          .single();
        if (secondaryError || !secondary) return { ok: false, message: describeError(secondaryError) };
        ctx.trackRecord({ table: "contacts", id: secondary.id });

        const movedActivity = await supabase
          .from("contact_activities")
          .insert([{ contact_id: secondary.id, tenant_id: ctx.tenantId, created_by: ctx.userId, activity_type: "note", title: `${SELFTEST_PREFIX} Zweitkontakt-Notiz`, description: SELFTEST_MARKER }])
          .select("id")
          .single();
        if (movedActivity.error || !movedActivity.data) return { ok: false, message: describeError(movedActivity.error) };
        ctx.trackRecord({ table: "contact_activities", id: movedActivity.data.id });

        // Nutzungszähler beider Kontakte kollidieren im Unique-Paar (user, tenant).
        const stats = await supabase
          .from("contact_usage_stats")
          .insert([
            { contact_id: targetId, user_id: ctx.userId, tenant_id: ctx.tenantId, usage_count: 2 },
            { contact_id: secondary.id, user_id: ctx.userId, tenant_id: ctx.tenantId, usage_count: 3 },
          ])
          .select("id");
        if (stats.error) return { ok: false, message: describeError(stats.error) };
        (stats.data ?? []).forEach((row) => ctx.trackRecord({ table: "contact_usage_stats", id: row.id }));

        const { data: result, error: mergeError } = await supabase.rpc("merge_contacts", {
          p_target: targetId,
          p_source: secondary.id,
          p_updates: { notes: `${SELFTEST_MARKER} zusammengeführt`, tags: ["selbsttest", "zusammengeführt"] },
        });
        if (mergeError) return { ok: false, message: describeError(mergeError) };

        const [source, kept, activity, usage] = await Promise.all([
          supabase.from("contacts").select("id").eq("id", secondary.id).maybeSingle(),
          supabase.from("contacts").select("notes, tags").eq("id", targetId).maybeSingle(),
          supabase.from("contact_activities").select("contact_id").eq("id", movedActivity.data.id).maybeSingle(),
          supabase.from("contact_usage_stats").select("usage_count").eq("contact_id", targetId).eq("user_id", ctx.userId),
        ]);
        const failure = [source, kept, activity, usage].map((response) => response.error).find(Boolean);
        if (failure) return { ok: false, message: describeError(failure) };

        const merged = (result ?? {}) as Record<string, unknown>;
        const moved = Number(merged.moved_links ?? 0);
        const dropped = Number(merged.dropped_links ?? 0);
        const checks = {
          zweitkontaktGeloescht: !source.data,
          notizenUebernommen: kept.data?.notes === `${SELFTEST_MARKER} zusammengeführt`,
          tagsVereinigt: (kept.data?.tags ?? []).includes("zusammengeführt"),
          aktivitaetUmgehaengt: activity.data?.contact_id === targetId,
          nutzungZusammengefasst: usage.data?.length === 1 && usage.data[0].usage_count === 5,
          verknuepfungenGemeldet: moved >= 1 && dropped >= 1,
        };
        const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name);
        return {
          ok: failed.length === 0,
          message: failed.length === 0
            ? `Alle Verknüpfungen wandern mit (${moved} verschoben, ${dropped} Kollisionen ohne Datenverlust aufgelöst), der Zweitkontakt ist gelöscht.`
            : `Fehlgeschlagen: ${failed.join(", ")}`,
          details: checks,
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
