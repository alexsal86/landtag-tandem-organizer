import { format } from 'date-fns';

export interface SpecialDay {
  month: number;
  day: number;
  name: string;
  hint: string;
}

export const DEFAULT_SPECIAL_DAYS: SpecialDay[] = [
  { month: 1, day: 27, name: 'Tag des Gedenkens an die Opfer des Nationalsozialismus', hint: 'Ein Moment für Erinnerung, Verantwortung und demokratisches Miteinander.' },
  { month: 3, day: 8, name: 'Internationaler Frauentag', hint: 'Ein guter Anlass, Gleichstellung und Teilhabe aktiv mitzudenken.' },
  { month: 5, day: 8, name: 'Tag der Befreiung', hint: 'Ein Tag der historischen Verantwortung und des Einsatzes für Freiheit.' },
  { month: 5, day: 23, name: 'Tag des Grundgesetzes', hint: 'Ein guter Moment, den Wert unserer Verfassung sichtbar zu machen.' },
  { month: 9, day: 1, name: 'Antikriegstag', hint: 'Ein Impuls für Frieden, Verständigung und demokratische Konfliktlösung.' },
  { month: 10, day: 3, name: 'Tag der Deutschen Einheit', hint: 'Gemeinschaft, Zusammenhalt und demokratische Werte stehen im Mittelpunkt.' },
  { month: 11, day: 9, name: 'Schicksalstag 9. November', hint: 'Ein historischer Tag mit Mahnung und Hoffnung zugleich.' },
  { month: 12, day: 10, name: 'Tag der Menschenrechte', hint: 'Ein guter Anlass, die Bedeutung von Grund- und Menschenrechten zu betonen.' }
];

const normalizeDate = (date: Date): Date => {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
};

export const parseSpecialDaysSetting = (value: string | null | undefined): SpecialDay[] | null => {
  if (!value) return null;

  try {
    const parsedValue = JSON.parse(value);
    if (!Array.isArray(parsedValue)) {
      return null;
    }

    const validDays = parsedValue.filter((entry): entry is SpecialDay => {
      if (!entry || typeof entry !== 'object') return false;

      const month = Number((entry as { month?: unknown }).month);
      const day = Number((entry as { day?: unknown }).day);
      const name = (entry as { name?: unknown }).name;
      const hint = (entry as { hint?: unknown }).hint;

      return Number.isInteger(month)
        && month >= 1
        && month <= 12
        && Number.isInteger(day)
        && day >= 1
        && day <= 31
        && typeof name === 'string'
        && name.trim().length > 0
        && typeof hint === 'string'
        && hint.trim().length > 0;
    });

    return validDays.length > 0 ? validDays : null;
  } catch {
    return null;
  }
};

export const getSpecialDayHint = (
  baseDate: Date = new Date(),
  specialDays: SpecialDay[] = DEFAULT_SPECIAL_DAYS
): string | null => {
  const month = baseDate.getMonth() + 1;
  const day = baseDate.getDate();

  const today = specialDays.find((specialDay) => specialDay.month === month && specialDay.day === day);
  if (today) {
    return `🕯️ **Heute ist ${today.name}.** ${today.hint}`;
  }

  const normalizedBaseDate = normalizeDate(baseDate);

  const upcoming = specialDays
    .map((specialDay) => {
      const targetDate = new Date(baseDate.getFullYear(), specialDay.month - 1, specialDay.day);
      const normalizedTargetDate = normalizeDate(targetDate);

      if (normalizedTargetDate < normalizedBaseDate) {
        normalizedTargetDate.setFullYear(baseDate.getFullYear() + 1);
      }

      const msPerDay = 1000 * 60 * 60 * 24;
      const daysUntil = Math.round((normalizedTargetDate.getTime() - normalizedBaseDate.getTime()) / msPerDay);

      return {
        ...specialDay,
        daysUntil,
        targetDate: normalizedTargetDate
      };
    })
    .filter((specialDay) => specialDay.daysUntil > 0 && specialDay.daysUntil <= 7)
    .sort((a, b) => a.daysUntil - b.daysUntil)[0];

  if (!upcoming) {
    return null;
  }

  return `🕯️ **Hinweis:** In ${upcoming.daysUntil} Tag${upcoming.daysUntil === 1 ? '' : 'en'} ist ${upcoming.name} (${format(upcoming.targetDate, 'dd.MM.')}).`;
};
