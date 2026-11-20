import type { DragUpdate } from "@hello-pangea/dnd";
import type { AgendaItem } from "../types";
import { combineAgendaItems } from "./combineAgendaItems";

export function agendaItemKey(item: AgendaItem, index: number) {
  return item.localKey || item.id || `agenda-${index}`;
}

export function resolveAgendaDrop(items: AgendaItem[], drag: DragUpdate, hiddenItems?: ReadonlySet<AgendaItem>) {
  const dragged = items.find((item, index) => agendaItemKey(item, index) === drag.draggableId);
  if (!dragged) return null;

  const parentOf = (item: AgendaItem) => items.find((candidate) =>
    Boolean((candidate.id && item.parent_id === candidate.id) ||
      (candidate.localKey && item.parentLocalKey === candidate.localKey)),
  );
  const previousParent = parentOf(dragged);
  const children = items.filter((item) => parentOf(item) === dragged);
  const rest = items.filter((item) => item !== dragged);
  let index: number;
  let parent: AgendaItem | undefined;
  let target: AgendaItem | undefined;

  if (drag.combine) {
    target = items.find((item, index) => agendaItemKey(item, index) === drag.combine?.draggableId);
    if (!target || target === dragged || children.includes(target)) return null;
    parent = parentOf(target) ?? target;
    if (!parent.id && !parent.localKey) return null;

    if (children.length) {
      const moved = combineAgendaItems(items, drag.draggableId, parent.localKey || parent.id!);
      return moved && { items: moved, parent, marker: target };
    }

    index = rest.indexOf(target) + 1;
    if (target === parent) {
      while (index < rest.length && parentOf(rest[index]) === parent) index++;
    }
  } else {
    if (!drag.destination || drag.destination.index === drag.source.index) return null;
    index = Math.min(drag.destination.index, rest.length);
    while (index < rest.length && hiddenItems?.has(rest[index])) index++;
    // Inserting before an existing child joins its group. The boundary before
    // a main point or at the end of the agenda always places a main point.
    parent = rest[index] && parentOf(rest[index]);
    if (parent && children.length) {
      do index++;
      while (index < rest.length && parentOf(rest[index]) === parent);
      parent = undefined;
    }
    if (children.includes(rest[index]) || (parent && !parent.id && !parent.localKey)) return null;
  }

  if (previousParent?.system_type && parent !== previousParent) return null;

  const remaining = rest.filter((item) => !children.includes(item));
  const marker = rest[index];
  const position = marker ? remaining.indexOf(marker) : remaining.length;
  if (position < 0) return null;

  const moved: AgendaItem = {
    ...dragged,
    parent_id: parent?.id ?? null,
    parentLocalKey: parent?.localKey,
    duration_minutes: parent ? null : dragged.duration_minutes,
  };
  remaining.splice(position, 0, moved, ...children);
  return {
    items: remaining.map((item, order_index) => ({ ...item, order_index })),
    parent,
    marker: target ?? marker,
  };
}
