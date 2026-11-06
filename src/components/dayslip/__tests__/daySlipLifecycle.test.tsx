import { StrictMode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { webcrypto } from "node:crypto";
import { supabase } from "@/integrations/supabase/client";
import { useDaySlipPersistence, daySlipCacheKey } from "../hooks/useDaySlipPersistence";
import { useDaySlipStore } from "../hooks/useDaySlipStore";
import { toDayKey, toParagraphHtml, STORAGE_KEY } from "../dayslipTypes";
import type { createBackend } from "./backend";

vi.mock("@/integrations/supabase/client", async () => {
  const { createBackend } = await import("./backend");
  return { supabase: createBackend() };
});
const db = supabase as unknown as ReturnType<typeof createBackend>;
const today = () => toDayKey(new Date());
const day = (text = "Call back") => ({ html: toParagraphHtml({ id: "line-1", text }), plainText: text, recurringInjected: true });

beforeEach(() => {
  db.reset();
  localStorage.clear();
  Object.defineProperty(crypto, "subtle", { configurable: true, value: webcrypto.subtle });
});

async function openStore() {
  const hook = renderHook(() => useDaySlipStore("user-a", "tenant"));
  await waitFor(() => expect(hook.result.current.ready).toBe(true));
  return hook;
}

describe("Tageszettel persistence", () => {
  it("does not overwrite loaded remote preferences with defaults, including StrictMode", async () => {
    db.tables.set("user_preferences", [{ user_id: "user-a", tenant_id: "tenant", key: "dayslip_recurring", value: [{ id: "r", text: "Remote routine", weekday: "all" }] }]);
    const { result } = renderHook(() => useDaySlipPersistence("user-a", "tenant"), { wrapper: StrictMode });
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.settings.recurringItems[0].text).toBe("Remote routine");
    expect(db.writes.filter(write => write.table === "user_preferences")).toEqual([]);
  });
  it("retains failed writes across reload and lets dirty local work win over stale DB content", async () => {
    const first = renderHook(() => useDaySlipPersistence("user-a", "tenant"));
    await waitFor(() => expect(first.result.current.ready).toBe(true));
    db.failures.set("day_slips:upsert", { message: "offline" });
    act(() => first.result.current.setStore({ [today()]: day("new local content") }));
    await act(async () => { expect(await first.result.current.flush()).toBe(false); });
    expect(first.result.current.saveStatus).toBe("error");
    expect(JSON.parse(localStorage.getItem(daySlipCacheKey("user-a", "tenant"))!).dirtyDays).toEqual([today()]);
    first.unmount();
    db.tables.set("day_slips", [{ user_id: "user-a", day_key: today(), data: day("old remote content") }]);
    const second = renderHook(() => useDaySlipPersistence("user-a", "tenant"));
    await waitFor(() => expect(second.result.current.ready).toBe(true));
    expect(second.result.current.store[today()].plainText).toBe("new local content");
    db.failures.clear();
    await act(async () => { expect(await second.result.current.retrySave()).toBe(true); });
    expect(second.result.current.saveStatus).toBe("saved");
    expect(JSON.parse(localStorage.getItem(daySlipCacheKey("user-a", "tenant"))!).dirtyDays).toEqual([]);
  });
  it("saves edits made while a previous save is still in flight", async () => {
    const { result } = renderHook(() => useDaySlipPersistence("user-a", "tenant"));
    await waitFor(() => expect(result.current.ready).toBe(true));
    let release!: () => void;
    db.pauseNextWrite(new Promise<void>(resolve => { release = resolve; }));
    act(() => result.current.setStore({ [today()]: day("first") }));
    let saving!: Promise<boolean>;
    act(() => { saving = result.current.flush(); });
    act(() => result.current.setStore({ [today()]: { ...day("second"), dayMood: 5 } }));
    await act(async () => { release(); expect(await saving).toBe(true); });
    const row = db.tables.get("day_slips")![0];
    expect(row.data).toMatchObject({ plainText: "second", dayMood: 5 });
    expect(result.current.saveStatus).toBe("saved");
  });
  it("isolates accounts and never automatically imports unowned legacy storage", async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ [today()]: day("legacy secret") }));
    const first = renderHook(() => useDaySlipPersistence("user-a", "tenant"));
    await waitFor(() => expect(first.result.current.ready).toBe(true));
    act(() => first.result.current.setStore({ [today()]: day("account A secret") }));
    await act(async () => { await first.result.current.flush(); });
    first.unmount();
    const second = renderHook(() => useDaySlipPersistence("user-b", "tenant"));
    await waitFor(() => expect(second.result.current.ready).toBe(true));
    expect(second.result.current.store).toEqual({});
    expect(db.writes.some(write => write.rows.some(row => row.user_id === "user-b"))).toBe(false);
    expect(localStorage.getItem(STORAGE_KEY)).toContain("legacy secret");
  });
  it("keeps the editor gated on load failure and supports a successful retry", async () => {
    db.failures.set("day_slips:select", { message: "load failed" });
    const { result } = renderHook(() => useDaySlipPersistence("user-a", "tenant"));
    await waitFor(() => expect(result.current.saveStatus).toBe("error"));
    expect(result.current.ready).toBe(false);
    db.failures.clear();
    await act(async () => { await result.current.retrySave(); });
    expect(result.current.ready).toBe(true);
  });
  it("can still save to the server when the browser cache is full", async () => {
    const { result } = renderHook(() => useDaySlipPersistence("user-a", "tenant"));
    await waitFor(() => expect(result.current.ready).toBe(true));
    const cacheWrite = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("full", "QuotaExceededError"); });
    try {
      act(() => result.current.setStore({ [today()]: day("must reach server") }));
      await act(async () => { expect(await result.current.flush()).toBe(true); });
      expect(db.tables.get("day_slips")![0].data).toMatchObject({ plainText: "must reach server" });
      expect(result.current.saveStatus).toBe("saved");
    } finally { cacheWrite.mockRestore(); }
  });
});

