export const agendaSubpointListClass =
  "border-t border-[color:var(--agenda-row-divider)] dark:border-border";

export const agendaSubpointBackground =
  "bg-[var(--agenda-subpoint-bg)] hover:bg-[var(--agenda-subpoint-bg)] dark:bg-slate-800 dark:hover:bg-slate-700";

export const agendaSubpointRowClass =
  "min-w-0 border-b border-[color:var(--agenda-row-divider)] border-l-[3px] border-l-transparent py-2.5 pl-4 pr-3 text-xs last:border-b-0 dark:border-b-border sm:pr-5";

export function agendaSubpointNumber(parentNumber: string | undefined, index: number) {
  return parentNumber ? `${parentNumber.replace(/\.$/, "")}.${index + 1}` : undefined;
}

export function orderSystemSubpoints<T extends { id: string }>(
  entries: readonly T[],
  results: Record<string, { order_index?: number }>,
): T[] {
  return [...entries].sort((a, b) =>
    (results[a.id]?.order_index ?? Number.MAX_SAFE_INTEGER) -
    (results[b.id]?.order_index ?? Number.MAX_SAFE_INTEGER),
  );
}

export function wasReservedForMeeting(meetingId?: string, reservedMeetingId?: string | null) {
  return Boolean(meetingId && reservedMeetingId === meetingId);
}
