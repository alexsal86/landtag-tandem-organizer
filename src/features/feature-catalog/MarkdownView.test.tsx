import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { catalogPages, entityMapMarkdown } from "./catalogContent";
import { MarkdownView } from "./MarkdownView";

const page = (id: string) => {
  const found = catalogPages.find((entry) => entry.id === id);
  if (!found) throw new Error(`Katalogseite fehlt: ${id}. npm run update:feature-catalog ausführen.`);
  return found;
};

describe("MarkdownView mit den generierten Katalogdateien", () => {
  it("bindet den echten Index ein und rendert seine Bereichstabelle", () => {
    const index = page("README");
    render(<MarkdownView markdown={index.markdown} />);

    expect(screen.getByRole("heading", { level: 1, name: "Funktionskatalog" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Funktionsbereiche" })).toBeTruthy();
    const areaTable = screen.getAllByRole("table").find((table) => within(table).queryByText("Aufgaben & Stafette"));
    expect(areaTable).toBeTruthy();
    expect(within(areaTable as HTMLElement).getByText("Wahlanalyse & Wahlhistorie")).toBeTruthy();
  });

  it("rendert eine echte Bereichsseite samt Funktionsdetails und Szenarien", () => {
    const area = page("aufgaben");
    render(<MarkdownView markdown={area.markdown} />);

    expect(screen.getByRole("heading", { level: 1, name: "Aufgaben & Stafette" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Funktionsdetails" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Selbsttest-Szenarien" })).toBeTruthy();
    expect(screen.getAllByText(/task-lifecycle/).length).toBeGreaterThan(0);
    // Die Detailbeschreibung nennt die betroffene Tabelle.
    expect(screen.getAllByText("tasks").length).toBeGreaterThan(0);
  });

  it("schaltet bei internen Links auf die Zielseite statt ins Leere zu verlinken", () => {
    const onNavigatePage = vi.fn();
    render(<MarkdownView markdown={page("README").markdown} onNavigatePage={onNavigatePage} />);

    fireEvent.click(screen.getByRole("button", { name: "Aufgaben & Stafette" }));

    expect(onNavigatePage).toHaveBeenCalledWith("aufgaben");
  });

  it("zeigt Repo-Pfade als Text, weil sie in der App keine Route haben", () => {
    render(<MarkdownView markdown={page("aufgaben").markdown} onNavigatePage={vi.fn()} />);

    expect(screen.getAllByText(/AGENTS\.md/).length).toBeGreaterThan(0);
  });

  it("rendert die echte Entitätskarte mit Fremdschlüsselverweisen", () => {
    expect(entityMapMarkdown.length).toBeGreaterThan(0);
    render(<MarkdownView markdown={entityMapMarkdown} />);

    expect(screen.getByText(/Fremdschlüsselverweise/)).toBeTruthy();
    const tables = screen.getAllByRole("table");
    expect(tables.length).toBeGreaterThan(0);
    expect(screen.getAllByText("tasks").length).toBeGreaterThan(0);
  });
});
