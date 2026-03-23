import { describe, expect, it, vi } from "vitest";
import { calculateBusinessDaysSince, getMeetingStatus, getWorkIndicatorMeta } from "@/components/my-work/hooks/useMyWorkTeamData";

describe("useMyWorkTeamData helpers", () => {
  it("counts only business days since the last entry", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-23T12:00:00Z"));

    expect(calculateBusinessDaysSince("2026-03-20")).toBe(1);
    expect(calculateBusinessDaysSince("2026-03-19")).toBe(2);
    expect(calculateBusinessDaysSince(null)).toBe(999);

    vi.useRealTimers();
  });

  it("marks overdue and soon due meetings", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-23T12:00:00Z"));

    expect(getMeetingStatus("2026-03-20T00:00:00.000Z")).toEqual({
      label: "Überfällig",
      variant: "destructive",
    });
    expect(getMeetingStatus("2026-04-01T00:00:00.000Z")).toEqual({
      label: "Bald fällig",
      variant: "secondary",
    });
    expect(getMeetingStatus("2026-05-15T00:00:00.000Z")).toBeNull();

    vi.useRealTimers();
  });

  it("returns UI indicator metadata based on progress", () => {
    expect(getWorkIndicatorMeta(0, 1200)).toMatchObject({ variant: "empty", label: "Keine Einträge" });
    expect(getWorkIndicatorMeta(120, 1200)).toMatchObject({ variant: "critical", label: "Wenig erfasst" });
    expect(getWorkIndicatorMeta(400, 1200)).toMatchObject({ variant: "warning", label: "Untererfasst" });
    expect(getWorkIndicatorMeta(800, 1200)).toMatchObject({ variant: "progress", label: "In Arbeit" });
    expect(getWorkIndicatorMeta(1100, 1200)).toMatchObject({ variant: "good", label: "Gut erfasst" });
    expect(getWorkIndicatorMeta(1300, 1200)).toMatchObject({ variant: "overtime", label: "Überstunden" });
  });
});
