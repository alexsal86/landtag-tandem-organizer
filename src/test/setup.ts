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

/**
 * Node ab 22 belegt `localStorage` selbst und liefert ohne --localstorage-file nur `undefined`;
 * jsdom kann das Global deshalb nicht mehr besetzen. Der Browserpfad der Anwendung braucht aber
 * echtes Web Storage, also stellt die Testumgebung es nach der Spezifikation bereit. Die
 * Anwendungslogik bleibt unangetastet, inklusive Spies auf `Storage.prototype`.
 */
class MemoryStorage {
  #items = new Map<string, string>();
  get length(): number { return this.#items.size; }
  key(index: number): string | null { return [...this.#items.keys()][index] ?? null; }
  getItem(key: string): string | null { return this.#items.get(String(key)) ?? null; }
  setItem(key: string, value: string): void { this.#items.set(String(key), String(value)); }
  removeItem(key: string): void { this.#items.delete(String(key)); }
  clear(): void { this.#items.clear(); }
}

const hasUsableStorage = (() => {
  try {
    const candidate = (globalThis as { localStorage?: { getItem?: unknown } }).localStorage;
    return typeof candidate?.getItem === "function";
  } catch {
    return false;
  }
})();

if (!hasUsableStorage) {
  Object.defineProperty(globalThis, "Storage", { value: MemoryStorage, configurable: true, writable: true });
  for (const name of ["localStorage", "sessionStorage"] as const) {
    Object.defineProperty(globalThis, name, { value: new MemoryStorage(), configurable: true, writable: true });
  }
}

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
