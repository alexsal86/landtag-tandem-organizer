export type UserRole = "abgeordneter" | "bueroleitung" | "mitarbeiter" | "praktikant" | null;

export type TabValue =
  | "dashboard"
  | "capture"
  | "tasks"
  | "decisions"
  | "jourFixe"
  | "casefiles"
  | "plannings"
  | "team"
  | "time"
  | "feedbackfeed";

export interface TabPermissionFlags {
  adminOnly?: boolean;
  employeeOnly?: boolean;
  abgeordneterOrBueroOnly?: boolean;
  abgeordneterOnly?: boolean;
}

const employeeRoles = new Set(["mitarbeiter", "praktikant", "bueroleitung"]);

export const getRoleFlags = (role: UserRole) => ({
  isAdmin: role === "abgeordneter" || role === "bueroleitung",
  isEmployee: role ? employeeRoles.has(role) : false,
  isAbgeordneter: role === "abgeordneter",
  isBueroleitung: role === "bueroleitung",
});

export const canViewTab = (flags: TabPermissionFlags, role: UserRole) => {
  const roleFlags = getRoleFlags(role);

  if (flags.adminOnly && !roleFlags.isAdmin) return false;
  if (flags.employeeOnly && !roleFlags.isEmployee) return false;
  if (flags.abgeordneterOrBueroOnly && !roleFlags.isAbgeordneter && !roleFlags.isBueroleitung) return false;
  if (flags.abgeordneterOnly && !roleFlags.isAbgeordneter) return false;

  return true;
};
