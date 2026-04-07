// ─── Types ───────────────────────────────────────────────────────────────────

export type ResolveTarget = "note" | "task" | "decision" | "archived" | "snoozed";

export interface DaySlipDayData {
  html: string;
  plainText: string;
  nodes?: string;
  struckLines?: string[];
  struckLineIds?: string[];
  resolved?: Array<{ lineId: string; text: string; target: ResolveTarget }>;
  completedAt?: string;
  recurringInjected?: boolean;
  weekPlanInjected?: boolean;
  deadlinesInjected?: boolean;
  deadlineLineMap?: Record<string, string>;
  lineTimestamps?: Record<string, { addedAt: string; checkedAt?: string }>;
  dayMood?: 1 | 2 | 3 | 4 | 5;
}

export type ResolvedItem = { lineId: string; text: string; target: ResolveTarget; persisted?: boolean; snoozeUntil?: string };
export type DaySlipStore = Record<string, DaySlipDayData>;
export type DaySlipLineEntry = { id: string; text: string };

export type RecurringTemplate = {
  id: string;
  text: string;
  weekday: (typeof WEEK_DAYS)[number];
};

export type ResolveExportItem = {
  sourceDayKey: string;
  lineId: string;
  text: string;
  target: Exclude<ResolveTarget, "archived" | "snoozed">;
  createdAt: string;
};

export type DayTemplate = {
  id: string;
  name: string;
  lines: string[];
};

// ─── Constants ───────────────────────────────────────────────────────────────

export const STORAGE_KEY = "day-slip-v2";
export const RECURRING_STORAGE_KEY = "day-slip-recurring-v2";
export const DAY_TEMPLATE_STORAGE_KEY = "day-slip-day-templates-v1";
export const RESOLVE_EXPORT_KEY = "day-slip-resolve-export-v1";
export const SAVE_DEBOUNCE_MS = 400;

