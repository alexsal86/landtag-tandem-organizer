import { describe, expect, it } from "vitest";
import { canAdvanceBriefing, needsBriefingDecision, nextBriefingStatus, suggestBriefingDue } from "./briefing";

describe("appointment briefing rules", () => {
  it("assignee may submit, but not approve", () => {
    expect(canAdvanceBriefing("assigned", "submit", { isDecider: false, isAssignee: true })).toBe(true);
    expect(canAdvanceBriefing("in_review", "approve", { isDecider: false, isAssignee: true })).toBe(false);
  });
  it("only deciders approve or return a briefing in review", () => {
    expect(canAdvanceBriefing("in_review", "approve", { isDecider: true, isAssignee: false })).toBe(true);
    expect(canAdvanceBriefing("in_review", "return", { isDecider: true, isAssignee: false })).toBe(true);
    expect(canAdvanceBriefing("assigned", "approve", { isDecider: true, isAssignee: false })).toBe(false);
  });
  it("return sends the briefing back to work", () => {
    expect(nextBriefingStatus("in_review", "return")).toBe("assigned");
    expect(nextBriefingStatus("none", "submit")).toBeNull();
  });
  it("suggests the day before at 12:00", () => {
    const due = suggestBriefingDue(new Date(2026, 10, 12, 18, 0), new Date(2026, 10, 1));
    expect([due.getDate(), due.getHours()]).toEqual([11, 12]);
  });
  it("only undecided appointments within 14 days need a decision", () => {
    const now = new Date("2026-11-01T10:00:00Z");
    expect(needsBriefingDecision({ briefing_status: "undecided", start_time: "2026-11-10T10:00:00Z" }, now)).toBe(true);
    expect(needsBriefingDecision({ briefing_status: "undecided", start_time: "2026-11-20T10:00:00Z" }, now)).toBe(false);
    expect(needsBriefingDecision({ briefing_status: "none", start_time: "2026-11-05T10:00:00Z" }, now)).toBe(false);
  });
});
