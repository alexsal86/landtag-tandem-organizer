import { describe, expect, it } from 'vitest';
import { escapeICSValue, formatDateToICS, generateICS, validateInviteDates } from './generate-calendar-invite.utils';

describe('generate-calendar-invite utils', () => {
  it('escaped problematische Zeichen korrekt für ICS', () => {
    expect(escapeICSValue('a,b;c\\d\nline')).toBe('a\\,b\\;c\\\\d\\nline');
  });

  it('formatiert Datum in UTC ICS Format', () => {
    const formatted = formatDateToICS('2025-02-01T10:30:45Z');
    expect(formatted).toBe('20250201T103045Z');
  });

  it('validiert ungültige Datumsformate und Zeitreihenfolge', () => {
    expect(validateInviteDates('kein-datum', '2025-01-01T10:00:00Z')).toContain('Ungültiges Datumsformat');
    expect(validateInviteDates('2025-01-01T10:00:00Z', '2025-01-01T09:00:00Z')).toContain('Endzeit');
  });

  it('erkennt Zeitzonen-Konflikte zwischen Start und Ende', () => {
    const conflict = validateInviteDates('2025-01-01T10:00:00Z', '2025-01-01T11:00:00');
    expect(conflict).toContain('Zeitzonen-Konflikt');
  });

  it('erzeugt ICS mit Organisator und Teilnehmern', () => {
    const ics = generateICS({
      appointmentId: 'appt-1',
      title: 'Jour fixe',
      startTime: '2025-01-01T10:00:00Z',
      endTime: '2025-01-01T11:00:00Z',
      organizer: { name: 'Max Mustermann', email: 'max@example.com' },
      attendees: [{ name: 'Erika', email: 'erika@example.com' }],
    });

    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('ORGANIZER;CN=Max Mustermann:mailto:max@example.com');
    expect(ics).toContain('ATTENDEE;CN=Erika;RSVP=TRUE:mailto:erika@example.com');
  });
});
