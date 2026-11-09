import "@testing-library/jest-dom";
import { afterEach, beforeEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import { mockSupabaseClient } from "@/test/mockSupabaseClient";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: mockSupabaseClient.supabase,
}));

vi.mock("@/utils/debugConsole", () => ({
  debugConsole: { error: vi.fn(), log: vi.fn(), warn: vi.fn() },
}));

vi.mock("@/hooks/useAuditLog", () => ({
  logAuditEvent: vi.fn(),
  AuditActions: { LOGOUT: "LOGOUT" },
}));

if (typeof window !== "undefined") Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

// jsdom has no layout observer; components can still exercise their real editor lifecycle.
vi.stubGlobal("ResizeObserver", class {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
});

beforeEach(() => {
  mockSupabaseClient.reset();
  mockSupabaseClient.setSession(null);
  mockSupabaseClient.setTenantMemberships([]);
});

afterEach(() => {
  cleanup();
  if (typeof localStorage !== "undefined") localStorage.clear();
  vi.clearAllMocks();
});
