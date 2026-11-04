import { describe, expect, it } from "vitest";
import { overlaps, nextFreeSlot, canMoveAppointment } from "../collisions";
import type { CalendarEvent } from "../types";
const event = (id: string, start: string, end: string): CalendarEvent => ({ id, title: id, date: new Date(`2026-11-04T${start}:00`), endTime: new Date(`2026-11-04T${end}:00`), time: start, duration: "", type: "appointment", priority: "medium", sourceScope: "internal" });
describe("calendar collisions", () => {
  it("detects containment and excludes touching boundaries, itself and all-day events", () => {
    const a = event("a", "09:00", "11:00");
    expect(overlaps(a, event("b", "09:30", "10:00"))).toBe(true);
    expect(overlaps(a, event("b", "11:00", "12:00"))).toBe(false);
    expect(overlaps(a, a)).toBe(false);
    expect(overlaps(a, { ...event("b", "10:00", "12:00"), is_all_day: true })).toBe(false);
  });
  it("skips occupied candidates and preserves room for the full duration", () => {
    const a = event("a", "09:00", "10:00");
    expect(nextFreeSlot(a, [a, event("b", "09:30", "11:00")])).toEqual(new Date("2026-11-04T11:00:00"));
  });
  it("does not suggest a slot beyond the search horizon", () => {
    const a = event("a", "09:00", "10:00");
    const occupied = { ...event("b", "09:00", "10:00"), endTime: new Date("2026-11-07T10:00:00") };
    expect(nextFreeSlot(a, [occupied])).toBeNull();
  });
  it("protects external and recurring appointments", () => {
    const a = event("a", "09:00", "10:00");
    expect(canMoveAppointment(a)).toBe(true);
    expect(canMoveAppointment({ ...a, _isRecurring: true })).toBe(false);
    expect(canMoveAppointment({ ...a, sourceScope: "external" })).toBe(false);
    expect(canMoveAppointment({ ...a, sourceScope: "system" })).toBe(false);
  });
});
