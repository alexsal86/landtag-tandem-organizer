import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PULSE_AREAS } from "./pulse";
import { SystemPulse } from "./SystemPulse";

const rpc = vi.hoisted(() => vi.fn());
const runSuite = vi.hoisted(() => vi.fn());
const saveRun = vi.hoisted(() => vi.fn());

vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc } }));
vi.mock("@/features/selftest/registry", () => ({
  SELFTEST_SCENARIOS: [{
    id: "contact-lifecycle", title: "Kontakt-Lifecycle", description: "", features: ["contacts"], touches: [],
    steps: [{ id: "create", label: "Anlegen", kind: "logic", run: async () => ({ ok: true, message: "" }) }],
  }],
}));
vi.mock("@/features/selftest/runner", () => ({ runSuite }));
vi.mock("@/features/selftest/history", () => ({ saveRun }));
vi.mock("@/hooks/useTenant", () => ({ useTenant: () => ({ currentTenant: { id: "tenant-1" } }) }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "user-1" } }) }));

const renderPulse = (gaps: Array<{ table_name: string; severity: string }> = []) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <SystemPulse gaps={gaps} gapsState="ready" />
      </QueryClientProvider>
    </MemoryRouter>,
  );
};

const tile = (name: RegExp) => screen.getByRole("button", { name });
const ago = (ms: number) => new Date(Date.now() - ms).toISOString();

beforeEach(() => {
  rpc.mockReset();
  runSuite.mockReset();
  saveRun.mockReset();
});

