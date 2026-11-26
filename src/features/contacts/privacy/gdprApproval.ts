/**
 * Reine Regeln des Vier-Augen-Prinzips für DSGVO-Löschanfragen. Die Oberfläche
 * nutzt sie für die Freigabe-Schaltfläche; die Datenbank prüft dieselben
 * Bedingungen zusätzlich (gdpr_check_four_eyes) und lehnt Eigenfreigaben ab.
 */

export const GDPR_APPROVER_ROLES = ["abgeordneter", "bueroleitung"] as const;

export type GdprApproverRole = (typeof GDPR_APPROVER_ROLES)[number];

export function isGdprApproverRole(role: string | null | undefined): boolean {
  return Boolean(role) && (GDPR_APPROVER_ROLES as readonly string[]).includes(role as string);
}

export interface GdprApprovalCandidate {
  request_type: string;
  status: string;
  requested_by: string;
}

export type GdprApprovalDecision =
  | { allowed: true }
  | { allowed: false; reason: string };

/** Prüft, ob die angemeldete Person diese Löschanfrage freigeben darf. */
export function canApproveGdprDelete(
  request: GdprApprovalCandidate,
  actorId: string | null | undefined,
): GdprApprovalDecision {
  if (request.request_type !== "delete") {
    return { allowed: false, reason: "Nur Löschanfragen benötigen eine Freigabe." };
  }
  if (request.status !== "pending") {
    return { allowed: false, reason: "Die Anfrage ist nicht mehr ausstehend." };
  }
  if (!actorId) {
    return { allowed: false, reason: "Freigabe erfordert eine angemeldete Person." };
  }
  if (actorId === request.requested_by) {
    return { allowed: false, reason: "Vier-Augen-Prinzip: Die eigene Anfrage kann niemand selbst freigeben." };
  }
  return { allowed: true };
}

export interface GdprApprovedRequest extends GdprApprovalCandidate {
  approved_by: string | null;
  approved_at: string | null;
}

/** Freigabe gilt nur mit personenbezogener Zustimmung einer zweiten Person. */
export function isApprovedBySecondPerson(request: GdprApprovedRequest): boolean {
  if (request.request_type !== "delete" || request.status !== "approved") return false;
  if (!request.approved_by || !request.approved_at) return false;
  return request.approved_by !== request.requested_by;
}
