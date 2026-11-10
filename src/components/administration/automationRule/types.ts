export type FieldType = "string" | "number" | "date" | "boolean" | "enum";
export type FieldSpec = { type: FieldType; options?: string[] };

export type ConditionItem = {
  field: string;
  operator: string;
  value: string;
};

export type ConditionGroup = {
  logic: "all" | "any";
  conditions: ConditionItem[];
  groups: ConditionGroup[];
};

export type ActionItem = {
  annualTaskId?: string;
  systemFunction?: string;
  routineCategory?: string;
  type: string;
  targetUserId: string;
  title: string;
  message: string;
  taskPriority: string;
  taskCategory: string;
  taskDueDate: string;
  taskAssignees: string;
  table: string;
  recordId: string;
  status: string;
  emailTemplateId: string;
  emailRecipient: string;
  emailRecipientName: string;
  approvalPolicy: string;
  approvalDueInHours: string;
  approvalMinimumApprovers: string;
};

export type WizardForm = {
  name: string;
  description: string;
  module: string;
  triggerType: string;
  triggerField: string;
  triggerValue: string;
  webhookSecret?: string;
  schedule?: { schedule_kind: string; month: string; day: string; hour: string; month_end: string; timezone: string; minutes_interval: string };
  /** @deprecated kept for backward compat during migration */
  conditionLogic: "all" | "any";
  /** @deprecated kept for backward compat during migration */
  conditions: ConditionItem[];
  conditionGroup: ConditionGroup;
  actions: ActionItem[];
  enabled: boolean;
  samplePayload: string;
};
