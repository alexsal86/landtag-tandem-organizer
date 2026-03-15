import { describe, expect, it, vi } from "vitest";

import type { WorkflowDefinition } from "../../domain/workflowDefinition";
import { WorkflowRuntime } from "../workflowRuntime";

const baseWorkflow = (): WorkflowDefinition => ({
  id: "wf-1",
  key: "case-escalation",
  name: "Case escalation",
  description: "",
  tenantId: "tenant-1",
  module: "cases",
  status: "published",
  version: 1,
  trigger: {
    type: "event",
    eventName: "case.created",
    source: "cases",
    filters: {},
  },
  condition: {
    id: "condition-root",
    kind: "rule",
    field: "priority",
    operator: "exists",
  },
  actions: [
    {
      id: "action-1",
      type: "side_effect",
      name: "Create task",
      config: {},
      dependsOnActionIds: [],
      onSuccessActionIds: [],
      onFailureActionIds: [],
    },
    {
      id: "action-2",
      type: "side_effect",
      name: "Notify team",
      config: {},
      dependsOnActionIds: ["action-1"],
      onSuccessActionIds: [],
      onFailureActionIds: [],
    },
  ],
  approvalSteps: [],
  metadata: {},
  createdAt: "2026-01-01T00:00:00.000Z",
  createdBy: "user-1",
  publishedAt: "2026-01-01T00:00:00.000Z",
  archivedAt: null,
});

describe("WorkflowRuntime", () => {
  it("executes run and keeps explicit state transition history", async () => {
    const runtime = new WorkflowRuntime();
    runtime.registerWorkflow(baseWorkflow());
    runtime.registerActionExecutor("side_effect", {
      execute: async () => ({ output: { ok: true } }),
    });

    const run = await runtime.triggerWorkflow("wf-1", {
      initiatedBy: "user-1",
      triggerSource: "cases",
      input: { caseId: "case-1" },
    });

    expect(run.state).toBe("completed");
    expect(run.transitionHistory.map((transition) => `${transition.from}->${transition.to}`)).toEqual([
      "created->triggered",
      "triggered->executing",
      "executing->completed",
    ]);
    expect(run.stepStates["action-1"].status).toBe("completed");
    expect(run.stepStates["action-2"].status).toBe("completed");
  });

  it("supports retries, timeout handling and compensation on partial failure", async () => {
    const runtime = new WorkflowRuntime({
      retryPolicy: {
        maxAttempts: 2,
        backoffMs: 1,
        timeoutMs: 10,
      },
    });
    runtime.registerWorkflow(baseWorkflow());

    const compensate = vi.fn(async () => undefined);
    const execute = vi
      .fn()
      .mockResolvedValueOnce({ output: { createdTask: true } })
      .mockImplementationOnce(
        async () =>
          await new Promise((resolve) => {
            setTimeout(resolve, 100);
          }),
      )
      .mockImplementationOnce(async () => {
        throw new Error("still failing");
      });

    runtime.registerActionExecutor("side_effect", {
      execute,
      compensate,
    });

    const run = await runtime.triggerWorkflow("wf-1", {
      initiatedBy: "user-2",
      triggerSource: "cases",
    });

    expect(run.state).toBe("failed");
    expect(run.stepStates["action-1"].status).toBe("compensated");
    expect(run.stepStates["action-2"].status).toBe("failed");
    expect(run.stepStates["action-2"].attempts).toBe(2);
    expect(compensate).toHaveBeenCalledTimes(1);
  });

  it("keeps run-level idempotency via idempotency keys", async () => {
    const runtime = new WorkflowRuntime();
    runtime.registerWorkflow(baseWorkflow());

    const execute = vi.fn(async () => ({ output: {} }));
    runtime.registerActionExecutor("side_effect", {
      execute,
    });

    const first = await runtime.triggerWorkflow("wf-1", {
      initiatedBy: "user-1",
      triggerSource: "cases",
      idempotencyKey: "event-123",
    });

    const second = await runtime.triggerWorkflow("wf-1", {
      initiatedBy: "user-1",
      triggerSource: "cases",
      idempotencyKey: "event-123",
    });

    expect(first.id).toBe(second.id);
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it("supports multi-stage approvals, delegation and escalation", async () => {
    const workflow = baseWorkflow();
    workflow.approvalSteps = [
      {
        id: "approval-a",
        role: "team_lead",
        slaMinutes: 10,
        escalationRole: "director",
        escalationAfterMinutes: 5,
        delegateRole: "assistant",
        dependsOnApprovalStepIds: [],
      },
      {
        id: "approval-b",
        role: "compliance",
        slaMinutes: 10,
        dependsOnApprovalStepIds: ["approval-a"],
      },
    ];

    const runtime = new WorkflowRuntime();
    runtime.registerWorkflow(workflow);
    runtime.registerActionExecutor("side_effect", {
      execute: async () => ({ output: {} }),
    });

    const run = await runtime.triggerWorkflow("wf-1", {
      initiatedBy: "user-1",
      triggerSource: "cases",
    });

    expect(run.state).toBe("waiting_for_approval");

    runtime.processEscalations(new Date(Date.now() + 6 * 60_000));
    const escalatedRun = runtime.getRun(run.id);
    expect(escalatedRun?.approvalSteps["approval-a"].status).toBe("escalated");

    await runtime.submitApproval({
      runId: run.id,
      stepId: "approval-a",
      actorId: "assistant-1",
      actorRole: "assistant",
      delegatedByRole: "team_lead",
      decision: "approved",
    });

    const partiallyApprovedRun = runtime.getRun(run.id);
    expect(partiallyApprovedRun?.state).toBe("waiting_for_approval");

    const completedRun = await runtime.submitApproval({
      runId: run.id,
      stepId: "approval-b",
      actorId: "compliance-1",
      actorRole: "compliance",
      decision: "approved",
    });

    expect(completedRun.state).toBe("completed");
  });
});
