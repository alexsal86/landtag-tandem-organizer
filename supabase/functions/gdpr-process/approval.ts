export interface DeletionApproval {
  status: string;
  requested_by: string;
  approved_by: string | null;
  approved_at: string | null;
}

export function hasPersonalDeletionApproval(request: DeletionApproval): boolean {
  return request.status === "approved" && !!request.approved_by &&
    request.approved_by !== request.requested_by && !!request.approved_at;
}