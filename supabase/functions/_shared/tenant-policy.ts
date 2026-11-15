export interface MembershipScope {
  tenant_id: string;
  role: string | null;
}

/** Never choose an arbitrary office for a person with multiple memberships. */
export function resolveTenantMembership(
  memberships: MembershipScope[],
  requestedTenantId?: string | null,
): MembershipScope | null {
  if (requestedTenantId) return memberships.find(m => m.tenant_id === requestedTenantId) ?? null;
  return memberships.length === 1 ? memberships[0] : null;
}

export function canForceCalendarResync(role: string | null): boolean {
  return role === "abgeordneter";
}