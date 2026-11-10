/** Shared by the browser preview and the actual rule executor. No runtime dependencies. */
export type AutomationFieldType = 'string' | 'number' | 'date' | 'boolean' | 'enum' | 'unknown';
export interface AutomationFieldSpec { type: Exclude<AutomationFieldType, 'unknown'>; options?: string[] }
export interface AutomationCondition { field: string; operator: string; value: string }
export interface AutomationConditionGroup { all?: AutomationConditionNode[]; any?: AutomationConditionNode[] }
export type AutomationConditionNode = AutomationCondition | AutomationConditionGroup;
export const AUTOMATION_FIELD_SPECS: Record<string, Record<string, AutomationFieldSpec>> = {
  tasks: {
    status: { type: "enum", options: ["open", "in_progress", "done", "overdue"] },
    priority: { type: "enum", options: ["low", "medium", "high", "urgent"] },
    due_date: { type: "date" },
  },
  meetings: {
    status: { type: "enum", options: ["planned", "done", "cancelled"] },
    meeting_date: { type: "date" },
    preparation_status: { type: "enum", options: ["none", "draft", "ready"] },
  },
  decisions: {
    status: { type: "enum", options: ["draft", "accepted", "rejected"] },
    deadline: { type: "date" },
  },
  knowledge: {
    status: { type: "enum", options: ["draft", "published", "review"] },
    updated_at: { type: "date" },
  },
  casefiles: {
    status: { type: "enum", options: ["open", "in_review", "closed"] },
    priority: { type: "enum", options: ["low", "medium", "high", "critical"] },
    processing_status: { type: "enum", options: ["new", "processing", "blocked", "completed"] },
  },
  contacts: {
    status: { type: "enum", options: ["active", "inactive", "archived"] },
    category: { type: "string" },
    updated_at: { type: "date" },
  },
};

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/;
const berlinDate = new Intl.DateTimeFormat('en-CA', { timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit' });
function validCalendarDay(value: string): boolean {
  if (!DATE_ONLY.test(value)) return false;
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0,10) === value;
}
export function isAutomationDate(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  if (DATE_ONLY.test(value)) return validCalendarDay(value);
  return TIMESTAMP.test(value) && validCalendarDay(value.slice(0,10)) && Number.isFinite(Date.parse(value));
}
function berlinDay(value: string): string {
  if (DATE_ONLY.test(value)) return value;
  const parts = berlinDate.formatToParts(new Date(value));
  const part = (key: string) => parts.find(item => item.type === key)?.value ?? '';
  return `${part('year').padStart(4,'0')}-${part('month')}-${part('day')}`;
}
function berlinMidnight(value: string): number {
  const base = Date.parse(`${value}T00:00:00Z`);
  const formatter = new Intl.DateTimeFormat('en-GB', { timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23' });
  let candidate = base;
  for (let i = 0; i < 3; i++) {
    const parts = formatter.formatToParts(new Date(candidate));
    const get = (key: string) => parts.find(item => item.type === key)?.value ?? '00';
    const represented = Date.parse(`${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}Z`);
    candidate = base - (represented - candidate);
  }
  return candidate;
}
function datePair(actual: unknown, expected: string): [number | string, number | string] | null {
  if (!isAutomationDate(actual) || !isAutomationDate(expected)) return null;
  // A date-only target addresses a Berlin calendar day, including DST boundaries.
  if (DATE_ONLY.test(expected)) return [berlinDay(actual),expected];
  return [DATE_ONLY.test(actual) ? berlinMidnight(actual) : Date.parse(actual),Date.parse(expected)];
}
export function automationFieldType(module: string | undefined, field: string): AutomationFieldType {
  const aliases: Record<string,string> = { appointments:'meetings',task_decisions:'decisions',cases:'casefiles',case_files:'casefiles',knowledge_documents:'knowledge' };
  const domain = module ? aliases[module] ?? module : '';
  return AUTOMATION_FIELD_SPECS[domain]?.[field]?.type ?? 'unknown';
}
export function evaluateAutomationValue(operator: string, expected: string, actual: unknown, fieldType: AutomationFieldType): boolean {
  const sample = actual == null ? '' : String(actual);
  if (operator === 'contains') return sample.includes(expected);
  if (fieldType === 'date') {
    const pair = datePair(actual,expected);
    if (!pair) return false;
    const [left,right] = pair;
    if (operator === 'equals') return left === right;
    if (operator === 'not_equals') return left !== right;
    if (operator === 'gt') return left > right;
    if (operator === 'lt') return left < right;
    return false;
  }
  if (operator === 'equals') return sample === expected;
  if (operator === 'not_equals') return sample !== expected;
  if (operator !== 'gt' && operator !== 'lt') return false;
  if (fieldType !== 'number' && fieldType !== 'unknown') return false;
  if (fieldType === 'number' && (!sample.trim() || !expected.trim())) return false;
  const left = Number(actual ?? 0), right = Number(expected);
  if (!Number.isFinite(left) || !Number.isFinite(right)) return false;
  return operator === 'gt' ? left > right : left < right;
}
export function evaluateAutomationTree(source: Record<string,unknown>, condition: AutomationConditionNode, module?: string, path = 'root'): { matched: boolean; evaluations: Array<Record<string,unknown>> } {
  if ('field' in condition && typeof condition.field === 'string') {
    const matched = evaluateAutomationValue(condition.operator,condition.value,source[condition.field],automationFieldType(module,condition.field));
    return { matched,evaluations:[{ type:'rule',path,field:condition.field,operator:condition.operator,expected:condition.value,actual:source[condition.field] ?? null,matched }] };
  }
  const group = condition as AutomationConditionGroup;
  const mode: 'all' | 'any' = group.any?.length ? 'any' : 'all';
  const children = group[mode] ?? [];
  const results = children.map((child,index) => evaluateAutomationTree(source,child,module,`${path}.${mode}[${index}]`));
  const matched = !children.length || (mode === 'any' ? results.some(result => result.matched) : results.every(result => result.matched));
  return { matched,evaluations:[{ type:'group',path,combinator:mode.toUpperCase(),matched,child_count:children.length },...results.flatMap(result => result.evaluations)] };
}
