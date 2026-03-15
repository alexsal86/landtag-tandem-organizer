import type { Action, ApprovalStep, WorkflowDefinition } from "../domain/workflowDefinition";

export const RUN_STATES = [
  "created",
  "triggered",
  "waiting_for_approval",
  "executing",
  "completed",
  "failed",
  "cancelled",
] as const;

export type RunState = (typeof RUN_STATES)[number];

export type TriggerPayload = {
  triggerSource: string;
  initiatedBy: string;
  input?: Record<string, unknown>;
  idempotencyKey?: string;
};

export type RetryPolicy = {
  maxAttempts: number;
  backoffMs: number;
  timeoutMs: number;
};

export type ActionExecutionContext = {
  runId: string;
  workflow: WorkflowDefinition;
  action: Action;
  input: Record<string, unknown>;
};

export type ActionExecutionResult = {
  output?: Record<string, unknown>;
};

export type ActionExecutor = {
  execute: (context: ActionExecutionContext) => Promise<ActionExecutionResult>;
  compensate?: (context: ActionExecutionContext) => Promise<void>;
};

export type ApprovalDecision = "approved" | "rejected";

export type WorkflowRuntimeEvent =
  | { type: "run_created"; runId: string; workflowId: string }
  | { type: "run_state_changed"; runId: string; from: RunState; to: RunState }
  | { type: "approval_requested"; runId: string; stepId: string; role: string }
  | {
      type: "approval_decided";
      runId: string;
      stepId: string;
      actorId: string;
      actorRole: string;
      decision: ApprovalDecision;
      delegatedByRole?: string;
    }
  | { type: "approval_escalated"; runId: string; stepId: string; escalationRole: string }
  | { type: "action_started"; runId: string; actionId: string; attempt: number }
  | { type: "action_completed"; runId: string; actionId: string; attempt: number }
  | { type: "action_failed"; runId: string; actionId: string; attempt: number; message: string }
  | { type: "action_compensated"; runId: string; actionId: string };

export type StepExecutionState = {
  actionId: string;
  status: "pending" | "running" | "completed" | "failed" | "compensated";
  attempts: number;
  lastError?: string;
  output?: Record<string, unknown>;
};

type ApprovalStepInstance = {
  stepId: string;
  role: string;
  dependsOnApprovalStepIds: string[];
  escalationRole?: string;
  delegateRole?: string;
  escalationAfterMinutes?: number;
  slaMinutes: number;
  requestedAt: string;
  status: "pending" | "approved" | "rejected" | "escalated";
  decidedByActorId?: string;
  decidedByRole?: string;
};

export type WorkflowRun = {
  id: string;
  workflowId: string;
  workflowKey: string;
  state: RunState;
  triggerSource: string;
  initiatedBy: string;
  input: Record<string, unknown>;
  idempotencyKey?: string;
  createdAt: string;
  updatedAt: string;
  startedExecutionAt?: string;
  finishedAt?: string;
  error?: string;
  stepStates: Record<string, StepExecutionState>;
  approvalSteps: Record<string, ApprovalStepInstance>;
  transitionHistory: Array<{ from: RunState; to: RunState; at: string }>;
};

const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 3,
  backoffMs: 150,
  timeoutMs: 4_000,
};