export const WEEK_DAYS = ["all", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;

export const WEEK_DAY_LABELS: Record<(typeof WEEK_DAYS)[number], string> = {
  all: "Jeden Tag",
  monday: "Montag",
  tuesday: "Dienstag",
  wednesday: "Mittwoch",
  thursday: "Donnerstag",
  friday: "Freitag",
  saturday: "Samstag",
  sunday: "Sonntag",
};

export const DEFAULT_DAY_TEMPLATES: DayTemplate[] = [
  {
    id: "plenary-day",
    name: "Plenar-/Sitzungstag",
    lines: [
      "--- 1) Vor Start ---",
      "!! Tagesordnung + Redebeiträge final prüfen",
      "Mappen/Links für Sitzung und Team bereitstellen",
      "--- 2) Während der Sitzung ---",
      "! Offene Fragen + Zusagen live notieren",
      "Beschlüsse inkl. Fristen protokollieren",
      "--- 3) Direkt danach ---",
      "Aufgaben an zuständige Personen verteilen",
      "Follow-ups in Kalender/Taskliste eintragen",
    ],
  },
  {
    id: "committee-day",
    name: "Ausschusstag",
    lines: [
      "--- 1) Vorbereitung ---",
      "Einladung, Unterlagen und Stellungnahmen querlesen",
      "!! Kritische Nachfragen + Kernbotschaften formulieren",
      "--- 2) Termin ---",
      "Fragen, Antworten und nächste Schritte mitschreiben",
      "Stakeholder mit Bezug markieren",
      "--- 3) Nachbereitung ---",
      "Beschlusslage intern kurz zusammenfassen",
      "Offene Punkte an Fachreferate übergeben",
    ],
  },
  {
    id: "district-day",
    name: "Wahlkreis-/Bürgersprechstunden-Tag",
    lines: [
      "--- 1) Vorbereitung ---",
      "Termine + Anfahrten gegenprüfen",
      "Bürgeranliegen nach Dringlichkeit sortieren",
      "--- 2) Vor Ort ---",
      "! Zusagen realistisch und konkret festhalten",
      "Rückruf-/Antwortfristen direkt notieren",
      "--- 3) Nachbereitung ---",
      "Anliegen in Aufgaben überführen",
      "Status-Update für Team/Assistenz senden",
    ],
  },
  {
    id: "homeoffice-day",
    name: "Homeoffice-Tag",
    lines: [
      "--- 1) Fokusblöcke ---",
      "!! Wichtigste Aufgabe des Tages (MIT)",
      "! E-Mails nur um 11:00 und 16:00",
      "--- 2) Kommunikation ---",
      "Jour fixe vorbereiten",
      "Rückrufe und Nachrichten abarbeiten",
      "--- 3) Tagesabschluss ---",
      "Ergebnisse dokumentieren",
      "Top-3 für morgen festlegen",
    ],
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

export const toDayKey = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

export const formatDate = (dayKey: string) => {
  const date = new Date(`${dayKey}T12:00:00`);
  return new Intl.DateTimeFormat("de-DE", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
};

export const stripHtml = (html: string) => html.replace(/<[^>]*>/g, "").trim();

export const normalizeRuleMarker = (text: string) =>
  text.replace(/[‐‑‒–—―−]/g, "-").replace(/[\u200B-\u200D\uFEFF]/g, "").replace(/\u00A0/g, " ").replace(/\s+/g, "").trim();

export const normalizeLineText = (text: string) => text.replace(/\s+/g, " ").trim();

export const isRuleLine = (text: string) => /^[-_]{3,}$/.test(normalizeRuleMarker(text));

export const parseRuleLine = (text: string): { isRule: boolean; label?: string } => {
  const trimmed = text.trim();
  const match = trimmed.match(/^[-–—―−_]{3,}\s*(.*)$/);
  if (!match) return { isRule: false };
  const label = match[1]?.replace(/\s*[-–—―−_]{3,}\s*$/, "").trim();
  return { isRule: true, label: label || undefined };
};

export const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");

export const toParagraphHtml = (entry: DaySlipLineEntry) =>
  `<p data-line-id="${entry.id}">${escapeHtml(entry.text)}</p>`;

export const toRuleHtml = (label?: string) => {
  const safeLabel = label ? escapeHtml(label) : "";
  return `<div class="labeled-hr" data-label="${safeLabel}"></div>`;
};

export const extractLinesFromHtml = (html: string): DaySlipLineEntry[] => {
  if (!html.trim()) return [];
  const parser = new DOMParser();
  const dom = parser.parseFromString(html, "text/html");
  return Array.from(dom.querySelectorAll("p"))
    .map((p) => ({ id: p.dataset.lineId || crypto.randomUUID(), text: (p.textContent ?? "").trim() }))
    .filter((line) => line.text.length > 0 && !isRuleLine(line.text));
};

export const weekdayKey = (date: Date): (typeof WEEK_DAYS)[number] => {
  const idx = date.getDay();
  if (idx === 0) return "sunday";
  if (idx === 1) return "monday";
  if (idx === 2) return "tuesday";
  if (idx === 3) return "wednesday";
  if (idx === 4) return "thursday";
  if (idx === 5) return "friday";
  return "saturday";
};

export const formatTimeStamp = (iso?: string) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
};

export const normalizeDayTemplates = (value: unknown): DayTemplate[] => {
  if (!Array.isArray(value)) return DEFAULT_DAY_TEMPLATES;
  const normalized = value
    .map((entry, index) => {
      if (!entry || typeof entry !== "object") return null;
      const candidate = entry as Partial<DayTemplate> & { content?: string[] | string };
      const name = typeof candidate.name === "string" ? candidate.name.trim() : "";
      if (!name) return null;
      const rawLines = Array.isArray(candidate.lines) ? candidate.lines : Array.isArray(candidate.content) ? candidate.content : typeof candidate.content === "string" ? candidate.content.split("\n") : [];
      const lines = rawLines.map((line) => (typeof line === "string" ? line.trim() : "")).filter(Boolean);
      if (lines.length === 0) return null;
      return { id: typeof candidate.id === "string" && candidate.id.trim() ? candidate.id : `template-${index}-${crypto.randomUUID()}`, name, lines };
    })
    .filter((template): template is DayTemplate => Boolean(template));
  return normalized.length > 0 ? normalized : DEFAULT_DAY_TEMPLATES;
};
