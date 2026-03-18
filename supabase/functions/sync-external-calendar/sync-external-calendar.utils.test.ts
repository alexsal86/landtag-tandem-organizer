import { describe, expect, it } from 'vitest';
import { dedupeEventsByLatestLastModified, getSyncExternalErrorResponse, parseICS } from './sync-external-calendar.utils.ts';

describe('sync-external-calendar utils', () => {
  it('parst RRULE Events im Sync-Bereich (Wiederholungssynchronisation)', () => {
    const ics = `BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:repeat-1\nSUMMARY:Weekly Sync\nDTSTART:20250101T090000\nDTEND:20250101T100000\nRRULE:FREQ=WEEKLY;BYDAY=MO\nLAST-MODIFIED:20250101T080000\nEND:VEVENT\nEND:VCALENDAR`;

    const events = parseICS(ics, new Date('2024-01-01T00:00:00Z'), new Date('2026-01-01T00:00:00Z'), 100);

    expect(events).toHaveLength(1);
    expect(events[0].rrule).toBe('FREQ=WEEKLY;BYDAY=MO');
  });

  it('respektiert Max-Events-Limit', () => {
    const ics = `BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:a\nSUMMARY:A\nDTSTART:20250101T090000\nEND:VEVENT\nBEGIN:VEVENT\nUID:b\nSUMMARY:B\nDTSTART:20250102T090000\nEND:VEVENT\nEND:VCALENDAR`;

    const events = parseICS(ics, new Date('2024-01-01T00:00:00Z'), new Date('2026-01-01T00:00:00Z'), 1);
    expect(events).toHaveLength(1);
  });

  it('entfernt Duplikate und priorisiert jüngstes last_modified', () => {
    const deduped = dedupeEventsByLatestLastModified([
      { external_uid: 'dupe-1', last_modified: '2025-01-01T09:00:00.000Z', marker: 'old' },
      { external_uid: 'dupe-1', last_modified: '2025-01-01T10:00:00.000Z', marker: 'new' },
      { external_uid: 'unique-1', last_modified: '2025-01-01T11:00:00.000Z', marker: 'unique' },
    ]);

    expect(deduped).toHaveLength(2);
    expect(deduped.find((item: any) => item.external_uid === 'dupe-1')?.marker).toBe('new');
  });

  it('liefert externe Fehlerantworten für Timeout und invalid feed', () => {
    const timeoutError = new DOMException('Timeout reached', 'AbortError');
    const invalidFeed = new Error('invalid feed payload');

    const timeout = getSyncExternalErrorResponse(timeoutError);
    const invalid = getSyncExternalErrorResponse(invalidFeed);

    expect(timeout.status).toBe(504);
    expect(timeout.message).toContain('Timeout');
    expect(invalid.status).toBe(502);
    expect(invalid.message).toContain('ungültig');
  });
});
