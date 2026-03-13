import { vi } from "vitest";

export const mockTenantContext = (overrides: Record<string, unknown> = {}) => ({
  tenants: [],
  currentTenant: null,
  memberships: [],
  loading: false,
  switchTenant: vi.fn(),
  refreshTenants: vi.fn(async () => undefined),
  ...overrides,
});

export const mockRoleContext = (overrides: Record<string, unknown> = {}) => ({
  role: "mitarbeiter",
  isAdmin: false,
  hasRole: vi.fn((_role: string) => false),
  ...overrides,
});
