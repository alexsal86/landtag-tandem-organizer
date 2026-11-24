import { describe, expect, it } from 'vitest';
import { dedupeEventsByLatestLastModified, getSyncExternalErrorResponse, parseICS } from './sync-external-calendar.utils.ts';

const BERLIN_VTIMEZONE = `BEGIN:VTIMEZONE
TZID:Europe/Berlin
X-LIC-LOCATION:Europe/Berlin
BEGIN:DAYLIGHT
TZOFFSETFROM:+0100
TZOFFSETTO:+0200
TZNAME:CEST
DTSTART:19700329T020000
RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU
END:DAYLIGHT
BEGIN:STANDARD
TZOFFSETFROM:+0200
TZOFFSETTO:+0100
TZNAME:CET
DTSTART:19701025T030000
RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU
END:STANDARD
END:VTIMEZONE`;

const OUTLOOK_VTIMEZONE = `BEGIN:VTIMEZONE
TZID:W. Europe Standard Time
BEGIN:STANDARD
DTSTART:16011028T030000
TZOFFSETFROM:+0200
TZOFFSETTO:+0100
RRULE:FREQ=YEARLY;BYDAY=-1SU;BYMONTH=10
END:STANDARD
BEGIN:DAYLIGHT
DTSTART:16010325T020000
TZOFFSETFROM:+0100
TZOFFSETTO:+0200
RRULE:FREQ=YEARLY;BYDAY=-1SU;BYMONTH=3
END:DAYLIGHT
END:VTIMEZONE`;

const SYNC_START = new Date('2024-01-01T00:00:00Z');
const SYNC_END = new Date('2027-01-01T00:00:00Z');

const GOOGLE_FEED = `BEGIN:VCALENDAR
PRODID:-//Google Inc//Google Calendar 70.9054//EN
VERSION:2.0
CALSCALE:GREGORIAN
METHOD:PUBLISH
${BERLIN_VTIMEZONE}
BEGIN:VEVENT
DTSTART;TZID=Europe/Berlin:20250715T140000
DTEND;TZID=Europe/Berlin:20250715T150000
DTSTAMP:20250701T100000Z
UID:google-summer@google.com
CREATED:20250601T100000Z
DESCRIPTION:Bürgersprechstunde
LAST-MODIFIED:20250701T100000Z
LOCATION:Karlsruhe
SEQUENCE:0
STATUS:CONFIRMED
SUMMARY:Sommertermin
END:VEVENT
BEGIN:VEVENT
DTSTART:20260120T100000Z
DTEND:20260120T110000Z
UID:google-utc@google.com
SUMMARY:UTC-Termin
END:VEVENT
BEGIN:VEVENT
DTSTART;VALUE=DATE:20251224
DTEND;VALUE=DATE:20251226
UID:google-allday@google.com
SUMMARY:Weihnachtsferien
END:VEVENT
BEGIN:VEVENT
DTSTART;VALUE=DATE:20260101
UID:google-allday-open@google.com
SUMMARY:Neujahr
END:VEVENT
BEGIN:VEVENT
UID:google-out-of-range@google.com
SUMMARY:Zu alt
DTSTART:20200101T090000Z
DTEND:20200101T100000Z
END:VEVENT
END:VCALENDAR`;

