# Administration, Sicherheit & Qualität

_Auto-generiert mit `npm run update:feature-catalog` aus dem zentralen Funktionskatalog (`src/features/feature-catalog/inventory/verwaltung.json`). Nicht von Hand bearbeiten._

**Zweck:** Rollen, Rechte, Feature Flags, Audit, DSGVO, Sicherheits-Cockpit, Selbsttests und Funktionskatalog als administrative und qualitätssichernde Querschnittsfunktionen.

## Kennzahlen

- Funktionen: **24** in **11** Unterbereichen
- implementiert: **24**, teilweise: **0**, deaktiviert: **0**, potenziell verwaist: **0**
- ohne zugeordneten Test: **14**
- ohne Dokumentationsverweis: **9**

## Funktionen

| Funktion | Unterbereich | Kategorie | Implementierung | Einbindung | Abdeckung |
|---|---|---|---|---|---|
| `admin.workspace` Administrationsbereich und Zugriff | Administration | administrativ | implementiert | rollenabhängig | Unit-Test |
| `admin.audit-log` Audit-Trail einsehen und exportieren | Audit | sicherheit | implementiert | rollenabhängig | kein Test |
| `admin.bulk-audit` Massenaktions-Audit | Audit | sicherheit | implementiert | rollenabhängig | kein Test |
| `admin.performance` Performance- und Größen-Dashboard | Betrieb | administrativ | implementiert | rollenabhängig | kein Test |
| `admin.maintenance` Wartungs- und Aufräumläufe | Betrieb | automatisiert | implementiert | systemseitig | kein Test |
| `admin.data-lint` Datenqualitätsprüfung | Datenqualität | administrativ | implementiert | rollenabhängig | kein Test |
| `admin.gdpr` DSGVO-Löschanträge | Datenschutz | sicherheit | implementiert | rollenabhängig | kein Test |
| `admin.templates-senders` Administrative Vorlagen und Absenderdaten | Konfiguration | administrativ | implementiert | rollenabhängig | kein Test |
| `admin.configuration` Konfigurierbare Stammdaten pflegen | Konfiguration | administrativ | implementiert | rollenabhängig | kein Test |
| `admin.onboarding-login` Onboarding-Folien und Login-Anpassung | Konfiguration | administrativ | implementiert | rollenabhängig | kein Test |
| `admin.users-sessions` Benutzer, MFA und Sitzungen | Mandanten | administrativ | implementiert | rollenabhängig | kein Test |
| `admin.tenants` Mandantenverwaltung | Mandanten | administrativ | implementiert | rollenabhängig | kein Test |
| `admin.feature-catalog` Funktionskatalog und Inventarisierung | Qualität | administrativ | implementiert | rollenabhängig | Unit-Test |
| `admin.selftest-center` Selbsttest-Center | Qualität | administrativ | implementiert | rollenabhängig | Selbsttest |
| `admin.system-pulse` System-Puls | Qualität | administrativ | implementiert | rollenabhängig | Unit-Test |
| `admin.action-permissions` Aktionsberechtigungen | Rollen & Rechte | sicherheit | implementiert | rollenabhängig | Selbsttest |
| `admin.roles` Benutzerrollen verwalten | Rollen & Rechte | administrativ | implementiert | rollenabhängig | Selbsttest |
| `admin.feature-flags` Feature Flags | Rollen & Rechte | administrativ | implementiert | Feature Flag | kein Test |
| `admin.field-permissions` Feldschutz | Rollen & Rechte | sicherheit | implementiert | rollenabhängig | Selbsttest |
| `admin.permissions-explorer` Rechte-Explorer und Rechteerklärung | Rollen & Rechte | administrativ | implementiert | UI | Unit-Test |
| `admin.edge-function-security` Edge-Function-Sicherheitsklassifikation | Sicherheit | sicherheit | implementiert | nicht anwendbar | kein Test |
| `admin.security-cockpit` Security-Cockpit | Sicherheit | sicherheit | implementiert | rollenabhängig | Unit-Test |
| `admin.access-boundaries` Zugriffsschutzprüfung | Sicherheit | sicherheit | implementiert | nicht anwendbar | Selbsttest |
| `platform.notification-dispatch` Benachrichtigungs- und Audit-Trigger | Technische Basisfunktionen | technisch | implementiert | systemseitig | kein Test |

## Unterbereiche

- Administration
- Rollen & Rechte
- Audit
- Datenschutz
- Sicherheit
- Qualität
- Datenqualität
- Betrieb
- Mandanten
- Konfiguration
- Technische Basisfunktionen

## Rollen

`admin`, `bueroleitung`, `superadmin`, `abgeordneter`, `mitarbeiter`, `system`

## Datenbanktabellen

`action_permissions`, `appointment_categories`, `appointment_requests`, `audit_log_entries`, `bulk_action_audit`, `case_items`, `contacts`, `data_lint_findings`, `document_categories`, `edge_function_cache`, `email_templates`, `field_permissions`, `gdpr_requests`, `information_blocks`, `login_customization`, `news_articles`, `notifications`, `planning_templates`, `press_releases`, `profiles`, `push_subscriptions`, `security_audit_snapshots`, `selftest_runs`, `sender_information`, `superadmin_users`, `system_health`, `task_categories`, `task_statuses`, `tenant_collaborations`, `tenant_feature_flags`, `tenant_onboarding_checklist_items`, `tenant_onboarding_slides`, `tenants`, `todo_categories`, `user_onboarding_state`, `user_roles`, `user_sessions`, `user_status`, `user_tenant_memberships`, `v_rls_coverage`, `workflow_runs`

