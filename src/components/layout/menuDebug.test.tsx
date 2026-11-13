import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

describe("open mechanics", () => {
  afterEach(cleanup);

  it("pointerDown then reports state", () => {
    render(<GlobalCreateMenu />);
    fireEvent.pointerDown(trigger(), { button: 0, ctrlKey: false, pointerType: "mouse" });
    console.log("after pointerDown expanded =", trigger().getAttribute("aria-expanded"));
    console.log("body items =", document.body.querySelectorAll("[role=menuitem]").length);
  });

  it("click reports state", async () => {
    render(<GlobalCreateMenu />);
    fireEvent.click(trigger());
    console.log("after click expanded =", trigger().getAttribute("aria-expanded"));
    console.log("body items =", document.body.querySelectorAll("[role=menuitem]").length);
  });

  it("userEvent.click reports state", async () => {
    render(<GlobalCreateMenu />);
    const user = userEvent.setup();
    await user.click(trigger());
    console.log("after userEvent expanded =", trigger().getAttribute("aria-expanded"));
    console.log("body items =", document.body.querySelectorAll("[role=menuitem]").length);
  });

  it("keyboard Enter reports state", async () => {
    render(<GlobalCreateMenu />);
    const user = userEvent.setup();
    trigger().focus();
    await user.keyboard("{Enter}");
    console.log("after Enter expanded =", trigger().getAttribute("aria-expanded"));
    console.log("body items =", document.body.querySelectorAll("[role=menuitem]").length);
  });
});
