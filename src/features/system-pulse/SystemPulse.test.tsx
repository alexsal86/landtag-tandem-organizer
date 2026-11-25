import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PULSE_AREAS } from "./pulse";
import { SystemPulse } from "./SystemPulse";

const rpc = vi.hoisted(() => vi.fn());

vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc } }));
vi.mock("@/hooks/useTenant", () => ({ useTenant: () => ({ currentTenant: { id: "tenant-1" } }) }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "user-1" } }) }));
vi.mock("@/features/selftest/registry", () => ({
  SELFTEST_SCENARIOS: [
    { id: "contact-lifecycle", title: "Kontakt-Lifecycle", description: "Legt einen vollständigen Kontakt an.", checks: ["Stammdaten", "Suche"] },
    { id: "meeting-lifecycle", title: "Meeting-Lifecycle", description: "Prüft den Meetingablauf.", checks: ["Agenda"] },
    { id: "jour-fixe-platform-integration", title: "Jour fixe", description: "Prüft die Plattformquellen.", checks: ["Agenda", "Regeln"] },
  ],
}));

const renderPulse = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <SystemPulse gaps={[]} gapsState="ready" />
      </QueryClientProvider>
    </MemoryRouter>,
  );
};

const tile = (name: RegExp) => screen.getByRole("button", { name });

beforeEach(() => {
  rpc.mockReset();
});

describe("SystemPulse: selftest_runs", () => {
  it("zeigt während des Ladens auf allen Kacheln 'wird geladen …' statt 'Noch nie getestet'", () => {
    rpc.mockReturnValue(new Promise(() => {}));
    renderPulse();

    expect(screen.getByText(/Testlage wird geladen/)).toBeInTheDocument();
    expect(screen.getAllByText("wird geladen …")).toHaveLength(PULSE_AREAS.length);
    expect(screen.queryByText("Noch nie getestet")).not.toBeInTheDocument();
  });

  it("zeigt bei einem Abfragefehler auf allen Kacheln 'unbekannt' statt 'Noch nie getestet'", async () => {
    rpc.mockRejectedValue(new Error("Abfrage fehlgeschlagen"));
    renderPulse();

    await waitFor(() => expect(screen.getAllByText("unbekannt")).toHaveLength(PULSE_AREAS.length));
    expect(screen.getByText(/Testlage unbekannt/)).toBeInTheDocument();
    expect(screen.queryByText("Noch nie getestet")).not.toBeInTheDocument();
  });

  it("nutzt im Erfolgsfall den neuesten Lauf je Szenario, unabhängig von der Zeilenreihenfolge", async () => {
    rpc.mockResolvedValue({
      data: [
        // Älterer Fehlschlag, neuerer Erfolg: Kontakte muss grün sein.
        { scenario_id: "contact-lifecycle", scenario_title: "Kontakt (alt)", status: "failed", created_at: "2026-11-20T10:00:00Z", duration_ms: 40, failed_steps: 1, total_steps: 7, steps: [] },
        {
          scenario_id: "contact-lifecycle", scenario_title: "Kontakt-Lifecycle (gespeichert)", status: "ok", created_at: "2026-11-25T10:00:00Z",
          duration_ms: 820, failed_steps: 0, total_steps: 7,
          steps: [{ id: "create", label: "Kontakt mit allen Stammdaten anlegen", status: "ok", durationMs: 120 }],
        },
        { scenario_id: "meeting-lifecycle", scenario_title: "Meeting-Lifecycle", status: "ok", created_at: "2026-11-24T10:00:00Z", duration_ms: 1500, failed_steps: 0, total_steps: 21, steps: [] },
        // Meeting besteht früher, Jour fixe scheitert später: Bereich muss rot sein.
        {
          scenario_id: "jour-fixe-platform-integration", scenario_title: "Jour fixe (Plattform)", status: "failed", created_at: "2026-11-24T12:00:00Z",
          duration_ms: 987, failed_steps: 1, total_steps: 10,
          steps: [{ id: "agenda-combine", label: "Agenda: Hauptpunkt verschieben", status: "failed", message: "Agenda konnte nicht verschoben werden.", durationMs: 35 }],
        },
      ],
      error: null,
    });
    renderPulse();

    await waitFor(() => expect(within(tile(/Kontakte/)).getByText("Alles in Ordnung")).toBeInTheDocument());
    expect(rpc).toHaveBeenCalledWith("get_latest_selftest_runs", { p_tenant_id: "tenant-1" });
    expect(within(tile(/Jour fixe/)).getByText("Fehler")).toBeInTheDocument();
    // Bereiche ohne Lauf dürfen erst bei erfolgreich geladenen Daten 'Noch nie getestet' sagen.
    expect(within(tile(/Vorgänge/)).getByText("Noch nie getestet")).toBeInTheDocument();

    fireEvent.click(tile(/Kontakte/));
    expect(await screen.findByLabelText(/Kontakt mit allen Stammdaten anlegen: bestanden/)).toBeInTheDocument();
    expect(screen.getByText("Kontakt-Lifecycle (gespeichert)")).toBeInTheDocument();
    expect(screen.getByText(/820 ms/)).toBeInTheDocument();
    expect(screen.getByText(/7 Schritte · 0 fehlgeschlagen/)).toBeInTheDocument();
    expect(screen.getByText("120 ms")).toBeInTheDocument();
    expect(await screen.findByText(/Legt einen vollständigen Kontakt an\./)).toBeInTheDocument();
    expect(screen.getByText("Geprüft (2)")).toBeInTheDocument();
    const catalogLink = screen.getAllByRole("link", { name: /im Funktionskatalog öffnen/ })[0];
    expect(catalogLink.getAttribute("href")).toContain("/funktionskatalog?feature=");

    fireEvent.click(tile(/Jour fixe/));
    expect(await screen.findByText(/10 Schritte · 1 fehlgeschlagen/)).toBeInTheDocument();
    const failedStep = screen.getByRole("button", { name: /Agenda: Hauptpunkt.*fehlgeschlagen/ });
    fireEvent.click(failedStep);
    expect(screen.getByRole("alert")).toHaveTextContent("Agenda konnte nicht verschoben werden.");
  });
});
