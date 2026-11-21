export interface TaskPackageRuleAccess {
  trigger_type: string;
  actions: unknown;
}

/** Members may execute only a single, manual package action; all other rules stay admin-only. */
export function isMemberTaskPackage(rule: TaskPackageRuleAccess, isInternalCall: boolean): boolean {
  if (isInternalCall || rule.trigger_type !== "manual" || !Array.isArray(rule.actions) || rule.actions.length !== 1) return false;
  const action = rule.actions[0] as Record<string, unknown> | null;
  return action?.type === "create_task_package";
}
