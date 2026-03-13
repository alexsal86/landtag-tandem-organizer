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

export function parseICSDate(dateStr: string): Date {
  if (/^\d{8}$/.test(dateStr)) {
    return new Date(
      parseInt(dateStr.substring(0, 4), 10),
      parseInt(dateStr.substring(4, 6), 10) - 1,
      parseInt(dateStr.substring(6, 8), 10),
    );
  }

  if (/^\d{8}T\d{6}/.test(dateStr)) {
    return new Date(
      parseInt(dateStr.substring(0, 4), 10),
      parseInt(dateStr.substring(4, 6), 10) - 1,
      parseInt(dateStr.substring(6, 8), 10),
      parseInt(dateStr.substring(9, 11), 10),
      parseInt(dateStr.substring(11, 13), 10),
      parseInt(dateStr.substring(13, 15), 10),
    );
  }

  return new Date(dateStr);
}

export function parseICSForValidation(icsContent: string, startDate: Date, endDate: Date): ICSEvent[] {
  const events: ICSEvent[] = [];
  const lines = icsContent.split('\n').map((line) => line.trim());
  let currentEvent: Partial<ICSEvent> | null = null;

  const unfoldedLines: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    while (i + 1 < lines.length && (lines[i + 1].startsWith(' ') || lines[i + 1].startsWith('\t'))) {
      line += lines[i + 1].substring(1);
      i++;
    }
    unfoldedLines.push(line);
  }

  for (const line of unfoldedLines) {
    if (line === 'BEGIN:VEVENT') {
      currentEvent = {};
    } else if (line === 'END:VEVENT' && currentEvent) {
      if (currentEvent.dtstart && currentEvent.summary) {
        const eventStart = parseICSDate(currentEvent.dtstart);
        const eventEnd = currentEvent.dtend
          ? parseICSDate(currentEvent.dtend)
          : new Date(eventStart.getTime() + 24 * 60 * 60 * 1000);

        if (eventStart <= endDate && eventEnd >= startDate) {
          events.push({
            uid: currentEvent.uid || `generated-${events.length}`,
            summary: currentEvent.summary,
            description: currentEvent.description || '',
            dtstart: currentEvent.dtstart,
            dtend: currentEvent.dtend || currentEvent.dtstart,
            last_modified: currentEvent.last_modified,
            location: currentEvent.location || '',
            organizer: currentEvent.organizer || '',
            status: currentEvent.status || 'confirmed',
            rrule: currentEvent.rrule,
          });
        }
      }
      currentEvent = null;
    } else if (currentEvent) {
      const [key, ...valueParts] = line.split(':');
      const value = valueParts.join(':');

      switch (key) {
        case 'UID':
          currentEvent.uid = value;
          break;
        case 'SUMMARY':
          currentEvent.summary = value;
          break;
        case 'DESCRIPTION':
          currentEvent.description = value;
          break;
        case 'DTSTART':
        case 'DTSTART;VALUE=DATE':
          currentEvent.dtstart = value;
          break;
        case 'DTEND':
        case 'DTEND;VALUE=DATE':
          currentEvent.dtend = value;
          break;
        case 'LAST-MODIFIED':
          currentEvent.last_modified = value;
          break;
        case 'LOCATION':
          currentEvent.location = value;
          break;
        case 'ORGANIZER':
          currentEvent.organizer = value;
          break;
        case 'STATUS':
          currentEvent.status = value.toLowerCase();
          break;
        case 'RRULE':
          currentEvent.rrule = value;
          break;
      }
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
