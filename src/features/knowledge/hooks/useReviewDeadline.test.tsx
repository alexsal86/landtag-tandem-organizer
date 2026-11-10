import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useReviewDeadline } from "./useReviewDeadline";
import { effectiveReviewStatus } from "../logic";

afterEach(() => vi.useRealTimers());
it("shares one timer across cards, follows server time and updates at each deadline", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  const server = "2026-11-11T12:00:00Z";
  const a = {
    server_now: server,
    review_due_at: "2026-11-11T12:00:01Z",
    review_status: "verified",
  };
  const b = {
    server_now: server,
    review_due_at: "2026-11-11T12:00:02Z",
    review_status: "verified",
  };
  const first = renderHook(() => useReviewDeadline(a));
  const second = renderHook(() => useReviewDeadline(b));
  expect(vi.getTimerCount()).toBe(1);
  expect(effectiveReviewStatus(a, first.result.current)).toBe("verified");
  act(() => vi.advanceTimersByTime(1000));
  expect(effectiveReviewStatus(a, first.result.current)).toBe("needs_review");
  expect(effectiveReviewStatus(b, second.result.current)).toBe("verified");
  expect(vi.getTimerCount()).toBe(1);
  act(() => vi.advanceTimersByTime(1000));
  expect(effectiveReviewStatus(b, second.result.current)).toBe("needs_review");
  expect(vi.getTimerCount()).toBe(0);
  first.unmount();
  second.unmount();
});
