import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useQuickNotes } from "./useQuickNotes";
import type { QuickNote } from "@/components/shared/QuickNotesList";

const mocks = vi.hoisted(() => ({
  user: { id: "owner" }, rpc: vi.fn(), error: vi.fn(), success: vi.fn(),
}));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock("@/hooks/useTenant", () => ({ useTenant: () => ({ currentTenant: { id: "tenant" } }) }));
vi.mock("@/lib/notify", () => ({ notify: { error: mocks.error, success: mocks.success } }));
vi.mock("@/utils/debugConsole", () => ({ debugConsole: { error: vi.fn() } }));
vi.mock("@/integrations/supabase/client", () => {
  const query = {
    select: () => query, eq: () => query, is: () => query, order: () => query,
    then: (resolve: (value: { data: never[]; error: null }) => unknown) => Promise.resolve(resolve({ data: [], error: null })),
  };
  const channel = { on: () => channel, subscribe: () => channel };
  return { supabase: { from: () => query, channel: () => channel, removeChannel: vi.fn(), rpc: mocks.rpc } };
});
const note: QuickNote = {
  id: "note", user_id: "owner", title: "Titel", content: "Inhalt", color: null,
  created_at: "", updated_at: "", is_pinned: false,
  task_id: "task", decision_id: "decision", case_item_id: "case", meeting_id: "meeting",
};
beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); });

describe("deleting linked notes", () => {
  it("resets all linked-object choices each time a deletion dialog opens", async () => {
    const { result } = renderHook(() => useQuickNotes());
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => {
      result.current.setDeleteLinkedTask(true);
      result.current.setDeleteLinkedDecision(true);
      result.current.setDeleteLinkedCaseItem(true);
      result.current.setDeleteLinkedMeeting(true);
    });
    act(() => result.current.handleDeleteWithConfirmation(note));
    expect(result.current.deleteLinkedTask).toBe(false);
    expect(result.current.deleteLinkedDecision).toBe(false);
    expect(result.current.deleteLinkedCaseItem).toBe(false);
    expect(result.current.deleteLinkedMeeting).toBe(false);
  });

  it("keeps the dialog and selection on database failure and reports the actual error", async () => {
    mocks.rpc.mockResolvedValue({ error: { message: "Keine Berechtigung für Aufgabe" } });
    const { result } = renderHook(() => useQuickNotes());
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.handleDeleteWithConfirmation(note));
    act(() => result.current.setDeleteLinkedTask(true));
    await act(() => result.current.handleDeleteNoteWithLinks());
    expect(result.current.confirmDeleteLinkedNote).toEqual(note);
    expect(result.current.deleteLinkedTask).toBe(true);
    expect(result.current.deletingLinkedNote).toBe(false);
    expect(mocks.error).toHaveBeenCalledWith(expect.stringContaining("Keine Berechtigung für Aufgabe"));
    expect(mocks.success).not.toHaveBeenCalled();
  });

  it("blocks duplicate submits while awaiting confirmation and closes only after success", async () => {
    let finish!: (value: { error: null }) => void;
    mocks.rpc.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    const { result } = renderHook(() => useQuickNotes());
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.handleDeleteWithConfirmation(note));
    let request!: Promise<void>;
    act(() => { request = result.current.handleDeleteNoteWithLinks(); });
    expect(result.current.deletingLinkedNote).toBe(true);
    await act(() => result.current.handleDeleteNoteWithLinks());
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(result.current.confirmDeleteLinkedNote).toEqual(note);
    await act(async () => { finish({ error: null }); await request; });
    expect(result.current.confirmDeleteLinkedNote).toBeNull();
    expect(result.current.deletingLinkedNote).toBe(false);
    expect(mocks.success).toHaveBeenCalledOnce();
  });
});
