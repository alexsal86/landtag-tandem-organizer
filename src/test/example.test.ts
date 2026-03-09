import { describe, it, expect } from "vitest";

describe("LandtagsOS test setup", () => {
  it("should pass basic assertion", () => {
    expect(1 + 1).toBe(2);
  });

  it("should handle string operations", () => {
    const appName = "LandtagsOS";
    expect(appName).toContain("Landtag");
    expect(appName).not.toContain("Tandem");
  });
});
