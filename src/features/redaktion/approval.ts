export type EditorialApprovalState = "draft" | "pending_approval" | "approved" | "rejected";

const APPROVAL_ORDER: EditorialApprovalState[] = ["draft", "pending_approval", "approved", "rejected"];

const normalizeApprovalState = (value: string | null | undefined): EditorialApprovalState | null =>
  APPROVAL_ORDER.includes(value as EditorialApprovalState) ? (value as EditorialApprovalState) : null;

/** Freigaben erteilen oder zurücknehmen dürfen nur Büroleitung und Abgeordnete. */
export const canDecideApproval = (hasAdminAccess: boolean): boolean => hasAdminAccess;

/**
 * Auswahl im Freigabe-Dialog: Das Team reicht ein (Angefragt) und nimmt zurück (Entwurf),
 * entscheidet aber nicht. Ein bestehender Zustand bleibt sichtbar, damit nichts verschwindet.
 */
export function approvalOptions(hasAdminAccess: boolean, current: string | null | undefined): EditorialApprovalState[] {
  const options: EditorialApprovalState[] = ["draft", "pending_approval"];
  if (canDecideApproval(hasAdminAccess)) {
    options.push("approved", "rejected");
  }
  const currentState = normalizeApprovalState(current);
  return currentState && !options.includes(currentState) ? [...options, currentState] : options;
}

/** Bestätigte Freigabe: Zustand und Freigabe-Datum sind für das Team gesperrt. */
export const isApprovalLocked = (hasAdminAccess: boolean, approvalState: string | null | undefined): boolean =>
  !canDecideApproval(hasAdminAccess) && approvalState === "approved";

/** Frist des Änderungswunsches in Tagen ab heute, immer mindestens ein Tag. */
export function changeRequestDueDate(days: number, from: Date = new Date()): Date {
  const base = new Date(from);
  const safeDays = Number.isFinite(days) ? Math.max(1, Math.trunc(days)) : 3;
  base.setDate(base.getDate() + safeDays);
  base.setHours(9, 0, 0, 0);
  return base;
}

export const CHANGE_REQUEST_DUE_OPTIONS = [2, 3, 5, 7] as const;
