import type { TestScenario } from "./types";
import { meetingLifecycleScenario } from "./scenarios/meeting-lifecycle";
import { taskLifecycleScenario } from "./scenarios/task-lifecycle";
import { letterLifecycleScenario } from "./scenarios/letter-lifecycle";
import { caseItemLifecycleScenario } from "./scenarios/case-item-lifecycle";
import { decisionLifecycleScenario } from "./scenarios/decision-lifecycle";

export const SELFTEST_SCENARIOS: TestScenario[] = [
  meetingLifecycleScenario,
  letterLifecycleScenario,
  caseItemLifecycleScenario,
  decisionLifecycleScenario,
  taskLifecycleScenario,
];
