import { describe, it, expect } from "vitest";
import { nextWorkingDay, toDateString, todayString } from "@/features/briefings/utils";

describe("briefings/utils", () => {
  it("toDateString formats as YYYY-MM-DD", () => {
    expect(toDateString(new Date(2026, 0, 5))).toBe("2026-01-05");
  });

  it("todayString matches toDateString(new Date())", () => {
    expect(todayString()).toBe(toDateString(new Date()));
  });

  it("nextWorkingDay skips weekends (Fri -> Mon)", () => {
    // 2026-01-09 is a Friday
    const friday = new Date(2026, 0, 9);
    const next = nextWorkingDay(friday);
    expect(next.getDay()).toBe(1); // Monday
    expect(toDateString(next)).toBe("2026-01-12");
  });

  it("nextWorkingDay returns next day for weekday (Mon -> Tue)", () => {
    const monday = new Date(2026, 0, 5);
    const next = nextWorkingDay(monday);
    expect(toDateString(next)).toBe("2026-01-06");
  });

  it("nextWorkingDay from Saturday lands on Monday", () => {
    const saturday = new Date(2026, 0, 10);
    const next = nextWorkingDay(saturday);
    expect(next.getDay()).toBe(1);
  });
});
