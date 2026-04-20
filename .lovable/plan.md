

## Tenant-Provisioning als SaaS-Workflow

Ziel: Als Super-Admin lege ich in **einem geführten Wizard** einen neuen Tenant an, der **sofort produktiv nutzbar** ist – mit Standard-Templates, Kategorien, Notification-Typen, Wahlkreis-Daten und einem fertig eingerichteten Admin-User. Optional als Klon eines bestehenden „Master"-Tenants.

### Was heute fehlt
- Neue Tenants starten leer: 0 case_file_types, 0 letter_templates, 0 meeting_templates, 0 letter_occasions, 0 planning_templates, 0 notification_types, 0 sender_information.
- `initializeTenant` setzt nur 5 app_settings.
- Tenant-Anlage und User-Anlage sind zwei getrennte Schritte – kein "fertig in 60 Sekunden"-Erlebnis.
- Kein Klonen aus Vorlage-Tenant, keine Health-Anzeige (was fehlt diesem Tenant?).

### Lösung – 4 Bausteine

**1) Tenant-Vorlagen (DB)**
Neue Spalte `tenants.is_template boolean default false`. Ein Tenant kann als „Master-Vorlage" markiert werden. Beim Erstellen eines neuen Tenants kann der Super-Admin entweder:
- **„Standard-Setup"** wählen (ein hartkodiertes Seed-Set in der Edge-Function), oder
- **„Aus Vorlage klonen"** + einen Template-Tenant auswählen → kopiert dessen Templates 1:1.

**2) Erweiterte Edge-Function `manage-tenant-user` – neue Actions**
- `provisionTenant` (ersetzt/erweitert `initializeTenant`): legt Tenant + Default-Daten + optional Admin-User in **einem Aufruf** an. Body:
  ```
  { name, description, settings:{constituency,city,state,party,...},
    appName, appSubtitle,
    seedMode: 'standard' | 'clone' | 'empty',
    cloneFromTenantId?, 
    adminUser?: { email, displayName } }
  ```
  Schritte: tenant insert → app_settings seed → seedDefaultData(seedMode) → optional createUser(role=abgeordneter) → return {tenantId, adminPassword?, seedReport}.
- `cloneTenantData`: kopiert für einen bestehenden Tenant Daten aus einem anderen Tenant (nachträgliches Aufstocken).
- `getTenantHealth`: liefert pro Tenant {users, case_file_types, letter_templates, meeting_templates, notification_types, sender_information, last_activity} → für die neue Health-Spalte in der Übersicht.

**3) Seed-Module in der Edge-Function (ein zentraler Helper)**
Ein neues File `supabase/functions/_shared/tenant-seed.ts` mit:
- `STANDARD_CASE_FILE_TYPES` (≈ 8 sinnvolle Defaults: Bürgeranfrage, Beschwerde, Anfrage Behörde, …)
- `STANDARD_NOTIFICATION_TYPES` (alle bekannten `name`-Keys aus dem Code, inkl. `social_post_change_requested`, `social_post_reminder`, Aufgaben-, Termin-, Brief-Events)
- `STANDARD_LETTER_OCCASIONS` (Geburtstag, Kondolenz, Glückwunsch, …)
- `STANDARD_MEETING_TEMPLATES` (Jour Fixe, Wahlkreis-Termin)
- `STANDARD_PLANNING_TEMPLATES` (Veranstaltungsplanung)
- `STANDARD_APP_SETTINGS` (erweitert um Branding-Defaults)
- `cloneTenantData(sourceId, targetId)`: kopiert die o. g. Tabellen + `letter_templates`, `letter_occasions`, `sender_information`, `appointment_preparation_templates`, `event_email_templates`, `news_email_templates`, `vacation_checklist_templates` per `INSERT … SELECT` mit `tenant_id`-Rewrite und neuen UUIDs.

**4) UI – Neuer „Tenant Provisioning Wizard" + Health-Übersicht**
In `SuperadminTenantManagement.tsx` ersetzt ein **3-Schritt-Wizard** den heutigen Erstell-Dialog:

```text
Schritt 1: Stammdaten        Schritt 2: Setup-Quelle       Schritt 3: Admin-User
─────────────────────        ──────────────────────         ────────────────────
• Name, Beschreibung          ( ) Standard-Setup              ☑ Admin gleich anlegen
• Wahlkreis, Stadt, Land      ( ) Aus Vorlage klonen ▼          E-Mail, Name
• Partei                      ( ) Leer (manuell befüllen)       Rolle: abgeordneter
• App-Name, Subtitle          
• Social Links                Vorschau: "wird 8 Falltypen,
                              7 Briefanlässe, 24 Notif-
                              Typen, 2 Meeting-Templates
                              anlegen"
```

Nach „Anlegen" zeigt ein Erfolgs-Screen: Tenant-ID, Seed-Report (was wurde angelegt), generiertes Admin-Passwort mit Copy-Button, Direkt-Link „Jetzt als Admin einloggen".

In der Tenant-Tabelle kommt eine neue **„Health"-Spalte**: kleine Badges (Users · Templates · Notif) mit Ampel-Farbe (rot wenn 0). Klick öffnet ein Drawer mit „Daten aus anderem Tenant nachladen" (`cloneTenantData`).

Außerdem: Toggle „Als Vorlage markieren" (`is_template`) im Edit-Dialog.

### Migration (SQL)
- `ALTER TABLE tenants ADD COLUMN is_template boolean NOT NULL DEFAULT false;`
- Idempotente Inserts in der Seed-Function nutzen `ON CONFLICT DO NOTHING` (auf passenden Unique-Keys).

### Files
- **Neu**: `supabase/functions/_shared/tenant-seed.ts` (Seeds + cloneTenantData)
- **Neu**: `src/components/administration/tenant-wizard/TenantProvisioningWizard.tsx` (3-Step UI)
- **Neu**: `src/components/administration/tenant-wizard/TenantHealthBadges.tsx`
- **Neu**: `src/components/administration/tenant-wizard/CloneDataDrawer.tsx`
- **Edit**: `supabase/functions/manage-tenant-user/index.ts` (Actions `provisionTenant`, `cloneTenantData`, `getTenantHealth`)
- **Edit**: `src/components/administration/SuperadminTenantManagement.tsx` (Wizard einhängen, Health-Spalte, is_template-Toggle)

### Out of Scope (bewusst)
- Self-Service-Signup für externe Kunden (bleibt Super-Admin-only).
- Billing/Subscription-Tabellen – kommt erst, wenn Onboarding rund läuft.

