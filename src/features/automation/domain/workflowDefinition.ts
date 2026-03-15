import { z } from "zod";

export const WORKFLOW_LIFECYCLE_STATUSES = ["draft", "published", "archived"] as const;
export type WorkflowLifecycleStatus = (typeof WORKFLOW_LIFECYCLE_STATUSES)[number];

export const TriggerSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("event"),
    eventName: z.string().min(1),
    source: z.string().min(1),
    filters: z.record(z.string(), z.unknown()).default({}),
  }),
  z.object({
    type: z.literal("time"),
    cron: z.string().min(1),
    timezone: z.string().min(1),
    startAt: z.string().datetime().optional(),
    endAt: z.string().datetime().optional(),
  }),
  z.object({
    type: z.literal("manual"),
    allowedRoles: z.array(z.string().min(1)).min(1),
  }),
]);
export type Trigger = z.infer<typeof TriggerSchema>;

const ComparisonOperatorSchema = z.enum([
  "eq",
  "neq",
  "contains",
  "gt",
  "gte",
  "lt",
  "lte",
  "exists",
  "in",
]);

const ConditionRuleSchema = z.object({
  id: z.string().min(1),
  kind: z.literal("rule"),
  field: z.string().min(1),
  operator: ComparisonOperatorSchema,
  value: z.unknown().optional(),
});

const ConditionGroupSchema: z.ZodType<ConditionGroup> = z.object({
  id: z.string().min(1),
  kind: z.literal("group"),
  combinator: z.enum(["AND", "OR"]),
  conditions: z.array(z.union([ConditionRuleSchema, z.lazy(() => ConditionGroupSchema)])).min(1),
});

export type ConditionRule = z.infer<typeof ConditionRuleSchema>;
export type ConditionGroup = {
  id: string;
  kind: "group";
  combinator: "AND" | "OR";
  conditions: Array<ConditionRule | ConditionGroup>;
};

export const ConditionSchema = z.union([ConditionRuleSchema, ConditionGroupSchema]);
export type Condition = ConditionRule | ConditionGroup;

const ActionTypeSchema = z.enum(["side_effect", "notification", "data_change", "api_call"]);

export const ActionSchema = z.object({
  id: z.string().min(1),
  type: ActionTypeSchema,
  name: z.string().min(1),
  config: z.record(z.string(), z.unknown()),
  dependsOnActionIds: z.array(z.string().min(1)).default([]),
  onSuccessActionIds: z.array(z.string().min(1)).default([]),
  onFailureActionIds: z.array(z.string().min(1)).default([]),
});
export type Action = z.infer<typeof ActionSchema>;

export const ApprovalStepSchema = z.object({
  id: z.string().min(1),
  role: z.string().min(1),
  slaMinutes: z.number().int().positive(),
  escalationRole: z.string().min(1).optional(),
  escalationAfterMinutes: z.number().int().positive().optional(),
  delegateRole: z.string().min(1).optional(),
  dependsOnApprovalStepIds: z.array(z.string().min(1)).default([]),
});
export type ApprovalStep = z.infer<typeof ApprovalStepSchema>;

export const WorkflowDefinitionSchema = z.object({
  id: z.string().min(1),
  key: z.string().min(1),
  name: z.string().min(1),
  description: z.string().default(""),
  tenantId: z.string().min(1),
  module: z.string().min(1),
  status: z.enum(WORKFLOW_LIFECYCLE_STATUSES),
  version: z.number().int().positive(),
  trigger: TriggerSchema,
  condition: ConditionSchema,
  actions: z.array(ActionSchema).min(1),
  approvalSteps: z.array(ApprovalStepSchema).default([]),
  metadata: z.record(z.string(), z.unknown()).default({}),
  createdAt: z.string().datetime(),
  createdBy: z.string().min(1),
  publishedAt: z.string().datetime().nullable().default(null),
  archivedAt: z.string().datetime().nullable().default(null),
}).superRefine((workflow, ctx) => {
  if (workflow.status === "published" && !workflow.publishedAt) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Published workflows require publishedAt.",
      path: ["publishedAt"],
    });
  }

  if (workflow.status === "archived" && !workflow.archivedAt) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Archived workflows require archivedAt.",
      path: ["archivedAt"],
    });
  }
});

export type WorkflowDefinition = z.infer<typeof WorkflowDefinitionSchema>;

export const WorkflowVersionSnapshotSchema = WorkflowDefinitionSchema.extend({
  checksum: z.string().min(1),
});
export type WorkflowVersionSnapshot = z.infer<typeof WorkflowVersionSnapshotSchema>;

export const WorkflowDocumentSchema = z.object({
  workflowKey: z.string().min(1),
  draft: WorkflowDefinitionSchema.nullable(),
  publishedVersions: z.array(WorkflowVersionSnapshotSchema),
  archivedVersions: z.array(WorkflowVersionSnapshotSchema).default([]),
});

export type WorkflowDocument = z.infer<typeof WorkflowDocumentSchema>;

const collectConditionIds = (condition: Condition, ids: Set<string>) => {
  if (ids.has(condition.id)) {
    throw new Error(`Duplicate condition id: ${condition.id}`);
  }
  ids.add(condition.id);

  if (condition.kind === "group") {
    condition.conditions.forEach((child) => collectConditionIds(child as Condition, ids));
  }
};

