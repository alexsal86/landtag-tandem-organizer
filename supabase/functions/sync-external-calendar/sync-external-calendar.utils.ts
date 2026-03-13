export interface ICSEvent {
  uid: string;
  summary: string;
  description?: string;
  dtstart: string;
  dtend?: string;
  location?: string;
  allDay?: boolean;
  rrule?: string;
  lastModified?: string;
}

export function parseICSDate(dateStr: string): Date {
  if (dateStr.includes('T')) {
    const year = parseInt(dateStr.substring(0, 4), 10);
    const month = parseInt(dateStr.substring(4, 6), 10) - 1;
    const day = parseInt(dateStr.substring(6, 8), 10);
    const hour = parseInt(dateStr.substring(9, 11), 10) || 0;
    const minute = parseInt(dateStr.substring(11, 13), 10) || 0;
    const second = parseInt(dateStr.substring(13, 15), 10) || 0;

    return new Date(year, month, day, hour, minute, second);
  }

  const year = parseInt(dateStr.substring(0, 4), 10);
  const month = parseInt(dateStr.substring(4, 6), 10) - 1;
  const day = parseInt(dateStr.substring(6, 8), 10);

  return new Date(year, month, day);
}

export function parseICS(icsContent: string, startDate: Date, endDate: Date, maxEvents: number): ICSEvent[] {
  const events: ICSEvent[] = [];
  const lines = icsContent.split(/\r?\n/);
  let currentEvent: Partial<ICSEvent> | null = null;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();

    while (i + 1 < lines.length && (lines[i + 1].startsWith(' ') || lines[i + 1].startsWith('\t'))) {
      i++;
      line += lines[i].trim();
    }

    if (line === 'BEGIN:VEVENT') {
      currentEvent = {};
    } else if (line === 'END:VEVENT' && currentEvent) {
      if (currentEvent.uid && currentEvent.summary && currentEvent.dtstart) {
        const eventStart = parseICSDate(currentEvent.dtstart);
        const eventEnd = currentEvent.dtend
          ? parseICSDate(currentEvent.dtend)
          : new Date(eventStart.getTime() + 24 * 60 * 60 * 1000);

        if (eventStart <= endDate && eventEnd >= startDate) {
          events.push(currentEvent as ICSEvent);
        }
      }
      currentEvent = null;

      if (events.length >= maxEvents) {
        break;
      }
    } else if (currentEvent) {
      if (line.startsWith('UID:')) {
        currentEvent.uid = line.substring(4);
      } else if (line.startsWith('SUMMARY:')) {
        currentEvent.summary = line.substring(8);
      } else if (line.startsWith('DESCRIPTION:')) {
        currentEvent.description = line.substring(12);
      } else if (line.startsWith('DTSTART')) {
        const value = line.split(':')[1];
        currentEvent.dtstart = value;
        currentEvent.allDay = !value.includes('T');
      } else if (line.startsWith('DTEND')) {
        currentEvent.dtend = line.split(':')[1];
      } else if (line.startsWith('LOCATION:')) {
        currentEvent.location = line.substring(9);
      } else if (line.startsWith('RRULE:')) {
        currentEvent.rrule = line.substring(6);
      } else if (line.startsWith('LAST-MODIFIED:')) {
        currentEvent.lastModified = line.substring(14);
      }
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
