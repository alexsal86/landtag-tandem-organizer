import "@testing-library/jest-dom/vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { supabase } from "@/integrations/supabase/client";
import { GlobalDaySlipPanel } from "../GlobalDaySlipPanel";
import { DAY_SLIP_APPEND_EVENT } from "@/lib/daySlipBridge";
import { toDayKey, toParagraphHtml } from "../dayslipTypes";
import { shiftDayKey } from "../daySlipNavigation";
import type { createBackend } from "./backend";

const account = vi.hoisted(() => ({ userId: "user-a" }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: account.userId } }) }));
vi.mock("@/hooks/useTenant", () => ({ useTenant: () => ({ currentTenant: { id: "tenant" } }) }));
vi.mock("@/hooks/useTenantUsers", () => ({ useTenantUsers: () => ({ users: [{ id: "colleague", display_name: "Kollegin" }] }) }));
vi.mock("@/integrations/supabase/client", async () => {
  const { createBackend } = await import("./backend");
  return { supabase: createBackend() };
});
vi.mock("@/components/lexical/FloatingTextFormatToolbar", () => ({ default: () => null }));
const notifications = vi.hoisted(() => {
  const toast = vi.fn();
  return { toast: Object.assign(toast, { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(), message: vi.fn(), loading: vi.fn(), dismiss: vi.fn(), promise: vi.fn() }) };
});
vi.mock("sonner", () => ({ toast: notifications.toast }));
const db = supabase as unknown as ReturnType<typeof createBackend>;
const today = toDayKey(new Date());

beforeEach(() => {
  db.reset(); localStorage.clear(); account.userId = "user-a";
  window.history.replaceState(null, "", "/");
  localStorage.setItem("day-slip-panel-open", "true");
});
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const view = () => <QueryClientProvider client={queryClient}><BrowserRouter><GlobalDaySlipPanel /></BrowserRouter></QueryClientProvider>;

