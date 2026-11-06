import type { TestScenario } from "./types";
import { meetingLifecycleScenario } from "./scenarios/meeting-lifecycle";
import { taskLifecycleScenario } from "./scenarios/task-lifecycle";
import { letterLifecycleScenario } from "./scenarios/letter-lifecycle";
import { caseItemLifecycleScenario } from "./scenarios/case-item-lifecycle";
import { decisionLifecycleScenario } from "./scenarios/decision-lifecycle";
import { appointmentLifecycleScenario } from "./scenarios/appointment-lifecycle";
import { dailyBriefingLifecycleScenario } from "./scenarios/daily-briefing-lifecycle";
import { appointmentRequestLifecycleScenario } from "./scenarios/appointment-request-lifecycle";
import { daySlipLifecycleScenario } from "./scenarios/day-slip-lifecycle";
import { quickNoteLifecycleScenario } from "./scenarios/quick-note-lifecycle";
import { contactLifecycleScenario } from "./scenarios/contact-lifecycle";
import { eventPlanningLifecycleScenario } from "./scenarios/event-planning-lifecycle";

export const SELFTEST_SCENARIOS: TestScenario[] = [
  meetingLifecycleScenario,
  appointmentLifecycleScenario,
  dailyBriefingLifecycleScenario,
  eventPlanningLifecycleScenario,
  letterLifecycleScenario,
  caseItemLifecycleScenario,
  appointmentRequestLifecycleScenario,
  daySlipLifecycleScenario,
  decisionLifecycleScenario,
  taskLifecycleScenario,
  quickNoteLifecycleScenario,
  contactLifecycleScenario,
];
