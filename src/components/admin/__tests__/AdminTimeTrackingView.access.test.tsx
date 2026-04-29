import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

const fixtures = {
  tenants: {
    a: { id: "tenant-a", name: "Tenant A" },
    b: { id: "tenant-b", name: "Tenant B" },
  },
  users: {
    admin: { id: "user-admin" },
    employee: { id: "user-employee" },
  },
  roles: {
    admin: "abgeordneter",
    employee: "mitarbeiter",
  },
};

const { authState, tenantState, queries } = vi.hoisted(() => ({
  authState: { user: { id: "user-admin" } as { id: string } | null },
  tenantState: { currentTenant: { id: "tenant-a", name: "Tenant A" } as { id: string; name: string } | null },
  queries: [] as Array<{ table: string; column: string; value: unknown }>,
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => authState,
}));

vi.mock("@/hooks/useTenant", () => ({
  useTenant: () => tenantState,
}));

vi.mock("@/utils/debugConsole", () => ({
  debugConsole: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("@/hooks/useYearlyBalance", () => ({
  useYearlyBalance: () => ({ yearlyBalance: 0, yearlyBreakdown: [], loading: false, refetch: vi.fn() }),
}));

vi.mock("@/hooks/useCombinedTimeEntries", () => ({
  useCombinedTimeEntries: () => [],
}));

vi.mock("@/features/timetracking/components/AdminTimeEntryEditor", () => ({
  AdminTimeEntryEditor: () => <div>editor</div>,
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn((table: string) => ({
      select: vi.fn(() => ({
        eq: vi.fn((column: string, value: unknown) => {
          queries.push({ table, column, value });

          if (table === "user_roles" && column === "user_id") {
            const role = authState.user?.id === fixtures.users.admin.id ? fixtures.roles.admin : fixtures.roles.employee;
            return {
              single: vi.fn(() => Promise.resolve({ data: { role }, error: null })),
            };
          }

          return {
            eq: vi.fn(() => Promise.resolve({ data: [], error: null })),
            in: vi.fn(() => Promise.resolve({ data: [], error: null })),
            gte: vi.fn(() => ({ lte: vi.fn(() => ({ order: vi.fn(() => Promise.resolve({ data: [], error: null })) })) })),
            order: vi.fn(() => Promise.resolve({ data: [], error: null })),
            ilike: vi.fn(() => Promise.resolve({ data: [], error: null })),
          };
        }),
      })),
    })),
  },
}));

import { AdminTimeTrackingView } from "@/components/admin/AdminTimeTrackingView";

describe("AdminTimeTrackingView access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queries.length = 0;
    tenantState.currentTenant = fixtures.tenants.a;
  });

  it("hides and blocks admin actions for non-admin users", async () => {
    authState.user = fixtures.users.employee;

    render(<AdminTimeTrackingView />);

    await waitFor(() => {
      expect(screen.getByText("Dieser Bereich ist nur für Administratoren verfügbar.")).toBeInTheDocument();
    });

    expect(screen.queryByText("Mitarbeiter gefunden")).not.toBeInTheDocument();
  });

  it("uses the current tenant id when loading tenant-scoped employee access path", async () => {
    authState.user = fixtures.users.admin;
    tenantState.currentTenant = fixtures.tenants.b;

    render(<AdminTimeTrackingView />);

    await waitFor(() => {
      expect(queries).toEqual(
        expect.arrayContaining([
          { table: "user_tenant_memberships", column: "tenant_id", value: "tenant-b" },
        ]),
      );
    });
  });
});
