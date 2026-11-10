import { officeRoutineDeadline } from './officeRoutineTemplates';
import type { AutomationRuleRecordView } from '@/components/administration/automationShared';
import { annualRoutineAction, routineMonth } from './annualRoutines';
import { annualDueDay, annualTaskStatus } from '@/features/timetracking/annualTaskRules';

export type RoutineFilter = 'all' | 'open' | 'done';
export interface RoutineRecord {
  due_month: number; due_day: number | null; automation_rule_id: string | null;
  completion?: { completed_at: string | null; linked_task_id: string | null };
}
export function berlinCalendar(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const part = (type: string) => Number(parts.find(p => p.type === type)?.value);
  return { year: part('year'), month: part('month'), day: part('day') };
}
export function presentAnnualRoutines(rules: AutomationRuleRecordView[], records: RoutineRecord[], now = new Date()) {
  const today = berlinCalendar(now);
  const localToday = new Date(today.year, today.month - 1, today.day, 12);
  const byRule = new Map(records.map(record => [record.automation_rule_id, record]));
  return rules.filter(rule => annualRoutineAction(rule)).map(rule => {
    const record = byRule.get(rule.id);
    const month = routineMonth(rule);
    const deadline = record ?? { due_month: month ?? 0, due_day: rule.trigger_config.month_end === 'true' ? null : Number(rule.trigger_config.day) };
    let due: string | null = null;
    let start: string | null = null;
    let status: ReturnType<typeof annualTaskStatus> = record?.completion?.completed_at ? 'completed' : 'upcoming';
    try {
      start = annualDueDay(deadline, today.year);
      due = officeRoutineDeadline(annualRoutineAction(rule)?.payload,start);
      const [year,month,day]=due.split('-').map(Number);
      status = annualTaskStatus({due_month:month,due_day:day},year,record?.completion?.completed_at,localToday);
    } catch { /* An invalid schedule stays visible and editable. */ }
    const days = due ? Math.round((Date.parse(`${due}T12:00:00Z`) - Date.UTC(today.year, today.month - 1, today.day, 12)) / 86_400_000) : null;
    return { rule, month, start, due, days, status, linkedTask: record?.completion?.linked_task_id, system: Boolean(annualRoutineAction(rule)?.payload?.system_function) };
  }).sort((a,b) => (a.month ?? 13) - (b.month ?? 13) || (a.due ?? '').localeCompare(b.due ?? '') || a.rule.name.localeCompare(b.rule.name, 'de'));
}
export type PresentedRoutine = ReturnType<typeof presentAnnualRoutines>[number];
export function matchesRoutineFilter(status: PresentedRoutine['status'], filter: RoutineFilter) {
  return filter === 'all' || (filter === 'done' ? status === 'completed' : status !== 'completed');
}
