import { describe, expect, it } from "vitest";
import { getAdministrationAccess } from "./access";
import { resolveNavigationState } from "./adminNavigation";
import { adminMenuItems } from "./AdminSidebar";
import { automationTabFromParams, normalizeAutomationParams, rssTabFromParams } from "./automationNavigation";

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

it("keeps bookmarks valid after reorganizing personal and financial settings", () => {
  expect(resolveNavigationState("security", "expense", false)).toEqual({ section: "finance", subSection: "expense" });
  expect(resolveNavigationState("users", "matrix", false)).toEqual({ section: "personal", subSection: "matrix" });
  expect(resolveNavigationState("content", "archiving", false)).toEqual({ section: "personal", subSection: "archiving" });
  expect(resolveNavigationState("templates", "celebrations", false)).toEqual({ section: "personal", subSection: "celebrations" });
});

describe("automation hub navigation", () => {
  it("exposes exactly the three planned workspaces", () => {
    expect(adminMenuItems.find(item => item.id === "automation")?.children?.map(item => item.id)).toEqual(["rules", "annual", "rss"]);
  });
  it("preserves legacy engine links in the dispatcher tab", () => {
    const params = normalizeAutomationParams(new URLSearchParams("adminSection=automation&adminSubSection=engine&tab=dashboard"));
    expect(resolveNavigationState("automation", "engine", false)).toEqual({ section: "automation", subSection: "rules" });
    expect(params.get("adminSubSection")).toBe("rules");
    expect(automationTabFromParams(params)).toBe("dispatcher");
    expect(params.get("tab")).toBe("dashboard");
  });
  it.each([['rss-sources', 'sources'], ['rss-settings', 'settings']])("preserves legacy %s links", (legacy, tab) => {
    const params = normalizeAutomationParams(new URLSearchParams(`adminSection=automation&adminSubSection=${legacy}`));
    expect(params.get("adminSubSection")).toBe("rss");
    expect(rssTabFromParams(params)).toBe(tab);
    expect(resolveNavigationState("automation", legacy, false).subSection).toBe("rss");
  });
  it("keeps canonical tabs and browser-history destinations stable", () => {
    const params = new URLSearchParams("adminSection=automation&adminSubSection=rules&automationTab=history");
    expect(automationTabFromParams(normalizeAutomationParams(params))).toBe("history");
    expect(normalizeAutomationParams(normalizeAutomationParams(params)).toString()).toBe(params.toString());
    expect(automationTabFromParams(new URLSearchParams("automationTab=invalid"))).toBe("rules");
    expect(rssTabFromParams(new URLSearchParams("rssTab=invalid"))).toBe("sources");
  });
});
