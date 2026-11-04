import { describe, expect, it } from "vitest";
import { webcrypto } from "node:crypto";
import { appendEntries, carryLines, collectCarryLines, emptyDay, exportId, normalizeStore, sourcePath } from "../daySlipState";
import { extractLinesFromHtml, isRuleLine, stripHtml, toParagraphHtml, type DaySlipStore } from "../dayslipTypes";

const day = (id: string, text = id) => ({ html: toParagraphHtml({ id, text }), plainText: text });

describe("Tageszettel state", () => {
  it("offers an item snoozed on Monday on Thursday, and open items across weekends", () => {
    const store: DaySlipStore = {
      "2026-11-02": { ...day("later"), struckLineIds: ["later"], resolved: [{ lineId: "later", text: "later", target: "snoozed", snoozeUntil: "2026-11-05" }] },
      "2026-10-30": day("friday"),
    };
    expect(collectCarryLines(store, "2026-11-04").map(line => line.id)).toEqual(["friday"]);
    expect(collectCarryLines(store, "2026-11-05").map(line => line.id)).toEqual(["friday", "later"]);
  });
  it("does not offer completed, exported, archived or already transferred items", () => {
    const store: DaySlipStore = {
      "2026-11-01": { ...day("done"), struckLineIds: ["done"] },
      "2026-11-02": { ...day("exported"), resolved: [{ lineId: "exported", text: "exported", target: "task", persisted: true }] },
      "2026-11-03": { ...day("archived"), resolved: [{ lineId: "archived", text: "archived", target: "archived" }] },
    };
    expect(collectCarryLines(store, "2026-11-04")).toEqual([]);
    const original = { "2026-10-30": day("open") };
    const next = carryLines(original, "2026-11-04", collectCarryLines(original, "2026-11-04"));
    expect(collectCarryLines(next, "2026-11-04")).toEqual([]);
    expect(extractLinesFromHtml(next["2026-11-04"].html)).toHaveLength(1);
    expect(next["2026-10-30"].carriedTo?.open).toBe("2026-11-04");
  });
  it("keeps the actual line ID and source together, including after carry-over", () => {
    const added = appendEntries(emptyDay(), [{ id: "line-actual", text: "Due", source: { type: "task", id: "task-1" } }]);
    expect(extractLinesFromHtml(added.html)[0].id).toBe("line-actual");
    expect(added.sources?.["line-actual"]).toEqual({ type: "task", id: "task-1" });
    const store = { "2026-11-02": added };
    const next = carryLines(store, "2026-11-04", collectCarryLines(store, "2026-11-04"));
    const newId = extractLinesFromHtml(next["2026-11-04"].html)[0].id;
    expect(next["2026-11-04"].sources?.[newId]).toEqual({ type: "task", id: "task-1" });
  });
  it("preserves distinct unlinked carry-over entries with the same title", () => {
    const store = { "2026-11-02": day("first", "Call back"), "2026-11-03": day("second", "Call back") };
    const next = carryLines(store, "2026-11-04", collectCarryLines(store, "2026-11-04"));
    expect(extractLinesFromHtml(next["2026-11-04"].html)).toHaveLength(2);
  });
  it("deduplicates sources rather than titles, preserving formatted content", () => {
    const initial = { html: '<div class="labeled-hr" data-label="Focus"></div><p data-line-id="formatted"><strong>Hello &amp; bye</strong></p>', plainText: "Hello & bye" };
    const next = appendEntries(initial, [
      { id: "a", text: "Same title", source: { type: "task", id: "1" } },
      { id: "b", text: "Same title", source: { type: "task", id: "2" } },
      { id: "c", text: "Renamed title", source: { type: "task", id: "1" } },
    ]);
    expect(next.html).toContain('<strong>Hello &amp; bye</strong>');
    expect(next.html).toContain('data-label="Focus"');
    expect(extractLinesFromHtml(next.html)).toHaveLength(3);
  });
  it("normalizes missing legacy IDs once and excludes labeled headings from open work", () => {
    const store = normalizeStore({ "2026-11-04": { html: "<p>Hello</p><p>--- Heutige Fristen ---</p>" }, invalid: { html: "<p>No</p>" } });
    expect(Object.keys(store)).toEqual(["2026-11-04"]);
    expect(extractLinesFromHtml(store["2026-11-04"].html)).toHaveLength(1);
    expect(extractLinesFromHtml(store["2026-11-04"].html)).toEqual(extractLinesFromHtml(store["2026-11-04"].html));
    expect(isRuleLine("--- Focus ---")).toBe(true);
    expect(stripHtml("<p>A &amp; B</p><p>C</p>")).toBe("A & B\nC");
  });
  it("uses stable export primary keys scoped to account, day, line and destination", async () => {
    Object.defineProperty(crypto, "subtle", { configurable: true, value: webcrypto.subtle });
    const id = await exportId("user-1", "2026-11-04", "line", "task");
    expect(await exportId("user-1", "2026-11-04", "line", "task")).toBe(id);
    expect(await exportId("user-2", "2026-11-04", "line", "task")).not.toBe(id);
    expect(await exportId("user-1", "2026-11-04", "line", "note")).not.toBe(id);
    expect(id).toMatch(/^[a-f0-9]{8}-[a-f0-9]{4}-5[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
    expect(sourcePath({ type: "task", id: "task-1" })).toBe("/tasks?highlight=task-1");
    expect(sourcePath({ type: "note", id: "note-1" })).toBe("/mywork?tab=capture&highlight=note-1");
    expect(sourcePath({ type: "case", id: "case-1" })).toBe("/vorgaenge/case-1");
  });
});
