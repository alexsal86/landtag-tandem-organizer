import type { QuickNote } from "@/components/shared/QuickNotesList";

export type QuickNoteFilter = "all" | "pinned" | "due" | "shared" | "open" | "linked" | "stale";

export const DEFAULT_NOTE_COLOR = "#3b82f6";

export const QUICK_NOTE_FILTERS: Array<{ value: QuickNoteFilter; label: string; hint: string }> = [
  { value: "all", label: "Alle", hint: "Alle aktiven Notizen" },
  { value: "pinned", label: "Angeheftet", hint: "Nur angeheftete Notizen" },
  { value: "due", label: "Wiedervorlage fällig", hint: "Wiedervorlage-Datum ist heute oder schon vorbei" },
  { value: "shared", label: "Geteilt", hint: "Von dir geteilt oder mit dir geteilt" },
  { value: "open", label: "Offen", hint: "Noch nicht weiterverarbeitet – keine Aufgabe, Entscheidung, Vorgang, Jour fixe oder Themenspeicher" },
  { value: "linked", label: "Verknüpft", hint: "Mit Aufgabe, Entscheidung, Vorgang, Jour fixe (auch vorgemerkt) oder Themenspeicher verbunden" },
  { value: "stale", label: "Älter als 30 Tage", hint: "Länger als 30 Tage nicht bearbeitet; zukünftige Wiedervorlagen ausgenommen" },
];

export function isNoteLinked(note: QuickNote): boolean {
  return Boolean(
    note.task_id || note.decision_id || note.case_item_id || note.meeting_id ||
    note.topic_backlog_id || note.pending_for_jour_fixe,
  );
}

export function isFollowUpDue(note: QuickNote, now: Date = new Date()): boolean {
  if (!note.follow_up_date) return false;
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);
  return new Date(note.follow_up_date).getTime() <= endOfToday.getTime();
}

export function isNoteStale(note: QuickNote, now: Date = new Date()): boolean {
  const changed = new Date(note.updated_at || note.created_at).getTime();
  if (!Number.isFinite(changed) || now.getTime() - changed <= 30 * 864e5) return false;
  if (note.follow_up_date) {
    const today = new Date(now); today.setHours(23, 59, 59, 999);
    if (new Date(note.follow_up_date).getTime() > today.getTime()) return false;
  }
  return !note.sync_status;
}

export function matchesNoteFilter(
  note: QuickNote,
  filter: QuickNoteFilter,
  color: string | null = null,
  now: Date = new Date(),
): boolean {
  if (color && (note.color || DEFAULT_NOTE_COLOR) !== color) return false;
  switch (filter) {
    case "stale": return isNoteStale(note, now);
    case "pinned": return note.is_pinned;
    case "due": return isFollowUpDue(note, now);
    case "shared": return (note.share_count || 0) > 0 || note.is_shared === true;
    case "open": return !isNoteLinked(note);
    case "linked": return isNoteLinked(note);
    default: return true;
  }
}

export { countChecklist, toggleChecklistItem, renderChecklistHtml } from "@/features/quick-notes/checklists";
