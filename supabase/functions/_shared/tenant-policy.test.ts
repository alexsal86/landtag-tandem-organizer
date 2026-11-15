import { describe, it, expect } from "vitest";
import { resolveTenantMembership, canForceCalendarResync } from "./tenant-policy";

describe("privileged office authorization", () => {
  const memberships = [{ tenant_id: "office-a", role: "abgeordneter" }, { tenant_id: "office-b", role: "mitarbeiter" }];
  it("refuses arbitrary selection for multiple active memberships", () => {
    expect(resolveTenantMembership(memberships)).toBeNull();
  });
  it("uses only the role in the explicitly selected office", () => {
    expect(resolveTenantMembership(memberships, "office-b")?.role).toBe("mitarbeiter");
    expect(canForceCalendarResync(resolveTenantMembership(memberships, "office-b")?.role ?? null)).toBe(false);
  });
  it("rejects a foreign office", () => {
    expect(resolveTenantMembership(memberships, "office-c")).toBeNull();
  });
  it("allows an unambiguous single office", () => {
    expect(resolveTenantMembership([memberships[0]])?.tenant_id).toBe("office-a");
  });
  it("preserves the existing deputy-only calendar reset rule", () => {
    expect(canForceCalendarResync("abgeordneter")).toBe(true);
    expect(canForceCalendarResync("bueroleitung")).toBe(false);
    expect(canForceCalendarResync(null)).toBe(false);
  });
});