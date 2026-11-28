import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ResolvedUserRole } from "@/hooks/useResolvedUserRole";
import { AppNavigation } from "./AppNavigation";
import { DesktopSidebar } from "./appNavigation/DesktopSidebar";
import { useQuickAccessPages } from "@/hooks/useQuickAccessPages";
import { SIDEBAR_MODE_PREF_KEY } from "./appNavigation/sidebarMode";

const state = vi.hoisted(() => ({
  role: "mitarbeiter" as ResolvedUserRole,
  admin: false,
  tenant: { id: "tenant-a" },
  disabledModule: "",
}));

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "user-a", email: "profil@example.test" } }) }));
vi.mock("@/hooks/useTenant", () => ({ useTenant: () => ({ currentTenant: state.tenant }) }));
vi.mock("@/hooks/useResolvedUserRole", () => ({
  useResolvedUserRole: () => ({ role: state.role, hasAdminAccess: state.admin, isAbgeordneter: state.role === "abgeordneter" }),
}));
vi.mock("@/hooks/useAppSettings", () => ({ useAppSettings: () => ({ app_name: "Testbüro", app_subtitle: "Landtag" }) }));
vi.mock("@/hooks/useFavicon", () => ({ useFavicon: vi.fn() }));
vi.mock("@/contexts/WorkspaceViewContext", () => ({ useWorkspaceView: () => ({ isDeputyView: true, setView: vi.fn() }) }));
vi.mock("@/contexts/MatrixUnreadContext", () => ({ useMatrixUnread: () => ({ totalUnreadCount: 4, unreadRooms: [] }) }));
vi.mock("@/hooks/useTenantFeatureFlag", () => ({ useTenantModuleGate: () => (key: string) => key !== state.disabledModule }));
vi.mock("@/hooks/useActionPermission", () => ({ useActionPermission: () => ({ allowed: false }) }));
vi.mock("@/hooks/useUserStatus", () => ({
  useUserStatus: () => ({ currentStatus: { status_type: "online" }, getStatusDisplay: () => ({ label: "Online", color: "green" }) }),
}));
vi.mock("@/components/status/UserStatusSelector", () => ({ UserStatusSelector: ({ children }: React.PropsWithChildren) => children }));
vi.mock("@/hooks/useNavigationNotifications", () => ({ useNavigationNotifications: () => ({ markNavigationAsVisited: vi.fn() }) }));
vi.mock("@/lib/routePrefetch", () => ({ prefetchRoute: vi.fn() }));
vi.mock("@/components/dayslip/DaySlipLayout", () => ({ useDaySlipLayout: () => null }));
vi.mock("./appNavigation/useFocusSummary", () => ({ useFocusSummary: () => ({ approvalCount: 1, taskCount: 2, caseCount: 0 }) }));
vi.mock("./appNavigation/useNavPanelData", () => ({
  useNavPanelData: () => ({
    quickAccessCaseItems: [], quickAccessDocuments: [], quickAccessEventPlannings: [],
    userProfile: { display_name: "Testprofil" },
    nextAppointment: { id: "appointment", title: "Ausschuss", start_time: "2026-11-28T13:00:00.000Z", is_all_day: false },
  }),
}));

function renderSidebar(node = <AppNavigation activeSection="mywork" />, initialPath = "/mywork") {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, enabled: false } } });
  return render(<QueryClientProvider client={queryClient}><MemoryRouter initialEntries={[initialPath]}>{node}</MemoryRouter></QueryClientProvider>);
}

