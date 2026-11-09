import { supabase } from "@/integrations/supabase/client";
import { canDecide } from "@/features/appointment-requests/logic";
import { SELFTEST_PREFIX } from "../runner";
import { describeError, expectFields } from "../verify";
import type { TestScenario } from "../types";

export const accessBoundariesScenario: TestScenario = {
  id: "access-boundaries", title: "Zugriffsschutz (Bürogrenzen und Entscheiderrolle)",
  description: "Prüft Schreibsperren mit der aktuellen Anmeldung und die Entscheidung einer Terminanfrage gemäß der tatsächlichen Rolle.",
  features: ["appointment-requests", "permissions"], touches: ["appointment_requests"],
  checks: ["Schreibversuch mit fremder Büro-ID scheitert an RLS", "Unberechtigte Rolle darf nicht entscheiden", "Berechtigte Rolle darf ablehnen"],
  limitations: ["Getestet wird die aktuelle Rolle. Für die vollständige Rollenmatrix mit beiden Testkonten ausführen.", "Lesetrennung zweier existierender Büros erfordert eine separate Testumgebung mit zwei Konten."],
  steps: [
    {
      id: "admin-sort-guard", label: "Konfigurationssortierung: Rollenprüfung und Tabellen-Whitelist", kind: "workflow",
      run: async ctx => {
        const [platform, office] = await Promise.all([
          supabase.rpc("is_superadmin", { _user_id: ctx.userId }),
          supabase.rpc("is_tenant_admin", { _user_id: ctx.userId, _tenant_id: ctx.tenantId }),
        ]);
        if (platform.error || office.error) return { ok: false, message: describeError(platform.error ?? office.error) };
        const globalSort = await supabase.rpc("reorder_admin_items", { _tenant_id: ctx.tenantId, _table: "task_statuses", _ids: [] });
        if (platform.data ? Boolean(globalSort.error) : globalSort.error?.code !== "42501") return { ok: false, message: "Globale Stammdaten erfordern Plattformrechte.", details: globalSort.error };
        const result = await supabase.rpc("reorder_admin_items", { _tenant_id: ctx.tenantId, _table: "__selftest_forbidden__", _ids: [] });
        const expectedCode = platform.data || office.data ? "22023" : "42501";
        return { ok: result.error?.code === expectedCode, message: result.error?.code === expectedCode ? "Unzulässige Sortierung vor Schreibzugriff abgewiesen." : "Sortiersperre fehlt.", details: result.error };
      },
    },
    {
      id: "calendar-schedule", label: "Kalenderplan: Minuten, Sommerzeit und Wiederholungsstunde", kind: "workflow",
      run: async () => {
        const cases = [
          ["2026-11-09T05:00:00Z", "2026-11-08 06:30:00"],
          ["2026-11-09T05:30:00Z", "2026-11-09 06:30:00"],
          ["2026-07-09T04:30:00Z", "2026-07-09 06:30:00"],
          ["2026-10-25T01:35:00Z", "2026-10-24 06:30:00"],
        ];
        for (const [now, expected] of cases) {
          const result = await supabase.rpc("calendar_sync_slot", { _now: now, _time: "06:30", _interval: 24, _timezone: "Europe/Berlin" });
          if (result.error || result.data?.replace("T", " ").slice(0, 19) !== expected) return { ok: false, message: "Kalenderplan weicht ab.", details: { now, expected, actual: result.data, error: result.error } };
        }
        return { ok: true, message: "Minuten und Zeitzonen des Kalenderplans korrekt." };
      },
    },
    {
      id: "office-default-template", label: "Meeting-Standardvorlage ist pro Büro eindeutig", kind: "workflow",
      run: async ctx => {
        const result = await supabase.from("meeting_templates").select("id").eq("tenant_id", ctx.tenantId).eq("is_default", true);
        if (result.error) return { ok: false, message: describeError(result.error) };
        return { ok: (result.data?.length ?? 0) <= 1, message: `${result.data?.length ?? 0} Standardvorlagen im aktuellen Büro.` };
      },
    },
    {
      id: "admin-role-guard", label: "Globale Rollenänderung: Plattformrecht und gültige Rolle erforderlich", kind: "workflow",
      run: async (ctx) => {
        const platform = await supabase.rpc("is_superadmin", { _user_id: ctx.userId });
        if (platform.error) return { ok: false, message: describeError(platform.error) };
        // An invalid role is rejected before any write, including for platform admins.
        const result = await supabase.rpc("replace_user_role", {
          _tenant_id: ctx.tenantId, _user_id: ctx.userId, _role: "__selftest_invalid__",
        });
        const expectedCode = platform.data ? "22023" : "42501";
        return { ok: result.error?.code === expectedCode,
          message: result.error?.code === expectedCode ? "Ungültige oder unberechtigte Rollenänderung verweigert." : "Erwartete Rollensperre fehlt.",
          details: { expectedCode, actualCode: result.error?.code } };
      },
    },
    {
      id: "foreign-tenant", label: "Schreiben mit nicht zugehöriger Büro-ID wird verweigert", kind: "workflow",
      run: async (ctx) => {
        const tenantId = crypto.randomUUID();
        const result = await supabase.from("appointment_requests").insert({ tenant_id: tenantId,
          title: `${SELFTEST_PREFIX} Bürogrenze (${ctx.runId})`, requested_date: "2099-01-15" }).select("id").single();
        if (result.data) ctx.trackRecord({ table: "appointment_requests", id: result.data.id });
        return { ok: result.error?.code === "42501", message: result.error?.code === "42501" ? "RLS verweigert den Schreibversuch." : "Erwartete RLS-Sperre fehlt.", details: { expectedCode: "42501", actualCode: result.error?.code } };
      },
    },
    {
      id: "create-request", label: "Eigene Testanfrage für Rollenprüfung anlegen",
      run: async (ctx) => {
        const result = await supabase.from("appointment_requests").insert({ tenant_id: ctx.tenantId,
          title: `${SELFTEST_PREFIX} Rollenprüfung (${ctx.runId})`, requested_date: "2099-01-15" }).select("id").single();
        if (result.error || !result.data) return { ok: false, message: describeError(result.error) };
        ctx.trackRecord({ table: "appointment_requests", id: result.data.id });
        ctx.data.requestId = result.data.id;
        return expectFields("appointment_requests", result.data.id, { status: "open" });
      },
    },
    {
      id: "role-decision", label: "Entscheidungsfunktion respektiert die aktuelle Rolle", kind: "workflow",
      run: async (ctx) => {
        const id = ctx.data.requestId as string;
        const result = await supabase.rpc("decide_appointment_request", { _request_id: id, _decision: "declined" });
        if (canDecide(ctx.role)) {
          if (result.error) return { ok: false, message: describeError(result.error) };
          return expectFields("appointment_requests", id, { status: "declined", decided_by: ctx.userId, appointment_id: null }, "Berechtigte Entscheidung");
        }
        if (!result.error || !/Nur Abgeordnete oder Büroleitung/.test(result.error.message)) return { ok: false, message: "Die erwartete Rollensperre fehlt.", details: result.error };
        return expectFields("appointment_requests", id, { status: "open", decided_by: null, appointment_id: null }, "Nach verweigerter Entscheidung");
      },
    },
  ],
};
