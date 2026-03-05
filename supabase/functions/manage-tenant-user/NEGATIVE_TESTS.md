# Negative Tests (Permission Enforcement)

## Szenario: Admin in Tenant A, kein Admin in Tenant B

- **Given:** Benutzer `U1` hat eine aktive Membership mit `role = abgeordneter` in `tenant_id = A`.
- **And:** Benutzer `U1` hat **keine** aktive `abgeordneter`-Membership in `tenant_id = B`.
- **When:** `U1` ruft eine tenant-gebundene Action auf (`removeTenantMembership`, `updateRole`, `deleteUser` mit `tenantId = B`).
- **Then:** Die Function muss mit HTTP-Status `403` und Fehler `Insufficient permissions` (bzw. bei `deleteUser` tenant-spezifisch) antworten.

## Zusätzliche Negativfälle

- Action ohne `tenantId` (`listAllUsers`, `deleteUser` ohne `tenantId`) durch Nicht-Superadmin → **403**.
- Tenant-gebundene Action mit inaktivem Membership-Record (`is_active = false`) trotz passender Rolle → **403**.
- Tenant-gebundene Action mit aktivem Membership, aber falscher Rolle (nicht `abgeordneter`) → **403**.
