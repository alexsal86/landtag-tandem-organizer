import { createElement, type ReactNode } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useResponsibilities } from "./useResponsibilities";

const mock = vi.hoisted(() => ({
  tenant: { id: "tenant-a" } as { id: string } | null,
  from: vi.fn(),
  rpc: vi.fn(),
  calls: [] as Array<{ table: string; filters: Array<[string, unknown]> }>,
}));
vi.mock("@/hooks/useTenant", () => ({
  useTenant: () => ({ currentTenant: mock.tenant }),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: mock.from, rpc: mock.rpc },
}));
const rows: Record<string, unknown[]> = {
  employee_responsibilities: [],
  topics: [],
  committees: [],
  regions: [],
  user_tenant_memberships: [{ user_id: "person" }],
  profiles: [{ user_id: "person", display_name: "Anna" }],
};
const wrapper = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
};
beforeEach(() => {
  mock.tenant = { id: "tenant-a" };
  mock.calls.length = 0;
  mock.from.mockClear();
  mock.rpc.mockReset();
  mock.from.mockImplementation((table: string) => {
    const call = { table, filters: [] as Array<[string, unknown]> };
    mock.calls.push(call);
    const result = { data: rows[table] ?? [], error: null };
    const chain = {
      select: () => chain,
      eq: (key: string, value: unknown) => {
        call.filters.push([key, value]);
        return chain;
      },
      in: (key: string, value: unknown) => {
        call.filters.push([key, value]);
        return chain;
      },
      order: () => chain,
      then: (resolve: (v: typeof result) => unknown) =>
        Promise.resolve(result).then(resolve),
    };
    return chain;
  });
});
describe("Zuständigkeitsdaten", () => {
  it("grenzt Kataloge und Mitgliedschaften über den aktuellen Tenant und Profile über aktive User-IDs ein", async () => {
    const { result } = renderHook(() => useResponsibilities(), {
      wrapper: wrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.people).toEqual([
      { id: "person", name: "Anna", badgeColor:null, avatarUrl:null },
    ]);
    for (const call of mock.calls.filter((c) => c.table !== "profiles"))
      expect(call.filters).toContainEqual(["tenant_id", "tenant-a"]);
    expect(
      mock.calls.find((c) => c.table === "profiles")?.filters,
    ).toContainEqual(["user_id", ["person"]]);
  });
  it("lädt ohne Tenant keine Daten", async () => {
    mock.tenant = null;
    const { result } = renderHook(() => useResponsibilities(), {
      wrapper: wrapper(),
    });
    expect(result.current.fetchStatus).toBe("idle");
    expect(mock.from).not.toHaveBeenCalled();
  });
  it("schreibt nur über die tenantgebundene RPC und meldet Fehler", async () => {
    mock.rpc.mockResolvedValue({ error: { message: "Keine Berechtigung" } });
    const { result } = renderHook(() => useResponsibilities(), {
      wrapper: wrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    await expect(
      result.current.change.mutateAsync({
        userId: "person",
        kind: "topic",
        reference: "topic",
        level: "primary",
      }),
    ).rejects.toMatchObject({ message: "Keine Berechtigung" });
    expect(mock.rpc).toHaveBeenCalledWith("set_employee_responsibility", {
      p_tenant: "tenant-a",
      p_user: "person",
      p_kind: "topic",
      p_reference: "topic",
      p_level: "primary",
    });
  });
});