## Selbsttest-Szenarien

| Szenario | Titel | deklarierte Tabellen | deklarierte Prüfungen | letzter Lauf |
|---|---|---:|---:|---|
| `access-boundaries` | Zugriffsschutz (Bürogrenzen und Entscheiderrolle) | 1 | 4 | — |
| `admin-controls` | Adminregeln: Feldschutz, Aktionen, Export, Rücknahme und Feeds | 0 | 4 | — |

## Selbsttest-Schritte

Diese Schritte führen die Szenarien aus; „letzter Lauf“ stammt aus `src/features/selftest/last-runs.json`, nicht aus dieser Doku.

| Szenario | Schritt | Bezeichnung | Art | letzter Lauf |
|---|---|---|---|---|
| `access-boundaries` | `edge-tenant-role-boundary` | Erhöhte Rechte gelten nur im ausgewählten Büro | logic | — |
| `access-boundaries` | `active-tenant-query-guard` | Fachdatenabfragen bleiben im aktiven Büro | logic | — |
| `access-boundaries` | `admin-sort-guard` | Konfigurationssortierung: Rollenprüfung und Tabellen-Whitelist | workflow | — |
| `access-boundaries` | `calendar-schedule` | Kalenderplan: Minuten, Sommerzeit und Wiederholungsstunde | workflow | — |
| `access-boundaries` | `office-default-template` | Meeting-Standardvorlage ist pro Büro eindeutig | workflow | — |
| `access-boundaries` | `admin-role-guard` | Globale Rollenänderung: Plattformrecht und gültige Rolle erforderlich | workflow | — |
| `access-boundaries` | `foreign-tenant` | Schreiben mit nicht zugehöriger Büro-ID wird verweigert | workflow | — |
| `access-boundaries` | `create-request` | Eigene Testanfrage für Rollenprüfung anlegen | db | — |
| `access-boundaries` | `role-decision` | Entscheidungsfunktion respektiert die aktuelle Rolle | workflow | — |
| `admin-controls` | `feed-rules` | Feedtest sperrt lokale Ziele, Zugangsdaten und Sonderports | logic | — |
| `admin-controls` | `full-export` | Gesamtexport paginiert und schützt vor Formelauswertung | logic | — |
| `admin-controls` | `module-routes` | Direktlinks der Module sind dem jeweiligen Schalter zugeordnet | logic | — |
| `admin-controls` | `module-tabs` | Redaktions-Reiter hängt am Modulschalter | logic | — |
| `admin-controls` | `redaktion-meldungen` | Redaktionsmeldungen sind je Mandant angelegt | workflow | — |
| `admin-controls` | `field-modes` | Leseregeln liefern erlauben, Feld ausblenden oder Datensatz sperren | workflow | — |
| `admin-controls` | `foreign-action` | Aktionsprüfung kann nicht für eine fremde Identität aufgerufen werden | workflow | — |
| `admin-controls` | `invalid-bulk` | Leere Sammelaktion und unbekannte Rücknahme verändern keine Kontakte | workflow | — |

## Deklarierter Prüfumfang

### `access-boundaries`

1. Fachdatenabfragen werden zentral auf das aktive Büro begrenzt
2. Schreibversuch mit fremder Büro-ID scheitert am Client-Schutz oder an RLS
3. Unberechtigte Rolle darf nicht entscheiden
4. Berechtigte Rolle darf ablehnen

### `admin-controls`

1. Export über 1000 Einträge ohne CSV-Formeln
2. Private Feedziele abgewiesen
3. Beide Feldlesemodi im aktuellen Büro
4. Fremde Aktion und ungültige Rücknahme abgewiesen

## Funktionsdetails

### `admin.workspace` — Administrationsbereich und Zugriff
Bündelt administrative Themen in einer eigenen Oberfläche, prüft den Zugriff und führt die administrative Navigation.

- **Kategorie:** administrativ
- **Implementierung:** implementiert
- **Einbindung:** rollenabhängig
- **Testabdeckung:** Unit-Test
- **Letztes Testergebnis:** unbekannt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `admin`, `bueroleitung`, `superadmin`
- **Routen:** `/administration`
- **Frontend-Komponenten:** `src/pages/Administration.tsx`, `src/components/administration/AdminSidebar.tsx`
- **Services:** `src/components/administration/adminNavigation.ts`
- **Hooks:** `src/components/administration/useAdministrationAccess.ts`
- **Edge Functions:** —
- **Datenbankfunktionen:** —
- **Tabellen:** `user_roles`, `user_tenant_memberships`
- **Abhängigkeiten:** `admin.roles`
- **Selbsttests:** —
- **Unit-Tests:** `src/components/administration/useAdministrationAccess.test.tsx`, `src/components/administration/access.test.ts`
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** `docs/rollenrechte-matrix.md`

**Nachweise im Quellcode**

- src/pages/Administration.tsx
- src/components/administration/AdminSidebar.tsx
- src/components/administration/adminNavigation.ts
- src/components/administration/useAdministrationAccess.ts

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Der Zugriff ist über Hook-Tests abgedeckt, aber nicht in einem Selbsttest-Szenario.

### `admin.roles` — Benutzerrollen verwalten
Vergibt und entzieht Rollen je Büro, verhindert inkonsistente Doppelrollen und erklärt die resultierenden Rechte.

