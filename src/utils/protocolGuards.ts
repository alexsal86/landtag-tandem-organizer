import { hasOwnProperty, isRecord } from '@/utils/typeSafety';
import type { ProtocolAgendaItem } from '@/types/protocol';

export interface PdfTextItem {
  str: string;
}

export function isPdfTextItem(item: unknown): item is PdfTextItem {
  return isRecord(item) && hasOwnProperty(item, 'str') && typeof item.str === 'string';
}

export function isProtocolAgendaItem(value: unknown): value is ProtocolAgendaItem {
  if (!isRecord(value)) {
    return false;
  }

  if (!hasOwnProperty(value, 'title') || typeof value.title !== 'string') {
    return false;
  }

  if (!hasOwnProperty(value, 'number') && !hasOwnProperty(value, 'agenda_number')) {
    return false;
  }

  const numberValue = hasOwnProperty(value, 'number') ? value.number : value.agenda_number;
  return typeof numberValue === 'string' || typeof numberValue === 'number';
}
