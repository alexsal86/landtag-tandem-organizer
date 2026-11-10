import { annualDueDay } from '@/features/timetracking/annualTaskRules';
import { officeRoutineDeadline, parseRoutineSteps, routineStepKinds, type OfficeRoutineFields } from './officeRoutineTemplates';

export const ROUTINE_RELEASES = [
  { value: 'package_start', label: 'Beim Start des Pakets' },
  { value: 'scheduled', label: 'Erst am geplanten Tag' },
  { value: 'after_previous', label: 'Nach Abschluss des vorherigen Schritts' },
  { value: 'after_approval', label: 'Nach ausdrücklicher Freigabe' },
] as const;
export type RoutineRelease = typeof ROUTINE_RELEASES[number]['value'];
export interface RoutineStepSetting { release: RoutineRelease; assignee: string; approver: string }
export const defaultStepSetting = (): RoutineStepSetting => ({ release: 'package_start', assignee: '', approver: '' });
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function readStepSettings(value: string | undefined, count: number): RoutineStepSetting[] {
  if (!value) return Array.from({ length: count }, defaultStepSetting);
  const settings: unknown = JSON.parse(value);
  if (!Array.isArray(settings) || settings.length !== count) throw new Error('Die Einstellungen müssen zu allen Arbeitsschritten gehören.');
  return settings.map(setting => {
    if (!setting || typeof setting !== 'object' || !ROUTINE_RELEASES.some(item => item.value === setting.release)
      || typeof setting.assignee !== 'string' || (setting.assignee && !uuid.test(setting.assignee))
      || typeof setting.approver !== 'string' || (setting.approver && !uuid.test(setting.approver))) throw new Error('Ungültige Zuständigkeit oder Startbedingung.');
    if (setting.release === 'after_approval' && !setting.approver) throw new Error('Für eine Freigabe bitte eine entscheidende Person auswählen.');
    return setting as RoutineStepSetting;
  });
}
// Drafts may temporarily have an unselected approver; validation happens on save.
export function draftStepSettings(value: string | undefined, count: number): RoutineStepSetting[] {
  try {
    const parsed = value ? JSON.parse(value) : [];
    return Array.from({ length: count }, (_, index) => ({ ...defaultStepSetting(), ...(Array.isArray(parsed) ? parsed[index] : {}) }));
  } catch { return Array.from({ length: count }, defaultStepSetting); }
}
export function validateRoutineWorkflow(fields: OfficeRoutineFields & { routineStepSettings?: string }): string | null {
  try {
    const lines = (fields.routineSteps ?? '').split('\n').filter(line => line.trim());
    const settings = readStepSettings(fields.routineStepSettings, lines.length);
    const source = lines.map((line, index) => ({ ...parseRoutineSteps(line)[0], setting: settings[index] }));
    if (fields.routineStepSettings && source.some((step, index) => index > 0 && step.days_before > source[index - 1].days_before)) return 'Bitte die Schritte mit „Nach Zeitpunkt sortieren“ ordnen, damit die sichtbare Abfolge den Abhängigkeiten entspricht.';
    const ordered = [...source].sort((a, b) => b.days_before - a.days_before);
    if (ordered[0]?.setting.release === 'after_previous') return 'Der erste Schritt kann nicht auf einen vorherigen Schritt warten.';
    return null;
  } catch (error) { return error instanceof Error ? error.message : 'Ablauf ungültig.'; }
}
export function previewRoutine(fields: OfficeRoutineFields & { routineStepSettings?: string }, schedule: { month: string; day: string; month_end: string } | undefined, year: number) {
  if (!schedule) throw new Error('Bitte zuerst einen Starttermin wählen.');
  const start = annualDueDay({ due_month: Number(schedule.month), due_day: schedule.month_end === 'true' ? null : Number(schedule.day) }, year);
  const finish = officeRoutineDeadline({ routine_deadline_month: fields.routineDeadlineMonth ?? '', routine_deadline_day: fields.routineDeadlineDay ?? '' }, start);
  const lines = (fields.routineSteps ?? '').split('\n').filter(line => line.trim());
  const kinds = routineStepKinds(fields.routineStepKinds, lines.length);
  const settings = readStepSettings(fields.routineStepSettings, lines.length);
  const steps = lines.map((line, index) => {
    const step = parseRoutineSteps(line)[0];
    const date = new Date(`${finish}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() - step.days_before);
    const proposed = date.toISOString().slice(0, 10);
    return { ...step, kind: kinds[index], ...settings[index], due: proposed < start ? start : proposed, clamped: proposed < start };
  }).sort((a, b) => b.days_before - a.days_before);
  return { start, finish, steps };
}
