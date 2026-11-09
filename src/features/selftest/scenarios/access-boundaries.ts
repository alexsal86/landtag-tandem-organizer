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
