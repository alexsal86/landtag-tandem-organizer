# Automations sichtbar & no-code zugänglich machen

## Ausgangslage im aktuellen System

Die Codebasis hat bereits viele „Automation-Bausteine“, die für Nutzer:innen aber nur teilweise sichtbar sind:

- Admin-Bereich „Automatisierung“ enthält derzeit **RSS-Quellen**, **RSS-Einstellungen** und **Jährliche Aufgaben**.
- Es existieren mehrere Supabase Edge Functions für Erinnerungen, Status-Updates und Benachrichtigungen.
- Notification- und Deep-Link-Mechaniken sind im Frontend vorhanden.

Damit ist die technische Basis da — es fehlt vor allem ein konsistentes **Rule-Engine + Builder-UI** Muster.

## Zielbild

1. **No-code Regel-Builder** für Fachnutzer:innen
2. **Gemeinsames Trigger-/Action-Modell** über Module hinweg (Tasks, Meetings, Entscheidungen, Kontakte, Wissen)
3. **Sichere Ausführung** mit Tenant-Scope, Idempotenz, Audit-Trail
4. **Sichtbarkeit** durch „Warum ist das passiert?“-Transparenz im UI

---

## Architekturvorschlag (inkrementell, ohne Big Bang)

## 1) Einheitliches Regelmodell einführen

Neue Tabellen (Vorschlag):

- `automation_rules`
  - `id`, `tenant_id`, `name`, `module`, `enabled`
  - `trigger_type` (z. B. `record_changed`, `schedule`, `webhook`)
  - `trigger_config` (JSONB)
  - `conditions` (JSONB)
  - `actions` (JSONB)
  - `created_by`, `created_at`, `updated_at`
- `automation_rule_runs`
  - `id`, `rule_id`, `tenant_id`, `status`
  - `input_payload` (JSONB), `result_payload` (JSONB), `error`
  - `started_at`, `finished_at`, `idempotency_key`
- `automation_rule_run_steps`
  - Pro Action-Step ein Log für Debuggability

### Warum so?

- Passt zu eurer existierenden Supabase-/RPC-/Function-Architektur.
- JSONB erlaubt schnelle Erweiterung ohne dauerndes Schema-Churn.
- Run-Logs machen Automations für Admins nachvollziehbar.

## 2) Trigger-Layer standardisieren

Drei Trigger-Typen als MVP:

1. **DB-Trigger/Event**
   - z. B. „Task wurde auf `overdue` gesetzt“
2. **Zeitbasiert (Cron/Scheduler)**
   - z. B. tägliche Prüfung 08:00
3. **UI-Trigger (manuell / Button)**
   - z. B. „Jetzt einmal ausführen“

Implementierung:

- Eine zentrale Edge Function `run-automation-rule` als Executor.
- Vorhandene Functions (Reminder, Archive, Notification etc.) bleiben bestehen und werden als Action-Handler genutzt.

## 3) Action-Katalog definieren

No-code braucht einen stabilen Action-Katalog statt freier Script-Eingabe:

- `create_notification`
- `send_push_notification`
- `create_task`
- `update_record_status`
- `send_email_template`
- `invoke_edge_function` (kontrolliert, Whitelist)

Pro Action:

- JSON-Schema für Eingaben
- Validierung + sichere Defaultwerte
- UI-Form-Renderer (dynamisch)

## 4) Conditions DSL (einfach halten)

Für MVP reicht:

- Vergleich: `equals`, `not_equals`, `contains`, `gt`, `lt`, `in`
- Verknüpfung: `all` / `any`
- Felder nur aus Whitelist pro Modul

Beispiel (semantisch):

- Trigger: `meeting.reminder_due`
- Conditions: `meeting.status != done` UND `owner.notifications_enabled = true`
- Actions: `create_notification`, optional `send_push_notification`

## 5) UI: Automations-Hub im Adminbereich

Den bestehenden Bereich „Automatisierung“ erweitern um:

1. **Regel-Liste**
   - Name, Modul, Status, letzte Ausführung, Fehlerrate
2. **Regel-Builder (Wizard)**
   - Schritt 1: Trigger
   - Schritt 2: Bedingungen
   - Schritt 3: Aktionen
   - Schritt 4: Testlauf (Dry Run)
3. **Run-Historie / Logs**
   - Filterbar nach Regel, Zeitraum, Fehlern
4. **Template-Galerie**
   - vordefinierte Regeln als Startpunkt

---

## Quick Wins auf eurer bestehenden Basis

1. **Vorhandene „versteckte“ Automations als Templates sichtbar machen**
   - „Meeting-Reminder“
   - „Überfällige Action Items“
   - „Decision Auto-Archive“

2. **„Warum habe ich diese Notification?“ Link ergänzen**
   - Deep Link auf `automation_rule_runs` Eintrag

3. **Dry-Run in Admin UI**
   - Ausgewählte Regel gegen Beispieldaten testen

4. **Kill-Switch je Tenant**
   - zentrale Möglichkeit, alle Regeln kurzfristig zu pausieren

---

## Sicherheits- und Betriebsanforderungen (wichtig)

- **Tenant-Isolation**: jede Regel & Ausführung strikt tenant-gebunden
- **Idempotenz**: jede Ausführung bekommt `idempotency_key`
- **Rate Limiting** für Actions mit Außenwirkung (E-Mail/Push)
- **Retry mit Backoff** nur für transient errors
- **Audit-Trail** für Erstellung/Änderung/Aktivierung von Regeln
- **Rollenmodell**: nur Admins erstellen/ändern Regeln; Fachnutzer dürfen ggf. nur aktivieren/deaktivieren

---

## Rollout-Plan (4 Phasen)

## Phase 1 (1–2 Sprints): Fundament

- Tabellen + RLS + zentrale Executor-Function
- Regel-Liste + Enable/Disable
- 2 Trigger + 2 Actions

## Phase 2 (1 Sprint): Builder MVP

- Wizard-UI mit Validation
- Dry-Run und Ergebnisvorschau
- Run-Log Seite

## Phase 3 (1–2 Sprints): Produktiv nutzbar

- Template-Galerie
- Fehler-Alerts für Admins
- „Warum ausgelöst?“-Transparenz in Notifications

## Phase 4: Skalierung

- Mehr Actions/Integrationen
- Rule-Versionierung
- Import/Export von Regelsets pro Tenant

---

## Konkrete Start-Templates (empfohlen)

1. **Meeting fällig in 48h + keine Vorbereitung**
   - Action: Notification an Owner + Teamlead
2. **Entscheidung angenommen**
   - Action: Folge-Task an Verantwortliche mit Deadline
3. **Wissensartikel 90 Tage unverändert**
   - Action: Review-Reminder an Autor:in
4. **Casefile Status auf „kritisch“**
   - Action: Sofortalarm + Prioritäts-Tag setzen

Diese vier Templates machen den Nutzen eures Automation-Systems sofort sichtbar, ohne dass Nutzer:innen selbst bei null anfangen müssen.
