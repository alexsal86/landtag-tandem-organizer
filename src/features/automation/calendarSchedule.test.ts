import { describe, expect, it } from "vitest";
import { calendarOccurrence, nextCalendarOccurrence, scheduleRunKey, validateCalendarSchedule } from "./calendarSchedule";

const annual = { schedule_kind: "annual", month: "4", day: "1", hour: "9", month_end: "false", timezone: "Europe/Berlin" };
describe("calendar automation schedules", () => {
  it("runs annually on April 1 at 09:00 Berlin, not before", () => {
    expect(calendarOccurrence(annual, new Date("2026-04-01T06:59:00Z"))).toBeNull();
    expect(calendarOccurrence(annual, new Date("2026-04-01T07:00:00Z"))).toBe("2026-04-01");
    expect(calendarOccurrence(annual, new Date("2026-04-02T07:00:00Z"))).toBeNull();
  });
  it("uses one key per rule and calendar date", () => {
    expect(scheduleRunKey("rule-a", "2026-04-01")).toBe("rule-a-calendar-2026-04-01");
    expect(scheduleRunKey("rule-b", "2026-04-01")).not.toBe(scheduleRunKey("rule-a", "2026-04-01"));
  });
  it("runs monthly at the actual month end including leap years", () => {
    const config = { ...annual, schedule_kind: "monthly", month_end: "true" };
    expect(calendarOccurrence(config, new Date("2028-02-29T08:00:00Z"))).toBe("2028-02-29");
    expect(calendarOccurrence(config, new Date("2026-02-28T08:00:00Z"))).toBe("2026-02-28");
    expect(calendarOccurrence(config, new Date("2026-02-27T08:00:00Z"))).toBeNull();
  });
  it("runs quarterly in March, June, September and December", () => {
    const config = { ...annual, schedule_kind: "quarterly", month_end: "true" };
    expect(calendarOccurrence(config, new Date("2026-06-30T07:00:00Z"))).toBe("2026-06-30");
    expect(calendarOccurrence(config, new Date("2026-05-31T07:00:00Z"))).toBeNull();
  });
  it("clamps a monthly day 31 to February 28", () => {
    expect(calendarOccurrence({ ...annual, schedule_kind: "monthly", day: "31" }, new Date("2026-02-28T08:00:00Z"))).toBe("2026-02-28");
  });
  it("moves an annual February 29 to February 28 in non-leap years", () => {
    expect(calendarOccurrence({ ...annual, month: "2", day: "29" }, new Date("2026-02-28T08:00:00Z"))).toBe("2026-02-28");
  });
  it("rejects impossible annual dates and invalid hours", () => {
    expect(validateCalendarSchedule({ ...annual, month: "2", day: "30" })).not.toBeNull();
    expect(validateCalendarSchedule({ ...annual, hour: "24" })).not.toBeNull();
    expect(validateCalendarSchedule({ ...annual, timezone: "UTC" })).not.toBeNull();
  });
  it("computes future dates using Berlin daylight saving time", () => {
    expect(nextCalendarOccurrence(annual, new Date("2026-03-31T23:00:00Z"))?.toISOString()).toBe("2026-04-01T07:00:00.000Z");
    expect(nextCalendarOccurrence({ ...annual, month: "12" }, new Date("2026-11-01T00:00:00Z"))?.toISOString()).toBe("2026-12-01T08:00:00.000Z");
  });
  it("moves the missing spring 02:00 to 03:00 and uses the first autumn 02:00", () => {
    expect(nextCalendarOccurrence({ ...annual, month: "3", day: "29", hour: "2" }, new Date("2026-03-28T00:00:00Z"))?.toISOString()).toBe("2026-03-29T01:00:00.000Z");
    expect(nextCalendarOccurrence({ ...annual, month: "10", day: "25", hour: "2" }, new Date("2026-10-24T00:00:00Z"))?.toISOString()).toBe("2026-10-25T00:00:00.000Z");
  });
});