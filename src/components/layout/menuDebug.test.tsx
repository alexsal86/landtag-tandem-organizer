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

describe("probe", () => {
  afterEach(cleanup);

  it("inspects react props on the trigger", () => {
    render(<GlobalCreateMenu />);
    const el = trigger();
    const key = Object.keys(el).find((k) => k.startsWith("__reactProps$"));
    console.log("props key:", key);
    const props = key ? (el as unknown as Record<string, Record<string, unknown>>)[key] : {};
    console.log("handler names:", Object.keys(props || {}).filter((k) => k.startsWith("on")).join(","));
    console.log("has PointerEvent:", typeof (window as unknown as { PointerEvent?: unknown }).PointerEvent);

    // native listener probe
    let seen = "";
    const probe = (e: Event) => {
      seen += `${e.type},`;
    };
    el.addEventListener("pointerdown", probe);
    fireEvent.pointerDown(el, { button: 0, ctrlKey: false });
    el.removeEventListener("pointerdown", probe);
    console.log("native saw:", seen);
    console.log("expanded after:", el.getAttribute("aria-expanded"));
  });
});
