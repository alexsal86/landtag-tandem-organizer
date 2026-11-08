import { describe, expect, it } from "vitest";
import { computeCropRect, effectiveCaption, isCrowdedDay, rescheduleToDay } from "./plannerRules";

describe("plannerRules", () => {
  it("keeps the time of day when moving a post", () => {
    const moved = rescheduleToDay(new Date(2026, 10, 3, 14, 30).toISOString(), new Date(2026, 10, 9));
    expect([moved.getDate(), moved.getHours(), moved.getMinutes()]).toEqual([9, 14, 30]);
  });

  it("uses 10:00 for unscheduled posts", () => {
    const moved = rescheduleToDay(null, new Date(2026, 10, 9));
    expect([moved.getHours(), moved.getMinutes()]).toEqual([10, 0]);
  });

  it("warns from three posts per day", () => {
    expect(isCrowdedDay(2)).toBe(false);
    expect(isCrowdedDay(3)).toBe(true);
  });

  it("crops a landscape photo to 4:5 around the focus point", () => {
    expect(computeCropRect(2000, 1000, 4 / 5, 0.5, 0.5)).toEqual({ sx: 600, sy: 0, sw: 800, sh: 1000 });
    expect(computeCropRect(2000, 1000, 4 / 5, 0, 0.5).sx).toBe(0);
    expect(computeCropRect(2000, 1000, 4 / 5, 1, 0.5).sx).toBe(1200);
  });

  it("crops a portrait photo to 16:9", () => {
    expect(computeCropRect(1000, 2000, 16 / 9, 0.5, 0.5)).toEqual({ sx: 0, sy: 719, sw: 1000, sh: 563 });
  });

  it("falls back to the master text for channels without own caption", () => {
    expect(effectiveCaption("", "Master")).toBe("Master");
    expect(effectiveCaption("Eigen", "Master")).toBe("Eigen");
  });
});
