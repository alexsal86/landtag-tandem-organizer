/** Reine Ampel-Logik für den System-Puls: aus Testläufen und Sicherheitslücken je Bereich einen Status ableiten. */
export type PulseLevel = "green" | "yellow" | "red" | "grey";

export interface PulseArea { id: string; title: string; scenarios: string[]; tables: string[]; next: string[] }

export const PULSE_AREAS: PulseArea[] = [
  { id: "contacts", title: "Kontakte", scenarios: ["contact-lifecycle"], tables: ["contacts"], next: ["appointments", "cases"] },
  { id: "appointments", title: "Termine & Briefings", scenarios: ["appointment-lifecycle", "appointment-request-lifecycle", "appointment-briefing-lifecycle"], tables: ["appointments"], next: ["tasks"] },
  { id: "cases", title: "Vorgänge", scenarios: ["case-item-lifecycle"], tables: ["case_items"], next: ["tasks"] },
  { id: "tasks", title: "Aufgaben & Stafette", scenarios: ["task-lifecycle", "task-stafette-lifecycle"], tables: ["tasks"], next: ["decisions", "meetings"] },
  { id: "decisions", title: "Entscheidungen", scenarios: ["decision-lifecycle"], tables: ["task_decisions"], next: [] },
  { id: "meetings", title: "Jour fixe", scenarios: ["meeting-lifecycle", "jour-fixe-platform-integration"], tables: ["meetings"], next: [] },
  { id: "security", title: "Zugriffsschutz", scenarios: ["access-boundaries"], tables: [], next: [] },
];

export interface PulseInput { runs: Record<string, "ok" | "failed" | string | undefined>; criticalTables: Set<string>; warningTables: Set<string> }

export function areaLevel(area: PulseArea, input: PulseInput): PulseLevel {
  const statuses = area.scenarios.map((id) => input.runs[id]);
  if (statuses.includes("failed") || area.tables.some((t) => input.criticalTables.has(t))) return "red";
  if (statuses.every((s) => s === undefined)) return "grey";
  if (statuses.some((s) => s !== "ok") || area.tables.some((t) => input.warningTables.has(t))) return "yellow";
  return "green";
}
