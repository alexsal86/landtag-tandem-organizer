// Helpers that bind outbound recipients to the caller's own tenants.
// deno-lint-ignore-file no-explicit-any

export async function getCallerTenantIds(admin: any, userId: string): Promise<string[]> {
  const { data } = await admin
    .from("user_tenant_memberships")
    .select("tenant_id")
    .eq("user_id", userId)
    .eq("is_active", true);
  return [...new Set((data ?? []).map((r: any) => r.tenant_id).filter(Boolean))] as string[];
}

/** Returns only user IDs that are active members of one of the given tenants. */
export async function filterTenantUserIds(
  admin: any,
  tenantIds: string[],
  userIds: string[],
): Promise<string[]> {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (ids.length === 0 || tenantIds.length === 0) return [];
  const { data } = await admin
    .from("user_tenant_memberships")
    .select("user_id")
    .in("tenant_id", tenantIds)
    .in("user_id", ids)
    .eq("is_active", true);
  const allowed = new Set((data ?? []).map((r: any) => r.user_id));
  return ids.filter((id) => allowed.has(id));
}

/** Returns only email addresses stored on contacts of the given tenants. */
export async function filterTenantContactEmails(
  admin: any,
  tenantIds: string[],
  emails: string[],
): Promise<string[]> {
  const list = [...new Set(emails.map((e) => e.trim().toLowerCase()).filter((e) => e.includes("@")))];
  if (list.length === 0 || tenantIds.length === 0) return [];
  const { data } = await admin
    .from("contacts")
    .select("email")
    .in("tenant_id", tenantIds)
    .not("email", "is", null);
  const known = new Set((data ?? []).map((r: any) => String(r.email).trim().toLowerCase()));
  return list.filter((e) => known.has(e));
}
