import { describe, expect, it } from "vitest";
import { waitFor } from "@testing-library/react";
import { useTenant } from "@/hooks/useTenant";
import { mockSupabaseClient, renderHookWithProviders } from "@/test";

const tenantA = {
  id: "tenant-a",
  name: "Fraktion A",
  description: null,
  settings: {},
  created_at: "2024-01-01T00:00:00.000Z",
  updated_at: "2024-01-01T00:00:00.000Z",
  is_active: true,
};

describe("useTenant (reference)", () => {
  it("loads memberships and restores the saved tenant for the active user", async () => {
    mockSupabaseClient.setSession({ user: { id: "user-1", email: "team@example.org" } });
    mockSupabaseClient.setTenantMemberships([
      {
        id: "membership-1",
        user_id: "user-1",
        tenant_id: "tenant-a",
        role: "admin",
        is_active: true,
        created_at: "2024-01-01T00:00:00.000Z",
        updated_at: "2024-01-01T00:00:00.000Z",
        tenant: tenantA,
      },
    ]);
    localStorage.setItem("currentTenantId_user-1", "tenant-a");

    const { result } = renderHookWithProviders(() => useTenant());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.currentTenant?.id).toBe("tenant-a");
      expect(result.current.tenants).toHaveLength(1);
    });
  });

  it("switchTenant persists user-specific tenant selection", async () => {
    mockSupabaseClient.setSession({ user: { id: "user-1", email: "team@example.org" } });
    mockSupabaseClient.setTenantMemberships([
      {
        id: "membership-1",
        user_id: "user-1",
        tenant_id: "tenant-a",
        role: "admin",
        is_active: true,
        created_at: "2024-01-01T00:00:00.000Z",
        updated_at: "2024-01-01T00:00:00.000Z",
        tenant: tenantA,
      },
    ]);

    const { result } = renderHookWithProviders(() => useTenant());

    await waitFor(() => expect(result.current.loading).toBe(false));
    result.current.switchTenant("tenant-a");

    expect(localStorage.getItem("currentTenantId_user-1")).toBe("tenant-a");
  });
});
