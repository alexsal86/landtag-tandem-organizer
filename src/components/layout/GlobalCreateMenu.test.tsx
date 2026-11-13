import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "user-1", email: "test@example.com" } }),
}));

vi.mock("@/hooks/useTenant", () => ({
  useTenant: () => ({ currentTenant: { id: "tenant-1", name: "Büro" } }),
}));

vi.mock("@/hooks/useActionPermission", () => ({
  useActionPermission: () => ({ allowed: true }),
}));

vi.mock("@/features/appointment-requests/events", () => ({
  openAppointmentRequestCreate: vi.fn(),
}));

vi.mock("@/features/knowledge/globalQuestion", () => ({
  openKnowledgeQuestion: vi.fn(),
  KNOWLEDGE_QUESTION_SHORTCUT: "Strg + Alt + F",
}));

import { GlobalCreateMenu } from "./GlobalCreateMenu";

describe("GlobalCreateMenu", () => {
  afterEach(cleanup);

  it("renders the create trigger as a real menu button", () => {
    render(<GlobalCreateMenu />);

    const trigger = screen.getByRole("button", { name: /Globales Erstellen-Menü/i });
    expect(trigger.tagName).toBe("BUTTON");
    expect(trigger).toHaveAttribute("aria-haspopup", "menu");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("opens the create menu and lists the create actions", async () => {
    render(<GlobalCreateMenu />);

    // jsdom has no PointerEvent constructor, so a plain pointerdown event would carry
    // no `button` and Radix would ignore it. Dispatch a mouse-backed pointerdown instead.
    fireEvent(
      screen.getByRole("button", { name: /Globales Erstellen-Menü/i }),
      new MouseEvent("pointerdown", { bubbles: true, cancelable: true, button: 0 })
    );

    await waitFor(() => {
      expect(screen.getByRole("menuitem", { name: /Schnelle Notiz/i })).toBeInTheDocument();
    });
    expect(screen.getByRole("menuitem", { name: /Terminanfrage vormerken/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /Wissensfrage stellen/i })).toBeInTheDocument();
  });
});
