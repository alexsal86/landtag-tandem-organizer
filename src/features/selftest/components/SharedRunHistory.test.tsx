import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const loadHistory = vi.hoisted(() => vi.fn());

vi.mock("../history", async () => {
  const actual = await vi.importActual<typeof import("../history")>("../history");
  return { ...actual, loadHistory };
});

import { SharedRunHistory } from "./SharedRunHistory";

describe("SharedRunHistory", () => {
  beforeEach(() => loadHistory.mockReset());

  it("kennzeichnet gekürzte Details am Schritt des gespeicherten Laufs", async () => {
    loadHistory.mockResolvedValue([{
      id: "run-1", scenario_id: "contact-lifecycle", scenario_title: "Kontakt-Lifecycle", status: "failed", keep_data: false,
      duration_ms: 500, failed_steps: 1, total_steps: 1, created_at: "2026-11-22T10:00:00Z",
      steps: [{
        id: "verify", label: "Felder prüfen", status: "failed",
        details: [{ field: "status", expected: "sent", actual: "draft" }],
        detailsTruncated: true, detailsOmitted: 42,
      }],
      cleanup: { status: "ok" },
    }]);

    render(<SharedRunHistory tenantId="tenant-1" refreshKey="r1" />);

    expect(await screen.findByText("Details gekürzt: 42 Einträge ausgelassen")).toBeInTheDocument();
  });

  it("zeigt keinen Kürzungshinweis bei vollständigen Details", async () => {
    loadHistory.mockResolvedValue([{
      id: "run-2", scenario_id: "contact-lifecycle", scenario_title: "Kontakt-Lifecycle", status: "failed", keep_data: false,
      duration_ms: 500, failed_steps: 1, total_steps: 1, created_at: "2026-11-22T10:00:00Z",
      steps: [{ id: "check", label: "Prüfen", status: "failed", message: "Prüfung kaputt" }],
      cleanup: { status: "ok" },
    }]);

    render(<SharedRunHistory tenantId="tenant-1" refreshKey="r2" />);

    expect(await screen.findByText(/Prüfung kaputt/)).toBeInTheDocument();
    expect(screen.queryByText(/Details gekürzt/)).not.toBeInTheDocument();
  });
});
