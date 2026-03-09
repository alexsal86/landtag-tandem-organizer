import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import React from "react";

// Mock supabase before importing the hook
vi.mock("@/integrations/supabase/client", () => {
  const mockAuth = {
    onAuthStateChange: vi.fn(() => ({
      data: { subscription: { unsubscribe: vi.fn() } },
    })),
    getSession: vi.fn(() =>
      Promise.resolve({ data: { session: null }, error: null })
    ),
    signOut: vi.fn(() => Promise.resolve({ error: null })),
  };

  return {
    supabase: {
      auth: mockAuth,
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
        insert: vi.fn(() => Promise.resolve({ data: null, error: null })),
        update: vi.fn().mockReturnThis(),
        delete: vi.fn().mockReturnThis(),
      })),
    },
  };
});

vi.mock("@/hooks/useAuditLog", () => ({
  logAuditEvent: vi.fn(),
  AuditActions: { LOGOUT: "LOGOUT" },
}));

vi.mock("@/utils/debugConsole", () => ({
  debugConsole: { error: vi.fn(), log: vi.fn(), warn: vi.fn() },
}));

import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

describe("useAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(AuthProvider, null, children);

  it("should throw when used outside AuthProvider", () => {
    expect(() => {
      renderHook(() => useAuth());
    }).toThrow("useAuth must be used within an AuthProvider");
  });

  it("should initialize with null user and loading state", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    // After getSession resolves, loading should be false
    await vi.waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.user).toBeNull();
    expect(result.current.session).toBeNull();
  });

  it("should provide a signOut function", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    await vi.waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(typeof result.current.signOut).toBe("function");
  });

  it("should call supabase.auth.signOut on signOut", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    await vi.waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.signOut();
    });

    expect(supabase.auth.signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("should clear tenant localStorage on signOut", async () => {
    localStorage.setItem("currentTenantId", "test-tenant");

    const { result } = renderHook(() => useAuth(), { wrapper });

    await vi.waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.signOut();
    });

    expect(localStorage.getItem("currentTenantId")).toBeNull();
  });

  it("should set up auth state listener on mount", () => {
    renderHook(() => useAuth(), { wrapper });
    expect(supabase.auth.onAuthStateChange).toHaveBeenCalled();
  });

  it("should call getSession on mount", () => {
    renderHook(() => useAuth(), { wrapper });
    expect(supabase.auth.getSession).toHaveBeenCalled();
  });
});
