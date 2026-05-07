import type { ConditionItem, ConditionGroup, FieldType, WizardForm } from "./types";
import { FIELD_SPEC_BY_MODULE } from "./constants";

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

function isIsoDate(value: string): boolean {
  if (!value.trim()) return false;
  const parsed = Date.parse(value);
  return !Number.isNaN(parsed);
}

function toComparableNumber(fieldType: FieldType, value: string): number | null {
  if (fieldType === "number") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  if (fieldType === "date") {
    const ts = Date.parse(value);
    return Number.isNaN(ts) ? null : ts;
  }
  return null;
}

export function evaluateCondition(condition: ConditionItem, fieldType: FieldType, sampleValue: unknown): boolean {
  const sample = sampleValue == null ? "" : String(sampleValue);
  switch (condition.operator) {
    case "equals":
      return sample === condition.value;
    case "not_equals":
      return sample !== condition.value;
    case "contains":
      return sample.toLowerCase().includes(condition.value.toLowerCase());
    case "gt": {
      const left = toComparableNumber(fieldType, sample);
      const right = toComparableNumber(fieldType, condition.value);
      return left != null && right != null ? left > right : false;
    }
    case "lt": {
      const left = toComparableNumber(fieldType, sample);
      const right = toComparableNumber(fieldType, condition.value);
      return left != null && right != null ? left < right : false;
    }
    default:
      return false;
  }
}

function evaluateConditionGroup(group: ConditionGroup, module: string, sampleData: Record<string, unknown>): boolean {
  const specs = FIELD_SPEC_BY_MODULE[module] ?? {};
  const selfMatches = group.conditions.map((c) => {
    const fieldType = specs[c.field]?.type ?? "string";
    return evaluateCondition(c, fieldType, sampleData[c.field]);
  });
  const subMatches = group.groups.map((g) => evaluateConditionGroup(g, module, sampleData));
  const matches = [...selfMatches, ...subMatches];
  if (matches.length === 0) return false;
  return group.logic === "all" ? matches.every(Boolean) : matches.some(Boolean);
}

export function sanitizeTriggerValue(triggerType: string, value: string): string {
  const trimmed = value.trim();
  if (triggerType !== "webhook") return trimmed;
  return trimmed.replace(/[^a-zA-Z0-9._:-]/g, "").slice(0, 120);
}

export function collectSemanticIssues(
  form: WizardForm,
  parsedSample: Record<string, unknown> | null,
): Array<{ level: "error" | "warning"; message: string }> {
  const issues: Array<{ level: "error" | "warning"; message: string }> = [];
  const fieldSpecs = FIELD_SPEC_BY_MODULE[form.module] ?? {};

  if (form.triggerType === "record_changed" && !form.triggerValue.trim()) {
    issues.push({ level: "error", message: "Trigger-Wert ist bei Datenänderung verpflichtend." });
  }

  if (form.triggerType === "webhook" && sanitizeTriggerValue(form.triggerType, form.triggerValue) !== form.triggerValue.trim()) {
    issues.push({ level: "warning", message: "Webhook-Trigger-Werte werden auf sichere Zeichen (a-z, 0-9, Punkt, Doppelpunkt, Bindestrich, Unterstrich) reduziert." });
  }

  const validateGroup = (group: ConditionGroup) => {
    group.conditions.forEach((condition) => {
      const spec = fieldSpecs[condition.field];
      if (!spec) {
        issues.push({ level: "warning", message: `Unbekanntes Feld in Bedingungen: ${condition.field}.` });
        return;
      }
      if (spec.type === "date" && !isIsoDate(condition.value)) {
        issues.push({ level: "error", message: `Feld ${condition.field} erwartet ein Datum.` });
      }
      if (spec.type === "number" && !Number.isFinite(Number(condition.value))) {
        issues.push({ level: "error", message: `Feld ${condition.field} erwartet eine Zahl.` });
      }
      if (spec.type === "enum" && spec.options && !spec.options.includes(condition.value)) {
        issues.push({ level: "warning", message: `Wert "${condition.value}" liegt außerhalb der bekannten Werte für ${condition.field}.` });
      }
      if ((condition.operator === "gt" || condition.operator === "lt") && !["number", "date"].includes(spec.type)) {
        issues.push({ level: "error", message: `${condition.operator.toUpperCase()} ist nur für Zahl- oder Datumsfelder zulässig (${condition.field}).` });
      }
    });
    group.groups.forEach(validateGroup);
  };
  validateGroup(form.conditionGroup);

  form.actions.forEach((action, idx) => {
    if (action.type === "create_approval_request" && Number(action.approvalMinimumApprovers) < 2 && action.approvalPolicy === "four_eyes") {
      issues.push({ level: "error", message: `Aktion ${idx + 1}: 4-Augen-Freigabe benötigt mindestens 2 Approver.` });
    }
    if (action.type === "create_approval_request" && !action.targetUserId.trim()) {
      issues.push({ level: "error", message: `Aktion ${idx + 1}: Approval benötigt eine Zielperson.` });
    }
    if (action.type === "send_email_template" && !action.emailRecipient.includes("@")) {
      issues.push({ level: "error", message: `Aktion ${idx + 1}: Empfänger-E-Mail ist ungültig.` });
    }
  });

  if (parsedSample) {
    const matches = evaluateConditionGroup(form.conditionGroup, form.module, parsedSample);
    if (!matches) {
      issues.push({ level: "warning", message: "Aktuelle Testdaten matchen die Bedingungen nicht." });
    }
  }

  return issues;
}
