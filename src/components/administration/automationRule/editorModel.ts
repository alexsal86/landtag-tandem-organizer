import type { ConditionGroup, WizardForm } from './types';
import { collectSemanticIssues, countConditions, evaluateCondition, validateConditionGroup } from './logic';
import { FIELD_SPEC_BY_MODULE } from './constants';
import { isCalendarSchedule, nextCalendarOccurrence, validateCalendarSchedule } from '@/features/automation/calendarSchedule';
import { validateAnnualRoutine } from '@/features/automation/annualRoutines';

export function parseEditorSample(value: string): { data: Record<string, unknown> | null; error: string | null } {
  if (!value.trim()) return { data: null, error: null };
  try {
    const data: unknown = JSON.parse(value);
    if (!data || typeof data !== 'object' || Array.isArray(data)) return { data: null, error: 'Der Beispieldatensatz muss ein JSON-Objekt sein, keine Liste und kein einzelner Wert.' };
    return { data: data as Record<string, unknown>, error: null };
  } catch { return { data: null, error: 'Ungültiges JSON. Bitte Klammern und Anführungszeichen prüfen.' }; }
}
export function editorStepErrors(form: WizardForm): string[][] {
  const errors: string[][] = [[], [], [], []];
  if (!form.name.trim()) errors[0].push('Bitte einen Regelnamen eingeben.');
  if (!form.module || !form.triggerType) errors[0].push('Fachbereich und Auslöser auswählen.');
  if (form.triggerType === 'record_changed' && (!form.triggerField || !form.triggerValue.trim())) errors[0].push('Für die Datenänderung Feld und Wert angeben.');
  const annual = form.actions.some(action => action.type === 'run_annual_routine');
  if (form.triggerType === 'schedule' || (form.triggerType === 'manual' && annual)) {
    if (!form.schedule) errors[0].push('Bitte einen Zeitplan angeben.');
    else if (isCalendarSchedule(form.schedule)) {
      const error = validateCalendarSchedule(form.schedule);
      if (error) errors[0].push(error);
    } else if (!Number.isFinite(Number(form.schedule.minutes_interval)) || Number(form.schedule.minutes_interval) < 60) errors[0].push('Das Minutenintervall muss mindestens 60 Minuten betragen.');
  }
  if ((countConditions(form.conditionGroup) > 0 || form.conditionGroup.groups.length > 0) && !validateConditionGroup(form.conditionGroup)) errors[1].push('Bitte alle Bedingungen und Untergruppen vollständig ausfüllen.');
  if (!form.actions.length) errors[2].push('Mindestens eine Aktion hinzufügen.');
  form.actions.forEach((action, index) => {
    const fail = (message: string) => errors[2].push(`Aktion ${index + 1}: ${message}`);
    if (['create_notification','send_push_notification','create_approval_request'].includes(action.type) && !action.targetUserId.trim()) fail('Eine empfangende oder freigebende Person auswählen.');
    if (['create_task','run_annual_routine'].includes(action.type) && !action.title.trim()) fail('Einen Titel eingeben.');
    if (action.type === 'update_record_status' && (!action.recordId.trim() || !action.status.trim())) fail('Datensatz-ID und Zielstatus angeben.');
    if (action.type === 'send_email_template' && (!action.emailTemplateId.trim() || !action.emailRecipient.trim())) fail('E-Mail-Vorlage und Empfänger angeben.');
    if (action.type === 'create_approval_request' && (!Number.isInteger(Number(action.approvalMinimumApprovers)) || Number(action.approvalMinimumApprovers) < 1)) fail('Mindestens eine freigebende Person vorsehen.');
  });
  const annualError = validateAnnualRoutine(form.triggerType, form.schedule, form.actions);
  if (annualError) errors[2].push(annualError);
  collectSemanticIssues(form, null).filter(issue => issue.level === 'error').forEach(issue => {
    const step = issue.message.includes('Webhook') ? 0 : /^(Feld |GT |LT )/.test(issue.message) ? 1 : 2;
    if (!errors.flat().includes(issue.message)) errors[step].push(issue.message);
  });
  const sample = parseEditorSample(form.samplePayload);
  if (sample.error) errors[3].push(sample.error);
  return errors;
}
export function editorFormSnapshot(form: WizardForm) {
  const { samplePayload: _sample, conditions: _legacyConditions, conditionLogic: _legacyLogic, ...persistent } = form;
  return JSON.stringify(persistent);
}
export function evaluateEditorSample(form: WizardForm, data: Record<string, unknown> | null) {
  if (!data) return null;
  const specs = FIELD_SPEC_BY_MODULE[form.module] ?? {};
  let matched = 0;
  const walk = (group: ConditionGroup): boolean => {
    const matches = group.conditions.map(condition => {
      const result = evaluateCondition(condition, specs[condition.field]?.type ?? 'string', data[condition.field]);
      if (result) matched++;
      return result;
    });
    const nested = group.groups.map(walk);
    const children = [...matches, ...nested];
    return !children.length || (group.logic === 'all' ? children.every(Boolean) : children.some(Boolean));
  };
  const runs = walk(form.conditionGroup);
  return { runs, matched, total: countConditions(form.conditionGroup) };
}
export function editorSample(form: WizardForm) {
  const data: Record<string, unknown> = {};
  if (form.triggerType === 'record_changed') data[form.triggerField] = form.triggerValue;
  const walk = (group: ConditionGroup) => {
    group.conditions.forEach(condition => { if (condition.field && condition.value) data[condition.field] = condition.value; });
    group.groups.forEach(walk);
  };
  walk(form.conditionGroup);
  return JSON.stringify(Object.keys(data).length ? data : { status: 'open', priority: 'high' }, null, 2);
}

export function editorPlanYear(form: Pick<WizardForm, 'triggerType' | 'schedule'>, now = new Date()) {
  const current = Number(new Intl.DateTimeFormat('en', { timeZone: 'Europe/Berlin', year: 'numeric' }).format(now));
  const next = form.triggerType === 'schedule' && form.schedule && isCalendarSchedule(form.schedule) ? nextCalendarOccurrence(form.schedule, now) : null;
  return next ? Number(new Intl.DateTimeFormat('en', { timeZone: 'Europe/Berlin', year: 'numeric' }).format(next)) : current;
}
