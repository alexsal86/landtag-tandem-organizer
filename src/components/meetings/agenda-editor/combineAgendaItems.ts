import type { AgendaItem } from "../types";
const matches = (item: AgendaItem, key: string) =>
  item.id === key || item.localKey === key;
const childOf = (item: AgendaItem, parent: AgendaItem) =>
  !!(
    (parent.id && item.parent_id === parent.id) ||
    (parent.localKey && item.parentLocalKey === parent.localKey)
  );
/** The editor supports two levels: a moved group's children join the target as siblings. */
export function combineAgendaItems(
  items: AgendaItem[],
  draggedKey: string,
  targetKey: string,
): AgendaItem[] | null {
  const dragged = items.find((item) => matches(item, draggedKey));
  const target = items.find((item) => matches(item, targetKey));
  if (
    !dragged ||
    !target ||
    dragged === target ||
    dragged.parent_id ||
    dragged.parentLocalKey ||
    target.parent_id ||
    target.parentLocalKey
  )
    return null;
  const group = [dragged, ...items.filter((item) => childOf(item, dragged))];
  const rest = items.filter((item) => !group.includes(item));
  let position = rest.indexOf(target) + 1;
  while (position < rest.length && childOf(rest[position], target)) position++;
  const children = group.map((item) => ({
    ...item,
    parent_id: target.id || null,
    parentLocalKey: target.localKey || target.id,
    duration_minutes: null,
  }));
  rest.splice(position, 0, ...children);
  return rest.map((item, index) => ({ ...item, order_index: index }));
}
