import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import React from "react";

// Use vi.hoisted so mock objects are available when vi.mock factories run
const { mockSupabase } = vi.hoisted(() => {
  const mockSupabase = {
    auth: {
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
      getSession: vi.fn(() => Promise.resolve({ data: { session: null } })),
      signOut: vi.fn(() => Promise.resolve({ error: null })),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
      insert: vi.fn(() => Promise.resolve({ data: null, error: null })),
      update: vi.fn(() => Promise.resolve({ data: null, error: null })),
      delete: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ data: null, error: null })),
        })),
      })),
    })),
  };
  return { mockSupabase };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: mockSupabase,
}));

vi.mock("@/hooks/useAuditLog", () => ({
  logAuditEvent: vi.fn(),
  AuditActions: { LOGOUT: "LOGOUT" },
}));

vi.mock("@/utils/debugConsole", () => ({
  debugConsole: {
    log: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { AuthProvider, useAuth } from "@/hooks/useAuth";

const wrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(AuthProvider, null, children);

describe("useAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    // Reset default mocks
    mockSupabase.auth.onAuthStateChange.mockImplementation(() => ({
      data: { subscription: { unsubscribe: vi.fn() } },
    }));
    mockSupabase.auth.getSession.mockResolvedValue({ data: { session: null } });
  });

  it("throws when used outside AuthProvider", () => {
    expect(() => {
      renderHook(() => useAuth());
    }).toThrow("useAuth must be used within an AuthProvider");
  });

  it("starts with no user after session check", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.user).toBeNull();
    expect(result.current.session).toBeNull();
  });

  it("sets user from existing session", async () => {
    const mockUser = { id: "user-1", email: "test@example.com" };
    const mockSession = { user: mockUser, access_token: "token-123" };

    mockSupabase.auth.getSession.mockResolvedValueOnce({
      data: { session: mockSession },
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.user).toEqual(mockUser);
    expect(result.current.session).toEqual(mockSession);
  });

  it("signOut clears tenant localStorage", async () => {
    const mockUser = { id: "user-1", email: "test@example.com" };
    const mockSession = { user: mockUser, access_token: "token-123" };

    mockSupabase.auth.getSession.mockResolvedValueOnce({
      data: { session: mockSession },
    });

    localStorage.setItem("currentTenantId", "tenant-old");
    localStorage.setItem(`currentTenantId_${mockUser.id}`, "tenant-1");

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.user).toEqual(mockUser);
    });

    await act(async () => {
      await result.current.signOut();
    });

    expect(localStorage.getItem("currentTenantId")).toBeNull();
    expect(localStorage.getItem(`currentTenantId_${mockUser.id}`)).toBeNull();
    expect(mockSupabase.auth.signOut).toHaveBeenCalled();
  });

  it("reacts to auth state changes", async () => {
    let authCallback: (event: string, session: any) => void;

    mockSupabase.auth.onAuthStateChange.mockImplementation((cb: any) => {
      authCallback = cb;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const mockUser = { id: "user-2", email: "new@example.com" };
    const mockSession = { user: mockUser };

    act(() => {
      authCallback!("SIGNED_IN", mockSession);
    });

    expect(result.current.user).toEqual(mockUser);
  });
});
