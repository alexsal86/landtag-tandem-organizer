import { describe, expect, it } from 'vitest';
import { buildExternalFeedErrorMessage, parseICSDate, parseICSForValidation } from './ics-validation.utils.ts';

describe('ics-validation utils', () => {
  it('parst YYYYMMDD und YYYYMMDDTHHMMSS Datumsformate', () => {
    const allDay = parseICSDate('20250131');
    const timed = parseICSDate('20250131T141500');

    expect(Number.isNaN(allDay.getTime())).toBe(false);
    expect(Number.isNaN(timed.getTime())).toBe(false);
    // Zeitzonenunabhängig: der Wert wird als UTC-Wandzeit abgebildet.
    expect(timed.getUTCHours()).toBe(14);
    expect(timed.getUTCMinutes()).toBe(15);
  });

  it('lässt ungültige Datumsformate als invalid Date durch, sodass Caller sie behandeln kann', () => {
    const invalid = parseICSDate('nicht-ein-datum');
    expect(Number.isNaN(invalid.getTime())).toBe(true);
  });

  it('filtert TZID-Termine anhand der aufgelösten Zeit statt der Wandzeit', () => {
    const ics = `BEGIN:VCALENDAR\nBEGIN:VTIMEZONE\nTZID:Europe/Berlin\nBEGIN:DAYLIGHT\nTZOFFSETFROM:+0100\nTZOFFSETTO:+0200\nDTSTART:19700329T020000\nRRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU\nEND:DAYLIGHT\nBEGIN:STANDARD\nTZOFFSETFROM:+0200\nTZOFFSETTO:+0100\nDTSTART:19701025T030000\nRRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU\nEND:STANDARD\nEND:VTIMEZONE\nBEGIN:VEVENT\nUID:tzid-1\nSUMMARY:TZID-Termin\nDTSTART;TZID=Europe/Berlin:20251231T230000\nDTEND;TZID=Europe/Berlin:20260101T000000\nEND:VEVENT\nEND:VCALENDAR`;

    // 23:00 Berliner Zeit am 31.12.2025 ist 22:00 UTC und liegt damit vor dem
    // Fensterbeginn um 00:00 UTC – nur die aufgelöste Zeit zählt.
    const outside = parseICSForValidation(ics, new Date('2026-01-01T00:00:00Z'), new Date('2026-02-01T00:00:00Z'));
    expect(outside).toHaveLength(0);

    const inside = parseICSForValidation(ics, new Date('2025-12-31T00:00:00Z'), new Date('2026-01-01T00:00:00Z'));
    expect(inside).toHaveLength(1);
    expect(inside[0].uid).toBe('tzid-1');
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
