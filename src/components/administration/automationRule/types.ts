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
  /** @deprecated kept for backward compat during migration */
  conditionLogic: "all" | "any";
  /** @deprecated kept for backward compat during migration */
  conditions: ConditionItem[];
  conditionGroup: ConditionGroup;
  actions: ActionItem[];
  enabled: boolean;
  samplePayload: string;
};
