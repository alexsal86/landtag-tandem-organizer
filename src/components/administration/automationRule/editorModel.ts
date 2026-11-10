import type { ConditionGroup, WizardForm } from './types';
import { conditionTree } from './logic';
import { validateRuleEditor } from './ruleValidation';
import { evaluateAutomationTree } from '@/features/automation/conditions';
import { isCalendarSchedule, nextCalendarOccurrence } from '@/features/automation/calendarSchedule';

export { parseEditorSample } from './ruleValidation';
export function editorStepErrors(form: WizardForm): string[][] {
  const errors: string[][] = [[],[],[],[]];
  validateRuleEditor(form).filter(issue => issue.level === 'error').forEach(issue => errors[issue.step].push(issue.message));
  return errors;
}
export function editorFormSnapshot(form: WizardForm) {
  const { samplePayload: _sample, conditions: _legacyConditions, conditionLogic: _legacyLogic, ...persistent } = form;
  return JSON.stringify(persistent);
}
export function evaluateEditorSample(form: WizardForm, data: Record<string, unknown> | null) {
  if (!data) return null;
  const result = evaluateAutomationTree(data,conditionTree(form.conditionGroup),form.module);
  const leaves = result.evaluations.filter(entry => entry.type === 'rule');
  return { runs:result.matched,matched:leaves.filter(entry => entry.matched).length,total:leaves.length };
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
