/** Tabs reachable via /employee?tab=… – unknown values fall back to the profile overview. */
export const EMPLOYEE_TABS = [
  "overview",
  "meetings",
  "timetracking",
  "responsibilities",
  "hr",
  "rituals",
] as const;

export type EmployeeTab = (typeof EMPLOYEE_TABS)[number];

export function resolveEmployeeTab(requested: string | null | undefined): EmployeeTab {
  return EMPLOYEE_TABS.includes(requested as EmployeeTab) ? (requested as EmployeeTab) : "overview";
}
