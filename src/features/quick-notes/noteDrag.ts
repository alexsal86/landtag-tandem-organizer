import { stripHtml } from '@/hooks/quickNotes/utils';
import type { QuickNote } from './types';

/** Match the native drag contract already consumed by the global day slip. */
export function writeNoteDragData(transfer: Pick<DataTransfer, 'setData' | 'effectAllowed'>, note: Pick<QuickNote, 'id' | 'title' | 'content'>) {
  const text = [stripHtml(note.title || ''), stripHtml(note.content)].filter(Boolean).join('\n');
  transfer.effectAllowed = 'copyMove';
  transfer.setData('text/plain', text);
  transfer.setData('application/x-mywork-task-title', text);
  transfer.setData('application/x-mywork-task-id', note.id);
  transfer.setData('application/x-mywork-item-type', 'note');
  transfer.setData('application/x-quick-note-id', note.id);
}
