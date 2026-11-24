/**
 * Beschluss direkt im Meeting.
 *
 * Ein im Jour fixe gefasster Beschluss ist eine reguläre Entscheidung
 * (`task_decisions`) und wird zusätzlich im Block „Entscheidungen“ der Agenda
 * verlinkt. Dort erwartet die Plattform eine Zuordnung `id -> { result }` als
 * JSON in `meeting_agenda_items.result_text`; nur so greifen die bestehenden
 * Rechteprüfungen und die Ergebnispflege.
 */

export interface DecisionNoteEntry {
  result?: string;
}

export type DecisionNote = Record<string, DecisionNoteEntry | string>;

/** Liest den Entscheidungsblock, ohne bestehende Freitext-Notizen zu verlieren. */
export function parseDecisionNote(value: string | null | undefined): DecisionNote {
  if (!value) return {};
  try {
    const parsed: unknown = JSON.parse(value);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as DecisionNote;
    }
  } catch {
    // Freitext aus älteren Sitzungen bleibt unter einem neutralen Schlüssel erhalten.
    return { legacy_note: value };
  }
  return { legacy_note: value };
}

/** Ergänzt den Entscheidungsblock um einen neuen Beschluss. */
export function addDecisionToNote(
  value: string | null | undefined,
  decisionId: string,
  result: string,
): string {
  const note = parseDecisionNote(value);
  const existing = note[decisionId];
  const previous = existing && typeof existing === "object" ? existing.result ?? "" : "";
  return JSON.stringify({ ...note, [decisionId]: { result: result.trim() || previous } });
}

/** Kurzfassung, die im Entscheidungsblock als Ergebnis erscheint. */
export function decisionSummary(title: string, description?: string | null): string {
  const detail = (description ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return detail ? `${title.trim()} – ${detail.slice(0, 200)}` : title.trim();
}