describe("SystemPulse: selftest_runs", () => {
  it("zeigt während des Ladens auf allen Kacheln 'wird geladen …' statt 'Noch nie getestet'", () => {
    rpc.mockReturnValue(new Promise(() => {}));
    renderPulse();

    // Kopfzeile und die noch leere Fehlertabelle melden den Ladezustand getrennt.
    expect(within(screen.getByTestId("pulse-status")).getByText(/Testlage wird geladen/)).toBeInTheDocument();
    const failedTests = screen.getByRole("region", { name: "Fehlgeschlagene Tests" });
    expect(within(failedTests).getByText(/Testlage wird geladen/)).toBeInTheDocument();
    expect(screen.getAllByText("wird geladen …")).toHaveLength(PULSE_AREAS.length);
    expect(screen.queryByText("Noch nie getestet")).not.toBeInTheDocument();
  });

  it("zeigt bei einem Abfragefehler auf allen Kacheln 'unbekannt' statt 'Noch nie getestet'", async () => {
    rpc.mockRejectedValue(new Error("Abfrage fehlgeschlagen"));
    renderPulse();

    await waitFor(() => expect(screen.getAllByText("unbekannt")).toHaveLength(PULSE_AREAS.length));
    expect(within(screen.getByTestId("pulse-status")).getByText(/Testlage unbekannt/)).toBeInTheDocument();
    const failedTests = screen.getByRole("region", { name: "Fehlgeschlagene Tests" });
    expect(within(failedTests).getByText(/es können keine Fehler angezeigt werden/)).toBeInTheDocument();
    expect(screen.queryByText("Noch nie getestet")).not.toBeInTheDocument();
  });

  it("nutzt den neuesten Lauf je Szenario und zeigt Metadaten, Verlauf, Filter und gezielte Läufe", async () => {
    const latest = [
      // Älterer Fehlschlag, neuerer Erfolg: Kontakte muss grün sein.
      {
        scenario_id: "contact-lifecycle", scenario_title: "Kontakt (alt)", status: "failed", created_at: ago(5 * 86_400_000),
        duration_ms: 40, failed_steps: 1, total_steps: 7, keep_data: false, cleanup: { status: "ok" }, steps: [],
      },
      {
        scenario_id: "contact-lifecycle", scenario_title: "Kontakt-Lifecycle (gespeichert)", status: "ok", created_at: ago(3_600_000),
        duration_ms: 820, failed_steps: 0, total_steps: 7, keep_data: false, cleanup: { status: "ok" },
        steps: [
          { id: "create", label: "Kontakt mit allen Stammdaten anlegen", status: "ok", durationMs: 120 },
          { id: "dynamic-extra", label: "Dynamischer Plattformschritt", status: "ok", durationMs: 15 },
        ],
      },
      {
        scenario_id: "meeting-lifecycle", scenario_title: "Meeting-Lifecycle", status: "ok", created_at: ago(2 * 3_600_000),
        duration_ms: 1500, failed_steps: 0, total_steps: 21, keep_data: false, cleanup: { status: "ok" }, steps: [],
      },
      // Meeting besteht, Jour fixe scheitert: Bereich muss rot sein.
      {
        scenario_id: "jour-fixe-platform-integration", scenario_title: "Jour fixe (Plattform)", status: "failed", created_at: ago(7_200_000),
        duration_ms: 987, failed_steps: 1, total_steps: 10, keep_data: false, cleanup: { status: "ok" },
        steps: [{
          id: "agenda-combine", label: "Agenda: Hauptpunkt verschieben", status: "failed", message: "Agenda konnte nicht verschoben werden.", durationMs: 35,
          details: { step: { id: "agenda-combine", label: "Agenda: Hauptpunkt verschieben" }, error: { code: "42501", details: "policy meeting_agenda_update" } },
        }],
      },
    ];
    const history = [
      { scenario_id: "contact-lifecycle", status: "ok", created_at: ago(3_600_000), duration_ms: 820 },
      { scenario_id: "contact-lifecycle", status: "failed", created_at: ago(2 * 86_400_000), duration_ms: 900 },
      { scenario_id: "contact-lifecycle", status: "ok", created_at: ago(3 * 86_400_000), duration_ms: 1000 },
      { scenario_id: "jour-fixe-platform-integration", status: "failed", created_at: ago(7_200_000), duration_ms: 987 },
      { scenario_id: "jour-fixe-platform-integration", status: "failed", created_at: ago(2 * 86_400_000), duration_ms: 1100 },
      { scenario_id: "jour-fixe-platform-integration", status: "ok", created_at: ago(3 * 86_400_000), duration_ms: 900 },
      { scenario_id: "meeting-lifecycle", status: "ok", created_at: ago(2 * 3_600_000), duration_ms: 1500 },
    ];
    rpc.mockImplementation((name: string) => Promise.resolve(
      name === "get_selftest_run_history" ? { data: history, error: null } : { data: latest, error: null },
    ));
    renderPulse();

    await waitFor(() => expect(within(tile(/Kontakte/)).getByText("Alles in Ordnung")).toBeInTheDocument());
    expect(rpc).toHaveBeenCalledWith("get_latest_selftest_runs", { p_tenant_id: "tenant-1" });
    expect(rpc).toHaveBeenCalledWith("get_selftest_run_history", { p_tenant_id: "tenant-1", p_runs_per_scenario: 8 });
    expect(within(tile(/Kontakte/)).getByText("1/1 geprüft")).toBeInTheDocument();
    expect(within(tile(/Jour fixe/)).getByText("Test fehlgeschlagen")).toBeInTheDocument();
    expect(within(tile(/Vorgänge/)).getByText("Noch nie getestet")).toBeInTheDocument();
    expect(within(tile(/Vorgänge/)).getByText("0/2 geprüft")).toBeInTheDocument();

    fireEvent.click(tile(/Kontakte/));
    expect(await screen.findByLabelText(/Kontakt mit allen Stammdaten anlegen: bestanden/)).toBeInTheDocument();
    expect(screen.getByText("Kontakt-Lifecycle (gespeichert)")).toBeInTheDocument();
    expect(screen.getByText(/820 ms/)).toBeInTheDocument();
    expect(screen.getByText(/7 Schritte · 0 fehlgeschlagen/)).toBeInTheDocument();
    expect(screen.getByText("120 ms")).toBeInTheDocument();
    expect(screen.getByText(/Legt einen vollständigen Kontakt an/)).toBeInTheDocument();
    expect(screen.getByText("1 Schritt(e) aus dem Lauf ergänzt – nicht im Artefakt deklariert.")).toBeInTheDocument();
    expect(screen.getByLabelText(/Letzte 3 Läufe/)).toBeInTheDocument();
    expect(screen.getByText(/Dauer -9 % zum Vorlauf/)).toBeInTheDocument();
    expect(screen.getByText(/langsamster Schritt: Kontakt mit allen Stammdaten anlegen \(120 ms\)/)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /erneut testen/ }).length).toBeGreaterThan(0);
    const catalogLink = screen.getAllByRole("link", { name: /im Funktionskatalog öffnen/ })[0];
    expect(catalogLink.getAttribute("href")).toContain("/funktionskatalog?feature=");
    expect(screen.getByText(/Betroffene Funktionen/)).toBeInTheDocument();

    fireEvent.click(tile(/Jour fixe/));
    expect(await screen.findByText(/10 Schritte · 1 fehlgeschlagen/)).toBeInTheDocument();
    expect(await screen.findByText(/2× in Folge fehlgeschlagen/)).toBeInTheDocument();
    expect(screen.getAllByText(/Geprüft \(/).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Nur auffällige testen (1)" })).toBeEnabled();

    const stepNodes = screen.getAllByTestId("pulse-step");
    expect(stepNodes.length).toBeGreaterThan(1);
    fireEvent.click(screen.getByRole("checkbox", { name: /Nur fehlgeschlagene Schritte/ }));
    expect(screen.getAllByTestId("pulse-step")).toHaveLength(1);

    const diagnostic = within(screen.getAllByTestId("pulse-step")[0]).getByTestId("pulse-step-diagnostic");
    expect(diagnostic).toHaveTextContent("Code 42501");
    expect(diagnostic).toHaveTextContent("policy meeting_agenda_update");

    const failedStep = screen.getByRole("button", { name: /Agenda: Hauptpunkt.*fehlgeschlagen/ });
    fireEvent.click(failedStep);
    expect(screen.getByRole("alert")).toHaveTextContent("Agenda konnte nicht verschoben werden.");
  });

  it("verwirft lokale Live-Statuswerte nach dem Lauf statt einen Erfolg zu erfinden", async () => {
    let latestReads = 0;
    rpc.mockImplementation((name: string) => {
      if (name === "get_selftest_run_history") return Promise.resolve({ data: [], error: null });
      latestReads += 1;
      return Promise.resolve({
        // Nach dem Lauf liefert die Abfrage keinen gespeicherten Lauf mehr.
        data: latestReads === 1 ? [{
          scenario_id: "contact-lifecycle", scenario_title: "Kontakt-Lifecycle", status: "failed", created_at: ago(3_600_000),
          duration_ms: 500, failed_steps: 1, total_steps: 7, keep_data: false, cleanup: { status: "ok" }, steps: [],
        }] : [],
        error: null,
      });
    });
    runSuite.mockImplementation(async (_scenarios: unknown, options: { onUpdate?: (state: unknown) => void }) => {
      options.onUpdate?.({ scenarioId: "contact-lifecycle", status: "ok", steps: [] });
      return [{ scenarioId: "contact-lifecycle", status: "ok", steps: [], cleanup: { status: "ok" } }];
    });
    renderPulse();

    await waitFor(() => expect(within(tile(/Kontakte/)).getByText("Test fehlgeschlagen")).toBeInTheDocument());
    fireEvent.click(tile(/Kontakte/));
    fireEvent.click(await screen.findByRole("button", { name: /Kontakt-Lifecycle erneut testen/ }));

    await waitFor(() => expect(saveRun).toHaveBeenCalled());
    await waitFor(() => expect(latestReads).toBeGreaterThanOrEqual(2));
    // Ohne gespeicherten Lauf zählt der verworfene Live-Status nicht mehr.
    await waitFor(() => expect(within(tile(/Kontakte/)).getByText("Noch nie getestet")).toBeInTheDocument());
    expect(screen.queryByText("Alles in Ordnung")).not.toBeInTheDocument();
  });

  it("verknüpft RLS-Befunde mit Bereich und Workflow", async () => {
    rpc.mockImplementation((name: string) => Promise.resolve(
      name === "get_selftest_run_history"
        ? { data: [], error: null }
        : {
          data: [{
            scenario_id: "contact-lifecycle", scenario_title: "Kontakt-Lifecycle", status: "ok", created_at: ago(3_600_000),
            duration_ms: 500, failed_steps: 0, total_steps: 7, keep_data: false, cleanup: { status: "ok" }, steps: [],
          }],
          error: null,
        },
    ));
    renderPulse([{ table_name: "contacts", severity: "critical" }]);

    await waitFor(() => expect(within(tile(/Kontakte/)).getByText("Alles in Ordnung")).toBeInTheDocument());
    fireEvent.click(tile(/Kontakte/));
    expect(screen.getByText(/RLS-Befunde in den Haupttabellen:/)).toBeInTheDocument();
    expect(screen.getByText(/RLS: contacts \(critical\)/)).toBeInTheDocument();
    expect(screen.getByText(/Tabellen: contacts/)).toBeInTheDocument();
  });
});
