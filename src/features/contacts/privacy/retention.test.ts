import { describe, it, expect } from "vitest";
import { defaultReviewDate, defaultLegalBasis, isReviewDue } from "./retention";

describe("Kontakt-Prüffristen", () => {
  it("Bürger: 24 Monate", () => {
    expect(defaultReviewDate("citizen", new Date("2026-11-12T00:00:00Z"))).toBe("2028-11-12");
  });
  it("Andere: Legislaturende 31.03.2031", () => {
    expect(defaultReviewDate("business", new Date("2026-11-12T00:00:00Z"))).toBe("2031-03-31");
  });
  it("Rechtsgrundlage nach Kategorie", () => {
    expect(defaultLegalBasis("citizen")).toBe("mandate_public_interest");
    expect(defaultLegalBasis("politician")).toBe("legitimate_interest");
  });
  it("fällig am Stichtag", () => {
    expect(isReviewDue("2026-11-12", new Date("2026-11-12T10:00:00Z"))).toBe(true);
    expect(isReviewDue("2026-11-13", new Date("2026-11-12T10:00:00Z"))).toBe(false);
  });
});
