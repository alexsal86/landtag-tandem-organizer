import type { TestScenario } from "./types";
import { meetingLifecycleScenario } from "./scenarios/meeting-lifecycle";
import { taskLifecycleScenario } from "./scenarios/task-lifecycle";

export const SELFTEST_SCENARIOS: TestScenario[] = [
  meetingLifecycleScenario,
  taskLifecycleScenario,
];
