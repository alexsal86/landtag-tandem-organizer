import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import React from "react";

// Mock dependencies
const mockUser = { id: "user-123", email: "test@example.com" };
const mockTenant = {
  id: "tenant-1",
  name: "Test Tenant",
  description: null,
  settings: {},
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
  is_active: true,
};

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn((table: string) => {
      if (table === "tenant_memberships") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() =>
              Promise.resolve({
                data: [
                  {
                    id: "m-1",
                    user_id: "user-123",
                    tenant_id: "tenant-1",
                    role: "admin",
                    is_active: true,
                    created_at: "2024-01-01",
                    updated_at: "2024-01-01",
                    tenant: mockTenant,
                  },
                ],
                error: null,
              })
            ),
          })),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
      };
    }),
    auth: {
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
      getSession: vi.fn(() =>
        Promise.resolve({ data: { session: null }, error: null })
      ),
    },
  },
}));

vi.mock("@/utils/debugConsole", () => ({
  debugConsole: { error: vi.fn(), log: vi.fn(), warn: vi.fn() },
}));

vi.mock("@/hooks/useAuditLog", () => ({
  logAuditEvent: vi.fn(),
  AuditActions: { LOGOUT: "LOGOUT" },
}));

import { useTenant, TenantProvider } from "@/hooks/useTenant";
import { AuthProvider } from "@/hooks/useAuth";

describe("useTenant", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("should throw when used outside TenantProvider", () => {
    expect(() => {
      renderHook(() => useTenant());
    }).toThrow("useTenant must be used within a TenantProvider");
  });

  it("should initialize with loading state", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(
        AuthProvider,
        null,
        React.createElement(TenantProvider, null, children)
      );

    const { result } = renderHook(() => useTenant(), { wrapper });
    // Without a user, loading resolves to false and tenant is null
    expect(result.current.currentTenant).toBeNull();
  });

  it("should provide switchTenant function", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(
        AuthProvider,
        null,
        React.createElement(TenantProvider, null, children)
      );

    const { result } = renderHook(() => useTenant(), { wrapper });
    expect(typeof result.current.switchTenant).toBe("function");
  });

  it("should provide refreshTenants function", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(
        AuthProvider,
        null,
        React.createElement(TenantProvider, null, children)
      );

    const { result } = renderHook(() => useTenant(), { wrapper });
    expect(typeof result.current.refreshTenants).toBe("function");
  });

  it("should expose tenants array and memberships", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(
        AuthProvider,
        null,
        React.createElement(TenantProvider, null, children)
      );

    const { result } = renderHook(() => useTenant(), { wrapper });
    expect(Array.isArray(result.current.tenants)).toBe(true);
    expect(Array.isArray(result.current.memberships)).toBe(true);
  });
});
