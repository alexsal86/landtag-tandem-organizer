import { allDayEndDate, createIcsDateTimeParser, parseIcsContentLines, parseIcsProperty } from '../_shared/icsTime.ts';

export interface ICSEvent {
  uid: string;
  summary: string;
  description?: string;
  /** Rohwert aus dem Feed (Diagnose/raw_ics_data). */
  dtstart: string;
  dtend?: string;
  /** Mit Z/TZID/VTIMEZONE aufgelöster UTC-Zeitstempel. */
  startUtc: string;
  endUtc: string;
  location?: string;
  allDay?: boolean;
  rrule?: string;
  lastModified?: string;
  lastModifiedUtc?: string;
}

interface RawEvent {
  uid?: string;
  summary?: string;
  description?: string;
  location?: string;
  rrule?: string;
  startValue?: string;
  startParams?: Record<string, string>;
  endValue?: string;
  endParams?: Record<string, string>;
  lastModified?: string;
}

export function parseICS(icsContent: string, startDate: Date, endDate: Date, maxEvents: number): ICSEvent[] {
  const parser = createIcsDateTimeParser(icsContent);
  const events: ICSEvent[] = [];
  let current: RawEvent | null = null;

  const finishEvent = () => {
    const source = current;
    current = null;
    if (!source?.uid || !source.summary || !source.startValue) return;

    const start = parser.resolveDateTime(source.startValue, source.startParams);
    if (!start) return;

    const end = source.endValue ? parser.resolveDateTime(source.endValue, source.endParams) : null;
    // DTEND ist bei ganztägigen Terminen exklusiv; fehlt es, gilt ein Tag.
    // Ohne DTEND bei Uhrzeitterminen wird eine Stunde angenommen.
    const endDate_ = start.dateOnly
      ? allDayEndDate(start.date, end?.date ?? null)
      : end?.date && end.date.getTime() > start.date.getTime()
        ? end.date
        : new Date(start.date.getTime() + 60 * 60 * 1000);

    // Überlappung mit dem Sync-Fenster auf Basis der aufgelösten Zeitpunkte.
    if (start.date > endDate || endDate_ < startDate) return;

    events.push({
      uid: source.uid,
      summary: source.summary,
      description: source.description,
      dtstart: source.startValue,
      dtend: source.endValue,
      startUtc: start.date.toISOString(),
      endUtc: endDate_.toISOString(),
      location: source.location,
      allDay: start.dateOnly || source.startParams?.VALUE?.toUpperCase() === 'DATE',
      rrule: source.rrule,
      lastModified: source.lastModified,
      lastModifiedUtc: source.lastModified ? parser.resolveUtc(source.lastModified)?.toISOString() : undefined,
    });
  };

  for (const line of parseIcsContentLines(icsContent)) {
    const property = parseIcsProperty(line);
    if (!property) continue;

    const component = property.value.trim().toUpperCase();
    if (property.name === 'BEGIN' && component === 'VEVENT') {
      current = {};
      continue;
    }

    if (property.name === 'END' && component === 'VEVENT') {
      finishEvent();
      if (events.length >= maxEvents) break;
      continue;
    }

    if (!current) continue;

    switch (property.name) {
      case 'UID':
        current.uid = property.value.trim();
        break;
      case 'SUMMARY':
        current.summary = property.value;
        break;
      case 'DESCRIPTION':
        current.description = property.value;
        break;
      case 'LOCATION':
        current.location = property.value;
        break;
      case 'RRULE':
        current.rrule = property.value;
        break;
      case 'LAST-MODIFIED':
        current.lastModified = property.value;
        break;
      case 'DTSTART':
        current.startValue = property.value;
        current.startParams = property.params;
        break;
      case 'DTEND':
        current.endValue = property.value;
        current.endParams = property.params;
        break;
    }
  }

  return events;
}

export function dedupeEventsByLatestLastModified<T extends { external_uid: string; last_modified?: string }>(events: T[]): T[] {
  const uniqueEventsMap = new Map<string, T>();
  events.forEach((event) => {
    const existingEvent = uniqueEventsMap.get(event.external_uid);
    if (!existingEvent || (event.last_modified && (!existingEvent.last_modified || event.last_modified > existingEvent.last_modified))) {
      uniqueEventsMap.set(event.external_uid, event);
    }
  });

  return Array.from(uniqueEventsMap.values());
}

export function getSyncExternalErrorResponse(error: unknown): { status: number; message: string } {
  if (error instanceof Error) {
    if (error.name === 'AbortError' || /timeout/i.test(error.message)) {
      return { status: 504, message: 'Timeout beim Abruf des externen Kalenders.' };
    }

    if (/invalid feed|invalid ics|malformed/i.test(error.message)) {
      return { status: 502, message: 'Externer Kalender-Feed ist ungültig.' };
    }
  }

  return { status: 500, message: 'Interner Fehler bei der Kalendersynchronisation.' };
}
