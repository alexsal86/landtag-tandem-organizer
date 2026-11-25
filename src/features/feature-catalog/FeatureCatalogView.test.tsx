import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const roleState = vi.hoisted(() => ({ hasAdminAccess: true, loading: false }));
const securityState = vi.hoisted(() => ({ policiesUnavailable: false }));

vi.mock("@/hooks/useResolvedUserRole", () => ({
  useResolvedUserRole: () => ({
    hasAdminAccess: roleState.hasAdminAccess,
    loading: roleState.loading,
    role: roleState.hasAdminAccess ? "bueroleitung" : "mitarbeiter",
  }),
}));

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

const renderCatalog = (entry = "/funktionskatalog") =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <FeatureCatalogView />
    </MemoryRouter>,
  );

describe("Funktionskatalog: Zugriff", () => {
  beforeEach(() => {
    roleState.hasAdminAccess = true;
    roleState.loading = false;
    securityState.policiesUnavailable = false;
  });

  it("zeigt Administration und Büroleitung den Katalog", () => {
    renderCatalog();

    expect(screen.getByRole("navigation", { name: "Katalogbereiche" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Übersicht" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Katalog" })).toBeTruthy();
  });

  it("verweigert Mitarbeitenden Inhalt und Bereiche", () => {
    roleState.hasAdminAccess = false;
    renderCatalog();

    expect(screen.getByText(/nur für Administration und Büroleitung/)).toBeTruthy();
    expect(screen.queryByRole("navigation", { name: "Katalogbereiche" })).toBeNull();
    expect(screen.queryByRole("heading", { level: 1, name: "Funktionskatalog" })).toBeNull();
  });

  it("zeigt während der Rollenprüfung keinen Inhalt", () => {
    roleState.loading = true;
    renderCatalog();

    expect(screen.getByText(/Zugriff wird geprüft/)).toBeTruthy();
    expect(screen.queryByRole("navigation", { name: "Katalogbereiche" })).toBeNull();
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

  it("öffnet eine Funktion per Deep-Link und trennt RLS-Befunde von Testergebnissen", async () => {
    renderCatalog("/funktionskatalog?feature=events.plan");

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
    renderCatalog("/funktionskatalog?feature=events.plan");

    expect(await screen.findByText(/Policy-Details sind nicht verfügbar/)).toBeTruthy();
    expect(screen.getByText("20261125160000_feature_security_policy_links.sql")).toBeTruthy();
    expect(screen.getByText(/Wenige Policies trotz tenant_id/)).toBeTruthy();
    expect(screen.getByText(/RLS-Befunde bleiben sichtbar/)).toBeTruthy();
    expect(screen.getByText("Letztes Ergebnis")).toBeTruthy();
  });
});
