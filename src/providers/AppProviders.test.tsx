import type { PropsWithChildren } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { AppProviders } from "./AppProviders";
import { SunflowerThemeToggle } from "@/components/ui/sunflower-theme-toggle";
import { Toaster } from "@/components/ui/sonner";

// Isolate account/data providers; exercise the real app-level theme boundary.
vi.mock("@/hooks/useAuth", () => ({ AuthProvider: ({ children }: PropsWithChildren) => children }));
vi.mock("@/hooks/useTenant", () => ({ TenantProvider: ({ children }: PropsWithChildren) => children }));
vi.mock("@/hooks/useAppSettings", () => ({ AppSettingsProvider: ({ children }: PropsWithChildren) => children }));
vi.mock("@/contexts/NotificationContext", () => ({ NotificationProvider: ({ children }: PropsWithChildren) => children }));
vi.mock("@/features/quick-notes/useQuickNotesData", () => ({ QuickNotesRuntime: () => null }));
vi.mock("@/components/navigation/AppHeadManager", () => ({ AppHeadManager: () => null }));
vi.mock("@/hooks/useNotificationDisplayPreferences", () => ({
  useNotificationDisplayPreferences: () => ({ preferences: { size: "normal", position: "bottom-right", persist: false, duration: 5000 } }),
}));
vi.mock("sonner", () => ({
  Toaster: ({ theme }: { theme: string }) => <output data-testid="toast-theme">{theme}</output>,
  toast: vi.fn(),
}));

function Page({ name }: { name: string }) {
  const navigate = useNavigate();
  return <><h1>{name}</h1><SunflowerThemeToggle /><button onClick={() => navigate("/tasks/new")}>Neue Aufgabe</button></>;
}

function renderApp(path: string) {
  return render(<AppProviders>
    {/* Same placement as AppRouter: notifications are siblings of the routes. */}
    <Toaster />
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/contacts/:id" element={<Page name="Kontakt" />} />
        <Route path="/tasks/new" element={<Page name="Aufgabe" />} />
        <Route path="/auth" element={<Page name="Anmeldung" />} />
      </Routes>
    </MemoryRouter>
  </AppProviders>);
}

describe("app-wide theme boundary", () => {
  it.each(["/contacts/123", "/tasks/new", "/auth"])("restores the stored theme on direct entry to %s", async path => {
    localStorage.setItem("theme", "dark");
    renderApp(path);
    await waitFor(() => expect(document.documentElement).toHaveClass("dark"));
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");
    expect(screen.getByTestId("toast-theme")).toHaveTextContent("dark");
  });

  it("keeps routes and notifications in sync across navigation and reload", async () => {
    localStorage.setItem("theme", "light");
    const app = renderApp("/contacts/123");
    fireEvent.click(screen.getByRole("switch"));
    fireEvent.click(screen.getByRole("button", { name: "Neue Aufgabe" }));
    expect(screen.getByRole("heading")).toHaveTextContent("Aufgabe");
    await waitFor(() => expect(screen.getByTestId("toast-theme")).toHaveTextContent("dark"));
    expect(localStorage.getItem("theme")).toBe("dark");
    app.unmount();
    renderApp("/tasks/new");
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");
    fireEvent.click(screen.getByRole("switch"));
    await waitFor(() => expect(screen.getByTestId("toast-theme")).toHaveTextContent("light"));
    expect(document.documentElement).toHaveClass("light");
  });

  it("resolves system changes for both page controls and notifications", async () => {
    let dark = false;
    let onChange: (() => void) | undefined;
    const media = vi.spyOn(window, "matchMedia").mockImplementation(query => ({
      matches: dark, media: query, onchange: null,
      addListener: callback => { onChange = () => callback({ matches: dark } as MediaQueryListEvent); },
      removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: () => true,
    }));
    try {
      renderApp("/auth");
      expect(screen.getByTestId("toast-theme")).toHaveTextContent("light");
      dark = true;
      act(() => onChange?.());
      await waitFor(() => expect(screen.getByTestId("toast-theme")).toHaveTextContent("dark"));
      expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");
    } finally {
      media.mockRestore();
    }
  });
});