- **Kategorie:** administrativ
- **Implementierung:** implementiert
- **Einbindung:** rollenabhängig
- **Testabdeckung:** Selbsttest
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `admin`, `bueroleitung`, `superadmin`
- **Routen:** —
- **Frontend-Komponenten:** `src/components/administration/UserRolesManager.tsx`, `src/components/admin/UserAssignmentDialog.tsx`
- **Services:** —
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** `replace_user_role`, `enforce_role_consistency_between_global_and_tenant`, `get_user_role_level`, `is_admin`, `is_tenant_admin`, `reorder_admin_items`, `set_admin_user_colors`
- **Tabellen:** `user_roles`, `user_tenant_memberships`, `profiles`, `tenants`
- **Abhängigkeiten:** —
- **Selbsttests:** `admin-controls`
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** `docs/rollenrechte-matrix.md`, `docs/role-check-migration.md`

**Nachweise im Quellcode**

- src/components/administration/UserRolesManager.tsx
- src/features/selftest/scenarios/admin-controls.ts

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `admin.permissions-explorer` — Rechte-Explorer und Rechteerklärung
Erklärt, warum eine Rolle eine Aktion, ein Feld oder ein Feature darf, und macht die Entscheidung nachvollziehbar.

- **Kategorie:** administrativ
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** Unit-Test
- **Letztes Testergebnis:** unbekannt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `admin`, `bueroleitung`, `superadmin`
- **Routen:** —
- **Frontend-Komponenten:** `src/features/permissions/PermissionExplorer.tsx`
- **Services:** `src/features/permissions/explain.ts`, `src/features/permissions/catalog.ts`
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** `explain_permissions`, `explain_action_permission`, `explain_field_permission`, `explain_feature_flag`, `permission_action_decision`, `permission_field_decision`, `permission_feature_decision`, `permission_role_label`
- **Tabellen:** `action_permissions`, `field_permissions`, `tenant_feature_flags`
- **Abhängigkeiten:** —
- **Selbsttests:** —
- **Unit-Tests:** `src/features/permissions/explain.test.ts`
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** `docs/rollenrechte-matrix.md`

**Nachweise im Quellcode**

- src/features/permissions/PermissionExplorer.tsx
- src/features/permissions/explain.ts

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `admin.field-permissions` — Feldschutz
Beschränkt Lese- und Schreibrechte auf einzelne Felder und erzwingt sie zusätzlich in der Datenbank.

- **Kategorie:** sicherheit
- **Implementierung:** implementiert
- **Einbindung:** rollenabhängig
- **Testabdeckung:** Selbsttest
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `admin`, `bueroleitung`
- **Routen:** —
- **Frontend-Komponenten:** `src/components/administration/PermissionsManager.tsx`
- **Services:** —
- **Hooks:** `src/hooks/useFieldPermission.ts`, `src/hooks/useActionPermission.ts`
- **Edge Functions:** —
- **Datenbankfunktionen:** `enforce_configured_field_writes`, `can_read_field`, `can_write_field`, `field_read_rule`, `field_row_visible`
- **Tabellen:** `field_permissions`, `action_permissions`
- **Abhängigkeiten:** —
- **Selbsttests:** `admin-controls`
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** `docs/security-function-matrix.md`, `docs/rollenrechte-matrix.md`

**Nachweise im Quellcode**

- src/components/administration/PermissionsManager.tsx
- src/hooks/useFieldPermission.ts

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `admin.feature-flags` — Feature Flags
Schaltet Funktionen je Mandant oder global über Flags und macht die Entscheidung erklärbar.

- **Kategorie:** administrativ
- **Implementierung:** implementiert
- **Einbindung:** Feature Flag
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `admin`, `superadmin`
- **Routen:** —
- **Frontend-Komponenten:** —
- **Services:** —
- **Hooks:** `src/hooks/useFeatureFlag.tsx`, `src/hooks/useTenantFeatureFlag.ts`
- **Edge Functions:** —
- **Datenbankfunktionen:** `is_feature_enabled`, `explain_feature_flag`
- **Tabellen:** `tenant_feature_flags`
- **Abhängigkeiten:** —
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/hooks/useFeatureFlag.tsx
- src/hooks/useTenantFeatureFlag.ts

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Die Menge der tatsächlich ausgewerteten Flags ist nicht zentral deklariert; UI-Flächen wurden nicht einzeln geprüft.

### `admin.action-permissions` — Aktionsberechtigungen
Legt je Aktion fest, welche Rollen sie ausführen dürfen, und prüft sie in UI und Datenbank.

- **Kategorie:** sicherheit
- **Implementierung:** implementiert
- **Einbindung:** rollenabhängig
- **Testabdeckung:** Selbsttest
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `admin`, `bueroleitung`, `abgeordneter`, `mitarbeiter`
- **Routen:** —
- **Frontend-Komponenten:** —
- **Services:** —
- **Hooks:** `src/hooks/useActionPermission.ts`
- **Edge Functions:** —
- **Datenbankfunktionen:** `is_action_allowed`, `is_tenant_action_allowed`, `enforce_configured_action`
- **Tabellen:** `action_permissions`
- **Abhängigkeiten:** —
- **Selbsttests:** `access-boundaries`
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/hooks/useActionPermission.ts
- src/features/selftest/scenarios/access-boundaries.ts

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `admin.audit-log` — Audit-Trail einsehen und exportieren
Protokolliert sicherheits- und fachrelevante Änderungen und erlaubt Suche und Export.

- **Kategorie:** sicherheit
- **Implementierung:** implementiert
- **Einbindung:** rollenabhängig
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `admin`, `bueroleitung`, `superadmin`
- **Routen:** —
- **Frontend-Komponenten:** `src/components/administration/AuditLogViewer.tsx`
- **Services:** —
- **Hooks:** `src/hooks/useAuditLog.ts`
- **Edge Functions:** `log-audit-event`
- **Datenbankfunktionen:** `log_audit_event`, `search_admin_audit_logs`, `export_admin_audit_logs`, `is_admin_for_audit_logs`
- **Tabellen:** `audit_log_entries`
- **Abhängigkeiten:** —
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** `docs/security-function-matrix.md`