const OUTLOOK_FEED = `BEGIN:VCALENDAR
PRODID:-//Microsoft Corporation//Outlook 16.0 MIMEDIR//EN
VERSION:2.0
METHOD:PUBLISH
${OUTLOOK_VTIMEZONE}
BEGIN:VEVENT
CLASS:PUBLIC
DTEND;TZID="W. Europe Standard Time":20260210T100000
DTSTART;TZID="W. Europe Standard Time":20260210T090000
DTSTAMP:20260101T000000Z
LAST-MODIFIED:20260101T000000Z
LOCATION:Berlin
SEQUENCE:0
SUMMARY;LANGUAGE=de-DE:Dienstgespräch mit einem sehr langen
  Betreff
UID:outlook-winter@example.org
END:VEVENT
BEGIN:VEVENT
DTSTART:20260301T090000
DTEND:20260301T100000
UID:outlook-floating@example.org
SUMMARY:Schwebender Termin
END:VEVENT
END:VCALENDAR`;

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

  it('verschiebt Google-Feeds mit Z und TZID nicht mehr', () => {
    const events = parseICS(GOOGLE_FEED, SYNC_START, SYNC_END, 100);
    const summer = events.find((event) => event.uid === 'google-summer@google.com');
    const utc = events.find((event) => event.uid === 'google-utc@google.com');

    // 14:00 Berliner Sommerzeit (CEST) = 12:00 UTC
    expect(summer?.startUtc).toBe('2025-07-15T12:00:00.000Z');
    expect(summer?.endUtc).toBe('2025-07-15T13:00:00.000Z');
    expect(summer?.allDay).toBe(false);
    // Z bleibt Z: keine Verschiebung um ein bis zwei Stunden
    expect(utc?.startUtc).toBe('2026-01-20T10:00:00.000Z');
    expect(utc?.endUtc).toBe('2026-01-20T11:00:00.000Z');
  });

  it('übernimmt ganztägige DATE-Werte als Kalendertage mit exklusivem DTEND', () => {
    const events = parseICS(GOOGLE_FEED, SYNC_START, SYNC_END, 100);
    const holidays = events.find((event) => event.uid === 'google-allday@google.com');
    const singleDay = events.find((event) => event.uid === 'google-allday-open@google.com');

    expect(holidays?.allDay).toBe(true);
    expect(holidays?.startUtc).toBe('2025-12-24T00:00:00.000Z');
    expect(holidays?.endUtc).toBe('2025-12-26T00:00:00.000Z');

    expect(singleDay?.allDay).toBe(true);
    expect(singleDay?.startUtc).toBe('2026-01-01T00:00:00.000Z');
    expect(singleDay?.endUtc).toBe('2026-01-02T00:00:00.000Z');
  });

  it('filtert Events außerhalb des Sync-Fensters anhand der aufgelösten Zeit', () => {
    const events = parseICS(GOOGLE_FEED, SYNC_START, SYNC_END, 100);
    expect(events.map((event) => event.uid)).not.toContain('google-out-of-range@google.com');
  });

  it('löst Outlook-TZIDs, gefaltete Zeilen und floating times auf', () => {
    const events = parseICS(OUTLOOK_FEED, SYNC_START, SYNC_END, 100);
    const winter = events.find((event) => event.uid === 'outlook-winter@example.org');
    const floating = events.find((event) => event.uid === 'outlook-floating@example.org');

    // 09:00 "W. Europe Standard Time" (CET) = 08:00 UTC
    expect(winter?.startUtc).toBe('2026-02-10T08:00:00.000Z');
    expect(winter?.endUtc).toBe('2026-02-10T09:00:00.000Z');
    expect(winter?.summary).toBe('Dienstgespräch mit einem sehr langen Betreff');
    expect(winter?.lastModifiedUtc).toBe('2026-01-01T00:00:00.000Z');

    // Floating time gilt als Berliner Wandzeit.
    expect(floating?.startUtc).toBe('2026-03-01T08:00:00.000Z');
  });

  it('parst DTSTART mit TZID auch ohne VTIMEZONE im Feed', () => {
    const ics = `BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:no-vtimezone\nSUMMARY:Ohne VTIMEZONE\nDTSTART;TZID=Europe/Berlin:20250715T140000\nDTEND;TZID=Europe/Berlin:20250715T150000\nEND:VEVENT\nEND:VCALENDAR`;
    const events = parseICS(ics, SYNC_START, SYNC_END, 100);
    expect(events[0].startUtc).toBe('2025-07-15T12:00:00.000Z');
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
