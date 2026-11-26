import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SecurityCockpit } from "./SecurityCockpit";

const mock = vi.hoisted(() => ({
  rpc: vi.fn(),
  runSuite: vi.fn(),
  saveRun: vi.fn(),
  notify: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: mock.rpc,
    from: () => {
      const query = { select: () => query, order: () => query, limit: () => Promise.resolve({ data: [], error: null }) };
      return query;
    },
  },
}));
vi.mock("@/lib/notify", () => ({ notify: mock.notify }));
vi.mock("@/features/selftest/registry", () => ({
  SELFTEST_SCENARIOS: [{
    id: "contact-lifecycle", title: "Kontakt-Lifecycle", description: "",
    touches: ["contacts"], features: ["contacts"],
    steps: [{ id: "create", label: "Anlegen", kind: "logic", run: async () => ({ ok: true, message: "" }) }],
  }],
}));
vi.mock("@/features/selftest/runner", () => ({ runSuite: mock.runSuite }));
vi.mock("@/features/selftest/history", () => ({ saveRun: mock.saveRun }));
vi.mock("@/hooks/useTenant", () => ({ useTenant: () => ({ currentTenant: { id: "tenant-1" } }) }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "user-1" } }) }));
// Tabs ohne Radix rendern, damit die Coverage-Tabelle direkt im DOM liegt.
vi.mock("@/components/ui/tabs", () => {
  const Container = ({ children }: { children: ReactNode }) => <div>{children}</div>;
  return { Tabs: Container, TabsContent: Container, TabsList: Container, TabsTrigger: Container };
});

const gaps = [
  { table_name: "contacts", severity: "critical", reason: "Ohne Tenant-Spalte", has_tenant_id: false, policy_count: 0 },
  { table_name: "action_permissions", severity: "warning", reason: "Eine Policy", has_tenant_id: true, policy_count: 1 },
  // RLS aktiv, keine Policy, aber kein Client-Grant: beabsichtigtes Deny-all.
  { table_name: "team_fun_facts", severity: "ok", reason: "Deny-all ohne Client-Grant (beabsichtigt)", has_tenant_id: true, policy_count: 0 },
];

const renderCockpit = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <SecurityCockpit />
      </QueryClientProvider>
    </MemoryRouter>,
  );
};

const auditReads = () => mock.rpc.mock.calls.filter(([name]) => name === "audit_rls_gaps").length;

beforeEach(() => {
  mock.rpc.mockReset();
  mock.runSuite.mockReset();
  mock.saveRun.mockReset();
  mock.notify.success.mockReset();
  mock.notify.error.mockReset();
  mock.rpc.mockImplementation((name: string) => {
    if (name === "audit_rls_gaps") return Promise.resolve({ data: gaps, error: null });
    return Promise.resolve({ data: [], error: null });
  });
  mock.runSuite.mockResolvedValue([{
    runId: "run-1", tenantId: "tenant-1", userId: "user-1", scenarioId: "contact-lifecycle",
    status: "ok", mode: "test", records: [], storageObjects: [], steps: [], cleanup: { status: "ok" },
  }]);
});

describe("SecurityCockpit: Nachtest je Befund", () => {
  it("führt die Selbsttests der abgedeckten Tabelle aus statt die Lückenabfrage neu zu laden", async () => {
    renderCockpit();

    const button = await screen.findByRole("button", { name: "Selbsttests für contacts nachtesten" });
    // Tabellen ohne abdeckendes Szenario bieten keinen Nachtest an.
    expect(screen.queryByRole("button", { name: /action_permissions/ })).not.toBeInTheDocument();
    const readsBefore = auditReads();

    fireEvent.click(button);

    await waitFor(() => expect(mock.runSuite).toHaveBeenCalled());
    const [scenarios] = mock.runSuite.mock.calls[0] as [Array<{ id: string }>];
    expect(scenarios.map((scenario) => scenario.id)).toEqual(["contact-lifecycle"]);
    await waitFor(() => expect(mock.saveRun).toHaveBeenCalled());
    expect(mock.notify.success).toHaveBeenCalledWith("contacts: 1 Selbsttest(s) bestanden");
    // Der Button testet; er lädt die Lückenabfrage nicht erneut.
    expect(auditReads()).toBe(readsBefore);
  });

  it("führt Tabellen ohne Client-Grant als beabsichtigtes Deny-all statt als kritisch", async () => {
    renderCockpit();

    // Standardfilter „Nur Probleme“: die Deny-all-Tabelle erscheint nicht als Befund.
    await screen.findByRole("button", { name: "Selbsttests für contacts nachtesten" });
    expect(screen.getAllByText("critical")).toHaveLength(1);
    expect(screen.queryByText("team_fun_facts")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Nur Probleme" }));

    // Sichtbar wird die Tabelle erst ohne Problemfilter – und dann als ok mit Begründung.
    await screen.findByText("team_fun_facts");
    expect(screen.getByText("Deny-all ohne Client-Grant (beabsichtigt)")).toBeInTheDocument();
    expect(screen.getAllByText("ok").length).toBeGreaterThan(0);
    expect(screen.getAllByText("critical")).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "Selbsttests für team_fun_facts nachtesten" })).not.toBeInTheDocument();
  });
});
