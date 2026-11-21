import { format } from "date-fns";

/** Human-readable fallbacks for categories that are not part of the editable category list. */
const CATEGORY_LABELS: Record<string, string> = {
  meeting: "Besprechung",
  appointment: "Termin",
  session: "Sitzung",
  deadline: "Frist",
  blocked: "Geblockt",
  veranstaltung: "Veranstaltung",
  vacation: "Urlaub",
  vacation_request: "Urlaubsantrag",
  birthday: "Geburtstag",
  employee_meeting: "Mitarbeitergespräch",
};

export function calendarCategoryLabel(
  type: string | null | undefined,
  categories: ReadonlyArray<{ name: string; label: string }> = [],
): string {
  const match = categories.find((category) => category.name === type);
  if (match?.label?.trim()) return match.label;
  if (!type) return "Termin";
  return CATEGORY_LABELS[type] ?? type.replace(/[_-]+/g, " ").replace(/^./, (letter) => letter.toUpperCase());
}

/** Avoid showing the start time twice when imported titles already contain it. */
export function calendarEventDisplayTitle(title: string, start: Date): string {
  if (!Number.isFinite(start.getTime())) return title;
  const time = format(start, "HH:mm");
  const normalized = title.replace(new RegExp(`^\\s*${time.replace(":", "[:.]")}\\s*(?:Uhr\\b|[–—-])?\\s*`, "i"), "").trim();
  return normalized || title;
}

type EmployeeMeetingMetadata = Record<string, unknown> & {
  employee_meeting_id: string;
  meeting_type?: string;
  notes?: string;
};

export function employeeMeetingMetadata(description: string | null | undefined): EmployeeMeetingMetadata | null {
  if (!description?.trimStart().startsWith("{")) return null;
  try {
    const parsed: unknown = JSON.parse(description);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
    const data = parsed as Record<string, unknown>;
    if (typeof data.employee_meeting_id !== "string" || !data.employee_meeting_id.trim()) return null;
    return data as EmployeeMeetingMetadata;
  } catch {
    return null;
  }
}

const MEETING_TYPES: Record<string, string> = {
  regular: "Regulär",
  extraordinary: "Außerordentlich",
  ad_hoc: "Anlassbezogen",
};

export function calendarDescription(description: string | null | undefined): string {
  const metadata = employeeMeetingMetadata(description);
  if (!metadata) return description || "";
  if (typeof metadata.notes === "string" && metadata.notes.trim()) return metadata.notes.trim();
  return `Mitarbeitergespräch · ${MEETING_TYPES[metadata.meeting_type ?? ""] ?? "Gespräch"}`;
}

export function editableCalendarDescription(description: string | null | undefined): string {
  const metadata = employeeMeetingMetadata(description);
  return metadata ? (typeof metadata.notes === "string" ? metadata.notes : "") : (description || "");
}

/** Preserve structured employee-meeting linkage while allowing a human-readable note. */
export function serializeCalendarDescription(
  original: string | null | undefined,
  edited: string,
): string | null {
  const metadata = employeeMeetingMetadata(original);
  if (!metadata) return edited.trim() || null;
  const { notes: _oldNotes, ...rest } = metadata;
  return JSON.stringify(edited.trim() ? { ...rest, notes: edited.trim() } : rest);
}
