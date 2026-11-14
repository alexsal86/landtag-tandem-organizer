import React from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getActiveTenantScope, setActiveTenantScope } from "@/integrations/supabase/tenantScope";

const state = vi.hoisted(() => ({
  user: { id: "user-a" },
  resolvers: [] as Array<(result: { data: unknown[]; error: null }) => void>,
}));

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: state.user }) }));
vi.mock("@/utils/debugConsole", () => ({ debugConsole: { log: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            returns: vi.fn(() => new Promise<{ data: unknown[]; error: null }>((resolve) => {
              state.resolvers.push(resolve);
            })),
          })),
        })),
      })),
    })),
  },
}));

import { TenantProvider, useTenant } from "@/hooks/useTenant";

function membership(userId: string, tenantId: string) {
  return {
    id: `membership-${tenantId}`, user_id: userId, tenant_id: tenantId,
    role: "mitarbeiter", is_active: true, created_at: null, updated_at: null,
    tenant: {
      id: tenantId, name: tenantId, description: null, settings: {},
      created_at: "2026-01-01", updated_at: "2026-01-01", is_active: true,
    },
  };
}

describe("TenantProvider membership races", () => {
  beforeEach(() => {
    state.resolvers.length = 0;
    state.user = { id: "user-a" };
    setActiveTenantScope(null);
    localStorage.clear();
  });

  it("ignores a previous user's late membership response", async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => <TenantProvider>{children}</TenantProvider>;
    const { result, rerender } = renderHook(() => useTenant(), { wrapper });
    await waitFor(() => expect(state.resolvers).toHaveLength(1));

    state.user = { id: "user-b" };
    rerender();
    await waitFor(() => expect(state.resolvers).toHaveLength(2));
    state.resolvers[1]({ data: [membership("user-b", "tenant-b")], error: null });
    await waitFor(() => expect(result.current.currentTenant?.id).toBe("tenant-b"));

    state.resolvers[0]({ data: [membership("user-a", "tenant-a")], error: null });
    await Promise.resolve();
    expect(result.current.currentTenant?.id).toBe("tenant-b");
    expect(result.current.tenants.map((tenant) => tenant.id)).toEqual(["tenant-b"]);
    expect(getActiveTenantScope()).toEqual({ userId: "user-b", tenantId: "tenant-b" });
  });
});
