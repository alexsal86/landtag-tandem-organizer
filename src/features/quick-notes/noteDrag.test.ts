import { describe, expect, it } from 'vitest';
import { writeNoteDragData } from './noteDrag';

describe('note drag integration with the day slip', () => {
  it('preserves the full note and its source reference for the existing day slip drop handler', () => {
    const values = new Map<string, string>();
    const transfer = { effectAllowed: 'none' as DataTransfer['effectAllowed'], setData: (type: string, value: string) => { values.set(type, value); } };
    const body = 'Langer Notizinhalt '.repeat(30);
    writeNoteDragData(transfer, { id: 'note-42', title: '<p>Rückruf</p>', content: `<p>${body}</p>` });
    expect(values.get('application/x-mywork-item-type')).toBe('note');
    expect(values.get('application/x-mywork-task-id')).toBe('note-42');
    expect(values.get('application/x-quick-note-id')).toBe('note-42');
    expect(values.get('application/x-mywork-task-title')).toBe(`Rückruf\n${body.trim()}`);
    expect(values.get('text/plain')).toBe(values.get('application/x-mywork-task-title'));
    expect(transfer.effectAllowed).toBe('copyMove');
  });
});
