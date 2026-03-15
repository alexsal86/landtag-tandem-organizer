import { describe, expect, it } from "vitest";

import {
  validateWorkflowDefinition,
  validateWorkflowDocument,
  type WorkflowDefinition,
} from "../workflowDefinition";

const baseWorkflow = (): WorkflowDefinition => ({
  id: "wf-v1",
  key: "case-escalation",
  name: "Case escalation",
  description: "Escalates stale cases",
  tenantId: "tenant-1",
  module: "cases",
  status: "draft",
  version: 1,
  trigger: {
    type: "event",
    eventName: "case.updated",
    source: "cases",
    filters: { changedField: "status" },
  },
  condition: {
    id: "cond-root",
    kind: "group",
    combinator: "AND",
    conditions: [
      {
        id: "cond-1",
        kind: "rule",
        field: "status",
        operator: "eq",
        value: "open",
      },
    ],
  },
  actions: [
    {
      id: "action-1",
      name: "Create Notification",
      type: "notification",
      config: { channel: "in_app" },
      dependsOnActionIds: [],
      onSuccessActionIds: ["action-2"],
      onFailureActionIds: [],
    },
    {
      id: "action-2",
      name: "Write escalation flag",
      type: "data_change",
      config: { target: "cases", patch: { escalated: true } },
      dependsOnActionIds: ["action-1"],
      onSuccessActionIds: [],
      onFailureActionIds: [],
    },
  ],
  approvalSteps: [
    {
      id: "approval-1",
      role: "team_lead",
      slaMinutes: 60,
      escalationRole: "manager",
      escalationAfterMinutes: 120,
      delegateRole: "deputy_manager",
      dependsOnApprovalStepIds: [],
    },
  ],
  metadata: {},
  createdAt: "2026-03-15T10:00:00.000Z",
  createdBy: "user-1",
  publishedAt: null,
  archivedAt: null,
});

describe("validateWorkflowDefinition", () => {
  it("accepts a valid workflow", () => {
    const result = validateWorkflowDefinition(baseWorkflow());

    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it("rejects cycles in action references", () => {
    const workflow = baseWorkflow();
    workflow.actions[1].onSuccessActionIds = ["action-1"];

    const result = validateWorkflowDefinition(workflow);

    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.code === "cycle")).toBe(true);
  });

  it("rejects unresolved action references", () => {
    const workflow = baseWorkflow();
    workflow.actions[0].dependsOnActionIds = ["missing-action"];

    const result = validateWorkflowDefinition(workflow);

    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.code === "reference")).toBe(true);
  });

  it("requires publishedAt for published status", () => {
    const workflow = baseWorkflow();
    workflow.status = "published";

    const result = validateWorkflowDefinition(workflow);

    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.path === "publishedAt")).toBe(true);
  });
});

describe("validateWorkflowDocument", () => {
  it("enforces immutable published history structure", () => {
    const workflow = baseWorkflow();
    const result = validateWorkflowDocument({
      workflowKey: "case-escalation",
      draft: {
        ...workflow,
        id: "wf-v3",
        version: 3,
        status: "draft",
      },
      publishedVersions: [
        {
          ...workflow,
          id: "wf-v2",
          version: 2,
          status: "published",
          publishedAt: "2026-03-10T10:00:00.000Z",
          checksum: "sha256:v2",
        },
      ],
      archivedVersions: [
        {
          ...workflow,
          id: "wf-v1",
          version: 1,
          status: "archived",
          archivedAt: "2026-03-09T10:00:00.000Z",
          checksum: "sha256:v1",
        },
      ],
    });

    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it("rejects draft versions that do not advance", () => {
    const workflow = baseWorkflow();
    const result = validateWorkflowDocument({
      workflowKey: "case-escalation",
      draft: {
        ...workflow,
        id: "wf-v2-draft",
        version: 2,
      },
      publishedVersions: [
        {
          ...workflow,
          id: "wf-v2",
          status: "published",
          version: 2,
          publishedAt: "2026-03-11T10:00:00.000Z",
          checksum: "sha256:v2",
        },
      ],
      archivedVersions: [],
    });

    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.code === "history")).toBe(true);
  });
});