describe("Sidebar", () => {
  beforeEach(() => {
    state.role = "mitarbeiter";
    state.admin = false;
    state.tenant = { id: "tenant-a" };
    state.disabledModule = "";
  });
  it("keeps all 16 destinations and their active route, including an initially open Recherche", () => {
    state.role = "bueroleitung";
    state.admin = true;
    renderSidebar(<AppNavigation activeSection="karten" />, "/karten");
    const nav = screen.getByRole("navigation", { name: "Hauptnavigation" });
    const routes = [
      "/mywork", "/calendar", "/chat", "/notes", "/casefiles", "/contacts", "/documents", "/wissen",
      "/tasks", "/decisions", "/meetings", "/eventplanning", "/employee", "/news", "/karten", "/daten",
    ];
    expect(within(nav).getAllByRole("link").map(link => link.getAttribute("href"))).toEqual(expect.arrayContaining(routes));
    const heading = screen.getByRole("button", { name: "Recherche" });
    expect(heading).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("link", { name: "Karten" })).toHaveAttribute("aria-current", "page");
    fireEvent.click(heading);
    expect(heading).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(heading);
    expect(screen.getByRole("link", { name: "Karten" })).toHaveAttribute("aria-current", "page");
  });

  it("takes team and administration visibility from the real role and admin access independently of the workspace view", () => {
    state.role = "mitarbeiter";
    state.admin = true;
    renderSidebar();
    expect(screen.queryByRole("link", { name: "Team" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Administration" })).toBeVisible();
    expect(screen.getByText("Abgeordnetenansicht")).toBeVisible();
  });

  it("hides disabled modules in sidebar and favorites without removing persisted pins", () => {
    state.disabledModule = "module.knowledge";
    localStorage.setItem("nav-quick-access-pages", JSON.stringify([
      { id: "wissen", label: "Wissensfavorit", icon: "Database", route: "/wissen" },
    ]));
    renderSidebar();
    expect(screen.queryByRole("link", { name: "Wissen" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Wissensfavorit" })).not.toBeInTheDocument();
    expect(localStorage.getItem("nav-quick-access-pages")).toContain("Wissensfavorit");
  });

  it("keeps information and collapse separately and restores keyboard focus after closing help", async () => {
    state.role = "mitarbeiter";
    state.admin = false;
    renderSidebar(<AppNavigation compact activeSection="mywork" onToggle={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Administration" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sidebar ausklappen" })).toBeVisible();
    const info = screen.getByRole("button", { name: "Information" });
    info.focus();
    fireEvent.click(info);
    const dialog = await screen.findByRole("dialog", { name: "Hilfe & Tastenkürzel" });
    expect(within(dialog).getByText("Globale Tastenkürzel")).toBeVisible();
    expect(within(dialog).getByText("Weitere Hilfe")).toBeVisible();
    fireEvent.keyDown(dialog, { key: "Escape" });
    await vi.waitFor(() => expect(info).toHaveFocus());
  });

  it("follows the existing help hint from the mobile sheet", async () => {
    const followHint = vi.fn();
    Element.prototype.scrollIntoView = vi.fn();
    renderSidebar(<><AppNavigation isMobile activeSection="mywork" onFollowHelpHint={followHint} />
      <button data-help-id="mywork-new-menu">Neu</button></>, "/mywork?tab=tasks");
    fireEvent.click(screen.getByRole("button", { name: "Information" }));
    fireEvent.click(await screen.findByRole("button", { name: "Über den Neu-Button eine neue Aufgabe erstellen" }));
    expect(followHint).toHaveBeenCalledOnce();
    await vi.waitFor(() => expect(screen.getByRole("button", { name: "Neu" })).toHaveClass("ring-primary"));
  });

  it("restores the last width, persists the mode and leaves editor bold shortcuts alone", async () => {
    localStorage.setItem("nav-sidebar-width", "315");
    const ui = renderSidebar(<><DesktopSidebar activeSection="mywork" /><div contentEditable suppressContentEditableWarning><span>Editor</span></div></>);
    const shell = ui.container.querySelector<HTMLElement>(".mission-shell")!;
    expect(shell.style.width).toBe("315px");
    const editor = screen.getByText("Editor");
    expect(fireEvent.keyDown(editor, { ctrlKey: true, key: "b" })).toBe(true);
    expect(fireEvent.keyDown(editor, { metaKey: true, key: "b" })).toBe(true);
    expect(shell.style.width).toBe("315px");
    fireEvent.keyDown(window, { ctrlKey: true, key: "b" });
    expect(shell.style.width).toBe("48px");
    await vi.waitFor(() => expect(localStorage.getItem(`pref_${SIDEBAR_MODE_PREF_KEY}`)).toBe('"compact"'));
    ui.unmount();
    const next = renderSidebar(<DesktopSidebar activeSection="mywork" />);
    const nextShell = next.container.querySelector<HTMLElement>(".mission-shell")!;
    expect(nextShell.style.width).toBe("48px");
    fireEvent.keyDown(window, { metaKey: true, code: "Backslash", key: "\\" });
    expect(nextShell.style.width).toBe("315px");
  });

  it("provides an accessible Ghost launcher and keeps it available after closing", async () => {
    localStorage.setItem(`pref_${SIDEBAR_MODE_PREF_KEY}`, '"ghost"');
    const { container } = renderSidebar(<DesktopSidebar activeSection="mywork" />);
    const shell = container.querySelector<HTMLElement>(".mission-shell")!;
    expect(shell).toHaveAttribute("hidden");
    const launcher = screen.getByRole("button", { name: "Sidebar öffnen" });
    launcher.focus();
    fireEvent.click(launcher);
    expect(shell).not.toHaveAttribute("hidden");
    expect(screen.getByRole("button", { name: "Suchen oder Befehl …" })).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: "Sidebar ausblenden" }));
    expect(shell).toHaveAttribute("hidden");
    await vi.waitFor(() => expect(screen.getByRole("button", { name: "Sidebar öffnen" })).toHaveFocus());
  });

  it("preserves legacy pins in their existing order and synchronizes changes from another consumer", () => {
    state.role = "mitarbeiter";
    state.admin = false;
    const legacy = [
      { id: "themen", label: "Themen", icon: "Tags", route: "/themen" },
      { id: "news", label: "News", icon: "Newspaper", route: "/news" },
      { id: "employee", label: "Team", icon: "Users", route: "/employee" },
    ];
    localStorage.setItem("nav-quick-access-pages", JSON.stringify(legacy));
    function PinElsewhere() {
      const { addPage, pages } = useQuickAccessPages();
      return <button onClick={() => {
        addPage({ id: "contacts", label: "Kontakte", icon: "Users", route: "/contacts" });
        addPage({ id: "contacts", label: "Kontakte", icon: "Users", route: "/contacts" });
      }}>Anheften {pages.length}</button>;
    }
    const ui = renderSidebar(<><AppNavigation activeSection="mywork" /><PinElsewhere /></>);
    const quickAccess = within(screen.getByRole("region", { name: "Schnellzugriff" }));
    expect(quickAccess.getAllByRole("link").map(link => link.textContent)).toEqual(["Themen", "News"]);
    fireEvent.click(screen.getByRole("button", { name: "Anheften 3" }));
    expect(quickAccess.getAllByRole("link").map(link => link.textContent)).toEqual(["Themen", "News", "Kontakte"]);
    expect(JSON.parse(localStorage.getItem("nav-quick-access-pages")!)).toEqual([
      ...legacy, expect.objectContaining({ id: "contacts", userId: "user-a", tenantId: "tenant-a" }),
    ]);
    state.tenant = { id: "tenant-b" };
    act(() => ui.rerender(<QueryClientProvider client={new QueryClient()}><MemoryRouter><AppNavigation activeSection="mywork" /></MemoryRouter></QueryClientProvider>));
    expect(within(screen.getByRole("region", { name: "Schnellzugriff" })).queryByText("Kontakte")).not.toBeInTheDocument();
    state.tenant = { id: "tenant-a" };
  });

  it("links the summary to real destinations and labels Matrix unread separately", () => {
    renderSidebar();
    expect(screen.getByRole("link", { name: "1 Freigabe wartet" })).toHaveAttribute("href", "/mywork?tab=dashboard#unterschriftenmappe");
    expect(screen.getByRole("link", { name: /Ausschuss/ })).toHaveAttribute("href", "/calendar?highlight=appointment");
    expect(screen.getByRole("link", { name: "Chat · 4 ungelesene Chatnachrichten" })).toBeVisible();
  });
});
