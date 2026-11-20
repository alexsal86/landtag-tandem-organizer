export const agendaSubpointListClass =
  "border-t border-[color:var(--agenda-row-divider)] dark:border-border";

export const agendaSubpointRowClass =
  "min-w-0 border-b border-[color:var(--agenda-row-divider)] bg-[var(--agenda-subpoint-bg)] py-2.5 pl-[3.75rem] pr-3 text-xs last:border-b-0 dark:border-border dark:bg-slate-800 sm:pr-5";

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
