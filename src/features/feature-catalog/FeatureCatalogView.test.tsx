import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const securityState = vi.hoisted(() => ({ policiesUnavailable: false }));

vi.mock("./useTableSecurity", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./useTableSecurity")>();
  return {
    ...actual,
    useTableSecurity: () => ({
      gapsQuery: {
      data: [
        {
          table_name: "event_plannings",
          severity: "warning",
          reason: "Wenige Policies trotz tenant_id",
          has_tenant_id: true,
          policy_count: 1,
        },
      ],
      isLoading: false,
      isError: false,
      isSuccess: true,
    },
      policiesQuery: {
        data: securityState.policiesUnavailable
          ? undefined
          : [
              {
                table_name: "event_plannings",
                policy_name: "Tenant members read plannings",
                command: "SELECT",
                roles: ["authenticated"],
                permissive: "PERMISSIVE",
                has_using: true,
                has_check: false,
              },
            ],
        isLoading: false,
        isError: securityState.policiesUnavailable,
        isSuccess: !securityState.policiesUnavailable,
      },
    }),
  };
});

import { FeatureCatalogView } from "./FeatureCatalogView";

const renderCatalog = (entry = "/administration?adminSection=superadmin&adminSubSection=feature-catalog") =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <FeatureCatalogView />
    </MemoryRouter>,
  );

describe("Funktionskatalog", () => {
  beforeEach(() => {
    securityState.policiesUnavailable = false;
  });

  it("zeigt den Katalog mit seinen Bereichen", () => {
    renderCatalog();

    expect(screen.getByRole("navigation", { name: "Katalogbereiche" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Übersicht" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Katalog" })).toBeTruthy();
  });

  it("zeigt die abgeleitete Funktionslandkarte mit Bereichen und Wirkungsketten", async () => {
    renderCatalog();
    fireEvent.click(screen.getByRole("button", { name: "Landkarte" }));

    expect(await screen.findByRole("heading", { name: "Funktionslandkarte" })).toBeTruthy();
    expect(screen.getByText(/Automatisch aus Bereich, Unterbereich/)).toBeTruthy();
    // Kopplungen stehen in den Bereichskacheln, nicht als separate Liste darunter.
    expect(screen.getAllByText(/hängt ab von Aufgaben & Stafette/).length).toBeGreaterThan(0);
    expect(screen.queryByText("Kopplungen zwischen Bereichen")).toBeNull();
    expect(screen.getByText("Wirkungsketten")).toBeTruthy();
    // Die deklarierten Abhängigkeiten bilden Ketten ab drei Funktionen.
    expect(screen.queryByText(/Keine Kette mit mindestens drei Funktionen/)).toBeNull();
    expect(screen.getByRole("list").querySelectorAll("li").length).toBeGreaterThan(0);
  });

  it("zeigt die generierten Zustandsmaschinen mit Zuständen, Übergängen und Guards", async () => {
    renderCatalog();
    fireEvent.click(screen.getByRole("button", { name: "Zustände" }));

    expect(await screen.findByRole("heading", { name: "Zustandsmaschinen" })).toBeTruthy();
    expect(screen.getByText(/^\d+ Maschinen$/)).toBeTruthy();
    expect(screen.getAllByText(/^\d+ Startzustände$/).length).toBeGreaterThan(0);
    expect(screen.getAllByText("tasks.status").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/→ completed/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Guard \(bricht ab\)/).length).toBeGreaterThan(0);
  });

  it("öffnet eine Funktion per Deep-Link und trennt RLS-Befunde von Testergebnissen", async () => {
    renderCatalog("/administration?adminSection=superadmin&adminSubSection=feature-catalog&feature=events.plan");

    expect(await screen.findByRole("heading", { name: "Veranstaltung planen" })).toBeTruthy();
    expect(screen.getByText("Sicherheitsbezug (RLS)")).toBeTruthy();
    expect(screen.getByText("Tenant members read plannings")).toBeTruthy();
    expect(screen.getByText(/Wenige Policies trotz tenant_id/)).toBeTruthy();
    // Die funktionalen Testangaben bleiben unabhängig von den Sicherheitsbefunden sichtbar.
    expect(screen.getAllByText("Testabdeckung").length).toBeGreaterThan(0);
    expect(screen.getByText("Letztes Ergebnis")).toBeTruthy();
  });

  it("degradiert klar, wenn die Policy-Migration noch fehlt, ohne den RLS-Befund zu verbergen", async () => {
    securityState.policiesUnavailable = true;
    renderCatalog("/administration?adminSection=superadmin&adminSubSection=feature-catalog&feature=events.plan");

    expect(await screen.findByText(/Policy-Details sind nicht verfügbar/)).toBeTruthy();
    expect(screen.getByText("20261125160000_feature_security_policy_links.sql")).toBeTruthy();
    expect(screen.getByText(/Wenige Policies trotz tenant_id/)).toBeTruthy();
    expect(screen.getByText(/RLS-Befunde bleiben sichtbar/)).toBeTruthy();
    expect(screen.getByText("Letztes Ergebnis")).toBeTruthy();
  });
});
