import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PropsWithChildren } from "react";
import { TenantProvider, useTenant } from "@/hooks/useTenant";
const identity = vi.hoisted(() => ({ id: "alice" as string | null, result: vi.fn(), from: vi.fn() }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: identity.id ? { id: identity.id } : null }) }));
vi.mock("@/utils/debugConsole", () => ({ debugConsole: { log: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock("@/integrations/supabase/client", () => {
  const query = { select: () => query, eq: () => query, returns: identity.result };
  identity.from.mockReturnValue(query);
  return { supabase: { from: identity.from } };
});
const wrapper = ({ children }: PropsWithChildren) => <TenantProvider>{children}</TenantProvider>;
let connected: boolean;
beforeEach(() => {
  localStorage.clear(); identity.id = "alice"; connected = false;
  vi.spyOn(navigator, "onLine", "get").mockImplementation(() => connected);
  identity.from.mockClear(); identity.result.mockResolvedValue({ data: [], error: null });
  localStorage.setItem("tenant-memberships:alice", JSON.stringify([{
    id: "membership", user_id: "alice", tenant_id: "tenant-a", is_active: true,
    tenant: { id: "tenant-a", name: "Arbeitsbereich A", settings: {} },
  }]));
});
describe("offline workspace identity", () => {
  it("restores only the signed-in user's previously verified workspace while offline", async () => {
    const { result, rerender } = renderHook(useTenant, { wrapper });
    await waitFor(() => expect(result.current.currentTenant?.id).toBe("tenant-a"));
    expect(identity.from).not.toHaveBeenCalled();
    identity.id = "bob"; rerender();
    await waitFor(() => expect(result.current.currentTenant).toBeNull());
    expect(result.current.tenants).toEqual([]);
  });
  it("revalidates membership when connectivity returns and removes a revoked workspace", async () => {
    const { result } = renderHook(useTenant, { wrapper });
    await waitFor(() => expect(result.current.currentTenant?.id).toBe("tenant-a"));
    connected = true;
    act(() => { window.dispatchEvent(new Event("online")); });
    await waitFor(() => expect(result.current.currentTenant).toBeNull());
    expect(identity.from).toHaveBeenCalledWith("user_tenant_memberships");
    expect(localStorage.getItem("tenant-memberships:alice")).toBe("[]");
  });
});
