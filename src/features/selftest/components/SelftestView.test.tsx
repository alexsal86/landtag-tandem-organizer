import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

const mock = vi.hoisted(() => ({ first: async () => ({ ok: true, message: "OK" }), secondCalls: 0 }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "user" } }) }));
vi.mock("@/hooks/useTenant", () => ({ useTenant: () => ({ currentTenant: { id: "office", name: "Testbüro" } }) }));
vi.mock("../registry", () => ({ SELFTEST_SCENARIOS: [
  { id: "first", title: "Erster Ablauf", description: "Prüfung", touches: [], features: [], steps: [{ id: "one", label: "Erster Schritt", kind: "logic", run: () => mock.first() }] },
  { id: "second", title: "Zweiter Ablauf", description: "Prüfung", touches: [], features: [], steps: [{ id: "two", label: "Zweiter Schritt", kind: "logic", run: async () => { mock.secondCalls++; return { ok: true, message: "OK" }; } }] },
] }));
import { SelftestView } from "./SelftestView";

beforeEach(() => { mock.first = async () => ({ ok: true, message: "OK" }); mock.secondCalls = 0; });
const show = () => render(<MemoryRouter><SelftestView /></MemoryRouter>);
describe("Selbsttest-Center", () => {
  it("sperrt alle Startknöpfe während der Suite und führt Szenarien nacheinander aus", async () => {
    let finish: (result: { ok: boolean; message: string }) => void = () => {};
    mock.first = () => new Promise(resolve => { finish = resolve; });
    show();
    fireEvent.click(screen.getByRole("button", { name: /Testsuite ausführen/ }));
    expect(mock.secondCalls).toBe(0);
    for (const button of screen.getAllByRole("button", { name: "Ausführen", exact: true })) expect(button).toBeDisabled();
    await act(async () => { finish({ ok: true, message: "OK" }); });
    await waitFor(() => expect(screen.getByTestId("suite-result")).toHaveTextContent("2 bestanden"));
    expect(mock.secondCalls).toBe(1);
  });
  it("zeigt einen fehlgeschlagenen Lauf und führt den unabhängigen zweiten weiter", async () => {
    mock.first = async () => ({ ok: false, message: "Regel verletzt" });
    show(); fireEvent.click(screen.getByRole("button", { name: /Testsuite ausführen/ }));
    await waitFor(() => expect(screen.getByTestId("suite-result")).toHaveTextContent("1 bestanden · 1 fehlgeschlagen"));
    expect(within(screen.getByTestId("scenario-first")).getByTestId("scenario-result")).toHaveTextContent("Fehlgeschlagen");
  });
  it("stellt das Ergebnis nach erneutem Öffnen aus der passenden Historie wieder her", async () => {
    const view = show(); fireEvent.click(within(screen.getByTestId("scenario-first")).getByRole("button", { name: "Ausführen", exact: true }));
    await waitFor(() => expect(within(screen.getByTestId("scenario-first")).getByTestId("scenario-result")).toHaveTextContent("Bestanden"));
    view.unmount(); show();
    expect(within(screen.getByTestId("scenario-first")).getByTestId("scenario-result")).toHaveTextContent("Bestanden");
  });
});