const ensureUniqueIds = (values: string[], type: string) => {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) {
      throw new Error(`Duplicate ${type} id: ${value}`);
    }
    seen.add(value);
  }
};

const detectCycle = (edges: Map<string, string[]>, graphName: string) => {
  const visited = new Set<string>();
  const stack = new Set<string>();

  const visit = (node: string) => {
    if (stack.has(node)) {
      throw new Error(`Cycle detected in ${graphName} graph at node: ${node}`);
    }

    if (visited.has(node)) {
      return;
    }

    visited.add(node);
    stack.add(node);

    for (const next of edges.get(node) ?? []) {
      visit(next);
    }

    stack.delete(node);
  };

  for (const node of edges.keys()) {
    visit(node);
  }
};

export type WorkflowValidationIssue = {
  code: "schema" | "cycle" | "required" | "reference" | "history";
  message: string;
  path?: string;
};

export const validateWorkflowDefinition = (payload: unknown): {
  valid: boolean;
  workflow?: WorkflowDefinition;
  issues: WorkflowValidationIssue[];
} => {
  const parseResult = WorkflowDefinitionSchema.safeParse(payload);

  if (!parseResult.success) {
    return {
      valid: false,
      issues: parseResult.error.issues.map((issue) => ({
        code: "schema",
        message: issue.message,
        path: issue.path.join("."),
      })),
    };
  }

  const workflow = parseResult.data;
  const issues: WorkflowValidationIssue[] = [];

  try {
    collectConditionIds(workflow.condition, new Set<string>());
  } catch (error) {
    issues.push({ code: "required", message: (error as Error).message, path: "condition" });
  }

  try {
    ensureUniqueIds(workflow.actions.map((action) => action.id), "action");
  } catch (error) {
    issues.push({ code: "required", message: (error as Error).message, path: "actions" });
  }

  try {
    ensureUniqueIds(workflow.approvalSteps.map((step) => step.id), "approvalStep");
  } catch (error) {
    issues.push({ code: "required", message: (error as Error).message, path: "approvalSteps" });
  }

  const actionIds = new Set(workflow.actions.map((action) => action.id));
  const actionEdges = new Map<string, string[]>();

  for (const action of workflow.actions) {
    const refs = [...action.dependsOnActionIds, ...action.onSuccessActionIds, ...action.onFailureActionIds];
    actionEdges.set(action.id, refs);

    for (const ref of refs) {
      if (!actionIds.has(ref)) {
        issues.push({
          code: "reference",
          message: `Action ${action.id} references unknown action: ${ref}`,
          path: "actions",
        });
      }
    }
  }

  try {
    detectCycle(actionEdges, "action");
  } catch (error) {
    issues.push({ code: "cycle", message: (error as Error).message, path: "actions" });
  }

  const approvalIds = new Set(workflow.approvalSteps.map((step) => step.id));
  const approvalEdges = new Map<string, string[]>();

  for (const step of workflow.approvalSteps) {
    approvalEdges.set(step.id, step.dependsOnApprovalStepIds);

    for (const dep of step.dependsOnApprovalStepIds) {
      if (!approvalIds.has(dep)) {
        issues.push({
          code: "reference",
          message: `Approval step ${step.id} references unknown dependency: ${dep}`,
          path: "approvalSteps",
        });
      }
    }
  }

  try {
    detectCycle(approvalEdges, "approval");
  } catch (error) {
    issues.push({ code: "cycle", message: (error as Error).message, path: "approvalSteps" });
  }

  if (workflow.actions.length === 0) {
    issues.push({
      code: "required",
      message: "At least one action is required.",
      path: "actions",
    });
  }

  return {
    valid: issues.length === 0,
    workflow,
    issues,
  };
};

export const validateWorkflowDocument = (payload: unknown): {
  valid: boolean;
  document?: WorkflowDocument;
  issues: WorkflowValidationIssue[];
} => {
  const parseResult = WorkflowDocumentSchema.safeParse(payload);
  if (!parseResult.success) {
    return {
      valid: false,
      issues: parseResult.error.issues.map((issue) => ({
        code: "schema",
        message: issue.message,
        path: issue.path.join("."),
      })),
    };
  }

  const document = parseResult.data;
  const issues: WorkflowValidationIssue[] = [];

  const versionIndex = new Set<number>();
  for (const published of document.publishedVersions) {
    if (published.status !== "published") {
      issues.push({
        code: "history",
        message: `Published history entry v${published.version} must have status=published.`,
      });
    }

    if (versionIndex.has(published.version)) {
      issues.push({
        code: "history",
        message: `Duplicate version in published history: ${published.version}`,
      });
    }

    versionIndex.add(published.version);
  }

  for (const archived of document.archivedVersions) {
    if (versionIndex.has(archived.version)) {
      issues.push({
        code: "history",
        message: `Version ${archived.version} appears in both published and archived history.`,
      });
    }
  }

  if (document.draft && document.draft.status !== "draft") {
    issues.push({
      code: "history",
      message: "Draft entry must have status=draft.",
      path: "draft.status",
    });
  }

  if (document.draft && document.publishedVersions.some((version) => version.version >= document.draft!.version)) {
    issues.push({
      code: "history",
      message: "Draft version must be greater than all published versions.",
      path: "draft.version",
    });
  }

  return {
    valid: issues.length === 0,
    document,
    issues,
  };
};

export const WORKFLOW_DEFINITION_DSL_VERSION = "1.0.0";
