import type { AgendaItem } from "@/components/meetings/types";
import type { GeneratedAgendaEntry } from "./SystemSubpointScope";

export interface AgendaNumberingInput {
  agendaItems: AgendaItem[];
  getItemKey: (item: AgendaItem, index: number) => string;
  generatedEntries: Record<string, GeneratedAgendaEntry[]>;
  systemCounts: Record<string, number | null>;
  generatedEntryCounts: Record<string, number>;
}

/**
 * Liefert die Nummer eines Agenda-Punkts ("3." für Hauptpunkte, "3.2" für
 * Unterpunkte). Generierte Einträge eines Systempunkts zählen die Unterpunkte
 * vor, damit die Nummerierung zur sichtbaren Reihenfolge passt.
 */
export function createAgendaNumbering({
  agendaItems,
  getItemKey,
  generatedEntries,
  systemCounts,
  generatedEntryCounts,
}: AgendaNumberingInput): (agendaItem: AgendaItem) => string | undefined {
  const parentByItemKey = new Map<string, AgendaItem>();
  agendaItems.forEach((agendaItem) => {
    if (agendaItem.id) parentByItemKey.set(agendaItem.id, agendaItem);
    if (agendaItem.localKey) parentByItemKey.set(agendaItem.localKey, agendaItem);
  });

  const mainItems = agendaItems
    .filter((agendaItem) => !(agendaItem.parentLocalKey || agendaItem.parent_id))
    .sort((a, b) => a.order_index - b.order_index);

  const mainNumberByKey = new Map<string, number>();
  const subNumberByKey = new Map<string, number>();

  mainItems.forEach((mainItem, mainIndex) => {
    const number = mainIndex + 1;
    if (mainItem.id) mainNumberByKey.set(mainItem.id, number);
    if (mainItem.localKey) mainNumberByKey.set(mainItem.localKey, number);

    const subItems = agendaItems
      .filter((agendaItem) => {
        if (!mainItem.id && !mainItem.localKey) return false;
        return (
          (mainItem.id && agendaItem.parent_id === mainItem.id) ||
          (mainItem.localKey && agendaItem.parentLocalKey === mainItem.localKey)
        );
      })
      .sort((a, b) => a.order_index - b.order_index);

    const generatedCount =
      generatedEntries[getItemKey(mainItem, agendaItems.indexOf(mainItem))]?.length ??
      systemCounts[getItemKey(mainItem, agendaItems.indexOf(mainItem))] ??
      generatedEntryCounts[mainItem.system_type ?? ""] ??
      0;
    subItems.forEach((subItem, subIndex) => {
      const subNumber = generatedCount + subIndex + 1;
      if (subItem.id) subNumberByKey.set(subItem.id, subNumber);
      if (subItem.localKey) subNumberByKey.set(subItem.localKey, subNumber);
    });
  });

  return (agendaItem: AgendaItem) => {
    const key = agendaItem.id || agendaItem.localKey;
    if (!key) return undefined;

    const directMain = mainNumberByKey.get(key);
    if (directMain) return `${directMain}.`;

    const parentKey = agendaItem.parent_id || agendaItem.parentLocalKey;
    if (!parentKey) return undefined;

    const parentMain = mainNumberByKey.get(parentKey);
    const subNumber = subNumberByKey.get(key);
    if (parentMain && subNumber) return `${parentMain}.${subNumber}`;

    const parentItem = parentByItemKey.get(parentKey);
    if (!parentItem) return undefined;
    const fallbackParentKey = parentItem.id || parentItem.localKey;
    if (!fallbackParentKey) return undefined;
    const fallbackMain = mainNumberByKey.get(fallbackParentKey);
    if (!fallbackMain || !subNumber) return undefined;
    return `${fallbackMain}.${subNumber}`;
  };
}
