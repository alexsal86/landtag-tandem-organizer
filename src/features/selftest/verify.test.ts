import { describe, it, expect } from "vitest";
import { deepEqual } from "./verify";

describe("selftest deepEqual", () => {
  it("treats Z and +00:00 timestamps as equal", () => {
    expect(deepEqual("2026-11-06T10:00:00+00:00", "2026-11-06T10:00:00.000Z")).toBe(true);
  });
  it("detects different timestamps", () => {
    expect(deepEqual("2026-11-06T10:00:00+00:00", "2026-11-06T11:00:00.000Z")).toBe(false);
  });
  it("treats HH:MM and HH:MM:SS as equal", () => {
    expect(deepEqual("10:00:00", "10:00")).toBe(true);
    expect(deepEqual("10:30:00", "10:00")).toBe(false);
  });
});
