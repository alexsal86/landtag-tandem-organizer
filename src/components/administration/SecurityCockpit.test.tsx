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

const audit = vi.hoisted(() => ({
  filters: [] as Array<{ column: string; values: string[] }>,
  rows: [] as Array<Record<string, unknown>>,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: mock.rpc,
    // Tabellenbewusst: audit_log_entries liefert Protokollzeilen, alles andere leer.
    from: (table: string) => {
      type Chain = {
        select: () => Chain;
        order: () => Chain;
        in: (column: string, values: string[]) => Chain;
        limit: () => Promise<{ data: unknown[]; error: null }>;
      };
      const data = table === "audit_log_entries" ? audit.rows : [];
      const chain: Chain = {
        select: () => chain,
        order: () => chain,
        in: (column, values) => {
          audit.filters.push({ column, values });
          return chain;
        },
        limit: () => Promise.resolve({ data, error: null }),
      };
      return chain;
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

const auditRows = [
  {
    id: "audit-1",
    created_at: "2026-11-27T10:00:00.000Z",
    user_id: "user-1",
    ip_address: "203.0.113.7",
    action: "security.gdpr.delete_approved",
    payload: { action: "security.gdpr.delete_approved", request_id: "req-1" },
  },
  {
    id: "audit-2",
    created_at: "2026-11-27T09:00:00.000Z",
    user_id: "user-2",
    ip_address: null,
    action: "letter.sent",
    payload: { action: "letter.sent" },
  },
];

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
  audit.filters.length = 0;
  audit.rows.length = 0;
  audit.rows.push(...auditRows);
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

  it("zeigt die Aktion und filtert Sicherheitsereignisse in der Datenbank statt im Browser", async () => {
    renderCockpit();

    // Die Ereignisart steht als eigene Spalte in der Zeile, nicht nur im Payload.
    expect(await screen.findByText("security.gdpr.delete_approved")).toBeInTheDocument();
    expect(screen.getByText("letter.sent")).toBeInTheDocument();
    // „Alle“ schickt keinen Aktionsfilter an die Datenbank.
    expect(audit.filters).toHaveLength(0);

    fireEvent.click(screen.getByRole("button", { name: "DSGVO" }));

    await waitFor(() => expect(audit.filters).toHaveLength(1));
    expect(audit.filters[0].column).toBe("action");
    expect(audit.filters[0].values).toContain("security.gdpr.delete_approved");
    expect(audit.filters[0].values).not.toContain("letter.sent");
    expect(screen.getByRole("button", { name: "DSGVO" })).toHaveAttribute("aria-pressed", "true");
  });

  it("filtert die Gruppe der fehlgeschlagenen Anmeldungen über ihre Aktionen", async () => {
    renderCockpit();
    await screen.findByText("letter.sent");

    fireEvent.click(screen.getByRole("button", { name: "Sicherheit" }));

    await waitFor(() => expect(audit.filters).toHaveLength(1));
    expect(audit.filters[0].values).toEqual(
      expect.arrayContaining([
        "security.gdpr.request_created",
        "security.gdpr.request_withdrawn",
        "security.gdpr.delete_approved",
        "security.gdpr.delete_completed",
        "user.role_changed",
        "auth.login_failed",
        "security.access_denied",
      ]),
    );
    expect(audit.filters[0].values).not.toContain("letter.sent");
  });

  it("benennt den gewählten Filter im Leerzustand", async () => {
    audit.rows.length = 0;
    renderCockpit();

    fireEvent.click(screen.getByRole("button", { name: "Anmeldung" }));

    expect(
      await screen.findByText(/Keine Ereignisse für „Fehlgeschlagene Anmeldungen“/),
    ).toBeInTheDocument();
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
