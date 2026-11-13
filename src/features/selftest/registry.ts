import { teamRitualsScenario } from './scenarios/team-rituals';
import { responsibilitiesScenario } from "./scenarios/responsibilities";
import { documentListScenario } from "./scenarios/document-list";
import { documentAnnotationScenario } from "./scenarios/document-annotation";
import { knowledgeLifecycleScenario } from './scenarios/knowledge-lifecycle';
import { adminControlsScenario } from './scenarios/admin-controls';
import { annualTaskStafetteScenario } from './scenarios/annual-task-stafette';
import type { TestScenario } from "./types";
import { meetingLifecycleScenario } from "./scenarios/meeting-lifecycle";
import { taskLifecycleScenario } from "./scenarios/task-lifecycle";
import { taskStafetteLifecycleScenario } from "./scenarios/task-stafette-lifecycle";
import { letterLifecycleScenario } from "./scenarios/letter-lifecycle";
import { caseItemLifecycleScenario } from "./scenarios/case-item-lifecycle";
import { decisionLifecycleScenario } from "./scenarios/decision-lifecycle";
import { appointmentLifecycleScenario } from "./scenarios/appointment-lifecycle";
import { dailyBriefingLifecycleScenario } from "./scenarios/daily-briefing-lifecycle";
import { appointmentRequestLifecycleScenario } from "./scenarios/appointment-request-lifecycle";
import { appointmentBriefingLifecycleScenario } from "./scenarios/appointment-briefing-lifecycle";
import { daySlipLifecycleScenario } from "./scenarios/day-slip-lifecycle";
import { quickNoteLifecycleScenario } from "./scenarios/quick-note-lifecycle";
import { contactLifecycleScenario } from "./scenarios/contact-lifecycle";
import { eventPlanningLifecycleScenario } from "./scenarios/event-planning-lifecycle";
import { workflowRulesScenario } from "./scenarios/workflow-rules";
import { accessBoundariesScenario } from "./scenarios/access-boundaries";
import { jourFixePlatformIntegrationScenario } from './scenarios/jour-fixe-platform-integration';

export const SELFTEST_SCENARIOS: TestScenario[] = [
  teamRitualsScenario,
  responsibilitiesScenario,
  documentListScenario,
  documentAnnotationScenario,
  knowledgeLifecycleScenario,
  adminControlsScenario,
  annualTaskStafetteScenario,
  workflowRulesScenario,
  accessBoundariesScenario,
  meetingLifecycleScenario,
  jourFixePlatformIntegrationScenario,
  appointmentLifecycleScenario,
  dailyBriefingLifecycleScenario,
  eventPlanningLifecycleScenario,
  letterLifecycleScenario,
  caseItemLifecycleScenario,
  appointmentRequestLifecycleScenario,
  appointmentBriefingLifecycleScenario,
  daySlipLifecycleScenario,
  decisionLifecycleScenario,
  taskLifecycleScenario,
  taskStafetteLifecycleScenario,
  quickNoteLifecycleScenario,
  contactLifecycleScenario,
];
