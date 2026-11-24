import {
  allDayEndDate,
  createIcsDateTimeParser,
  parseIcsContentLines,
  parseIcsDateValue,
  parseIcsProperty,
} from '../_shared/icsTime.ts';

export interface ICSEvent {
  uid: string;
  summary: string;
  description: string;
  dtstart: string;
  dtend: string;
  last_modified?: string;
  location?: string;
  organizer?: string;
  status?: string;
  rrule?: string;
}

/**
 * Wandelt einen ICS-Zeitwert in ein Date um. Zeitzonenangaben (Z/TZID) kann nur
 * der Feed-Parser auflösen; hier gilt der Wert als UTC, damit die Validierung
 * unabhängig von der Zeitzone des Prozesses bleibt.
 */
export function parseICSDate(dateStr: string): Date {
  const parsed = parseIcsDateValue(dateStr);
  if (!parsed) return new Date(Number.NaN);

  return new Date(Date.UTC(
    parsed.parts.year,
    parsed.parts.month - 1,
    parsed.parts.day,
    parsed.parts.hour,
    parsed.parts.minute,
    parsed.parts.second,
  ));
}

export function parseICSForValidation(icsContent: string, startDate: Date, endDate: Date): ICSEvent[] {
  const parser = createIcsDateTimeParser(icsContent);
  const events: ICSEvent[] = [];
  let currentEvent: Partial<ICSEvent> | null = null;
  let startValue = '';
  let startParams: Record<string, string> = {};
  let endValue = '';
  let endParams: Record<string, string> = {};

  const flush = () => {
    const event = currentEvent;
    const startRaw = startValue;
    const endRaw = endValue;
    currentEvent = null;
    startValue = '';
    startParams = {};
    endValue = '';
    endParams = {};
    if (!event || !startRaw || !event.summary) return;

    const start = parser.resolveDateTime(startRaw, startParams);
    if (!start) return;

    const end = endRaw ? parser.resolveDateTime(endRaw, endParams) : null;
    const resolvedEnd = start.dateOnly
      ? allDayEndDate(start.date, end?.date ?? null)
      : end?.date && end.date.getTime() > start.date.getTime()
        ? end.date
        : new Date(start.date.getTime() + 60 * 60 * 1000);

    if (start.date > endDate || resolvedEnd < startDate) return;

    events.push({
      uid: event.uid || `generated-${events.length}`,
      summary: event.summary,
      description: event.description || '',
      dtstart: startRaw,
      dtend: endRaw || startRaw,
      last_modified: event.last_modified,
      location: event.location || '',
      organizer: event.organizer || '',
      status: event.status || 'confirmed',
      rrule: event.rrule,
    });
  };

  for (const line of parseIcsContentLines(icsContent)) {
    const property = parseIcsProperty(line);
    if (!property) continue;

    const component = property.value.trim().toUpperCase();
    if (property.name === 'BEGIN' && component === 'VEVENT') {
      currentEvent = {};
      startValue = '';
      startParams = {};
      endValue = '';
      endParams = {};
      continue;
    }

    if (property.name === 'END' && component === 'VEVENT') {
      flush();
      continue;
    }

    if (!currentEvent) continue;

    switch (property.name) {
      case 'UID':
        currentEvent.uid = property.value.trim();
        break;
      case 'SUMMARY':
        currentEvent.summary = property.value;
        break;
      case 'DESCRIPTION':
        currentEvent.description = property.value;
        break;
      case 'DTSTART':
        startValue = property.value;
        startParams = property.params;
        break;
      case 'DTEND':
        endValue = property.value;
        endParams = property.params;
        break;
      case 'LAST-MODIFIED':
        currentEvent.last_modified = property.value;
        break;
      case 'LOCATION':
        currentEvent.location = property.value;
        break;
      case 'ORGANIZER':
        currentEvent.organizer = property.value;
        break;
      case 'STATUS':
        currentEvent.status = property.value.toLowerCase();
        break;
      case 'RRULE':
        currentEvent.rrule = property.value;
        break;
    }
  }

  return events;
}

export function buildExternalFeedErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === 'AbortError' || /timeout/i.test(error.message)) {
      return 'External ICS feed timeout. Bitte später erneut versuchen.';
    }
    if (/invalid feed|invalid ics|malformed/i.test(error.message)) {
      return 'External ICS feed ist ungültig oder beschädigt.';
    }
  }

  return 'External ICS feed konnte nicht verarbeitet werden.';
}
