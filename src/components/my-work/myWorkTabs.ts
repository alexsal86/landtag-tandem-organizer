import { Briefcase, Calendar, CheckSquare, Clock, Home, Lightbulb, MessageSquare, StickyNote, Users, Vote } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { UserRole } from "@/components/my-work/tabVisibility";
import { canViewTab } from "@/components/my-work/tabVisibility";

export interface TabCounts {
  tasks: number;
  decisions: number;
  cases: number;
  plannings: number;
  team: number;
  jourFixe: number;
  feedbackFeed: number;
  redaktion: number;
}

export type TabValue =
  | "dashboard"
  | "capture"
  | "tasks"
  | "decisions"
  | "jourFixe"
  | "cases"
  | "plannings"
  | "redaktion"
  | "team"
  | "time"
  | "feedbackfeed";

export interface MyWorkTabConfig {
  value: TabValue;
  label: string;
  icon: LucideIcon;
  countKey?: keyof TabCounts;
  badgeVariant?: "secondary" | "destructive";
  teamLeadsOnly?: boolean;
  employeeOnly?: boolean;
  abgeordneterOrBueroOnly?: boolean;
  abgeordneterOnly?: boolean;
  feedbackFeedCoreRolesOnly?: boolean;
  isLogo?: boolean;
}

export const MY_WORK_TABS: MyWorkTabConfig[] = [
  { value: "dashboard", label: "", icon: Home, isLogo: true },
  { value: "capture", label: "Quick Notes", icon: StickyNote },
  { value: "cases", label: "Vorgänge", icon: Briefcase, countKey: "cases" },
  { value: "tasks", label: "Aufgaben", icon: CheckSquare, countKey: "tasks" },
  { value: "decisions", label: "Entscheidungen", icon: Vote, countKey: "decisions" },
  { value: "jourFixe", label: "Jour fixe & Planungen", icon: Calendar, countKey: "jourFixe" },
  { value: "redaktion", label: "Redaktion", icon: Lightbulb, countKey: "redaktion" },
  { value: "time", label: "Meine Zeit", icon: Clock, employeeOnly: true },
  { value: "feedbackfeed", label: "Rückmeldungen", icon: MessageSquare, countKey: "feedbackFeed" },
  // Team-Tab: nur Rollen mit Führungs-/Koordinationsverantwortung sehen aggregierte Mitarbeiterdaten.
  { value: "team", label: "Team", icon: Users, countKey: "team", badgeVariant: "destructive", teamLeadsOnly: true },
];

export const LEGACY_TAB_MAP: Record<string, TabValue> = {
  caseitems: "cases",
  casefiles: "cases",
  appointmentfeedback: "feedbackfeed",
  plannings: "jourFixe",
};

export const MY_WORK_ALLOWED_TABS = new Set<TabValue>(MY_WORK_TABS.map((tab) => tab.value));

export const MY_WORK_TAB_VISIT_CONTEXTS: Record<TabValue, string[]> = {
  dashboard: [],
  capture: [],
  tasks: ["mywork_tasks"],
  decisions: ["mywork_decisions"],
  jourFixe: ["mywork_jourFixe"],
  cases: ["mywork_caseitems", "mywork_casefiles"],
  plannings: ["mywork_plannings"],
  redaktion: [],
  time: [],
  team: ["mywork_team"],
  feedbackfeed: ["mywork_feedbackfeed"],
};

export const MY_WORK_ACTION_TAB_MAP: Record<string, TabValue> = {
  "create-task": "tasks",
  "create-decision": "decisions",
  "create-meeting": "jourFixe",
  "create-caseitem": "cases",
  "create-casefile": "cases",
  "create-eventplanning": "jourFixe",
};

export const getVisibleMyWorkTabs = ({
  role,
  feedbackFeedCoreRolesOnly,
}: {
  role: UserRole;
  feedbackFeedCoreRolesOnly: boolean;
}) => MY_WORK_TABS.filter((tab) => canViewTab(tab.value === "feedbackfeed" ? { ...tab, feedbackFeedCoreRolesOnly } : tab, role));