**Nachweise im Quellcode**

- src/components/administration/AuditLogViewer.tsx
- src/hooks/useAuditLog.ts

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `admin.bulk-audit` — Massenaktions-Audit
Protokolliert Massenänderungen, erlaubt Rücknahme und räumt alte Audit-Einträge auf.

- **Kategorie:** sicherheit
- **Implementierung:** implementiert
- **Einbindung:** rollenabhängig
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `admin`, `bueroleitung`
- **Routen:** —
- **Frontend-Komponenten:** `src/components/administration/BulkActionAuditViewer.tsx`
- **Services:** —
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** `cleanup_bulk_action_audit`
- **Tabellen:** `bulk_action_audit`
- **Abhängigkeiten:** —
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/components/administration/BulkActionAuditViewer.tsx

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `admin.gdpr` — DSGVO-Löschanträge
Verwaltet Löschanträge mit Vier-Augen-Freigabe durch die Datenbank und atomarem Claim vor destruktiver Ausführung.

- **Kategorie:** sicherheit
- **Implementierung:** implementiert
- **Einbindung:** rollenabhängig
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `admin`, `superadmin`
- **Routen:** —
- **Frontend-Komponenten:** `src/components/administration/GdprRequestsManager.tsx`
- **Services:** —
- **Hooks:** —
- **Edge Functions:** `gdpr-process`
- **Datenbankfunktionen:** `approve_gdpr_delete`, `gdpr_check_four_eyes`, `gdpr_set_updated_at`
- **Tabellen:** `gdpr_requests`, `contacts`
- **Abhängigkeiten:** —
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** `docs/disaster-recovery.md`

**Nachweise im Quellcode**

- src/components/administration/GdprRequestsManager.tsx
- supabase/functions/gdpr-process/index.ts

**Bekannte Einschränkungen**

- Der Vier-Augen-Prozess ist nur über Code und Migration nachgewiesen; kein Testlauf gegen eine Datenbank in dieser Umgebung.

**Offene Prüfpunkte**

- Keine.

### `admin.security-cockpit` — Security-Cockpit
Zeigt RLS-Lücken, Policies, Snapshots und Audit-Trail als eigenständige Sicherheitssicht; Befunde verweisen auf die betroffenen Funktionen und sind von fachlichen Testergebnissen getrennt. Auffällige Befunde lassen sich je Zeile nachtesten: Es laufen die Selbsttests, die die betroffene Tabelle laut Coverage-Übersicht abdecken; Tabellen ohne abdeckendes Szenario bieten keinen Button.

