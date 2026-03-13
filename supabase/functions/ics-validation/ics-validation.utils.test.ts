import { describe, expect, it } from 'vitest';
import { buildExternalFeedErrorMessage, parseICSDate, parseICSForValidation } from './ics-validation.utils';

describe('ics-validation utils', () => {
  it('parst YYYYMMDD und YYYYMMDDTHHMMSS Datumsformate', () => {
    const allDay = parseICSDate('20250131');
    const timed = parseICSDate('20250131T141500');

    expect(Number.isNaN(allDay.getTime())).toBe(false);
    expect(Number.isNaN(timed.getTime())).toBe(false);
    expect(timed.getHours()).toBe(14);
    expect(timed.getMinutes()).toBe(15);
  });

  it('lässt ungültige Datumsformate als invalid Date durch, sodass Caller sie behandeln kann', () => {
    const invalid = parseICSDate('nicht-ein-datum');
    expect(Number.isNaN(invalid.getTime())).toBe(true);
  });

  it('filtert nur Events im Bereich und erstellt Fallback-UID bei Duplikat-/UID-Lücken', () => {
    const ics = `BEGIN:VCALENDAR\nBEGIN:VEVENT\nSUMMARY:Ohne UID\nDTSTART:20250101T090000\nDTEND:20250101T100000\nEND:VEVENT\nBEGIN:VEVENT\nUID:event-1\nSUMMARY:Außerhalb\nDTSTART:20350101T090000\nDTEND:20350101T100000\nEND:VEVENT\nEND:VCALENDAR`;

    const events = parseICSForValidation(ics, new Date('2024-01-01T00:00:00Z'), new Date('2026-01-01T00:00:00Z'));

    expect(events).toHaveLength(1);
    expect(events[0].uid).toBe('generated-0');
    expect(events[0].summary).toBe('Ohne UID');
  });

  it('liefert robuste Fehlermeldungen für Timeout und invalid feed', () => {
    const timeoutError = new DOMException('The operation timed out', 'AbortError');
    const invalidFeedError = new Error('invalid feed response');

    expect(buildExternalFeedErrorMessage(timeoutError)).toContain('timeout');
    expect(buildExternalFeedErrorMessage(invalidFeedError)).toContain('ungültig');
    expect(buildExternalFeedErrorMessage(new Error('anderer fehler'))).toContain('konnte nicht verarbeitet');
  });
});
