import { describe, expect, it } from "vitest";
import { countChecklist, matchesNoteFilter, toggleChecklistItem } from "./quickNoteBoard";
import type { QuickNote } from "./QuickNotesList";

const base: QuickNote = { id: "1", title: null, content: "", color: null, is_pinned: false, created_at: "", updated_at: "" };
const now = new Date("2026-11-04T12:00:00");

describe("quick note filters", () => {
  it("'Offen' shows only notes not linked anywhere", () => {
    expect(matchesNoteFilter(base, "open", null, now)).toBe(true);
    expect(matchesNoteFilter({ ...base, task_id: "t" }, "open", null, now)).toBe(false);
    expect(matchesNoteFilter({ ...base, topic_backlog_id: "x" }, "linked", null, now)).toBe(true);
  });
  it("'Wiedervorlage fällig' includes today and past, not tomorrow", () => {
    expect(matchesNoteFilter({ ...base, follow_up_date: "2026-11-04T18:00:00" }, "due", null, now)).toBe(true);
    expect(matchesNoteFilter({ ...base, follow_up_date: "2026-11-01T08:00:00" }, "due", null, now)).toBe(true);
    expect(matchesNoteFilter({ ...base, follow_up_date: "2026-11-05T08:00:00" }, "due", null, now)).toBe(false);
  });
  it("color filter treats notes without color as default blue", () => {
    expect(matchesNoteFilter(base, "all", "#3b82f6", now)).toBe(true);
    expect(matchesNoteFilter({ ...base, color: "#f59e0b" }, "all", "#3b82f6", now)).toBe(false);
  });
});

describe("checklists", () => {
  it("toggles only the clicked item", () => {
    const html = "<p>[ ] Akten</p><p>[x] Laptop</p><p>[ ] Rede</p>";
    expect(toggleChecklistItem(html, 2)).toBe("<p>[ ] Akten</p><p>[x] Laptop</p><p>[x] Rede</p>");
    expect(toggleChecklistItem(html, 1)).toBe("<p>[ ] Akten</p><p>[ ] Laptop</p><p>[ ] Rede</p>");
    expect(countChecklist(html)).toEqual({ done: 1, total: 3 });
  });
});

describe("linked filter includes Jour fixe", () => {
  it("counts notes only marked for the next Jour fixe as linked, not open", () => {
    const note = { id: "n", title: null, content: "x", color: null, is_pinned: false, created_at: "", updated_at: "", pending_for_jour_fixe: true };
    expect(matchesNoteFilter(note, "linked")).toBe(true);
    expect(matchesNoteFilter(note, "open")).toBe(false);
  });
});