const sleep = async (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
  const timeoutPromise = new Promise<T>((_, reject) => {
    setTimeout(() => reject(new Error(`Action timed out after ${timeoutMs}ms`)), timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]);
};

const TERMINAL_STATES = new Set<RunState>(["completed", "failed", "cancelled"]);

const ALLOWED_TRANSITIONS: Record<RunState, RunState[]> = {
  created: ["triggered", "cancelled"],
  triggered: ["waiting_for_approval", "executing", "failed", "cancelled"],
  waiting_for_approval: ["executing", "failed", "cancelled"],
  executing: ["completed", "failed", "cancelled"],
  completed: [],
  failed: [],
  cancelled: [],
};

export class WorkflowRuntime {
  private readonly workflows = new Map<string, WorkflowDefinition>();
  private readonly runs = new Map<string, WorkflowRun>();
  private readonly runIdsByIdempotency = new Map<string, string>();
  private readonly actionExecutors = new Map<Action["type"], ActionExecutor>();
  private readonly subscribers = new Set<(event: WorkflowRuntimeEvent) => void>();
  private readonly retryPolicy: RetryPolicy;

  constructor(options?: { retryPolicy?: Partial<RetryPolicy> }) {
    this.retryPolicy = {
      ...DEFAULT_RETRY_POLICY,
      ...options?.retryPolicy,
    };
  }

  onEvent(subscriber: (event: WorkflowRuntimeEvent) => void): () => void {
    this.subscribers.add(subscriber);
    return () => this.subscribers.delete(subscriber);
  }

  registerWorkflow(workflow: WorkflowDefinition): void {
    this.workflows.set(workflow.id, workflow);
  }

  registerActionExecutor(actionType: Action["type"], executor: ActionExecutor): void {
    this.actionExecutors.set(actionType, executor);
  }

  getRun(runId: string): WorkflowRun | undefined {
    return this.runs.get(runId);
  }

  getRunsByWorkflow(workflowId: string): WorkflowRun[] {
    return [...this.runs.values()].filter((run) => run.workflowId === workflowId);
  }

  async triggerWorkflow(workflowId: string, payload: TriggerPayload): Promise<WorkflowRun> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} is not registered`);
    }

    if (payload.idempotencyKey && this.runIdsByIdempotency.has(payload.idempotencyKey)) {
      const existingRun = this.runs.get(this.runIdsByIdempotency.get(payload.idempotencyKey) ?? "");
      if (existingRun) {
        return existingRun;
      }
    }

    const runId = `${workflow.key}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const now = new Date().toISOString();

    const run: WorkflowRun = {
      id: runId,
      workflowId: workflow.id,
      workflowKey: workflow.key,
      state: "created",
      triggerSource: payload.triggerSource,
      initiatedBy: payload.initiatedBy,
      input: payload.input ?? {},
      idempotencyKey: payload.idempotencyKey,
      createdAt: now,
      updatedAt: now,
      stepStates: Object.fromEntries(
        workflow.actions.map((action) => [
          action.id,
          {
            actionId: action.id,
            status: "pending",
            attempts: 0,
          } satisfies StepExecutionState,
        ]),
      ),
      approvalSteps: this.instantiateApprovalSteps(workflow.approvalSteps),
      transitionHistory: [],
    };

    if (payload.idempotencyKey) {
      this.runIdsByIdempotency.set(payload.idempotencyKey, run.id);
    }

    this.runs.set(run.id, run);
    this.emit({ type: "run_created", runId: run.id, workflowId: workflow.id });

    this.transition(run, "triggered");

    if (workflow.approvalSteps.length > 0) {
      this.transition(run, "waiting_for_approval");
      this.emitAvailableApprovals(run);
      return run;
    }

    await this.executeRun(run.id);
    return this.runs.get(run.id) as WorkflowRun;
  }

  async submitApproval(input: {
    runId: string;
    stepId: string;
    actorId: string;
    actorRole: string;
    decision: ApprovalDecision;
    delegatedByRole?: string;
  }): Promise<WorkflowRun> {
    const run = this.runs.get(input.runId);
    if (!run) {
      throw new Error(`Run ${input.runId} not found`);
    }
    if (run.state !== "waiting_for_approval") {
      throw new Error(`Run ${run.id} is not waiting for approval`);
    }

    const step = run.approvalSteps[input.stepId];
    if (!step) {
      throw new Error(`Approval step ${input.stepId} not found`);
    }

    const allowedRoles = new Set([step.role, step.delegateRole, step.escalationRole].filter(Boolean) as string[]);
    if (input.delegatedByRole) {
      if (input.actorRole !== step.delegateRole) {
        throw new Error(`Role ${input.actorRole} cannot act as delegate for step ${step.stepId}`);
      }
      if (input.delegatedByRole !== step.role) {
        throw new Error(`Delegation must originate from step role ${step.role}`);
      }
    } else if (!allowedRoles.has(input.actorRole)) {
      throw new Error(`Role ${input.actorRole} cannot decide step ${step.stepId}`);
    }

    step.status = input.decision === "approved" ? "approved" : "rejected";
    step.decidedByActorId = input.actorId;
    step.decidedByRole = input.actorRole;
    run.updatedAt = new Date().toISOString();

    this.emit({
      type: "approval_decided",
      runId: run.id,
      stepId: step.stepId,
      actorId: input.actorId,
      actorRole: input.actorRole,
      decision: input.decision,
      delegatedByRole: input.delegatedByRole,
    });

    if (input.decision === "rejected") {
      this.transition(run, "failed", "Approval rejected");
      return run;
    }

    if (this.canStartExecution(run)) {
      await this.executeRun(run.id);
      return this.runs.get(run.id) as WorkflowRun;
    }

    this.emitAvailableApprovals(run);
    return run;
  }

  processEscalations(now = new Date()): void {
    for (const run of this.runs.values()) {
      if (run.state !== "waiting_for_approval") {
        continue;
      }

      for (const step of Object.values(run.approvalSteps)) {
        if (step.status !== "pending") {
          continue;
        }
        const elapsedMinutes = Math.floor((now.getTime() - new Date(step.requestedAt).getTime()) / 60_000);
        const escalationAfter = step.escalationAfterMinutes ?? step.slaMinutes;
        if (elapsedMinutes >= escalationAfter && step.escalationRole) {
          step.status = "escalated";
          this.emit({
            type: "approval_escalated",
            runId: run.id,
            stepId: step.stepId,
            escalationRole: step.escalationRole,
          });
        }
      }
      this.emitAvailableApprovals(run);
    }
  }

  cancelRun(runId: string, reason = "Cancelled by request"): WorkflowRun {
    const run = this.runs.get(runId);
    if (!run) {
      throw new Error(`Run ${runId} not found`);
    }
    if (TERMINAL_STATES.has(run.state)) {
      return run;
    }
    this.transition(run, "cancelled", reason);
    return run;
  }

  private async executeRun(runId: string): Promise<void> {
    const run = this.runs.get(runId);
    if (!run) {
      throw new Error(`Run ${runId} not found`);
    }
    const workflow = this.workflows.get(run.workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${run.workflowId} not registered`);
    }

    if (run.state !== "executing") {
      this.transition(run, "executing");
      run.startedExecutionAt = new Date().toISOString();
    }

    const completedActionIds: string[] = [];

    try {
      for (const action of workflow.actions) {
        const step = run.stepStates[action.id];

        if (step.status === "completed") {
          continue;
        }

        const depsSatisfied = action.dependsOnActionIds.every((id) => run.stepStates[id]?.status === "completed");
        if (!depsSatisfied) {
          throw new Error(`Dependencies for action ${action.id} are not satisfied`);
        }

        await this.executeActionWithRetry(run, workflow, action);
        completedActionIds.push(action.id);
      }

      this.transition(run, "completed");
      run.finishedAt = new Date().toISOString();
    } catch (error) {
      await this.compensate(run, workflow, completedActionIds);
      this.transition(run, "failed", (error as Error).message);
      run.finishedAt = new Date().toISOString();
    }
  }

  private async executeActionWithRetry(run: WorkflowRun, workflow: WorkflowDefinition, action: Action): Promise<void> {
    const step = run.stepStates[action.id];
    const executor = this.actionExecutors.get(action.type);

    if (!executor) {
      throw new Error(`No action executor registered for type ${action.type}`);
    }

    for (let attempt = 1; attempt <= this.retryPolicy.maxAttempts; attempt += 1) {
      step.status = "running";
      step.attempts = attempt;
      this.emit({ type: "action_started", runId: run.id, actionId: action.id, attempt });

      try {
        const result = await withTimeout(
          executor.execute({ runId: run.id, workflow, action, input: run.input }),
          this.retryPolicy.timeoutMs,
        );
        step.status = "completed";
        step.output = result.output;
        this.emit({ type: "action_completed", runId: run.id, actionId: action.id, attempt });
        return;
      } catch (error) {
        step.status = "failed";
        step.lastError = (error as Error).message;
        this.emit({
          type: "action_failed",
          runId: run.id,
          actionId: action.id,
          attempt,
          message: step.lastError,
        });

        if (attempt === this.retryPolicy.maxAttempts) {
          throw error;
        }

        await sleep(this.retryPolicy.backoffMs * attempt);
      }
    }
  }

  private async compensate(run: WorkflowRun, workflow: WorkflowDefinition, completedActionIds: string[]): Promise<void> {
    for (const actionId of [...completedActionIds].reverse()) {
      const action = workflow.actions.find((candidate) => candidate.id === actionId);
      if (!action) {
        continue;
      }
      const executor = this.actionExecutors.get(action.type);
      if (!executor?.compensate) {
        continue;
      }

      await executor.compensate({ runId: run.id, workflow, action, input: run.input });
      run.stepStates[action.id].status = "compensated";
      this.emit({ type: "action_compensated", runId: run.id, actionId: action.id });
    }
  }

  private canStartExecution(run: WorkflowRun): boolean {
    return Object.values(run.approvalSteps).every((step) => {
      if (step.status !== "approved") {
        return false;
      }
      return step.dependsOnApprovalStepIds.every((dependencyId) => run.approvalSteps[dependencyId]?.status === "approved");
    });
  }

  private emitAvailableApprovals(run: WorkflowRun): void {
    for (const step of Object.values(run.approvalSteps)) {
      if (step.status !== "pending" && step.status !== "escalated") {
        continue;
      }
      const dependenciesReady = step.dependsOnApprovalStepIds.every(
        (dependencyId) => run.approvalSteps[dependencyId]?.status === "approved",
      );
      if (!dependenciesReady) {
        continue;
      }
      this.emit({ type: "approval_requested", runId: run.id, stepId: step.stepId, role: step.role });
    }
  }

  private instantiateApprovalSteps(approvalSteps: ApprovalStep[]): Record<string, ApprovalStepInstance> {
    const requestedAt = new Date().toISOString();
    return Object.fromEntries(
      approvalSteps.map((step) => [
        step.id,
        {
          stepId: step.id,
          role: step.role,
          dependsOnApprovalStepIds: step.dependsOnApprovalStepIds,
          escalationRole: step.escalationRole,
          delegateRole: step.delegateRole,
          escalationAfterMinutes: step.escalationAfterMinutes,
          slaMinutes: step.slaMinutes,
          requestedAt,
          status: "pending",
        } satisfies ApprovalStepInstance,
      ]),
    );
  }

  private transition(run: WorkflowRun, targetState: RunState, error?: string): void {
    const allowed = ALLOWED_TRANSITIONS[run.state];
    if (!allowed.includes(targetState)) {
      throw new Error(`Invalid transition from ${run.state} to ${targetState}`);
    }

    const previousState = run.state;
    run.state = targetState;
    run.updatedAt = new Date().toISOString();
    if (error) {
      run.error = error;
    }
    run.transitionHistory.push({ from: previousState, to: targetState, at: run.updatedAt });

    this.emit({ type: "run_state_changed", runId: run.id, from: previousState, to: targetState });
  }

  private emit(event: WorkflowRuntimeEvent): void {
    for (const subscriber of this.subscribers) {
      subscriber(event);
    }
  }
}
