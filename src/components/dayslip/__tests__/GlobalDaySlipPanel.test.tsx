import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { supabase } from "@/integrations/supabase/client";
import { GlobalDaySlipPanel } from "../GlobalDaySlipPanel";
import { DAY_SLIP_APPEND_EVENT } from "@/lib/daySlipBridge";
import { toDayKey, toParagraphHtml } from "../dayslipTypes";
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
