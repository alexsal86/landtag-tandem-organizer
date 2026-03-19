import type { Json, Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type AutomationRuleRecord = Pick<
  Tables<"automation_rules">,
  "id" | "name" | "description" | "module" | "trigger_type" | "trigger_config" | "conditions" | "actions" | "enabled" | "updated_at"
>;

export type AutomationRunRecord = Pick<
  Tables<"automation_rule_runs">,
  "id" | "rule_id" | "status" | "dry_run" | "trigger_source" | "started_at" | "finished_at" | "error_message" | "input_payload" | "result_payload"
>;

export type AutomationRunStepRecord = Pick<
  Tables<"automation_rule_run_steps">,
  "id" | "run_id" | "step_order" | "step_type" | "status" | "result_payload" | "error_message"
>;

export type AutomationRuleActionPayload = {
  type: string;
  payload?: Record<string, string>;
};

export type AutomationRuleCondition = {
  field: string;
  operator: string;
  value: string;
};

export type AutomationRuleConditionsPayload = {
  all?: AutomationRuleCondition[];
  any?: AutomationRuleCondition[];
};

export type AutomationRuleRecordView = Omit<AutomationRuleRecord, "trigger_config" | "conditions" | "actions"> & {
  trigger_type: "record_changed" | "schedule" | "manual" | "webhook";
  trigger_config: Record<string, string>;
  conditions: AutomationRuleConditionsPayload;
  actions: AutomationRuleActionPayload[];
};

export type AutomationRunRecordView = Omit<AutomationRunRecord, "input_payload" | "result_payload"> & {
  input_payload?: Record<string, unknown> | null;
  result_payload?: Record<string, unknown> | null;
};

export type AutomationRunStepRecordView = Omit<AutomationRunStepRecord, "result_payload"> & {
  result_payload: Record<string, unknown> | null;
};

export function toAutomationRuleRecordView(row: AutomationRuleRecord): AutomationRuleRecordView {
  return {
    ...row,
    trigger_type: row.trigger_type as AutomationRuleRecordView["trigger_type"],
    trigger_config: isStringRecord(row.trigger_config) ? row.trigger_config : {},
    conditions: isConditionsPayload(row.conditions) ? row.conditions : {},
    actions: Array.isArray(row.actions) ? (row.actions as unknown as AutomationRuleActionPayload[]) : [],
  };
}

export function toAutomationRunRecordView(row: AutomationRunRecord): AutomationRunRecordView {
  return {
    ...row,
    input_payload: isUnknownRecord(row.input_payload) ? row.input_payload : null,
    result_payload: isUnknownRecord(row.result_payload) ? row.result_payload : null,
  };
}

export function toAutomationRunStepRecordView(row: AutomationRunStepRecord): AutomationRunStepRecordView {
  return {
    ...row,
    result_payload: isUnknownRecord(row.result_payload) ? row.result_payload : null,
  };
}

export type AutomationRuleMutationPayload = {
  tenant_id: string;
  name: string;
  description: string | null;
  module: string;
  trigger_type: AutomationRuleRecordView["trigger_type"];
  trigger_config: Record<string, string>;
  conditions: Record<string, Json>;
  actions: AutomationRuleActionPayload[];
  enabled: boolean;
};

export function toAutomationRuleInsert(
  payload: AutomationRuleMutationPayload,
  createdBy: string,
): TablesInsert<"automation_rules"> {
  return {
    ...payload,
    created_by: createdBy,
    trigger_config: payload.trigger_config as unknown as Json,
    conditions: payload.conditions as unknown as Json,
    actions: payload.actions as unknown as Json,
  };
}

export function toAutomationRuleUpdate(
  payload: AutomationRuleMutationPayload,
): TablesUpdate<"automation_rules"> {
  return {
    ...payload,
    trigger_config: payload.trigger_config as unknown as Json,
    conditions: payload.conditions as unknown as Json,
    actions: payload.actions as unknown as Json,
  };
}

function isUnknownRecord(value: Json | null): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isStringRecord(value: Json): value is Record<string, string> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isCondition(value: unknown): value is AutomationRuleCondition {
  return !!value && typeof value === "object" && "field" in value && "operator" in value && "value" in value;
}

function isConditionsPayload(value: Json): value is AutomationRuleConditionsPayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  const allValid = candidate.all === undefined || (Array.isArray(candidate.all) && candidate.all.every(isCondition));
  const anyValid = candidate.any === undefined || (Array.isArray(candidate.any) && candidate.any.every(isCondition));
  return allValid && anyValid;
}
