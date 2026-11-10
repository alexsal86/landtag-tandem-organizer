import { validateRuleEditor } from "./ruleValidation";
import { evaluateAutomationTree, evaluateAutomationValue, type AutomationConditionGroup } from "@/features/automation/conditions";
import type { ConditionItem, ConditionGroup, FieldType, WizardForm } from "./types";

/** Recursively validate that all conditions in a group have non-empty values */
export function validateConditionGroup(group: ConditionGroup): boolean {
  const hasItems = group.conditions.length > 0 || group.groups.length > 0;
  if (!hasItems) return false;
  const conditionsValid = group.conditions.every((c) => c.value.trim().length > 0);
  const groupsValid = group.groups.every((g) => validateConditionGroup(g));
  return conditionsValid && groupsValid;
}

/** Count total conditions in a group tree */
export function countConditions(group: ConditionGroup): number {
  return group.conditions.length + group.groups.reduce((sum, g) => sum + countConditions(g), 0);
}

export function conditionTree(group: ConditionGroup): AutomationConditionGroup {
  const children = [...group.conditions,...group.groups.map(conditionTree)];
  return group.logic === "any" ? { any:children } : { all:children };
}
export function evaluateCondition(condition: ConditionItem, fieldType: FieldType, sampleValue: unknown): boolean {
  return evaluateAutomationValue(condition.operator,condition.value,sampleValue,fieldType);
}
export function evaluateConditionGroup(group: ConditionGroup, module: string, sampleData: Record<string,unknown>): boolean {
  return evaluateAutomationTree(sampleData,conditionTree(group),module).matched;
}

export function sanitizeTriggerValue(triggerType: string, value: string): string {
  const trimmed = value.trim();
  if (triggerType !== "webhook") return trimmed;
  return trimmed.replace(/[^a-zA-Z0-9._:-]/g, "").slice(0, 120);
}

export function collectSemanticIssues(form: WizardForm,parsedSample: Record<string,unknown> | null): Array<{ level: "error" | "warning"; message: string }> {
  const issues = validateRuleEditor(form).filter(issue => issue.field !== "samplePayload").map(({ level,message }) => ({ level,message }));
  if (parsedSample && !evaluateConditionGroup(form.conditionGroup,form.module,parsedSample)) issues.push({ level:"warning",message:"Die aktuellen Beispieldaten erfüllen die Bedingungen nicht." });
  return issues;
}
