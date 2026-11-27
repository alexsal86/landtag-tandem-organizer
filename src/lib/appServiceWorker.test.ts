import { describe, expect, it } from "vitest";
import { allowsAppServiceWorker } from "./appServiceWorker";

describe("combined app worker preview safety", () => {
  it.each(["id-preview--7d09a65d-5cbe-421b-a580-38a4fe244277.lovable.app", "preview-v2--test.gpt-eng.com", "project--test-dev.lovable.app", "a.lovableproject-dev.com", "beta.lovable.dev", "localhost"])("blocks %s even in built previews", host => {
    expect(allowsAppServiceWorker(host, true, false)).toBe(false);
  });
  it("keeps the canonical published host and custom domains eligible", () => {
    expect(allowsAppServiceWorker("landtag-tandem-organizer.lovable.app", true, false)).toBe(true);
    expect(allowsAppServiceWorker("office.example.org", true, false)).toBe(true);
  });
  it("blocks development, iframe and explicit kill switch", () => {
    expect(allowsAppServiceWorker("office.example.org", false, false)).toBe(false);
    expect(allowsAppServiceWorker("office.example.org", true, true)).toBe(false);
    expect(allowsAppServiceWorker("office.example.org", true, false, "?sw=off")).toBe(false);
  });
});