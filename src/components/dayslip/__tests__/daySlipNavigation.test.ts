import { describe, expect, it } from "vitest";
import { openLineCount, openPastDays, resolveDayView, shiftDayKey, snoozePresets } from "../daySlipNavigation";
import { toParagraphHtml, type DaySlipStore } from "../dayslipTypes";

const day = (id: string, text = id, extra: Record<string, unknown> = {}) => ({ html: toParagraphHtml({ id, text }), plainText: text, ...extra });

describe("Tageszettel navigation", () => {
  it("moves between stored days and always offers the way back to today", () => {
    const store: DaySlipStore = { "2026-11-02": day("a"), "2026-11-05": day("b") };
    expect(resolveDayView(store, "2026-11-06")).toMatchObject({
      key: "2026-11-06", isToday: true, readOnly: false, canGoPrevious: true, previousKey: "2026-11-05", canGoNext: false, nextKey: undefined,
    });
    expect(resolveDayView(store, "2026-11-06", "2026-11-02")).toMatchObject({
      key: "2026-11-02", isPast: true, readOnly: true, canGoPrevious: false, canGoNext: true, nextKey: "2026-11-05",
    });
    // The last stored day still leads forward to today, even when no other sheet sits in between.
    expect(resolveDayView(store, "2026-11-06", "2026-11-05").nextKey).toBe("2026-11-06");
  });

  it("clamps future and unknown selections to today", () => {
    const store: DaySlipStore = { "2026-11-05": day("a") };
    expect(resolveDayView(store, "2026-11-06", "2026-11-09").key).toBe("2026-11-06");
    expect(resolveDayView(store, "2026-11-06", "2026-01-01").key).toBe("2026-11-06");
    expect(resolveDayView(store, "2026-11-06", "not-a-day").key).toBe("2026-11-06");
  });

  it("counts only lines that still need a decision", () => {
    const html = ["open", "checked", "assigned", "carried"].map(id => toParagraphHtml({ id, text: id })).join("");
    const mixed = {
      html, plainText: "open\nchecked\nassigned\ncarried",
      struckLineIds: ["checked"],
      resolved: [{ lineId: "assigned", text: "assigned", target: "task" as const }],
      carriedTo: { carried: "2026-11-06" },
    };
    expect(openLineCount(mixed)).toBe(1);
    expect(openLineCount(undefined)).toBe(0);
  });

  it("lists unfinished past days with open work, ignoring completed, empty and carried days", () => {
    const store: DaySlipStore = {
      "2026-11-06": day("today"),
      "2026-11-05": day("yesterday-open"),
      "2026-11-04": { ...day("completed"), completedAt: "2026-11-04T17:00:00.000Z" },
      "2026-11-03": { ...day("struck"), struckLineIds: ["struck"] },
      "2026-11-02": { ...day("carried"), carriedTo: { carried: "2026-11-05" } },
    };
    expect(openPastDays(store, "2026-11-06")).toEqual([
      { dayKey: "2026-11-05", openCount: 1 },
    ]);
  });

  it("offers one snooze date per option, including the next week", () => {
    const presets = snoozePresets("2026-11-26");
    expect(presets.map(preset => preset.until)).toEqual(["2026-11-27", "2026-11-29", "2026-12-03"]);
    expect(new Set(presets.map(preset => preset.until)).size).toBe(presets.length);
    expect(presets.map(preset => preset.label)).not.toContain("Morgen");
    expect(shiftDayKey("2026-12-31", 1)).toBe("2027-01-01");
  });
});
