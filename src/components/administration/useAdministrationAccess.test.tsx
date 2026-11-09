import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAdministrationAccess } from "./useAdministrationAccess";

const mock = vi.hoisted(() => ({ rpc: vi.fn(), membership: vi.fn(), eq: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  rpc: mock.rpc,
  from: () => ({ select: () => {
    const query = { eq: (...args: unknown[]) => { mock.eq(...args); return query; }, maybeSingle: mock.membership };
    return query;
  } }),
} }));
vi.mock("@/utils/debugConsole", () => ({ debugConsole: { error: vi.fn() } }));
beforeEach(() => {
  mock.rpc.mockReset().mockResolvedValue({ data: false, error: null });
  mock.membership.mockReset().mockResolvedValue({ data: { role: "bueroleitung" }, error: null });
  mock.eq.mockClear();
});

describe("administration access resolution", () => {
  it("waits for auth and tenant loading, then checks the selected tenant", async () => {
    const { result, rerender } = renderHook(({ waiting }) => useAdministrationAccess("user", "office", waiting), { initialProps: { waiting: true } });
    expect(result.current.checkingAdmin).toBe(true);
    expect(mock.rpc).not.toHaveBeenCalled();
    rerender({ waiting: false });
    await waitFor(() => expect(result.current.checkingAdmin).toBe(false));
    expect(result.current.isAdmin).toBe(true);
    expect(result.current.isSuperAdmin).toBe(false);
    expect(mock.eq).toHaveBeenCalledWith("tenant_id", "office");
    expect(mock.eq).toHaveBeenCalledWith("is_active", true);
  });

  it("keeps access pending until the platform check completes", async () => {
    let finish!: (value: { data: boolean; error: null }) => void;
    mock.rpc.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    const { result } = renderHook(() => useAdministrationAccess("user", "office", false));
    expect(result.current.checkingAdmin).toBe(true);
    expect(result.current.isSuperAdmin).toBe(false);
    await act(async () => finish({ data: true, error: null }));
    expect(result.current.checkingAdmin).toBe(false);
    expect(result.current.isSuperAdmin).toBe(true);
  });

  it("revokes old access immediately on a tenant change and ignores stale responses", async () => {
    let finish!: (value: { data: { role: string }; error: null }) => void;
    mock.membership.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }))
      .mockResolvedValueOnce({ data: { role: "mitarbeiter" }, error: null });
    const { result, rerender } = renderHook(({ tenant }) => useAdministrationAccess("user", tenant, false), { initialProps: { tenant: "old" } });
    rerender({ tenant: "new" });
    expect(result.current.isAdmin).toBe(false);
    await waitFor(() => expect(result.current.checkingAdmin).toBe(false));
    await act(async () => finish({ data: { role: "abgeordneter" }, error: null }));
    expect(result.current.isAdmin).toBe(false);
  });

  it("denies access on a query error", async () => {
    mock.membership.mockResolvedValue({ data: null, error: { message: "offline" } });
    const { result } = renderHook(() => useAdministrationAccess("user", "office", false));
    await waitFor(() => expect(result.current.error).toBe(true));
    expect(result.current.isAdmin).toBe(false);
  });

  it("clears privileges on logout and allows platform admins without a tenant", async () => {
    mock.rpc.mockResolvedValue({ data: true, error: null });
    const { result, rerender } = renderHook(({ user }) => useAdministrationAccess(user, undefined, false), { initialProps: { user: "admin" as string | undefined } });
    await waitFor(() => expect(result.current.isSuperAdmin).toBe(true));
    expect(mock.membership).not.toHaveBeenCalled();
    rerender({ user: undefined });
    expect(result.current.isAdmin).toBe(false);
    expect(result.current.isSuperAdmin).toBe(false);
  });
});