describe("Tageszettel lifecycle", () => {
  it("saves mood and completion, blocks duplicate clicks, and reopens explicitly", async () => {
    db.tables.set("day_slips", [{ user_id: "user-a", day_key: today(), data: day() }]);
    const { result } = await openStore();
    act(() => { result.current.toggleResolveLine("line-1", "Call back", "task", undefined, { assignedTo: "colleague", dueDate: "2026-11-10" }); result.current.setMood(4); });
    await act(async () => {
      const first = result.current.completeDay();
      expect(await result.current.completeDay()).toBe(false);
      expect(await first).toBe(true);
    });
    expect(db.tables.get("tasks")).toHaveLength(1);
    expect(db.tables.get("tasks")![0]).toMatchObject({ assigned_to: "colleague", due_date: new Date("2026-11-10T12:00:00").toISOString() });
    expect(db.tables.get("day_slips")![0].data).toMatchObject({ dayMood: 4, completedAt: expect.any(String) });
    await act(async () => { await result.current.reopenDay(); });
    expect(result.current.todayData.completedAt).toBeUndefined();
    await act(async () => { expect(await result.current.completeDay()).toBe(true); });
    expect(db.tables.get("tasks")).toHaveLength(1);
  });
  it("keeps unfinished past days out of the archive after loading and autosaving", async () => {
    db.tables.set("day_slips", [
      { user_id: "user-a", day_key: "2026-01-01", data: day("Unfinished past work") },
      { user_id: "user-a", day_key: "2026-01-02", data: { ...day("Explicitly completed"), completedAt: "2026-01-02T18:00:00Z" } },
    ]);
    const { result } = await openStore();
    expect(result.current.archiveDays).toEqual(["2026-01-02"]);
    expect(result.current.carryEntries.some((entry) => entry.text === "Unfinished past work")).toBe(true);
    await act(async () => { expect(await result.current.flush()).toBe(true); });
    expect(result.current.archiveDays).toEqual(["2026-01-02"]);
    expect(result.current.store["2026-01-01"].completedAt).toBeUndefined();
  });

  it("keeps a failed export open and retries without duplicating a committed but unacknowledged creation", async () => {
    db.tables.set("day_slips", [{ user_id: "user-a", day_key: today(), data: day() }]);
    const { result } = await openStore();
    act(() => result.current.toggleResolveLine("line-1", "Call back", "task"));
    db.lostResponses.add("tasks");
    await act(async () => { expect(await result.current.completeDay()).toBe(false); });
    expect(result.current.todayData.completedAt).toBeUndefined();
    expect(result.current.resolvedItems[0].error).toBe("response lost");
    expect(db.tables.get("tasks")).toHaveLength(1);
    await act(async () => { expect(await result.current.completeDay()).toBe(true); });
    expect(db.tables.get("tasks")).toHaveLength(1);
    expect(result.current.resolvedItems[0]).toMatchObject({ persisted: true, error: undefined });
  });
  it("uses an existing linked task instead of creating another", async () => {
    db.tables.set("day_slips", [{ user_id: "user-a", day_key: today(), data: { ...day(), sources: { "line-1": { type: "task", id: "existing-task" } } } }]);
    const { result } = await openStore();
    act(() => result.current.toggleResolveLine("line-1", "Call back", "task"));
    await act(async () => { expect(await result.current.completeDay()).toBe(true); });
    expect(db.writes.filter(write => write.table === "tasks")).toEqual([]);
    expect(result.current.resolvedItems[0]).toMatchObject({ persisted: true, entityId: "existing-task" });
  });
  it("retains successful exports when another destination fails and retries only the failed item", async () => {
    const data = { ...day(), html: day().html + toParagraphHtml({ id: "line-2", text: "Keep a note" }) };
    db.tables.set("day_slips", [{ user_id: "user-a", day_key: today(), data }]);
    const { result } = await openStore();
    act(() => { result.current.toggleResolveLine("line-1", "Call back", "task"); result.current.toggleResolveLine("line-2", "Keep a note", "note"); });
    db.failures.set("quick_notes:insert", { message: "note creation failed" });
    await act(async () => { expect(await result.current.completeDay()).toBe(false); });
    expect(result.current.resolvedItems.find(item => item.lineId === "line-1")?.persisted).toBe(true);
    expect(result.current.resolvedItems.find(item => item.lineId === "line-2")?.error).toBe("note creation failed");
    db.failures.clear();
    await act(async () => { expect(await result.current.completeDay()).toBe(true); });
    expect(db.tables.get("tasks")).toHaveLength(1);
    expect(db.tables.get("quick_notes")).toHaveLength(1);
    expect(result.current.resolvedItems.every(item => item.persisted)).toBe(true);
  });
  it("persists metadata for old days when carrying open items forward", async () => {
    db.tables.set("day_slips", [{ user_id: "user-a", day_key: "2026-01-01", data: day() }]);
    const { result } = await openStore();
    act(() => result.current.carryOver());
    await act(async () => { await result.current.flush(); });
    const old = db.tables.get("day_slips")!.find(row => row.day_key === "2026-01-01")!;
    expect(old.data).toMatchObject({ carriedTo: { "line-1": today() } });
    expect(result.current.carryEntries).toHaveLength(0);
  });
  it("uses the inserted deadline line ID and keeps repeated completion events checked", async () => {
    db.tables.set("tasks", [{ id: "deadline-task", title: "Due today", tenant_id: "tenant", user_id: "user-a", status: "open" }]);
    const { result } = await openStore();
    await waitFor(() => expect(Object.values(result.current.todayData.sources ?? {})).toContainEqual({ type: "task", id: "deadline-task" }));
    const lineId = Object.entries(result.current.todayData.sources ?? {}).find(([, source]) => source.id === "deadline-task")![0];
    expect(result.current.allLineEntries.some(line => line.id === lineId)).toBe(true);
    act(() => db.emit("tasks", { id: "deadline-task", status: "completed" }));
    expect(result.current.struckLineIds).toContain(lineId);
    act(() => db.emit("tasks", { id: "deadline-task", status: "completed" }));
    expect(result.current.struckLineIds).toContain(lineId);
    expect(result.current.struckLineIds.filter(id => id === lineId)).toHaveLength(1);
  });
  it("does not complete the day when a database save fails", async () => {
    db.tables.set("day_slips", [{ user_id: "user-a", day_key: today(), data: { ...day(), struckLineIds: ["line-1"] } }]);
    const { result } = await openStore();
    act(() => result.current.setMood(3));
    db.failures.set("day_slips:upsert", { message: "cannot save" });
    await act(async () => { expect(await result.current.completeDay()).toBe(false); });
    expect(result.current.todayData.completedAt).toBeUndefined();
    expect(result.current.saveStatus).toBe("error");
    db.failures.clear();
    await act(async () => { expect(await result.current.completeDay()).toBe(true); });
    expect(result.current.todayData.completedAt).toEqual(expect.any(String));
  });
});
