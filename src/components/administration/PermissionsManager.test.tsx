import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PermissionsManager } from "./PermissionsManager";

const mock = vi.hoisted(() => ({
  tenantId: "office-a",
  readError: false,
  write: vi.fn(),
  notify: vi.fn(),
}));
vi.mock("@/hooks/useTenant", () => ({ useTenant: () => ({ currentTenant: { id: mock.tenantId } }) }));
vi.mock("@/lib/notify", () => ({ notify: { error: mock.notify } }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  from: () => ({
    select: () => ({ eq: async () => ({ data: [], error: mock.readError ? { message: "offline" } : null }) }),
    upsert: (...args: unknown[]) => mock.write(...args),
  }),
} }));
// Render all panels to exercise each write path without testing Radix tab behavior.
vi.mock("@/components/ui/tabs", () => {
  const Container = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
  return { Tabs: Container, TabsContent: Container, TabsList: Container, TabsTrigger: Container };
});

beforeEach(() => {
  mock.tenantId = "office-a";
  mock.readError = false;
  mock.write.mockReset();
  mock.notify.mockReset();
});
afterEach(cleanup);
const loaded = () => waitFor(() => expect(screen.queryByText("Berechtigungen werden geladen…")).not.toBeInTheDocument());

describe("permission persistence", () => {
  it("shows a load failure instead of editable default permissions", async () => {
    mock.readError = true;
    render(<PermissionsManager />);
    expect(await screen.findByRole("alert")).toHaveTextContent("nicht geladen");
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
  });

  it.each(["module", "action", "field"])("keeps %s permission unchanged when saving fails", async kind => {
    mock.write.mockResolvedValue({ error: { message: "denied" } });
    render(<PermissionsManager />);
    await loaded();
    const control = kind === "module" ? screen.getAllByRole("switch")[0]
      : kind === "action" ? screen.getAllByRole("button", { name: "mitarbeiter" })[0]
      : screen.getAllByRole("switch", { name: "Lesen", exact: true })[0];
    fireEvent.click(control);
    await waitFor(() => expect(mock.notify).toHaveBeenCalled());
    expect(control).toHaveAttribute(kind === "action" ? "aria-pressed" : "aria-checked", "true");
    expect(mock.write).toHaveBeenCalledOnce();
  });

  it("locks controls until a confirmed save and then shows the saved value", async () => {
    let finish!: (value: { error: null }) => void;
    mock.write.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    render(<PermissionsManager />);
    await loaded();
    const control = screen.getAllByRole("switch")[0];
    fireEvent.click(control);
    expect(control).toBeDisabled();
    expect(control).toHaveAttribute("aria-checked", "true");
    await act(async () => finish({ error: null }));
    expect(control).toBeEnabled();
    expect(control).toHaveAttribute("aria-checked", "false");
  });

  it("does not apply a delayed write to a different tenant", async () => {
    let finish!: (value: { error: null }) => void;
    mock.write.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    const { rerender } = render(<PermissionsManager />);
    await loaded();
    fireEvent.click(screen.getAllByRole("switch")[0]);
    mock.tenantId = "office-b";
    rerender(<PermissionsManager />);
    await loaded();
    await act(async () => finish({ error: null }));
    expect(screen.getAllByRole("switch")[0]).toHaveAttribute("aria-checked", "true");
  });
});
