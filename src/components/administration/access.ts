export function getAdministrationAccess(tenantRole: string | null, platformAdmin: boolean) {
  return {
    isAdmin: platformAdmin || tenantRole === "abgeordneter" || tenantRole === "bueroleitung",
    isSuperAdmin: platformAdmin,
  };
}

