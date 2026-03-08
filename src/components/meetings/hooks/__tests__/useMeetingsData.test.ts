import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

const { mockSupabase, mockToast, mockUser, mockTenant } = vi.hoisted(() => {
  const createChain = (resolveValue: any = { data: [], error: null }) => {
    const chain: any = {};
    const methods = ['select', 'eq', 'neq', 'order', 'in', 'not', 'is', 'gt', 'limit', 'single', 'maybeSingle', 'insert', 'update', 'delete'];
    methods.forEach(m => { chain[m] = vi.fn(() => chain); });
    chain.then = (fn: any) => Promise.resolve(resolveValue).then(fn);
    return chain;
  };

  const mockSupabase = {
    from: vi.fn(() => createChain()),
    storage: { from: vi.fn(() => ({ upload: vi.fn(), remove: vi.fn() })) },
  };
  const mockToast = vi.fn();
  const mockUser = { id: "user-1", email: "test@example.com" };
  const mockTenant = { id: "tenant-1", name: "Test" };
  return { mockSupabase, mockToast, mockUser, mockTenant, createChain };
});

vi.mock("@/integrations/supabase/client", () => ({ supabase: mockSupabase }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: mockUser }) }));
vi.mock("@/hooks/useTenant", () => ({ useTenant: () => ({ currentTenant: mockTenant }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: mockToast }) }));
vi.mock("@/hooks/useNotificationHighlight", () => ({
  useNotificationHighlight: () => ({ isHighlighted: false, highlightRef: { current: null } }),
}));
vi.mock("react-router-dom", () => {
  const searchParams = new URLSearchParams();
  return {
    useSearchParams: () => [searchParams, vi.fn()],
  };
});

import { useMeetingsData } from "../useMeetingsData";

describe("useMeetingsData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: all queries return empty data
    mockSupabase.from.mockImplementation(() => {
      const chain: any = {};
      const methods = ['select', 'eq', 'neq', 'order', 'in', 'not', 'is', 'gt', 'limit', 'single', 'maybeSingle', 'insert', 'update', 'delete'];
      methods.forEach(m => { chain[m] = vi.fn(() => chain); });
      chain.then = (fn: any) => Promise.resolve({ data: [], error: null }).then(fn);
      return chain;
    });
  });

  it("loads meetings on mount when user and tenant exist", async () => {
    const { result } = renderHook(() => useMeetingsData());

    await waitFor(() => {
      expect(mockSupabase.from).toHaveBeenCalledWith("meetings");
    });

    expect(result.current.meetings).toBeDefined();
    expect(Array.isArray(result.current.meetings)).toBe(true);
  });

  it("loads profiles for current tenant", async () => {
    renderHook(() => useMeetingsData());

    await waitFor(() => {
      expect(mockSupabase.from).toHaveBeenCalledWith("user_tenant_memberships");
    });
  });

  it("loads tasks for current user", async () => {
    renderHook(() => useMeetingsData());

    await waitFor(() => {
      expect(mockSupabase.from).toHaveBeenCalledWith("tasks");
    });
  });

  it("provides expected state properties", () => {
    const { result } = renderHook(() => useMeetingsData());

    expect(result.current.meetings).toBeDefined();
    expect(result.current.selectedMeeting).toBeNull();
    expect(result.current.agendaItems).toBeDefined();
    expect(result.current.profiles).toBeDefined();
    expect(result.current.isNewMeetingOpen).toBe(false);
    expect(result.current.hasEditPermission).toBe(false);
  });
});
