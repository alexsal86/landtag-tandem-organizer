export interface CalendarInviteRequest {
  appointmentId: string;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  location?: string;
  organizer: {
    name: string;
    email: string;
  };
  attendees?: Array<{
    name: string;
    email: string;
  }>;
}

export function generateUID(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2)}@lovable.app`;
}

export function formatDateToICS(date: string): string {
  return new Date(date).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

export function escapeICSValue(value: string | undefined | null): string {
  if (!value) return '';
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '');
}

export function validateInviteDates(startTime: string, endTime: string): string | null {
  const start = new Date(startTime);
  const end = new Date(endTime);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return 'Ungültiges Datumsformat. Erwartet wird ISO-8601.';
  }

  if (end <= start) {
    return 'Endzeit muss nach der Startzeit liegen.';
  }

  const hasStartTimezone = /([zZ]|[+-]\d{2}:\d{2})$/.test(startTime);
  const hasEndTimezone = /([zZ]|[+-]\d{2}:\d{2})$/.test(endTime);

  if (hasStartTimezone !== hasEndTimezone) {
    return 'Zeitzonen-Konflikt: Start- und Endzeit müssen konsistent angegeben werden.';
  }

  return null;
}

export function generateICS(request: CalendarInviteRequest): string {
  const uid = generateUID();
  const startTime = formatDateToICS(request.startTime);
  const endTime = formatDateToICS(request.endTime);
  const now = formatDateToICS(new Date().toISOString());

  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Lovable//Appointment Scheduler//DE',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${now}`,
    `DTSTART:${startTime}`,
    `DTEND:${endTime}`,
    `SUMMARY:${escapeICSValue(request.title)}`,
    `ORGANIZER;CN=${escapeICSValue(request.organizer.name)}:mailto:${request.organizer.email}`,
  ];

  if (request.description) {
    icsContent.push(`DESCRIPTION:${escapeICSValue(request.description)}`);
  }

  if (request.location) {
    icsContent.push(`LOCATION:${escapeICSValue(request.location)}`);
  }

  if (request.attendees && request.attendees.length > 0) {
    request.attendees.forEach((attendee) => {
      icsContent.push(`ATTENDEE;CN=${escapeICSValue(attendee.name)};RSVP=TRUE:mailto:${attendee.email}`);
    });
  }

  icsContent.push('STATUS:CONFIRMED', 'SEQUENCE:0', 'END:VEVENT', 'END:VCALENDAR');

  return icsContent.join('\r\n');
}
