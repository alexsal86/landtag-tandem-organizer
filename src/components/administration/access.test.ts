import { describe, expect, it } from "vitest";
import { getAdministrationAccess } from "./access";
import { resolveNavigationState } from "./adminNavigation";

describe("administration access", () => {
  it.each(["abgeordneter", "bueroleitung"])("allows tenant admin %s without platform privileges", role => {
    expect(getAdministrationAccess(role, false)).toEqual({ isAdmin: true, isSuperAdmin: false });
  });
  it.each(["mitarbeiter", "praktikant", "gast", null])("denies tenant role %s", role => {
    expect(getAdministrationAccess(role, false)).toEqual({ isAdmin: false, isSuperAdmin: false });
  });
  it("allows a platform administrator without a selected tenant", () => {
    expect(getAdministrationAccess(null, true)).toEqual({ isAdmin: true, isSuperAdmin: true });
  });
  it("keeps an authorized superadmin deep link", () => {
    expect(resolveNavigationState("superadmin", "roles", true)).toEqual({ section: "superadmin", subSection: "roles" });
  });
  it("normalizes unauthorized and invalid destinations", () => {
    expect(resolveNavigationState("superadmin", "roles", false)).toEqual({ section: "security", subSection: "general" });
    expect(resolveNavigationState("calendar", "invalid", false)).toEqual({ section: "calendar", subSection: "config" });
  });
});
