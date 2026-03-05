# Rollenmatrix (Global vs. Tenant-lokal)

Diese Matrix trennt explizit zwischen **globalen Plattformrechten** und **tenant-lokalen Fachrechten**.

## 1) Tenant-lokale Fachrollen (fachlich, pro Tenant)

Quelle: `public.user_tenant_memberships`

- Schlüsselattribute für Autorisierung:
  - `user_id`
  - `tenant_id`
  - `role`
  - `is_active = true`
- Typische Rollen:
  - `abgeordneter`
  - `bueroleitung`
  - `mitarbeiter`
  - `praktikant`
- Nutzung:
  - RLS für fachliche Datenzugriffe innerhalb eines Tenants.
  - Admin-Checks über zentrale DB-Funktion `public.is_tenant_admin(user_id, tenant_id)`.

## 2) Globale Plattformrechte

Quelle: `public.user_roles` (nur für wirklich globale, tenant-unabhängige Rechte vorgesehen).

- Keine fachlichen Tenant-Rechte aus `user_roles` ableiten.
- Wenn globale Admin-Rechte benötigt werden, sollen diese tenant-unabhängig modelliert werden
  (z. B. separate Plattform-Rollenlogik / `is_superadmin`).

## 3) Guard gegen Inkonsistenzen

Zur Vermeidung widersprüchlicher Rollenstände existiert eine DB-Validierung über Trigger:

- Änderungen in `user_roles` und `user_tenant_memberships` werden gegengeprüft.
- Falls eine tenant-lokale Rolle in beiden Tabellen widersprüchlich ist, wird die Änderung mit Fehler abgewiesen.

## 4) Leitlinie für neue Policies/Funktionen

- Tenant-spezifische Autorisierung **immer** über `user_tenant_memberships` + `tenant_id` + `is_active`.
- Bevorzugt zentrale DB-Helfer nutzen:
  - `public.has_active_tenant_role(user_id, tenant_id, roles[])`
  - `public.is_tenant_admin(user_id, tenant_id)`
- `user_roles` nicht für tenant-gebundene Fachlogik verwenden.
