import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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

const trigger = () => screen.getByRole("button", { name: /Globales Erstellen-Menü/i });
const report = (label: string) => {
  console.log(
    `${label}: expanded=${trigger().getAttribute("aria-expanded")} items=${
      document.body.querySelectorAll("[role=menuitem]").length
    }`
  );
};

describe("open mechanics", () => {
  afterEach(cleanup);

  it("pointerDown", () => {
    render(<GlobalCreateMenu />);
    fireEvent.pointerDown(trigger(), { button: 0, ctrlKey: false, pointerType: "mouse" });
    report("pointerDown");
  });

  it("mouseDown+mouseUp+click", () => {
    render(<GlobalCreateMenu />);
    const el = trigger();
    fireEvent.mouseDown(el, { button: 0 });
    fireEvent.mouseUp(el, { button: 0 });
    fireEvent.click(el);
    report("mouse sequence");
  });

  it("keyDown Enter", () => {
    render(<GlobalCreateMenu />);
    const el = trigger();
    el.focus();
    fireEvent.keyDown(el, { key: "Enter", code: "Enter" });
    report("Enter");
  });

  it("keyDown Space", () => {
    render(<GlobalCreateMenu />);
    const el = trigger();
    el.focus();
    fireEvent.keyDown(el, { key: " ", code: "Space" });
    report("Space");
  });
});
