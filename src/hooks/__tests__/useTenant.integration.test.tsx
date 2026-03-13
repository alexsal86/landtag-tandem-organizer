import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";

const fixtures = {
  tenants: {
    a: {
      id: "tenant-a",
      name: "Tenant A",
      description: null,
      settings: {},
      created_at: "2024-01-01T00:00:00.000Z",
      updated_at: "2024-01-01T00:00:00.000Z",
      is_active: true,
    },
    b: {
      id: "tenant-b",
      name: "Tenant B",
      description: null,
      settings: {},
      created_at: "2024-01-01T00:00:00.000Z",
      updated_at: "2024-01-01T00:00:00.000Z",
      is_active: true,
    },
  },
  memberships: [
    {
      id: "m-1",
      user_id: "user-admin",
      tenant_id: "tenant-a",
      role: "abgeordneter",
      is_active: true,
      created_at: "2024-01-01T00:00:00.000Z",
      updated_at: "2024-01-01T00:00:00.000Z",
      tenant: {
        id: "tenant-a",
        name: "Tenant A",
        description: null,
        settings: {},
        created_at: "2024-01-01T00:00:00.000Z",
        updated_at: "2024-01-01T00:00:00.000Z",
        is_active: true,
      },
    },
    {
      id: "m-2",
      user_id: "user-admin",
      tenant_id: "tenant-b",
      role: "abgeordneter",
      is_active: true,
      created_at: "2024-01-01T00:00:00.000Z",
      updated_at: "2024-01-01T00:00:00.000Z",
      tenant: {
        id: "tenant-b",
        name: "Tenant B",
        description: null,
        settings: {},
        created_at: "2024-01-01T00:00:00.000Z",
        updated_at: "2024-01-01T00:00:00.000Z",
        is_active: true,
      },
    },
    {
      id: "m-foreign",
      user_id: "user-employee",
      tenant_id: "tenant-b",
      role: "mitarbeiter",
      is_active: true,
      created_at: "2024-01-01T00:00:00.000Z",
      updated_at: "2024-01-01T00:00:00.000Z",
      tenant: {
        id: "tenant-b",
        name: "Tenant B",
        description: null,
        settings: {},
        created_at: "2024-01-01T00:00:00.000Z",
        updated_at: "2024-01-01T00:00:00.000Z",
        is_active: true,
      },
    },
  ],
};

const { mockUseAuth, eqTracker } = vi.hoisted(() => {
  return {
    mockUseAuth: vi.fn(),
    eqTracker: [] as Array<{ table: string; column: string; value: unknown }>,
  };
});

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("@/utils/debugConsole", () => ({
  debugConsole: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn((table: string) => {
      let current = [...fixtures.memberships];
      return {
        select: vi.fn(() => ({
          eq: vi.fn((columnA: string, valueA: unknown) => {
            eqTracker.push({ table, column: columnA, value: valueA });
            current = current.filter((row) => (row as Record<string, unknown>)[columnA] === valueA);
            return {
              eq: vi.fn((columnB: string, valueB: unknown) => {
                eqTracker.push({ table, column: columnB, value: valueB });
                current = current.filter((row) => (row as Record<string, unknown>)[columnB] === valueB);
                return Promise.resolve({ data: current, error: null });
              }),
            };
          }),
        })),
      };
    }),
  },
}));

import { TenantProvider, useTenant } from "@/hooks/useTenant";

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <TenantProvider>{children}</TenantProvider>
);

describe("useTenant integration access paths", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    eqTracker.length = 0;
    localStorage.clear();
  });

  it("isolates tenant memberships to the active user and excludes foreign tenant data", async () => {
    mockUseAuth.mockReturnValue({ user: { id: "user-admin" } });

    const { result } = renderHook(() => useTenant(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(eqTracker).toEqual(
      expect.arrayContaining([
        { table: "user_tenant_memberships", column: "user_id", value: "user-admin" },
        { table: "user_tenant_memberships", column: "is_active", value: true },
      ]),
    );

    expect(result.current.tenants.map((tenant) => tenant.id)).toEqual(["tenant-a", "tenant-b"]);
    expect(result.current.tenants.map((tenant) => tenant.id)).not.toContain("tenant-foreign");
  });

  it("persists and restores tenant changes per user with two-tenant fixture", async () => {
    mockUseAuth.mockReturnValue({ user: { id: "user-admin" } });
    localStorage.setItem("currentTenantId_user-admin", fixtures.tenants.b.id);

    const { result } = renderHook(() => useTenant(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.currentTenant?.id).toBe("tenant-b");

    act(() => {
      result.current.switchTenant("tenant-a");
    });

    expect(result.current.currentTenant?.id).toBe("tenant-a");
    expect(localStorage.getItem("currentTenantId_user-admin")).toBe("tenant-a");
  });
});
