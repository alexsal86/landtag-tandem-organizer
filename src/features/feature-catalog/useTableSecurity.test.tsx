import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "security-reader" } }) }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc },
}));

import { groupSecurityByTable, useTableSecurity, type RlsGap, type RlsPolicy } from "./useTableSecurity";

const gap = (table: string, severity: RlsGap["severity"], policyCount = 1): RlsGap => ({
  table_name: table,
  severity,
  reason: severity === "ok" ? "OK" : "Wenige Policies trotz tenant_id",
  has_tenant_id: true,
  policy_count: policyCount,
});

const policy = (table: string, name: string): RlsPolicy => ({
  table_name: table,
  policy_name: name,
  command: "SELECT",
  roles: ["authenticated"],
  permissive: "PERMISSIVE",
  has_using: true,
  has_check: false,
});

const gaps = [gap("appointments", "warning", 1), gap("tasks", "critical", 0)];
const policies = [
  policy("appointments", "Tenant members read appointments"),
  policy("appointments", "Tenant members write appointments"),
  policy("tasks", "Tenant members read tasks"),
  policy("unrelated", "Unrelated policy"),
];

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe("useTableSecurity", () => {
  beforeEach(() => {
    rpc.mockReset();
    rpc.mockImplementation(async (fn: string) => {
      if (fn === "audit_rls_gaps") return { data: gaps, error: null };
      if (fn === "audit_rls_policies") return { data: policies, error: null };
      return { data: null, error: new Error(`unexpected rpc: ${fn}`) };
    });
  });

  it("ruft Befunde ohne Argument und Policies mit den Tabellen der Funktion ab", async () => {
    const tables = ["appointments", "tasks"];
    const { result } = renderHook(() => useTableSecurity(tables), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.gapsQuery.isSuccess).toBe(true);
      expect(result.current.policiesQuery.isSuccess).toBe(true);
    });

    expect(rpc).toHaveBeenCalledWith("audit_rls_gaps");
    expect(rpc).toHaveBeenCalledWith("audit_rls_policies", { _tables: ["appointments", "tasks"] });
  });

  it("ordnet Befunde und Policies genau der jeweiligen Tabelle zu", async () => {
    const tables = ["appointments", "tasks", "tables_without_findings"];
    const { result } = renderHook(() => useTableSecurity(tables), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.policiesQuery.isSuccess).toBe(true));

    const grouped = groupSecurityByTable(
      tables,
      result.current.gapsQuery.data ?? [],
      result.current.policiesQuery.data ?? [],
    );

    expect(grouped.map((entry) => entry.table)).toEqual(tables);
    expect(grouped[0].gap?.severity).toBe("warning");
    expect(grouped[0].policies.map((entry) => entry.policy_name)).toEqual([
      "Tenant members read appointments",
      "Tenant members write appointments",
    ]);
    expect(grouped[1].gap?.severity).toBe("critical");
    expect(grouped[1].policies.map((entry) => entry.policy_name)).toEqual(["Tenant members read tasks"]);
    expect(grouped[2].gap).toBeUndefined();
    expect(grouped[2].policies).toEqual([]);
    // Policies fremder Tabellen werden keiner Funktionstabelle zugeschlagen.
    expect(grouped.flatMap((entry) => entry.policies.map((item) => item.policy_name))).not.toContain(
      "Unrelated policy",
    );
  });

  it("lädt nichts, wenn die Funktion keine Tabellen besitzt", async () => {
    const { result } = renderHook(() => useTableSecurity([]), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.gapsQuery.fetchStatus).toBe("idle");
      expect(result.current.policiesQuery.fetchStatus).toBe("idle");
    });

    expect(rpc).not.toHaveBeenCalled();
  });

  it("gibt RPC-Fehler weiter, ohne Ersatzdaten zu erfinden", async () => {
    rpc.mockImplementation(async (fn: string) => {
      if (fn === "audit_rls_gaps") return { data: gaps, error: null };
      return { data: null, error: new Error("function public.audit_rls_policies does not exist") };
    });

    const { result } = renderHook(() => useTableSecurity(["appointments"]), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.policiesQuery.isError).toBe(true));

    expect(result.current.gapsQuery.isSuccess).toBe(true);
    expect(result.current.policiesQuery.data).toBeUndefined();
  });
});
