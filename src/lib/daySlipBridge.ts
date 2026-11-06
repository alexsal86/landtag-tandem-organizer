export const DAY_SLIP_APPEND_EVENT = "dayslip:append";

export type DaySlipAppendDetail = {
  text: string;
  source?: { type: "task" | "note" | "case" | "decision"; id: string; nextActionLabel?: string };
};

/** Puts a line onto today's Tageszettel (handled by the global day slip panel). */
export function sendToDaySlip(detail: DaySlipAppendDetail): void {
  window.dispatchEvent(new CustomEvent<DaySlipAppendDetail>(DAY_SLIP_APPEND_EVENT, { detail }));
}
