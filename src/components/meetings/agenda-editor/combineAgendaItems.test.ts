import { describe, it, expect } from "vitest";
import { combineAgendaItems } from "./combineAgendaItems";
import type { AgendaItem } from "../types";
const item = (id: string, patch: Partial<AgendaItem> = {}): AgendaItem => ({
  id,
  title: id,
  order_index: 0,
  is_completed: false,
  is_recurring: false,
  ...patch,
});
describe("combine agenda groups", () => {
  it("moves a whole group after existing children without mutating inputs", () => {
    const items = [
      item("source", {
        duration_minutes: 15,
        notes: "Notiz",
        carry_over_to_next: true,
      }),
      item("source-child", { parent_id: "source", result_text: "Ergebnis" }),
      item("target"),
      item("target-child", { parent_id: "target" }),
      item("last"),
    ];
    const result = combineAgendaItems(items, "source", "target")!;
    expect(result.map((i) => i.id)).toEqual([
      "target",
      "target-child",
      "source",
      "source-child",
      "last",
    ]);
    expect(result.slice(2, 4).map((i) => i.parent_id)).toEqual([
      "target",
      "target",
    ]);
    expect(result[2]).toMatchObject({
      duration_minutes: null,
      notes: "Notiz",
      carry_over_to_next: true,
    });
    expect(result[3].result_text).toBe("Ergebnis");
    expect(items[0].parent_id).toBeUndefined();
    expect(result.map((i) => i.order_index)).toEqual([0, 1, 2, 3, 4]);
  });
  it("supports unsaved local keys and a parent with both identities", () => {
    const source = {
      ...item("source"),
      id: undefined,
      localKey: "local-source",
    };
    const child = {
      ...item("child"),
      id: undefined,
      parentLocalKey: "local-source",
    };
    const target = item("saved", { localKey: "local-target" });
    const result = combineAgendaItems(
      [source, child, target],
      "local-source",
      "local-target",
    )!;
    expect(
      result
        .slice(1)
        .every(
          (i) => i.parent_id === "saved" && i.parentLocalKey === "local-target",
        ),
    ).toBe(true);
  });
  it("rejects self, missing targets and drops onto children", () => {
    const items = [
      item("source"),
      item("child", { parent_id: "source" }),
      item("target"),
    ];
    expect(combineAgendaItems(items, "source", "source")).toBeNull();
    expect(combineAgendaItems(items, "source", "missing")).toBeNull();
    expect(combineAgendaItems(items, "source", "child")).toBeNull();
    expect(combineAgendaItems(items, "child", "target")).toBeNull();
  });
});
