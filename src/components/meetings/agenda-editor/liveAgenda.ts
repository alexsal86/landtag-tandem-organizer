import type { AgendaItem } from "../types";

export function liveAgendaPosition(mainItems: AgendaItem[], currentKey?: string | null) {
  const index = mainItems.findIndex((item) => currentKey && (item.localKey || item.id) === currentKey);
  if (index >= 0) return index;
  const unfinished = mainItems.findIndex((item) => !item.is_completed);
  return unfinished >= 0 ? unfinished : mainItems.length ? 0 : -1;
}
