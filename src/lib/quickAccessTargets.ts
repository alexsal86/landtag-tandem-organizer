const objectRoutes = {
  casefiles: { table: "case_files", params: ["caseFileId"] },
  documents: { table: "documents", params: ["document"] },
  dossiers: { table: "dossiers", params: ["id"] },
  decisions: { table: "task_decisions", params: ["highlight"] },
  "employee-meeting": { table: "employee_meetings", params: [], pathId: true },
  eventplanning: { table: "event_plannings", params: ["planningId", "highlight", "id"], pathId: true },
  knowledge: { table: "knowledge_documents", params: [], pathId: true },
  meetings: { table: "meetings", params: ["highlight", "protocol"] },
  mywork: { table: "case_items", params: ["caseItemId"] },
  vorgaenge: { table: "case_items", params: [], pathId: true },
  letters: { table: "letters", params: [], pathId: true },
} as const;

export function savedNavigationHref(route: string) {
  return route.replace(/^\/event-planning(?=\/|\?|$)/, "/eventplanning");
}

export function savedObjectReference(route: string) {
  const [pathname, query] = savedNavigationHref(route).split(/[?#]/);
  const [, section, child] = pathname.split("/");
  const config = objectRoutes[section as keyof typeof objectRoutes];
  if (!config) return null;
  const search = new URLSearchParams(query);
  const id = ("pathId" in config && child) || config.params.map(param => search.get(param)).find(Boolean);
  return id && /^[\da-f-]{36}$/i.test(id) ? { table: config.table, id } : null;
}

export function targetsSamePage(a: { id: string; route: string }, b: { id: string; route: string }) {
  if (a.id === b.id || a.route === b.route) return true;
  const left = savedObjectReference(a.route);
  const right = savedObjectReference(b.route);
  return !!left && !!right && left.table === right.table && left.id === right.id;
}

export function resolveSavedNavigationHref(route: string) {
  const href = savedNavigationHref(route);
  const ref = savedObjectReference(href);
  // Planning details accept the path ID or the planningId parameter.
  if (ref?.table !== "event_plannings") return href;
  const url = new URL(href, "https://app.invalid");
  if (url.pathname === "/eventplanning" && !url.searchParams.has("planningId")) {
    url.searchParams.set("planningId", ref.id);
    return url.pathname + url.search + url.hash;
  }
  return href;
}
