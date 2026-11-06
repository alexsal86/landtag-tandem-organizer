export const DAY_SLIP_APPEND_EVENT = "dayslip:append";

export type DaySlipAppendDetail = {
  text: string;
  source?: { type: "task" | "note" | "case" | "decision"; id: string; nextActionLabel?: string };
};

/** Puts a line onto today's Tageszettel (handled by the global day slip panel). */
export function sendToDaySlip(detail: DaySlipAppendDetail): void {
  window.dispatchEvent(new CustomEvent<DaySlipAppendDetail>(DAY_SLIP_APPEND_EVENT, { detail }));
}

export function formatCaseDaySlipText(title: string, step?: string | null): string {
  return `Vorgang: ${title.trim() || "Ohne Titel"} | Schritt: ${step?.trim() || "Noch kein Schritt festgelegt"}`;
}

export function withDaySlipSourceIcon(text: string, source?: DaySlipAppendDetail["source"]): string {
  const trimmed = text.trim();
  const icon = source ? { task: "✅", note: "📝", case: "💼", decision: "🗳️" }[source.type] : undefined;
  return icon && !trimmed.startsWith(icon) ? `${icon} ${trimmed}` : trimmed;
}
