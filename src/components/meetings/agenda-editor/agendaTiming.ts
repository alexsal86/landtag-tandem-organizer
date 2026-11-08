import type { AgendaItem } from "../types";

export function clockTime(minutes: number) {
  const normalized = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(normalized / 60)).padStart(2, "0")}:${String(normalized % 60).padStart(2, "0")}`;
}

/** Only top-level points occupy time; old agendas without durations have no end estimate. */
export function agendaTiming(items: AgendaItem[], meetingTime?: string | null) {
  const main = items
    .filter((item) => !item.parent_id && !item.parentLocalKey)
    .sort((a, b) => a.order_index - b.order_index);
  const parts = meetingTime?.match(/^(\d{2}):(\d{2})/);
  const start = parts ? Number(parts[1]) * 60 + Number(parts[2]) : null;
  const starts = new Map<AgendaItem, string>();
  let total = 0;
  for (const item of main) {
    starts.set(item, start === null ? "" : clockTime(start + total));
    total += Math.max(0, item.duration_minutes ?? 0);
  }
  return {
    main,
    total,
    starts,
    end: total > 0 && start !== null ? clockTime(start + total) : null,
  };
}
