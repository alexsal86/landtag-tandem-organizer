import { describe, it, expect } from "vitest";
import { compareRuns } from "./history";

describe("compareRuns", () => {
  it("reports a step that went from failed to ok as fixed", () => {
    const r = compareRuns([{ id: "a", label: "A", status: "failed" }], [{ id: "a", label: "A", status: "ok" }]);
    expect(r.fixed).toEqual(["A"]);
    expect(r.broken).toEqual([]);
  });
  it("reports a step that went from ok to failed as broken", () => {
    const r = compareRuns([{ id: "a", label: "A", status: "ok" }], [{ id: "a", label: "A", status: "failed" }]);
    expect(r.broken).toEqual(["A"]);
  });
});