- **Kategorie:** sicherheit
- **Implementierung:** implementiert
- **Einbindung:** rollenabhängig
- **Testabdeckung:** Unit-Test
- **Letztes Testergebnis:** bestanden (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `admin`, `superadmin`
- **Routen:** —
- **Frontend-Komponenten:** `src/components/administration/SecurityCockpit.tsx`, `src/features/feature-catalog/useTableSecurity.ts`, `src/features/feature-catalog/securityLinks.ts`
- **Services:** —
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** `audit_rls_gaps`, `audit_rls_policies`, `snapshot_rls_coverage`, `snapshot_rls_coverage_internal`
- **Tabellen:** `security_audit_snapshots`, `audit_log_entries`, `v_rls_coverage`
- **Abhängigkeiten:** —
- **Selbsttests:** —
- **Unit-Tests:** `src/components/administration/SecurityCockpit.test.tsx`, `src/features/selftest/tableRetests.test.ts`
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** `docs/security-function-matrix.md`, `docs/role-check-migration.md`

**Nachweise im Quellcode**

- src/components/administration/SecurityCockpit.tsx
- src/features/feature-catalog/useTableSecurity.ts
- src/features/feature-catalog/securityLinks.ts
- supabase/migrations/20261125160000_feature_security_policy_links.sql

**Bekannte Einschränkungen**

- Eine vorhandene RLS-Policy ist kein Nachweis für korrekte Mandantentrennung; das Cockpit liefert nur Befunde.
- Policy-Details stammen live aus pg_policies und bewerten weder die Funktion noch ihre Tests.
- Der Nachtest führt die Selbsttests aus, die die Tabelle laut Coverage-Übersicht abdecken; er beweist nicht, dass genau die beanstandete Policy korrekt ist.
- Für Tabellen ohne abdeckendes Selbsttest-Szenario bleibt die Nachtest-Zelle leer; diese Lücke schließt nur ein neues Szenario in src/features/selftest/scenarios.

**Offene Prüfpunkte**

- Funktionen ohne Tabellenbezug erhalten keinen RLS-Bezug; ob das fachlich korrekt ist, bleibt je Funktion zu prüfen.

### `admin.system-pulse` — System-Puls
Bildet alle registrierten Selbsttest-Szenarien in fachlichen Bereichen ab und zeigt je Funktionsbereich die letzten funktionalen Selbsttest-Ergebnisse als Ampel, startet die zugeordneten Szenarien aus der Detailkarte im Hintergrund, stellt die deklarierten Szenario-Schritte als Prozesskette mit gespeicherten Schritt-Ergebnissen dar und nennt bei fehlgeschlagenen Schritten Prüfpunkt, Fehlercode und Kurzdetails, führt ein fehlgeschlagenes Aufräumen als eigene Zeile mit der gespeicherten Aufräummeldung auf, statt es hinter einem pauschalen „Test fehlgeschlagen“ zu verbergen, listet alle fehlgeschlagenen Tests als kompakte Tabelle oberhalb der Bereichskacheln mit Bereich, geprüftem Schritt und Fehler auf und testet sie über einen je Szenario gebündelten Button direkt an der Zeile nach, ohne den Bereich erst zu öffnen, nennt darunter in einer einklappbaren Übersicht für jeden durchführbaren Test die zwei langsamsten Teilabschnitte mit Dauer und sortiert den langsamsten Abschnitt nach oben, erklärt die Bedeutung der Ampelfarben, zeigt je Workflow Testname, Zeitpunkt, Dauer, Beschreibung und Prüfumfang, bewertet Frische, App-Version, Demo- und Aufräumstatus, nennt Abdeckung und Verlauf, erlaubt gezielte Nachläufe und verknüpft betroffene Katalogfunktionen sowie RLS-Befunde, während RLS-Lücken als eigene Kennzahl getrennt von den Testergebnissen aus.

- **Kategorie:** administrativ
- **Implementierung:** implementiert
- **Einbindung:** rollenabhängig
- **Testabdeckung:** Unit-Test
- **Letztes Testergebnis:** bestanden (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `admin`, `superadmin`
- **Routen:** —
- **Frontend-Komponenten:** `src/features/system-pulse/SystemPulse.tsx`, `src/features/system-pulse/pulse.ts`, `src/features/system-pulse/pulse-areas.config.json`, `src/features/system-pulse/generated/pulse-areas.json`
- **Services:** `scripts/build-pulse-areas.mjs`
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** `get_latest_selftest_runs`, `get_selftest_run_history`
- **Tabellen:** `selftest_runs`
- **Abhängigkeiten:** `admin.security-cockpit`, `admin.selftest-center`
- **Selbsttests:** —
- **Unit-Tests:** `src/features/system-pulse/pulse.test.ts`, `src/features/system-pulse/SystemPulse.test.tsx`, `scripts/__tests__/pulse-areas.test.mjs`
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** `docs/selftest-center.md`

**Nachweise im Quellcode**

- src/features/system-pulse/SystemPulse.tsx
- src/features/system-pulse/pulse.ts
- src/features/system-pulse/pulse-areas.config.json
- src/features/system-pulse/generated/pulse-areas.json
- scripts/build-pulse-areas.mjs
- supabase/migrations/20261125170000_get_latest_selftest_runs.sql
- supabase/migrations/20261125180000_latest_selftest_runs_steps.sql
- supabase/migrations/20261125190000_latest_selftest_runs_run_meta.sql
- supabase/migrations/20261125200000_selftest_pulse_quality_and_history.sql

**Bekannte Einschränkungen**

- Die Testhistorie lädt über get_latest_selftest_runs und get_selftest_run_history; beide RPCs sowie die Qualitätsfelder app_version, keep_data und cleanup sind im Backend vorhanden (per PostgREST geprüft). Fehlen sie in einer Umgebung, zeigt die Karte „Testlage unbekannt“ statt serverseitiger Ergebnisse.
- Dynamisch erzeugte Schritte (z. B. die Plattformquellen im Jour fixe) stehen erst nach einem Lauf in der Kette; sie werden dann aus den gespeicherten Schritten ergänzt und als nicht deklariert gekennzeichnet.
- Verlauf und Dauertrend benötigen die separate RPC get_selftest_run_history; ohne sie bleibt die Ampel nutzbar, aber ohne Trend und Wiederholungszähler.
- Der Live-Teststart schreibt echte Testdaten und Dateien, ist bestätigungspflichtig und räumt anschließend auf; fehlende Rollen führen zu „Voraussetzung fehlt“.
- Die Bereichsampel bewertet ausschließlich funktionale Selbsttests; RLS-Lücken bleiben eine getrennte Kennzahl und ergeben keine Gesamtbewertung.
- Die Fehlertabelle über den Bereichskacheln zeigt nur den neuesten gespeicherten Lauf je Szenario; ältere Läufe ohne Schrittliste erscheinen dort als eine Zeile „gesamter Testlauf“.
- Die Übersicht der längsten Testabschnitte misst die gespeicherten Schritt-Dauern des neuesten Laufs je Szenario; Tests ohne Dauer bleiben ohne Abschnitte gelistet, und die Laufzeit der Schritte außerhalb des Tests (Aufräumen) zählt nicht dazu.
- Ausgeführt wurden Unit-, Generator- und Komponententests mit gemocktem RPC; RPC-Antwort, angewendete Migration und Darstellung im Browser wurden nicht gegen ein laufendes Backend geprüft.
- Die Ampel zeigt den neuesten Lauf je Szenario über alle Mitglieder des Mandanten, nicht nur den letzten Lauf des angemeldeten Nutzers.

**Offene Prüfpunkte**

- Migration vor Inbetriebnahme anwenden; ohne sie bleibt die Testlage unbekannt.
- SVG-Flusspfeile und Live-Aktualisierung sind nicht im Browser geprüft.

### `admin.edge-function-security` — Edge-Function-Sicherheitsklassifikation
Klassifiziert jede Edge Function nach verify_jwt und Zusatzschutz und prüft die Matrix gegen den Code.

- **Kategorie:** sicherheit
- **Implementierung:** implementiert
- **Einbindung:** nicht anwendbar
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** unbekannt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `system`, `superadmin`
- **Routen:** —
- **Frontend-Komponenten:** —
- **Services:** `scripts/check-edge-function-security.mjs`
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** —
- **Tabellen:** —
- **Abhängigkeiten:** —
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** `docs/security-function-matrix.md`, `docs/ci-quality-gates.md`

**Nachweise im Quellcode**

- scripts/check-edge-function-security.mjs
- docs/security-function-matrix.md
- scripts/security-function-whitelist.json

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Die Sicherheitsmatrix ist teilweise unvollständig formatiert; der Drift-Check ist als Prüfung vorhanden, wurde hier aber nicht ausgeführt.

### `admin.access-boundaries` — Zugriffsschutzprüfung
Prüft Bürogrenzen und Entscheiderrollen über ein eigenes Selbsttest-Szenario.

- **Kategorie:** sicherheit
- **Implementierung:** implementiert
- **Einbindung:** nicht anwendbar
- **Testabdeckung:** Selbsttest
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `system`, `abgeordneter`, `bueroleitung`, `mitarbeiter`
- **Routen:** —
- **Frontend-Komponenten:** —
- **Services:** —
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** —
- **Tabellen:** `appointment_requests`, `case_items`
- **Abhängigkeiten:** —
- **Selbsttests:** `access-boundaries`
- **Unit-Tests:** `src/features/selftest/scenarios/access-boundaries.test.ts`
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** `docs/selftest-center.md`

**Nachweise im Quellcode**

- src/features/selftest/scenarios/access-boundaries.ts
- src/features/selftest/scenarios/access-boundaries.test.ts

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `admin.data-lint` — Datenqualitätsprüfung
Führt Datenlint-Regeln aus, zeigt Befunde und unterstützt die Bereinigung.

- **Kategorie:** administrativ
- **Implementierung:** implementiert
- **Einbindung:** rollenabhängig
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `admin`, `bueroleitung`
- **Routen:** —
- **Frontend-Komponenten:** `src/components/administration/DataLintDashboard.tsx`
- **Services:** —
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** `run_data_lint`
- **Tabellen:** `data_lint_findings`
- **Abhängigkeiten:** —
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/components/administration/DataLintDashboard.tsx

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `admin.performance` — Performance- und Größen-Dashboard
Zeigt Tabellen- und Datenbankgrößen sowie Betriebskennzahlen.

- **Kategorie:** administrativ
- **Implementierung:** implementiert
- **Einbindung:** rollenabhängig
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `admin`, `superadmin`
- **Routen:** —
- **Frontend-Komponenten:** `src/components/administration/PerformanceDashboard.tsx`
- **Services:** —
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** `get_table_size_metrics`, `get_database_size`
- **Tabellen:** `system_health`
- **Abhängigkeiten:** —
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** `docs/performance-audit-2026-05.md`

**Nachweise im Quellcode**

- src/components/administration/PerformanceDashboard.tsx

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `admin.tenants` — Mandantenverwaltung
Verwaltet Büros, Mitgliedschaften und Gesundheitskennzahlen; Superadmins sehen alle Mandanten.

- **Kategorie:** administrativ
- **Implementierung:** implementiert
- **Einbindung:** rollenabhängig
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `superadmin`, `admin`
- **Routen:** —
- **Frontend-Komponenten:** `src/components/administration/SuperadminTenantManagement.tsx`, `src/components/administration/tenant-wizard`
- **Services:** —
- **Hooks:** —
- **Edge Functions:** `manage-tenant-user`, `create-admin-user`, `create-demo-users`
- **Datenbankfunktionen:** `get_admin_tenant_health`, `get_user_tenant_ids`, `get_user_primary_tenant_id`, `user_belongs_to_tenant`, `user_has_tenant_access`
- **Tabellen:** `tenants`, `user_tenant_memberships`, `tenant_collaborations`, `superadmin_users`
- **Abhängigkeiten:** —
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** `docs/rollenrechte-matrix.md`

**Nachweise im Quellcode**

- src/components/administration/SuperadminTenantManagement.tsx
- src/components/administration/tenant-wizard

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `admin.users-sessions` — Benutzer, MFA und Sitzungen
Legt Benutzer an, setzt MFA zurück und meldet Sitzungen global ab.

- **Kategorie:** administrativ
- **Implementierung:** implementiert
- **Einbindung:** rollenabhängig
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `admin`, `superadmin`, `abgeordneter`, `bueroleitung`, `mitarbeiter`
- **Routen:** —
- **Frontend-Komponenten:** `src/components/admin/NewUserForm.tsx`, `src/components/admin/TwoFactorSettings.tsx`
- **Services:** —
- **Hooks:** —
- **Edge Functions:** `reset-user-mfa`, `global-logout`, `create-admin-user`
- **Datenbankfunktionen:** —
- **Tabellen:** `profiles`, `user_sessions`, `user_status`
- **Abhängigkeiten:** —
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** `docs/security-function-matrix.md`

**Nachweise im Quellcode**

- src/components/admin/NewUserForm.tsx
- src/components/admin/TwoFactorSettings.tsx

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `admin.configuration` — Konfigurierbare Stammdaten pflegen
Verwaltet Kategorien, Status und Typen zentral, prüft Abhängigkeiten vor dem Löschen und benennt Referenzen um.

- **Kategorie:** administrativ
- **Implementierung:** implementiert
- **Einbindung:** rollenabhängig
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `admin`, `bueroleitung`
- **Routen:** —
- **Frontend-Komponenten:** `src/components/administration/ConfigurableTypeSettings.tsx`, `src/features/admin/ConfigDeleteDialog.tsx`
- **Services:** `src/features/admin/configImpact.ts`
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** `config_delete_impact`, `config_delete_guard`, `config_item_references`, `delete_config_item`, `rename_config_item`, `config_rename_action_field`, `config_rename_conditions`, `config_rename_keys`, `config_item_name`, `core_task_status_keys`
- **Tabellen:** `task_categories`, `task_statuses`, `document_categories`, `appointment_categories`, `todo_categories`
- **Abhängigkeiten:** —
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/components/administration/ConfigurableTypeSettings.tsx
- src/features/admin/configImpact.ts
- src/features/admin/ConfigDeleteDialog.tsx

**Bekannte Einschränkungen**

- Bei den Kernstatus der Aufgaben (todo, in_progress, completed, cancelled, review) ändert Umbenennen nur den Anzeigenamen; der technische Name bleibt stabil, weil Spalten-Default, Client und Datenbankfunktionen ihn schreiben. Löschen und direktes Umbenennen weist die Datenbank ab (22023). Der Aufgaben-Selbsttest prüft vor dem Anlegen einer Aufgabe, ob die fünf Kernstatus registriert sind, und meldet fehlende Einträge als eigenen Schritt.

**Offene Prüfpunkte**

- Keine.

### `admin.onboarding-login` — Onboarding-Folien und Login-Anpassung
Verwaltet Onboarding-Folien und passt die Anmeldeseite je Mandant an.

- **Kategorie:** administrativ
- **Implementierung:** implementiert
- **Einbindung:** rollenabhängig
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `admin`, `bueroleitung`, `abgeordneter`, `mitarbeiter`
- **Routen:** —
- **Frontend-Komponenten:** `src/components/administration/OnboardingSlidesManager.tsx`, `src/components/administration/LoginCustomization.tsx`
- **Services:** —
- **Hooks:** `src/hooks/useLoginCustomization.tsx`, `src/hooks/useOnboardingGate.ts`
- **Edge Functions:** —
- **Datenbankfunktionen:** —
- **Tabellen:** `tenant_onboarding_slides`, `tenant_onboarding_checklist_items`, `login_customization`, `user_onboarding_state`
- **Abhängigkeiten:** —
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/components/administration/OnboardingSlidesManager.tsx
- src/components/administration/LoginCustomization.tsx

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `admin.templates-senders` — Administrative Vorlagen und Absenderdaten
Pflegt E-Mail-Vorlagen, Planungsvorlagen, Anlässe, Absenderinformationen und Informationselemente.

- **Kategorie:** administrativ
- **Implementierung:** implementiert
- **Einbindung:** rollenabhängig
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `admin`, `bueroleitung`
- **Routen:** —
- **Frontend-Komponenten:** `src/components/administration/PlanningTemplateManager.tsx`, `src/components/administration/PressTemplateManager.tsx`, `src/components/administration/PressOccasionManager.tsx`, `src/components/administration/InformationBlockManager.tsx`
- **Services:** —
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** —
- **Tabellen:** `planning_templates`, `email_templates`, `press_releases`, `information_blocks`, `sender_information`
- **Abhängigkeiten:** —
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/components/administration/PlanningTemplateManager.tsx
- src/components/administration/PressTemplateManager.tsx
- src/components/administration/SenderInformationManager.tsx

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `admin.maintenance` — Wartungs- und Aufräumläufe
Bereinigt Caches, veraltete Nachrichten, Workflow-Läufe und Testdaten über automatisierte Funktionen.

- **Kategorie:** automatisiert
- **Implementierung:** implementiert
- **Einbindung:** systemseitig
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `system`
- **Routen:** —
- **Frontend-Komponenten:** —
- **Services:** —
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** `cleanup_edge_function_cache`, `cleanup_stale_news_articles`, `cleanup_workflow_runs`, `cleanup_bulk_action_audit`, `cleanup_team_ritual_membership`
- **Tabellen:** `edge_function_cache`, `news_articles`, `workflow_runs`
- **Abhängigkeiten:** —
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- supabase/migrations

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Die Läufe sind nicht ausgeführt worden; Löschumfang und Aufbewahrungsfristen sind nicht geprüft.

### `admin.selftest-center` — Selbsttest-Center
Führt registrierte Prüfszenarien gegen die Anwendung aus, protokolliert Läufe je Mandant, ordnet Fehler dem betroffenen Prüfpunkt mit Fehlercode, Details und Cleanup-Datensatz zu und räumt Testdaten auf.

- **Kategorie:** administrativ
- **Implementierung:** implementiert
- **Einbindung:** rollenabhängig
- **Testabdeckung:** Selbsttest
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `admin`, `bueroleitung`, `abgeordneter`, `mitarbeiter`
- **Routen:** `/selftest`
- **Frontend-Komponenten:** `src/features/selftest/components`
- **Services:** `src/features/selftest/runner.ts`, `src/features/selftest/registry.ts`, `src/features/selftest/reports.ts`, `src/features/selftest/artifacts.ts`
- **Hooks:** —
- **Edge Functions:** `selftest-backup-pointer`
- **Datenbankfunktionen:** —
- **Tabellen:** `selftest_runs`
- **Abhängigkeiten:** —
- **Selbsttests:** —
- **Unit-Tests:** `src/features/selftest/runner.test.ts`, `src/features/selftest/reports.test.ts`, `src/features/selftest/verify.test.ts`
- **Integrationstests:** —
- **Browser-Tests:** `e2e/selftest-live.spec.ts`
- **Dokumentation:** `docs/selftest-center.md`, `docs/selftest-coverage.md`

**Nachweise im Quellcode**

- src/features/selftest/runner.ts
- src/features/selftest/registry.ts
- src/features/selftest/components

**Bekannte Einschränkungen**

- Ein grüner Lauf bestätigt nur den angezeigten Prüfumfang; die Läufe wurden hier nicht gegen ein Backend ausgeführt.
- Fehlercode, Details und Hinweis stammen aus der tatsächlich fehlgeschlagenen Operation; ein Befund ohne diese Zuordnung bleibt offen.

**Offene Prüfpunkte**

- Keine.

### `admin.feature-catalog` — Funktionskatalog und Inventarisierung
Führt den vollständigen, versionierten Funktionskatalog, gleicht ihn mit Routen, Edge Functions, RPCs und Szenarien ab, erzeugt die Dokumentation und leitet daraus eine Funktionslandkarte mit Bereichen, Bereichskopplungen und Wirkungsketten ab. Zusätzlich entsteht ein Zustandsartefakt aus Statusspalten, CHECK-Constraints, Defaults, INSERT-/UPDATE-Schreibvorgängen, Funktionsparametern und Guard-Triggern der Migrationen. Es wird gegen den Quellcode auf Drift geprüft, mit registrierten TS-Regelmodulen und Client-Schreibvorgängen abgeglichen, um berechnete Befunde (unerreichbar, Sackgasse, nur im Guard, unbelegter Client-Wert) ergänzt und als Katalogansicht mit Zustandsgraph, Guards und Abweichungen angezeigt.

- **Kategorie:** administrativ
- **Implementierung:** implementiert
- **Einbindung:** rollenabhängig
- **Testabdeckung:** Unit-Test
- **Letztes Testergebnis:** unbekannt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `admin`, `bueroleitung`
- **Routen:** `/funktionskatalog`
- **Frontend-Komponenten:** `src/features/feature-catalog/FeatureCatalogView.tsx`, `src/features/feature-catalog/FeatureMap.tsx`, `src/features/feature-catalog/StateMachineView.tsx`, `src/features/feature-catalog/StateMachineGraph.tsx`
- **Services:** `scripts/build-feature-catalog.mjs`, `scripts/build-state-artifact.mjs`, `src/features/feature-catalog/metrics.ts`, `src/features/feature-catalog/map.ts`, `src/features/feature-catalog/stateMachines.ts`, `src/features/feature-catalog/graphLayout.ts`
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** —
- **Tabellen:** —
- **Abhängigkeiten:** —
- **Selbsttests:** —
- **Unit-Tests:** `src/features/feature-catalog/metrics.test.ts`, `src/features/feature-catalog/map.test.ts`, `src/features/feature-catalog/stateMachines.test.ts`, `src/features/feature-catalog/graphLayout.test.ts`, `src/features/feature-catalog/FeatureCatalogView.test.tsx`, `scripts/__tests__/feature-catalog.test.mjs`, `scripts/__tests__/state-artifact.test.mjs`
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** `docs/features/README.md`, `docs/features/review.md`, `docs/entity-map.md`

**Nachweise im Quellcode**

- src/features/feature-catalog/FeatureCatalogView.tsx
- scripts/build-feature-catalog.mjs
- scripts/build-state-artifact.mjs
- src/features/feature-catalog/inventory
- src/features/feature-catalog/generated/state-machines.json

**Bekannte Einschränkungen**

- Die Landkarte leitet Kanten ausschließlich aus deklarierten `dependsOn`-Bezügen ab und behauptet keine Laufzeitaufrufe.
- Das Zustandsartefakt leitet Übergänge nur aus belegten Schreibvorgängen, Defaults, INSERTs und validierten Funktionsparametern ab; ein vollständiger Automat wird nicht behauptet. Guards liefern geprüfte Werte und blockierte Zustände, aber keine Kontrollfluss-Auswertung.
- Der Abgleich mit TS-Regelmodulen und Client-Schreibvorgängen ist ein Prüfauftrag: Er vergleicht registrierte Quellen und Literale, keine Laufzeitaufrufe und keine dynamischen Statuswerte.

**Offene Prüfpunkte**

- Der Katalog ist so vollständig wie die manuelle Inventarisierung; heuristische Lücken werden im Review-Bericht ausgewiesen.

### `platform.notification-dispatch` — Benachrichtigungs- und Audit-Trigger
Erzeugt Benachrichtigungen, Push-Aufträge und Audit-Einträge aus Datenbankänderungen über zentrale Trigger-Funktionen.

- **Kategorie:** technisch
- **Implementierung:** implementiert
- **Einbindung:** systemseitig
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `system`
- **Routen:** —
- **Frontend-Komponenten:** —
- **Services:** —
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** `create_notification`, `handle_task_notifications`, `handle_document_notifications`, `handle_meeting_notifications`, `handle_message_notifications`, `handle_appointment_notifications`, `handle_leave_request_notifications`, `notify_push_on_insert`, `audit_contact_field_updates`, `audit_letter_changes`, `audit_user_role_changes`, `audit_document_deletion`
- **Tabellen:** `notifications`, `audit_log_entries`, `push_subscriptions`
- **Abhängigkeiten:** —
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- supabase/migrations
- supabase/functions/_shared/security.ts

**Bekannte Einschränkungen**

- Reine Querschnittsfunktion; den zugehörigen Fachfunktionen untergeordnet, kein eigenständiger Fachumfang.

**Offene Prüfpunkte**

- Die Liste der Trigger ist exemplarisch und nicht vollständig aus allen 881 Migrationen rekonstruiert.

## Regeln

Fachliche Invarianten stehen in [AGENTS.md](../../AGENTS.md); Rollen und Rechte in [rollenrechte-matrix.md](../rollenrechte-matrix.md).
