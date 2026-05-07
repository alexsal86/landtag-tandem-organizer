import { describe, it, expect, vi, beforeEach } from "vitest";

const notMock = vi.fn().mockResolvedValue({ error: null });
const eqAfterDelete = vi.fn(() => ({ not: notMock, then: undefined }));
// delete().eq() must support both await (clear-all) and .not() chain (partial delete)
const deleteEqResult: Promise<{ error: null }> & { not: typeof notMock } = Object.assign(
  Promise.resolve({ error: null }),
  { not: notMock }
);
const deleteMock = vi.fn(() => ({ eq: vi.fn(() => deleteEqResult) }));
const eqMock = vi.fn().mockResolvedValue({ error: null });
const updateMock = vi.fn(() => ({ eq: eqMock }));
const upsertMock = vi.fn().mockResolvedValue({ error: null });
const fromMock = vi.fn(() => ({
  delete: deleteMock,
  update: updateMock,
  upsert: upsertMock,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (...a: unknown[]) => fromMock(...a) },
}));

import {
  normalizeTaskAssigneeIds,
  serializeLegacyTaskAssignees,
  getTaskAssigneeIds,
  syncTaskAssignees,
} from "@/lib/taskAssignees";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("normalizeTaskAssigneeIds", () => {
  it("returns [] for nullish", () => {
    expect(normalizeTaskAssigneeIds(null)).toEqual([]);
    expect(normalizeTaskAssigneeIds(undefined)).toEqual([]);
    expect(normalizeTaskAssigneeIds("")).toEqual([]);
  });

  it("parses Postgres array format and dedupes", () => {
    expect(normalizeTaskAssigneeIds("{a,b,a}")).toEqual(["a", "b"]);
  });

  it("handles arrays", () => {
    expect(normalizeTaskAssigneeIds(["a", " b ", "a"])).toEqual(["a", "b"]);
  });
});

describe("serializeLegacyTaskAssignees", () => {
  it("returns null when empty", () => {
    expect(serializeLegacyTaskAssignees([])).toBeNull();
  });
  it("returns single id without braces", () => {
    expect(serializeLegacyTaskAssignees(["a"])).toBe("a");
  });
  it("wraps multi ids in braces", () => {
    expect(serializeLegacyTaskAssignees(["a", "b"])).toBe("{a,b}");
  });
});

describe("getTaskAssigneeIds", () => {
  it("prefers task_assignees join", () => {
    expect(
      getTaskAssigneeIds({
        assigned_to: "{x,y}",
        task_assignees: [{ user_id: "a" }, { user_id: "b" }],
      })
    ).toEqual(["a", "b"]);
  });
  it("falls back to assigned_to legacy field", () => {
    expect(getTaskAssigneeIds({ assigned_to: "{x,y}", task_assignees: [] })).toEqual(["x", "y"]);
  });
});

describe("syncTaskAssignees", () => {
  it("clears assignees when list is empty", async () => {
    await syncTaskAssignees({ taskId: "t1", assigneeIds: [] });
    expect(fromMock).toHaveBeenCalledWith("task_assignees");
    expect(fromMock).toHaveBeenCalledWith("tasks");
    expect(deleteMock).toHaveBeenCalled();
    expect(updateMock).toHaveBeenCalledWith({ assigned_to: null });
  });

  it("upserts assignees and updates legacy field", async () => {
    await syncTaskAssignees({ taskId: "t1", assigneeIds: ["a", "b"], assignedBy: "u1" });
    expect(upsertMock).toHaveBeenCalledWith(
      [
        { task_id: "t1", user_id: "a", assigned_by: "u1" },
        { task_id: "t1", user_id: "b", assigned_by: "u1" },
      ],
      { onConflict: "task_id,user_id" }
    );
    expect(updateMock).toHaveBeenCalledWith({ assigned_to: "{a,b}" });
  });
});
