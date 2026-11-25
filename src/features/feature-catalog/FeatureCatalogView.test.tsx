import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const roleState = vi.hoisted(() => ({ hasAdminAccess: true, loading: false }));
vi.mock("@/hooks/useResolvedUserRole", () => ({
  useResolvedUserRole: () => ({
    hasAdminAccess: roleState.hasAdminAccess,
    loading: roleState.loading,
    role: roleState.hasAdminAccess ? "bueroleitung" : "mitarbeiter",
  }),
}));

import { FeatureCatalogView } from "./FeatureCatalogView";

describe("Funktionskatalog: Zugriff", () => {
  beforeEach(() => {
    roleState.hasAdminAccess = true;
    roleState.loading = false;
  });

  it("zeigt Administration und Büroleitung den Katalog", () => {
    render(<FeatureCatalogView />);

    expect(screen.getByRole("navigation", { name: "Katalogbereiche" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Übersicht" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Katalog" })).toBeTruthy();
  });

  it("verweigert Mitarbeitenden Inhalt und Bereiche", () => {
    roleState.hasAdminAccess = false;
    render(<FeatureCatalogView />);

    expect(screen.getByText(/nur für Administration und Büroleitung/)).toBeTruthy();
    expect(screen.queryByRole("navigation", { name: "Katalogbereiche" })).toBeNull();
    expect(screen.queryByRole("heading", { level: 1, name: "Funktionskatalog" })).toBeNull();
  });

  it("zeigt während der Rollenprüfung keinen Inhalt", () => {
    roleState.loading = true;
    render(<FeatureCatalogView />);

    expect(screen.getByText(/Zugriff wird geprüft/)).toBeTruthy();
    expect(screen.queryByRole("navigation", { name: "Katalogbereiche" })).toBeNull();
  });
});
