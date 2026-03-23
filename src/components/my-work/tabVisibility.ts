import type { ResolvedUserRole as UserRole } from "@/hooks/useResolvedUserRole";
import type { TabValue } from "@/components/my-work/myWorkTabs";

export type { UserRole, TabValue };

export interface TabPermissionFlags {
  teamLeadsOnly?: boolean;
  employeeOnly?: boolean;
  abgeordneterOrBueroOnly?: boolean;
  abgeordneterOnly?: boolean;
  feedbackFeedCoreRolesOnly?: boolean;
}

const employeeRoles = new Set(["mitarbeiter", "praktikant", "bueroleitung"]);
const feedbackFeedCoreRoles = new Set<UserRole>(["mitarbeiter", "bueroleitung", "abgeordneter"]);

export const getRoleFlags = (role: UserRole) => ({
  canViewTeam: role === "abgeordneter" || role === "bueroleitung",
  isEmployee: role ? employeeRoles.has(role) : false,
  isAbgeordneter: role === "abgeordneter",
  isBueroleitung: role === "bueroleitung",
});

export const canViewTab = (flags: TabPermissionFlags, role: UserRole) => {
  const roleFlags = getRoleFlags(role);

  if (flags.teamLeadsOnly && !roleFlags.canViewTeam) return false;
  if (flags.employeeOnly && !roleFlags.isEmployee) return false;
  if (flags.abgeordneterOrBueroOnly && !roleFlags.isAbgeordneter && !roleFlags.isBueroleitung) return false;
  if (flags.abgeordneterOnly && !roleFlags.isAbgeordneter) return false;
  if (flags.feedbackFeedCoreRolesOnly && !feedbackFeedCoreRoles.has(role)) return false;

  return true;
};
