export type AutomationTab = "rules" | "history" | "dispatcher" | "annual";
export type RssTab = "sources" | "settings";

/** Keep bookmarked destinations when the five automation pages become three. */
export function resolveAutomationDestination(subSection: string | null): string | null {
  if (subSection === "annual") return "rules";
  if (subSection === "engine") return "rules";
  if (subSection === "rss-sources" || subSection === "rss-settings") return "rss";
  return subSection;
}

export function automationTabFromParams(params: URLSearchParams): AutomationTab {
  if (params.get("adminSubSection") === "annual") return "annual";
  if (params.get("adminSubSection") === "engine") return "dispatcher";
  const tab = params.get("automationTab");
  return tab === "history" || tab === "dispatcher" || tab === "annual" ? tab : "rules";
}

export function rssTabFromParams(params: URLSearchParams): RssTab {
  return params.get("adminSubSection") === "rss-settings" || params.get("rssTab") === "settings"
    ? "settings" : "sources";
}

export function normalizeAutomationParams(params: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(params);
  if (next.get("adminSection") !== "automation") return next;
  const original = next.get("adminSubSection");
  if (original === "annual") next.set("automationTab", "annual");
  if (original === "engine") next.set("automationTab", "dispatcher");
  if (original === "rss-settings") next.set("rssTab", "settings");
  if (original === "rss-sources") next.set("rssTab", "sources");
  const destination = resolveAutomationDestination(original);
  if (destination) next.set("adminSubSection", destination);
  return next;
}