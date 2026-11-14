export interface ActiveTenantScope {
  userId: string;
  tenantId: string;
}

let activeScope: ActiveTenantScope | null = null;
let scopeRevision = 0;

/** Set only by TenantProvider after validating the user's active membership. */
export function setActiveTenantScope(scope: ActiveTenantScope | null): boolean {
  if (activeScope?.userId === scope?.userId && activeScope?.tenantId === scope?.tenantId) {
    return false;
  }
  activeScope = scope ? { ...scope } : null;
  scopeRevision += 1;
  return true;
}

export function getActiveTenantScope(): ActiveTenantScope | null {
  return activeScope ? { ...activeScope } : null;
}

/** Detects responses that started before a tenant/user switch. */
export function getTenantScopeRevision(): number {
  return scopeRevision;
}
