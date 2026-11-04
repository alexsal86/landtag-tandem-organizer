import { act, renderHook } from "@testing-library/react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { useQuickNoteEditor } from "./useQuickNoteEditor";
import { useQuickNoteDialogs } from "./useQuickNoteDialogs";
import type { useQuickNotesData } from "./useQuickNotesData";
import type { QuickNote } from "./types";

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "user" } }) }));
vi.mock("@/hooks/useTenant", () => ({ useTenant: () => ({ currentTenant: { id: "tenant" } }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/lib/notify", () => ({ notify: { error: vi.fn(), success: vi.fn() } }));
const note: QuickNote = { id: "note", user_id: "user", tenant_id: "tenant", revision: 4, title: "Titel", content: "<p>Original</p>", color: null, is_pinned: false, created_at: "", updated_at: "" };
let queue: ReturnType<typeof vi.fn>;
let cached: QuickNote;
function useEditor() {
  const dialogs = useQuickNoteDialogs();
  const data = { repository: { scope: { userId: "user", tenantId: "tenant" }, queue, getNotes: () => [cached] } } as unknown as ReturnType<typeof useQuickNotesData>;
  return { ...dialogs, ...useQuickNoteEditor(data, dialogs) };
}
beforeEach(() => { vi.useFakeTimers(); localStorage.clear(); cached = { ...note }; queue = vi.fn().mockResolvedValue({ id: note.id }); });
afterEach(() => { vi.useRealTimers(); });

describe("note autosave", () => {
  it("debounces, leaves the editor open and keeps the displayed text after local commit", async () => {
    const { result } = renderHook(useEditor);
    act(() => result.current.openEditDialog(note));
    act(() => result.current.setEditContent("<p>Neu</p>"));
    await act(async () => { await vi.advanceTimersByTimeAsync(1199); });
    expect(queue).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(queue).toHaveBeenCalledOnce();
    expect(queue.mock.calls[0][0].content).toBe("<p>Neu</p>");
    expect(result.current.editDialogOpen).toBe(true);
    expect(result.current.editContent).toBe("<p>Neu</p>");
  });
  it("uses the revision the editor actually saw, even after a remote cache update", async () => {
    const { result } = renderHook(useEditor);
    act(() => result.current.openEditDialog(note));
    cached = { ...note, revision: 9, content: "Remote update" };
    act(() => result.current.setEditContent("<p>Meine Änderung</p>"));
    await act(async () => { await vi.advanceTimersByTimeAsync(1200); });
    expect(queue.mock.calls[0][0].note.revision).toBe(4);
  });
  it("keeps the draft and the dialog if IndexedDB cannot commit", async () => {
    queue.mockRejectedValueOnce(new Error("Speicher voll"));
    const { result } = renderHook(useEditor);
    act(() => result.current.openEditDialog(note));
    act(() => result.current.setEditContent("<p>Nicht verlieren</p>"));
    await act(async () => { await vi.advanceTimersByTimeAsync(1200); });
    expect(result.current.editDialogOpen).toBe(true);
    expect(result.current.editContent).toBe("<p>Nicht verlieren</p>");
    expect(result.current.editSaveStatus).toContain("Speicher voll");
    expect(localStorage.getItem("quick-note-draft:user:tenant:edit:note")).toContain("Nicht verlieren");
  });
  it("persists the draft's original revision across an editor reload", async () => {
    localStorage.setItem("quick-note-draft:user:tenant:edit:note", JSON.stringify({ title: "Titel", content: "<p>Alter Entwurf</p>", baseRevision: 2 }));
    const { result } = renderHook(useEditor);
    act(() => result.current.openEditDialog(note));
    await act(async () => { await vi.advanceTimersByTimeAsync(1200); });
    expect(queue.mock.calls[0][0].note.revision).toBe(2);
  });
  it("does not blindly upload legacy drafts that have no base revision", async () => {
    localStorage.setItem("quick-note-draft:user:tenant:edit:note", JSON.stringify({ title: "Titel", content: "<p>Alt</p>" }));
    const { result } = renderHook(useEditor);
    act(() => result.current.openEditDialog(note));
    await act(async () => { await vi.advanceTimersByTimeAsync(1200); });
    expect(queue).not.toHaveBeenCalled();
    expect(result.current.editSaveStatus).toContain("keinen Versionsstand");
    await act(() => result.current.saveDraftAsCopy());
    expect(queue.mock.calls[0][0].note).toBeUndefined();
    expect(queue.mock.calls[0][0].content).toBe("<p>Alt</p>");
  });
});
