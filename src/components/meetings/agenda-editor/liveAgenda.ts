import type { AgendaItem } from "../types";

export function liveAgendaPosition(mainItems: AgendaItem[], currentKey?: string | null) {
  const index = mainItems.findIndex((item) => currentKey && (item.localKey || item.id) === currentKey);
  if (index >= 0) return index;
  const unfinished = mainItems.findIndex((item) => !item.is_completed);
  return unfinished >= 0 ? unfinished : mainItems.length ? 0 : -1;
}

export function generatedAgendaKey(parentKey: string, sourceId: string) {
  return `system:${parentKey}:${sourceId}`;
}

export function flattenLiveAgenda(
  mainItems: AgendaItem[],
  items: AgendaItem[],
  generated: Readonly<Record<string, readonly { id: string; title: string; number?: string }[]>>,
) {
  const steps: { key: string; rootKey: string; parentKey?: string; title: string; number?: string; item?: AgendaItem }[] = [];
  const append = (item: AgendaItem, rootKey: string, parentKey?: string) => {
    const key = item.localKey || item.id;
    if (!key) return;
    steps.push({ key, rootKey, parentKey, title: item.title, item });
    for (const child of generated[key] ?? []) {
      steps.push({ key: generatedAgendaKey(key, child.id), rootKey, parentKey: key, title: child.title, number: child.number });
    }
  };
  for (const main of mainItems) {
    const rootKey = main.localKey || main.id;
    if (!rootKey) continue;
    append(main, rootKey);
    for (const child of items) {
      if ((main.id && child.parent_id === main.id) || (main.localKey && child.parentLocalKey === main.localKey)) {
        append(child, rootKey, rootKey);
      }
    }
  }
  return steps;
}
