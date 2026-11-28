import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GlobalSearchCommand } from "./GlobalSearchCommand";
import { CommandSearchTrigger } from "@/components/navigation/appNavigation/SidebarControls";

const state = vi.hoisted(() => ({
  user: { id: "user-a" },
  tenant: { id: "tenant-a" },
  allowQuestion: false,
  allowLetters: true,
  openRequest: vi.fn(),
  markVisit: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: state.user }) }));
vi.mock("@/hooks/useTenant", () => ({ useTenant: () => ({ currentTenant: state.tenant }) }));
vi.mock("@/hooks/useResolvedUserRole", () => ({ useResolvedUserRole: () => ({ role: "mitarbeiter", hasAdminAccess: false }) }));
vi.mock("@/hooks/useActionPermission", () => ({ useActionPermission: () => ({ allowed: state.allowQuestion }) }));
vi.mock("@/hooks/useTenantFeatureFlag", () => ({ useTenantModuleGate: () => (key: string) => key !== "module.letters" || state.allowLetters }));
vi.mock("@/features/appointment-requests/events", () => ({ openAppointmentRequestCreate: state.openRequest }));
vi.mock("@/hooks/useNavigationNotifications", () => ({ useNavigationNotifications: () => ({ markNavigationAsVisited: state.markVisit }) }));
vi.mock("@/lib/routePrefetch", () => ({ prefetchRoute: vi.fn() }));

function CurrentRoute() {
  const { pathname, search } = useLocation();
  return <output aria-label="Route">{pathname + search}</output>;
}

function setup(seededQuery?: string) {
  const client = new QueryClient({ defaultOptions: { queries: { enabled: false, retry: false } } });
  if (seededQuery) {
    client.setQueryData(["global-search-documents", seededQuery, state.tenant.id, state.user.id,
      { dateFrom: "", dateTo: "", category: "", status: "", scope: "all" }],
    [{ id: "doc-1", title: "Rede für die Bürgersprechstunde", description: seededQuery }]);
  }
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/mywork"]}>
        <CommandSearchTrigger compact={false} />
        <GlobalSearchCommand />
        <CurrentRoute />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("GlobalSearchCommand", () => {
  beforeEach(() => {
    state.allowQuestion = false;
    state.allowLetters = true;
    state.openRequest.mockClear();
    state.markVisit.mockClear();
    Element.prototype.scrollIntoView = vi.fn();
  });

  it("opens with Ctrl+K and Cmd+K, focuses the query and returns focus on Escape", async () => {
    setup();
    const trigger = screen.getByRole("button", { name: "Suchen oder Befehl …" });
    trigger.focus();
    fireEvent.keyDown(trigger, { ctrlKey: true, key: "k" });
    expect(await screen.findByRole("dialog", { name: "Globale Suche" })).toBeVisible();
    const search = screen.getByRole("combobox", { name: "Suchen oder Befehl" });
    expect(search).toHaveFocus();
    fireEvent.keyDown(search, { key: "Escape" });
    await waitFor(() => expect(trigger).toHaveFocus());
    fireEvent.keyDown(trigger, { metaKey: true, key: "k" });
    expect(await screen.findByRole("dialog", { name: "Globale Suche" })).toBeVisible();
  });

  it("filters commands by German terms and opens a result with the keyboard", async () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Suchen oder Befehl …" }));
    const input = await screen.findByRole("combobox", { name: "Suchen oder Befehl" });
    fireEvent.change(input, { target: { value: "term" } });
    const dialog = screen.getByRole("dialog", { name: "Globale Suche" });
    const navigation = within(dialog).getByRole("group", { name: "Navigation" });
    expect(within(navigation).getByRole("option", { name: "Kalender öffnen" })).toBeVisible();
    expect(within(dialog).getByRole("option", { name: "Terminanfrage vormerken" })).toBeVisible();
    expect(within(dialog).queryByRole("option", { name: "Fallakten öffnen" })).not.toBeInTheDocument();
    fireEvent.keyDown(input, { key: "ArrowDown" });
    await waitFor(() => expect(screen.getByRole("option", { name: "Planungen öffnen" })).toHaveAttribute("aria-selected", "true"));
    fireEvent.change(input, { target: { value: "akte öffnen" } });
    await waitFor(() => expect(screen.getByRole("option", { name: "Fallakten öffnen" })).toHaveAttribute("aria-selected", "true"));
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(screen.getByLabelText("Route")).toHaveTextContent("/casefiles"));
    expect(state.markVisit).toHaveBeenCalledWith("casefiles");
  });

  it("keeps content matches whose search term appears outside the title", async () => {
    setup("redeentwurf");
    fireEvent.click(screen.getByRole("button", { name: "Suchen oder Befehl …" }));
    const input = await screen.findByRole("combobox", { name: "Suchen oder Befehl" });
    fireEvent.change(input, { target: { value: "redeentwurf" } });
    const results = await screen.findByRole("group", { name: "Inhalte" });
    const hit = within(results).getByRole("option", { name: "Rede für die Bürgersprechstunde" });
    fireEvent.click(hit);
    await waitFor(() => expect(screen.getByLabelText("Route")).toHaveTextContent("/documents?document=doc-1"));
  });

  it("runs the existing global creation handler and only shows permitted knowledge and management commands", async () => {
    state.allowQuestion = true;
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Suchen oder Befehl …" }));
    const input = await screen.findByRole("combobox", { name: "Suchen oder Befehl" });
    expect(screen.queryByRole("option", { name: "Team öffnen" })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Administration öffnen" })).not.toBeInTheDocument();
    fireEvent.change(input, { target: { value: "brief" } });
    expect(screen.getByRole("option", { name: "Briefverwaltung öffnen" })).toBeVisible();
    fireEvent.change(input, { target: { value: "neu" } });
    expect(screen.getByRole("option", { name: "Neue Aufgabe" })).toBeVisible();
    expect(screen.getByRole("option", { name: "Wissensfrage stellen" })).toBeVisible();
    fireEvent.click(screen.getByRole("option", { name: "Terminanfrage vormerken" }));
    await waitFor(() => expect(state.openRequest).toHaveBeenCalledOnce());
  });
});
