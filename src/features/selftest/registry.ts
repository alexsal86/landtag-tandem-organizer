import { parlisScenario } from "./scenarios/parlis";
import { electionHistoryWorkbenchScenario } from './scenarios/election-history-workbench';
import { electionDeputyReaderScenario } from './scenarios/election-deputy-reader';
import { electionAnalysisScenario } from './scenarios/election-analysis';
import { electionMapScenario } from './scenarios/election-map';
import { onboardingHrScenario } from "./scenarios/onboarding-hr";
import { employeeProtectionScenario } from "./scenarios/employee-protection";
import { employeeMeetingsScenario } from "./scenarios/employee-meetings";
import { securityHardeningScenario } from "./scenarios/security-hardening";
import { teamRitualsScenario } from './scenarios/team-rituals';
import { responsibilitiesScenario } from "./scenarios/responsibilities";
import { documentListScenario } from "./scenarios/document-list";
import { documentAnnotationScenario } from "./scenarios/document-annotation";
import { knowledgeLifecycleScenario } from './scenarios/knowledge-lifecycle';
import { adminControlsScenario } from './scenarios/admin-controls';
import { annualTaskStafetteScenario } from './scenarios/annual-task-stafette';
import { pollLifecycleScenario } from './scenarios/poll-lifecycle';
import type { TestScenario } from "./types";
import { meetingLifecycleScenario } from "./scenarios/meeting-lifecycle";
import { taskLifecycleScenario } from "./scenarios/task-lifecycle";
import { taskStafetteLifecycleScenario } from "./scenarios/task-stafette-lifecycle";
import { letterLifecycleScenario } from "./scenarios/letter-lifecycle";
import { caseItemLifecycleScenario } from "./scenarios/case-item-lifecycle";
import { caseFileLifecycleScenario } from "./scenarios/case-file-lifecycle";
import { topicLinkingScenario } from "./scenarios/topic-linking";
import { decisionLifecycleScenario } from "./scenarios/decision-lifecycle";
import { appointmentLifecycleScenario } from "./scenarios/appointment-lifecycle";
import { dailyBriefingLifecycleScenario } from "./scenarios/daily-briefing-lifecycle";
import { appointmentRequestLifecycleScenario } from "./scenarios/appointment-request-lifecycle";
import { appointmentBriefingLifecycleScenario } from "./scenarios/appointment-briefing-lifecycle";
import { daySlipLifecycleScenario } from "./scenarios/day-slip-lifecycle";
import { quickNoteLifecycleScenario } from "./scenarios/quick-note-lifecycle";
import { contactLifecycleScenario } from "./scenarios/contact-lifecycle";
import { contactRelationsScenario } from "./scenarios/contact-relations";
import { eventPlanningLifecycleScenario } from "./scenarios/event-planning-lifecycle";
import { workflowRulesScenario } from "./scenarios/workflow-rules";
import { accessBoundariesScenario } from "./scenarios/access-boundaries";
import { jourFixePlatformIntegrationScenario } from './scenarios/jour-fixe-platform-integration';
import { socialContentLifecycleScenario } from './scenarios/social-content-lifecycle';
import { notificationInboxScenario } from './scenarios/notification-inbox';

export const SELFTEST_SCENARIOS: TestScenario[] = [
  onboardingHrScenario,
  employeeProtectionScenario,
  employeeMeetingsScenario,
  teamRitualsScenario,
  responsibilitiesScenario,
  documentListScenario,
  electionMapScenario,
  electionAnalysisScenario,
  parlisScenario,
  electionHistoryWorkbenchScenario,
  electionDeputyReaderScenario,
  documentAnnotationScenario,
  knowledgeLifecycleScenario,
  adminControlsScenario,
  annualTaskStafetteScenario,
  workflowRulesScenario,
  accessBoundariesScenario,
  securityHardeningScenario,
  meetingLifecycleScenario,
  jourFixePlatformIntegrationScenario,
  appointmentLifecycleScenario,
  dailyBriefingLifecycleScenario,
  eventPlanningLifecycleScenario,
  letterLifecycleScenario,
  caseItemLifecycleScenario,
  caseFileLifecycleScenario,
  topicLinkingScenario,
  appointmentRequestLifecycleScenario,
  appointmentBriefingLifecycleScenario,
  daySlipLifecycleScenario,
  decisionLifecycleScenario,
  taskLifecycleScenario,
  taskStafetteLifecycleScenario,
  quickNoteLifecycleScenario,
  contactLifecycleScenario,
  contactRelationsScenario,
  pollLifecycleScenario,
  socialContentLifecycleScenario,
  notificationInboxScenario,
];
