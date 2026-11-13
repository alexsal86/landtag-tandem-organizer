import type { ActionItemOwner } from "@/components/employees/types";

/** One task per agreement. For "both", the employee holds the ball. */
export function resolveActionTaskResponsibility(owner: ActionItemOwner, employeeId: string, supervisorId: string) {
  return {
    ballAssigneeId: owner === "supervisor" ? supervisorId : employeeId,
    collaboratorIds: owner === "both" ? [supervisorId].filter(id => id !== employeeId) : [],
  };
}
