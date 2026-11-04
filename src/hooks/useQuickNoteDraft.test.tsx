import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useQuickNoteDraft } from "./useQuickNoteDraft";

const identity = vi.hoisted(() => ({ user: "user-a", tenant: "tenant-a" }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: identity.user } }) }));
vi.mock("@/hooks/useTenant", () => ({ useTenant: () => ({ currentTenant: { id: identity.tenant } }) }));

beforeEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  identity.user = "user-a";
  identity.tenant = "tenant-a";
});

describe("quick note drafts", () => {
  it("restores a draft after unmounting and removes it only on successful save", () => {
    const first = renderHook(() => useQuickNoteDraft("capture"));
    act(() => first.result.current.setTitle("Titel"));
    act(() => first.result.current.setContent("<p>Ein Entwurf</p>"));
    first.unmount();
    const second = renderHook(() => useQuickNoteDraft("capture"));
    expect(second.result.current.title).toBe("Titel");
    expect(second.result.current.content).toBe("<p>Ein Entwurf</p>");
    act(() => second.result.current.clearDraft());
    second.unmount();
    const third = renderHook(() => useQuickNoteDraft("capture"));
    expect(third.result.current.content).toBe("");
    expect(localStorage.length).toBe(0);
  });

  it("isolates drafts across users, workspaces and notes", () => {
    const { result, rerender } = renderHook(({ scope }) => useQuickNoteDraft(scope), { initialProps: { scope: "edit:1" } });
    act(() => result.current.setContent("Vertraulich"));
    identity.tenant = "tenant-b";
    rerender({ scope: "edit:1" });
    expect(result.current.content).toBe("");
    identity.tenant = "tenant-a";
    identity.user = "user-b";
    rerender({ scope: "edit:1" });
    expect(result.current.content).toBe("");
    identity.user = "user-a";
    rerender({ scope: "edit:2" });
    expect(result.current.content).toBe("");
    rerender({ scope: "edit:1" });
    expect(result.current.content).toBe("Vertraulich");
  });

  it("uses current saved content again once an edit draft is cleared", () => {
    const { result, rerender } = renderHook(({ content }) => useQuickNoteDraft("edit:1", { title: "", content }), { initialProps: { content: "Original" } });
    act(() => result.current.setContent("Änderung"));
    act(() => result.current.clearDraft());
    rerender({ content: "Gespeicherte Änderung" });
    expect(result.current.content).toBe("Gespeicherte Änderung");
  });

  it("allows editing with broken storage and reports a failed write", () => {
    localStorage.setItem("quick-note-draft:user-a:tenant-a:capture", "invalid JSON");
    const { result } = renderHook(() => useQuickNoteDraft("capture"));
    expect(result.current.content).toBe("");
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("quota"); });
    act(() => result.current.setContent("Bleibt im Editor"));
    expect(result.current.content).toBe("Bleibt im Editor");
    expect(result.current.draftStatus).toContain("nicht lokal gesichert");
  });
});
