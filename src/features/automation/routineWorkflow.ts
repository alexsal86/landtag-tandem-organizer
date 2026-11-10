import { annualDueDay } from '@/features/timetracking/annualTaskRules';
import { officeRoutineDeadline, parseRoutineSteps, routineStepKinds, type OfficeRoutineFields } from './officeRoutineTemplates';

export const ROUTINE_RELEASES = [
  { value:'package_start',label:'Beim Start des Pakets' },{ value:'scheduled',label:'Erst am geplanten Tag' },
  { value:'after_previous',label:'Nach Abschluss des vorherigen Schritts' },{ value:'after_approval',label:'Nach ausdrücklicher Freigabe' },
] as const;
export const ROUTINE_DEADLINES = [
  { value:'finish',label:'Abschluss des Aufgabenpakets' },
  { value:'previous_planned',label:'Geplanter Termin des vorherigen Schritts' },
  { value:'next_planned',label:'Geplanter Termin des nächsten Schritts' },
  { value:'previous_completed',label:'Tatsächlicher Abschluss des vorherigen Schritts' },
  { value:'next_completed',label:'Tatsächlicher Abschluss des nächsten Schritts' },
] as const;
export type RoutineRelease = typeof ROUTINE_RELEASES[number]['value'];
export type RoutineDeadline = typeof ROUTINE_DEADLINES[number]['value'];
export interface RoutineStepSetting { release:RoutineRelease; assignee:string; approver:string; deadline_basis:RoutineDeadline; deadline_offset:number; use_deputy:boolean }
export const defaultStepSetting = (): RoutineStepSetting => ({ release:'package_start',assignee:'',approver:'',deadline_basis:'finish',deadline_offset:0,use_deputy:true });
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function readStepSettings(value: string | undefined,count: number): RoutineStepSetting[] {
  if (!value) return Array.from({ length:count },defaultStepSetting);
  const raw: unknown = JSON.parse(value);
  if (!Array.isArray(raw) || raw.length !== count) throw new Error('Die Einstellungen müssen zu allen Arbeitsschritten gehören.');
  return raw.map(item => {
    const setting = { ...defaultStepSetting(),...item };
    if (!item || typeof item !== 'object' || Array.isArray(item) || !ROUTINE_RELEASES.some(option => option.value === setting.release)
      || typeof setting.assignee !== 'string' || (setting.assignee && !uuid.test(setting.assignee))
      || typeof setting.approver !== 'string' || (setting.approver && !uuid.test(setting.approver))
      || !ROUTINE_DEADLINES.some(option => option.value === setting.deadline_basis) || typeof setting.use_deputy !== 'boolean'
      || !Number.isInteger(setting.deadline_offset) || Math.abs(setting.deadline_offset) > 365) throw new Error('Ungültige Zuständigkeit, Startbedingung oder relative Frist.');
    if (setting.release === 'after_approval' && !setting.approver) throw new Error('Für eine Freigabe bitte eine entscheidende Person auswählen.');
    if (setting.deadline_basis.endsWith('_completed') && setting.deadline_offset < 0) throw new Error('Vor einem tatsächlichen Abschluss ist kein Termin bekannt. Bitte 0 bis 365 Tage danach wählen.');
    return setting as RoutineStepSetting;
  });
}
export function draftStepSettings(value: string | undefined,count: number): RoutineStepSetting[] {
  try { const raw = value ? JSON.parse(value) : []; return Array.from({ length:count },(_,i) => ({ ...defaultStepSetting(),...(Array.isArray(raw) ? raw[i] : {}) })); }
  catch { return Array.from({ length:count },defaultStepSetting); }
}
export const hasRelativeDeadlines = (settings: RoutineStepSetting[]) => settings.some(setting => setting.deadline_basis !== 'finish');
export function validateStepGraph(settings: RoutineStepSetting[]): string | null {
  const n = settings.length, state = Array(n * 2).fill(0);
  for (let i = 0; i < n; i++) {
    if ((settings[i].deadline_basis.startsWith('previous_') || settings[i].release === 'after_previous') && i === 0) return 'Der erste Schritt hat keinen vorherigen Schritt.';
    if (settings[i].deadline_basis.startsWith('next_') && i === n - 1) return 'Der letzte Schritt hat keinen nächsten Schritt.';
  }
  const visit = (node: number): boolean => {
    if (state[node] === 1) return false;
    if (state[node] === 2) return true;
    state[node] = 1;
    const i = node % n, setting = settings[i];
    const deps: number[] = [];
    if (node < n && setting.deadline_basis !== 'finish') deps.push((setting.deadline_basis.startsWith('previous_') ? i - 1 : i + 1) + (setting.deadline_basis.endsWith('_completed') ? n : 0));
    if (node >= n) { deps.push(i); if (setting.release === 'after_previous') deps.push(n + i - 1); }
    if (!deps.every(visit)) return false;
    state[node] = 2; return true;
  };
  for (let i = 0; i < n * 2; i++) if (!visit(i)) return 'Die Fristen oder Startbedingungen bilden einen Kreis. Mindestens ein Schritt muss unabhängig planbar sein.';
  return null;
}
export function validateRoutineWorkflow(fields: OfficeRoutineFields): string | null {
  try {
    const lines = (fields.routineSteps ?? '').split('\n').filter(line => line.trim());
    const settings = readStepSettings(fields.routineStepSettings,lines.length);
    const source = lines.map((line,index) => ({ ...parseRoutineSteps(line)[0],setting:settings[index] }));
    if (!hasRelativeDeadlines(settings) && fields.routineStepSettings && source.some((step,index) => index > 0 && step.days_before > source[index - 1].days_before)) return 'Bitte die Schritte mit „Nach Zeitpunkt sortieren“ ordnen, damit die sichtbare Abfolge den Abhängigkeiten entspricht.';
    return validateStepGraph(settings);
  } catch (error) { return error instanceof Error ? error.message : 'Ablauf ungültig.'; }
}
export function resolveRoutineDates(start: string,finish: string,days: number[],settings: RoutineStepSetting[],completed: Array<string | null> = []) {
  const problem = validateStepGraph(settings); if (problem) throw new Error(problem);
  const memo: Array<{ due:string | null; clamped:boolean } | undefined> = [];
  const resolve = (i: number): { due:string | null; clamped:boolean } => {
    if (memo[i]) return memo[i]!;
    const setting = settings[i];
    let base: string | null = finish, offset = -days[i];
    if (setting.deadline_basis !== 'finish') {
      const ref = setting.deadline_basis.startsWith('previous_') ? i - 1 : i + 1;
      base = setting.deadline_basis.endsWith('_completed') ? completed[ref] ?? null : resolve(ref).due;
      offset = setting.deadline_offset;
    }
    if (!base) return memo[i] = { due:null,clamped:false };
    const date = new Date(`${base}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + offset);
    const due = date.toISOString().slice(0,10);
    return memo[i] = { due:due < start ? start : due,clamped:due < start };
  };
  return settings.map((_,i) => resolve(i));
}
export function previewRoutine(fields: OfficeRoutineFields,schedule: { month:string; day:string; month_end:string } | undefined,year: number) {
  if (!schedule) throw new Error('Bitte zuerst einen Starttermin wählen.');
  const start = annualDueDay({ due_month:Number(schedule.month),due_day:schedule.month_end === 'true' ? null : Number(schedule.day) },year);
  const finish = officeRoutineDeadline({ routine_deadline_month:fields.routineDeadlineMonth ?? '',routine_deadline_day:fields.routineDeadlineDay ?? '' },start);
  const lines = (fields.routineSteps ?? '').split('\n').filter(line => line.trim());
  const kinds = routineStepKinds(fields.routineStepKinds,lines.length), settings = readStepSettings(fields.routineStepSettings,lines.length);
  let steps = lines.map((line,i) => ({ ...parseRoutineSteps(line)[0],kind:kinds[i],...settings[i] }));
  if (!hasRelativeDeadlines(settings)) steps = steps.sort((a,b) => b.days_before - a.days_before);
  const resolved = resolveRoutineDates(start,finish,steps.map(step => step.days_before),steps);
  return { start,finish,steps:steps.map((step,i) => ({ ...step,...resolved[i] })) };
}
