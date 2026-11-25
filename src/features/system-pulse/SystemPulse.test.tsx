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
        { scenario_id: "contact-lifecycle", status: "failed", created_at: "2026-11-20T10:00:00Z", steps: [] },
        {
          scenario_id: "contact-lifecycle", status: "ok", created_at: "2026-11-25T10:00:00Z",
          steps: [{ id: "create", label: "Kontakt mit allen Stammdaten anlegen", status: "ok" }],
        },
        { scenario_id: "meeting-lifecycle", status: "ok", created_at: "2026-11-24T10:00:00Z", steps: [] },
        // Meeting besteht früher, Jour fixe scheitert später: Bereich muss rot sein.
        {
          scenario_id: "jour-fixe-platform-integration", status: "failed", created_at: "2026-11-24T12:00:00Z",
          steps: [{ id: "agenda-combine", label: "Agenda: Hauptpunkt verschieben", status: "failed", message: "Agenda konnte nicht verschoben werden." }],
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
    const catalogLink = screen.getAllByRole("link", { name: /im Funktionskatalog öffnen/ })[0];
    expect(catalogLink.getAttribute("href")).toContain("/funktionskatalog?feature=");

    fireEvent.click(tile(/Jour fixe/));
    const failedStep = screen.getByRole("button", { name: /Agenda: Hauptpunkt.*fehlgeschlagen/ });
    fireEvent.click(failedStep);
    expect(screen.getByRole("alert")).toHaveTextContent("Agenda konnte nicht verschoben werden.");
  });
});
