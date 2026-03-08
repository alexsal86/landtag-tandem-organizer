import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import React from "react";

// Use vi.hoisted so mock objects are available when vi.mock factories run
const { mockSupabase, mockUseAuth } = vi.hoisted(() => {
  const mockSupabase = {
    from: vi.fn(),
  };
  const mockUseAuth = vi.fn();
  return { mockSupabase, mockUseAuth };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: mockSupabase,
}));

vi.mock("@/utils/debugConsole", () => ({
  debugConsole: {
    log: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => mockUseAuth(),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

import { TenantProvider, useTenant } from "@/hooks/useTenant";

const wrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(TenantProvider, null, children);

const mockTenant = {
  id: "tenant-1",
  name: "Test Büro",
  settings: {},
  created_at: "2024-01-01",
  updated_at: "2024-01-01",
  is_active: true,
};

function setupSupabaseMock(data: any[] | null, error: any = null) {
  mockSupabase.from.mockReturnValue({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ data, error })),
      })),
    })),
  });
}

describe("useTenant", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("throws when used outside TenantProvider", () => {
    mockUseAuth.mockReturnValue({ user: null });
    expect(() => {
      renderHook(() => useTenant());
    }).toThrow("useTenant must be used within a TenantProvider");
  });

  it("returns empty tenants when no user is logged in", async () => {
    mockUseAuth.mockReturnValue({ user: null });

    const { result } = renderHook(() => useTenant(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.tenants).toEqual([]);
    expect(result.current.currentTenant).toBeNull();
  });

  it("loads tenants for authenticated user", async () => {
    mockUseAuth.mockReturnValue({ user: { id: "user-1" } });
    setupSupabaseMock([
      {
        id: "m1",
        user_id: "user-1",
        tenant_id: "tenant-1",
        role: "admin",
        is_active: true,
        created_at: "2024-01-01",
        updated_at: "2024-01-01",
        tenant: mockTenant,
      },
    ]);

    const { result } = renderHook(() => useTenant(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.tenants).toHaveLength(1);
    expect(result.current.tenants[0].name).toBe("Test Büro");
    expect(result.current.currentTenant?.id).toBe("tenant-1");
  });

  it("persists tenant selection in user-specific localStorage", async () => {
    mockUseAuth.mockReturnValue({ user: { id: "user-1" } });
    setupSupabaseMock([{ id: "m1", tenant: mockTenant }]);

    const { result } = renderHook(() => useTenant(), { wrapper });

    await waitFor(() => {
      expect(result.current.currentTenant?.id).toBe("tenant-1");
    });

    expect(localStorage.getItem("currentTenantId_user-1")).toBe("tenant-1");
  });

  it("cleans up legacy global tenant key", async () => {
    localStorage.setItem("currentTenantId", "old-tenant");
    mockUseAuth.mockReturnValue({ user: { id: "user-1" } });
    setupSupabaseMock([{ id: "m1", tenant: mockTenant }]);

    renderHook(() => useTenant(), { wrapper });

    await waitFor(() => {
      expect(localStorage.getItem("currentTenantId")).toBeNull();
    });
  });

  it("handles fetch error gracefully", async () => {
    mockUseAuth.mockReturnValue({ user: { id: "user-1" } });
    setupSupabaseMock(null, { message: "DB error" });

    const { result } = renderHook(() => useTenant(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.tenants).toEqual([]);
    expect(result.current.currentTenant).toBeNull();
  });
});
