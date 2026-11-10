import type { AutomationRuleRecordView } from '@/components/administration/automationShared';
import { ACTION_TYPES, FIELD_OPTIONS_BY_MODULE, MODULE_OPTIONS } from '@/components/administration/automationRule/constants';

export const RULE_FILTERS = [
  { value: 'all', label: 'Alle' }, { value: 'on', label: 'Aktiv' }, { value: 'off', label: 'Pausiert' },
  { value: 'schedule', label: 'Zeitgesteuert' }, { value: 'manual', label: 'Manuell' },
] as const;
export type RuleFilter = typeof RULE_FILTERS[number]['value'];
export const ruleModuleLabel = (module: string) => MODULE_OPTIONS.find(item => item.value === module)?.label ?? module;
export function matchesRule(rule: AutomationRuleRecordView, query: string, filter: RuleFilter) {
  const matchesFilter = filter === 'all' || (filter === 'on' ? rule.enabled : filter === 'off' ? !rule.enabled : rule.trigger_type === filter);
  const text = [rule.name, rule.description, ruleModuleLabel(rule.module)].join(' ').toLocaleLowerCase('de-DE');
  return matchesFilter && text.includes(query.trim().toLocaleLowerCase('de-DE'));
}
export const ruleTriggerLabel = (type: string) => ({ schedule: 'Zeitgesteuert', manual: 'Manuell', record_changed: 'Bei Datenänderung', webhook: 'Webhook' })[type] ?? type;
export function ruleActionLabel(actions: ReadonlyArray<{ type: string; payload?: Record<string, string> }>) {
  if (actions.length === 1 && actions[0].type === 'run_annual_routine') return actions[0].payload?.system_function ? 'Systemaktion' : 'Aufgabenpaket';
  if (actions.length > 1) return `${actions.length} Aktionen`;
  return ACTION_TYPES.find(item => item.value === actions[0]?.type)?.label ?? 'Keine Aktion';
}
export function templateTriggerLabel(template: { module: string; triggerType: string; triggerField: string; triggerValue: string; schedule?: { schedule_kind: string; month_end?: string } }) {
  if (template.triggerType === 'schedule') {
    if (template.schedule?.schedule_kind === 'monthly') return template.schedule.month_end === 'true' ? 'Monatsende' : 'Monatstermin erreicht';
    if (template.schedule?.schedule_kind === 'quarterly') return 'Quartalstermin erreicht';
    return 'Termin erreicht';
  }
  if (template.triggerType === 'manual') return 'Manuell gestartet';
  if (template.triggerType === 'webhook') return 'Webhook empfangen';
  const field = FIELD_OPTIONS_BY_MODULE[template.module]?.find(item => item.value === template.triggerField)?.label ?? template.triggerField;
  const labels: Record<string, string> = { overdue: 'überfällig', urgent: 'dringend', critical: 'kritisch', accepted: 'angenommen', closed: 'abgeschlossen', published: 'veröffentlicht', draft: 'Entwurf', open: 'offen', high: 'hoch' };
  return `${field} wird „${labels[template.triggerValue] ?? template.triggerValue}“`;
}
