import { createContext, useContext } from 'react';
import type { RuleIssue } from './ruleValidation';

export const RuleValidationContext = createContext<RuleIssue[]>([]);
const issueId = (field: string) => `rule-error-${field.replace(/[^a-zA-Z0-9_-]/g,'-')}`;
export function ruleFieldAttributes(issues: RuleIssue[],name: string,describedBy?: string) {
  const matches = issues.filter(issue => issue.field === name);
  return { 'data-rule-field':name,'aria-invalid':matches.some(issue => issue.level === 'error') || undefined,
    'aria-describedby':[describedBy,matches.length ? issueId(name) : undefined].filter(Boolean).join(' ') || undefined };
}
export function useRuleValidation() {
  const issues = useContext(RuleValidationContext);
  return { issues,field:(name: string,describedBy?: string) => ruleFieldAttributes(issues,name,describedBy) };
}
export function FieldIssue({ name }: { name: string }) {
  const { issues } = useRuleValidation();
  const matches = issues.filter(issue => issue.field === name);
  if (!matches.length) return null;
  return <p id={issueId(name)} className="mt-1 text-xs">{matches.map(issue => <span key={issue.message} className={`block ${issue.level === 'error' ? 'text-destructive' : 'text-amber-700 dark:text-amber-300'}`}>{issue.message}</span>)}</p>;
}