describe("Tageszettel panel", () => {
  it("loads DB content into the actual editor and resets the editor on account switch", async () => {
    db.tables.set("day_slips", [
      { user_id: "user-a", day_key: today, data: { html: toParagraphHtml({ id: "a", text: "Account A content" }), plainText: "Account A content", recurringInjected: true } },
      { user_id: "user-b", day_key: today, data: { html: toParagraphHtml({ id: "b", text: "Account B content" }), plainText: "Account B content", recurringInjected: true } },
    ]);
    const page = render(view());
    await waitFor(() => expect(screen.getByRole("textbox")).toHaveTextContent("Account A content"));
    account.userId = "user-b";
    page.rerender(view());
    await waitFor(() => expect(screen.getByRole("textbox")).toHaveTextContent("Account B content"));
    expect(screen.getByRole("textbox")).not.toHaveTextContent("Account A content");
  });
  it("shows the icon on an appended case and links to the highlighted My Work case", async () => {
    db.tables.set("day_slips", [{ user_id: "user-a", day_key: today, data: { html: toParagraphHtml({ id: "a", text: "Initial" }), plainText: "Initial", recurringInjected: true } }]);
    render(view());
    await waitFor(() => expect(screen.getByRole("textbox")).toHaveTextContent("Initial"));
    fireEvent(window, new CustomEvent(DAY_SLIP_APPEND_EVENT, { detail: {
      text: "Vorgang: Bürgeranfrage | Schritt: Antwort nachhalten", source: { type: "case", id: "case-1", nextActionLabel: "Antwort nachhalten" },
    } }));
    await waitFor(() => expect(screen.getByRole("textbox")).toHaveTextContent("💼 Vorgang: Bürgeranfrage | Schritt: Antwort nachhalten"));
    const line = screen.getByRole("textbox").querySelector('[data-source-type="case"]');
    expect(line).toHaveAttribute("data-source-id", "case-1");
    fireEvent.click(screen.getByRole("button", { name: "💼 Vorgang: Bürgeranfrage | Schritt: Antwort nachhalten" }));
    expect(window.location.pathname).toBe("/mywork");
    const params = new URLSearchParams(window.location.search);
    expect(params.get("tab")).toBe("cases");
    expect(params.get("caseItemId")).toBe("case-1");
    expect(params.get("highlight")).toBe("case-1");
  });
  it("shows only explicitly completed days in the archive", async () => {
    db.tables.set("day_slips", [
      { user_id: "user-a", day_key: "2026-01-01", data: { html: toParagraphHtml({ id: "open", text: "Open draft" }), plainText: "Open draft" } },
      { user_id: "user-a", day_key: "2026-01-02", data: { html: toParagraphHtml({ id: "closed", text: "Explicit report" }), plainText: "Explicit report", completedAt: "2026-01-02T18:00:00Z" } },
    ]);
    render(view());
    await waitFor(() => expect(screen.getByRole("textbox")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Archiv anzeigen" }));
    await waitFor(() => expect(screen.getByText("Archiv (nur lesen)")).toBeInTheDocument());
    expect(screen.getByText("Explicit report")).toBeInTheDocument();
    expect(screen.queryByText("Open draft")).not.toBeInTheDocument();
    expect(screen.queryByText(/Nicht explizit abgeschlossen/)).not.toBeInTheDocument();
  });
  it("offers responsibility and due date when a collected line is assigned to a task", async () => {
    db.tables.set("day_slips", [{ user_id: "user-a", day_key: today, data: { html: toParagraphHtml({ id: "a", text: "Prepare briefing" }), plainText: "Prepare briefing", recurringInjected: true } }]);
    render(view());
    await waitFor(() => expect(screen.getByRole("textbox")).toHaveTextContent("Prepare briefing"));
    fireEvent.click(screen.getByRole("button", { name: /Tag abschließen/ }));
    fireEvent.click(screen.getByTitle("Als Aufgabe"));
    expect(screen.getByText("Zur Erstellung vorgemerkt")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Zuständig"), { target: { value: "colleague" } });
    fireEvent.change(screen.getByLabelText("Fällig am"), { target: { value: "2026-11-10" } });
    expect(screen.getByLabelText("Zuständig")).toHaveValue("colleague");
    expect(screen.getByLabelText("Fällig am")).toHaveValue("2026-11-10");
  });
  it("shows an explicit reopen action and blocks typing on a completed day", async () => {
    db.tables.set("day_slips", [{ user_id: "user-a", day_key: today, data: { html: toParagraphHtml({ id: "a", text: "Finished" }), plainText: "Finished", completedAt: new Date().toISOString(), recurringInjected: true } }]);
    render(view());
    await waitFor(() => expect(screen.getByRole("button", { name: "Tag wieder öffnen" })).toBeInTheDocument());
    expect(screen.getByRole("textbox")).toHaveAttribute("contenteditable", "false");
    fireEvent.click(screen.getByRole("button", { name: "Tag wieder öffnen" }));
    await waitFor(() => expect(screen.getByRole("textbox")).toHaveAttribute("contenteditable", "true"));
  });
  it("opens an unfinished past day read-only and returns to today", async () => {
    const yesterday = shiftDayKey(today, -1);
    db.tables.set("day_slips", [
      { user_id: "user-a", day_key: yesterday, data: { html: toParagraphHtml({ id: "y", text: "Forgotten point" }), plainText: "Forgotten point" } },
    ]);
    render(view());
    await waitFor(() => expect(screen.getByRole("button", { name: "Vorheriger Tageszettel" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Vorheriger Tageszettel" }));
    await waitFor(() => expect(screen.getByRole("textbox")).toHaveTextContent("Forgotten point"));
    expect(screen.getByRole("textbox")).toHaveAttribute("contenteditable", "false");
    expect(screen.getByRole("status")).toHaveTextContent(/Nicht abgeschlossen/);
    fireEvent.click(screen.getByRole("button", { name: "Heute" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Heute" })).not.toBeInTheDocument());
  });

  it("restores a deleted line through the undo action", async () => {
    db.tables.set("day_slips", [{ user_id: "user-a", day_key: today, data: { html: toParagraphHtml({ id: "a", text: "Disposable" }), plainText: "Disposable", recurringInjected: true } }]);
    render(view());
    await waitFor(() => expect(screen.getByRole("textbox")).toHaveTextContent("Disposable"));
    fireEvent.contextMenu(screen.getByRole("textbox").querySelector('[data-line-id="a"]')!);
    fireEvent.click(screen.getByText("Löschen"));
    await waitFor(() => expect(screen.getByRole("textbox")).not.toHaveTextContent("Disposable"));
    const [, options] = notifications.toast.mock.calls.at(-1)! as [string, { action: { label: string; onClick: () => void } }];
    expect(options.action.label).toBe("Rückgängig");
    act(() => options.action.onClick());
    await waitFor(() => expect(screen.getByRole("textbox")).toHaveTextContent("Disposable"));
  });

  it("marks the chosen triage target as pressed for assistive technology", async () => {
    db.tables.set("day_slips", [{ user_id: "user-a", day_key: today, data: { html: toParagraphHtml({ id: "a", text: "Prepare briefing" }), plainText: "Prepare briefing", recurringInjected: true } }]);
    render(view());
    await waitFor(() => expect(screen.getByRole("textbox")).toHaveTextContent("Prepare briefing"));
    fireEvent.click(screen.getByRole("button", { name: /Tag abschließen/ }));
    expect(screen.getByRole("button", { name: "Als Notiz" })).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(screen.getByRole("button", { name: "Als Notiz" }));
    expect(screen.getByRole("button", { name: "Als Notiz" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Als Aufgabe" })).toHaveAttribute("aria-pressed", "false");
  });

  it("übernimmt getippte Kürzel beim Öffnen der Zuordnung", async () => {
    const due = shiftDayKey(today, 3);
    const line = `+ Prepare briefing @Kollegin >${due}`;
    db.tables.set("day_slips", [{ user_id: "user-a", day_key: today, data: { html: toParagraphHtml({ id: "a", text: line }), plainText: line, recurringInjected: true } }]);
    render(view());
    await waitFor(() => expect(screen.getByRole("textbox")).toHaveTextContent("Prepare briefing"));
    fireEvent.click(screen.getByRole("button", { name: /Tag abschließen/ }));
    expect(screen.getByRole("button", { name: "Als Aufgabe" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Zur Erstellung vorgemerkt")).toBeInTheDocument();
    expect(screen.getByLabelText("Zuständig")).toHaveValue("colleague");
    expect(screen.getByLabelText("Fällig am")).toHaveValue(due);
  });

  it("übernimmt das Entscheidungs-Kürzel und lässt es weiterhin umstellen", async () => {
    db.tables.set("day_slips", [{ user_id: "user-a", day_key: today, data: { html: toParagraphHtml({ id: "a", text: "? Zustimmen?" }), plainText: "? Zustimmen?", recurringInjected: true } }]);
    render(view());
    await waitFor(() => expect(screen.getByRole("textbox")).toHaveTextContent("Zustimmen?"));
    fireEvent.click(screen.getByRole("button", { name: /Tag abschließen/ }));
    expect(screen.getByRole("button", { name: "Als Entscheidung" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Als Notiz" }));
    expect(screen.getByRole("button", { name: "Als Notiz" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Als Entscheidung" })).toHaveAttribute("aria-pressed", "false");
  });

  it("toggles a line's done state into the stored content", async () => {
    db.tables.set("day_slips", [{ user_id: "user-a", day_key: today, data: { html: toParagraphHtml({ id: "a", text: "Click me" }), plainText: "Click me", recurringInjected: true } }]);
    render(view());
    await waitFor(() => expect(screen.getByRole("textbox")).toHaveTextContent("Click me"));
    const line = screen.getByRole("textbox").querySelector('p[data-line-id="a"]')!;
    fireEvent.click(line, { clientX: 0 });
    await waitFor(() => expect(line).toHaveAttribute("data-done", "true"));
    fireEvent.click(line, { clientX: 0 });
    await waitFor(() => expect(line).toHaveAttribute("data-done", "false"));
  });

  it("shows done and assigned lines in the archive and searches it", async () => {
    db.tables.set("day_slips", [
      { user_id: "user-a", day_key: "2026-01-02", data: {
        html: '<p data-line-id="done" data-done="true">Abgehakter Punkt</p><p data-line-id="task">Aufgabe Punkt</p><p data-line-id="open">Offener Punkt</p>',
        plainText: "Abgehakter Punkt", completedAt: "2026-01-02T18:00:00Z",
        resolved: [{ lineId: "task", text: "Aufgabe Punkt", target: "task" }],
      } },
      { user_id: "user-a", day_key: "2026-01-01", data: { html: toParagraphHtml({ id: "old", text: "Alter Archivtag" }), plainText: "Alter Archivtag", completedAt: "2026-01-01T18:00:00Z" } },
    ]);
    render(view());
    await waitFor(() => expect(screen.getByRole("button", { name: "Archiv anzeigen" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Archiv anzeigen" }));
    await waitFor(() => expect(screen.getByText("Abgehakter Punkt")).toBeInTheDocument());
    expect(screen.getByText("erledigt")).toBeInTheDocument();
    expect(screen.getByText("zugewiesen: Aufgabe")).toBeInTheDocument();
    expect(screen.getAllByText("offen")).toHaveLength(2);
    expect(screen.getByText(/1 erledigt · 1 zugewiesen · 1 offen/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Archiv durchsuchen"), { target: { value: "Alter" } });
    expect(screen.queryByText("Abgehakter Punkt")).not.toBeInTheDocument();
    expect(screen.getByText("Alter Archivtag")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Archiv durchsuchen"), { target: { value: "gibtesnicht" } });
    expect(screen.getByText(/Kein abgeschlossener Tag passt/)).toBeInTheDocument();
  });

  it("navigates archive days and opens the chosen date read-only", async () => {
    db.tables.set("day_slips", [
      { user_id: "user-a", day_key: "2026-01-02", data: { html: toParagraphHtml({ id: "new", text: "Neuer Tag" }), plainText: "Neuer Tag", completedAt: "2026-01-02T18:00:00Z" } },
      { user_id: "user-a", day_key: "2026-01-01", data: { html: toParagraphHtml({ id: "old", text: "Älterer Tag" }), plainText: "Älterer Tag", completedAt: "2026-01-01T18:00:00Z" } },
    ]);
    render(view());
    await waitFor(() => expect(screen.getByRole("button", { name: "Archiv anzeigen" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Archiv anzeigen" }));
    await waitFor(() => expect(screen.getByText("Neuer Tag")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Nächster Archivtag" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Vorheriger Archivtag" }));
    expect(screen.getByRole("button", { name: "Nächster Archivtag" })).toBeEnabled();
    fireEvent.change(screen.getByLabelText("Archivdatum"), { target: { value: "2026-01-01" } });
    await waitFor(() => expect(screen.getByRole("textbox")).toHaveTextContent("Älterer Tag"));
    await waitFor(() => expect(screen.getByRole("textbox")).toHaveAttribute("contenteditable", "false"));
  });

  it("shows load failures and offers retry without mounting an empty editor", async () => {
    db.failures.set("day_slips:select", { message: "Network unavailable" });
    render(view());
    await waitFor(() => expect(screen.getByText("Speichern fehlgeschlagen")).toBeInTheDocument());
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    db.failures.clear();
    fireEvent.click(screen.getByRole("button", { name: "Erneut versuchen" }));
    await waitFor(() => expect(screen.getByRole("textbox")).toBeInTheDocument());
  });
});
