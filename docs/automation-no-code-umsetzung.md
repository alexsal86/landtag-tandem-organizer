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

## Governance-Modell für produktive Workflows

### 1) Rollen und Rechte entlang des Lebenszyklus

| Rolle | Erstellen | Testen | Veröffentlichen | Freigeben | Betrieb/Incident |
|---|---|---|---|---|---|
| **Workflow-Author (Fachbereich)** | Erlaubt (Draft) | Erlaubt (Sandbox/Dry-Run) | Nicht erlaubt | Nicht erlaubt | Lesend (Status, Runs) |
| **Automation-Engineer (Plattform-Team)** | Erlaubt | Erlaubt (Staging + technische Tests) | Erlaubt (nur non-kritisch direkt) | Nicht erlaubt bei eigenen Änderungen | On-Call, Runbook-Ausführung |
| **Approver (2. Person, fachlich oder Security)** | Nicht erforderlich | Kann Testberichte prüfen | Für kritische Workflows zwingend beteiligt | Erlaubt (formale Freigabe) | Eskalationsentscheidung |
| **Tenant-Admin** | Optional via Template | UAT-Freigabe im Tenant | Erlaubt nur innerhalb Tenant-Policies | Erlaubt für non-kritische Workflows | Incident-koordination im Tenant |
| **SRE/Incident Manager** | Nein | Chaos-/Resilienztests | Nein | Notfall-Override nach 4-Augen-Regel | Vollzugriff auf Kill-Switch, Rollback, Eskalation |

**Rechteprinzipien:**

- Strikte Trennung von **Author** und **Approver** bei produktionsrelevanten Änderungen.
- Jeder Workflow hat `owner_role`, `risk_class` und `criticality` als Pflichtfelder.
- Änderungen und Freigaben werden im Audit-Log mit User, Zeitpunkt, Diff-Hash und Kommentar gespeichert.

### 2) Vier-Augen-Prinzip für kritische produktive Veröffentlichungen

Für `risk_class = high` oder `criticality = business_critical` gilt:

1. **Author** erstellt/ändert Version `vN` und führt Pflicht-Testlauf aus.
2. System erzwingt Status `pending_approval`.
3. **Approver** (andere Person, andere Rolle) prüft Diff, Testbelege, Rollback-Plan.
4. Erst nach Freigabe wird `vN` aktivierbar (`publishable = true`).
5. Veröffentlichung schreibt Audit-Event `workflow_published_with_4eyes`.

Technische Leitplanken:

- Kein Self-Approval (`author_id != approver_id` als harte Regel).
- Approval-Token zeitlich begrenzen (z. B. 24h).
- Bei Änderungen nach Approval: Approval verfällt automatisch, erneute Prüfung nötig.

### 3) Change-Management als Standardprozess

Jede Workflow-Änderung wird wie ein kontrollierter Change behandelt:

1. **Versioniertes Artefakt** (`workflow_versions`)
   - unveränderliche Versionen mit `version_number`, `created_by`, `created_at`, `change_comment`, `rollback_to`.
2. **Diff zwischen Versionen**
   - semantischer Diff für Trigger, Conditions, Actions, Guardrails.
   - UI zeigt Impact-Hinweis (z. B. „neue externe Aktion“, „geändertes Rate Limit“).
3. **Pflichtkommentar bei Änderungen**
   - ohne `change_comment` keine Speicherung.
   - Mindestinhalte: Grund, erwarteter Effekt, Risiko, Testnachweis.
4. **Rückrollstrategie pro Veröffentlichung**
   - jede Aktivierung verlangt `rollback_to_version` oder „disable + fallback process“.
   - One-Click-Rollback auf letzte stabile Version.
   - Rollback erzeugt Audit-Event und optional Incident-Ticket.

### 4) Guardrails für sichere Ausführung

Guardrails gelten auf Tenant-, Workflow- und Action-Ebene:

- **Rate Limits**
  - pro Workflow (z. B. max. 100 Runs/15 Min)
  - pro externer Aktion (z. B. max. 20 E-Mails/Min)
  - harte Stopps + Alert bei Überschreitung
- **Aktions-Whitelist**
  - nur freigegebene Actions im Builder auswählbar
  - `invoke_edge_function` nur mit signierter Allowlist (`function_name`, `allowed_params`)
- **Risiko-Klassifizierung pro Workflow**
  - `low`: interne Notifications, keine externen Nebenwirkungen
  - `medium`: Datensatz-Updates innerhalb Tenant
  - `high`: externe Kommunikation, Massenänderungen, Eskalationsaktionen
  - Risikoklasse steuert Pflichttests, Vier-Augen-Prozess, Limits und Monitoring-Tiefe

Empfohlene technische Felder im Modell:

- `risk_class` (`low|medium|high`)
- `max_runs_per_window`, `window_seconds`
- `allowed_actions[]`
- `requires_4eyes` (abgeleitet aus Risiko, aber überschreibbar nach Policy)

### 5) Betriebs-KPIs und Alerting

Für einen belastbaren Betrieb werden folgende KPIs pro Tenant und global gemessen:

1. **Fehlerrate**
   - Anteil fehlgeschlagener Runs pro Zeitraum / Workflow
   - Alert: >5 % in 15 Minuten (Warnung), >10 % (kritisch)
2. **Approval-Laufzeit**
   - Zeit von `pending_approval` bis `approved/rejected`
   - Alert: kritische Changes länger als SLA (z. B. 8h)
3. **Eskalationsquote**
   - Anteil Runs, die Incident oder manuelle Eskalation auslösen
   - Alert bei plötzlichem Anstieg gegenüber 7-Tage-Baseline
4. **Durchsatz**
   - Runs/Minute und abgeschlossene Actions/Minute
   - Alert bei Drop unter Mindestniveau oder unerwarteten Peaks

Alerting-Setup (MVP):

- Metrikexport aus `automation_rule_runs` + `automation_rule_run_steps` in Dashboard.
- Schwellwert-basierte Alerts an On-Call-Kanal (z. B. Matrix/Email).
- Täglicher Betriebsreport mit Top-Fehlern, langsamsten Freigaben, auffälligen Tenants.

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

## Dossier-Flow: Externe Informationsquellen als Automation-Template

Für Dossiers wird der gleiche Trigger/Action-Ansatz genutzt:

- **Trigger**: `schedule` (z. B. alle 30 Minuten)
- **Conditions**: optional pro Tenant/Dossier (`dossier.status in ['beobachten','aktiv']`)
- **Action**: `invoke_edge_function` auf `sync-dossier-external-sources`

### Domänenobjekte

- `dossier_source_watchers`: pro Dossier Quelle + Keywords (RSS, Presse, Verbände)
- `dossier_entries` vom Typ `link` werden automatisch angelegt
- Duplikatschutz über `source_hash` (URL-Hash) und Titel-Ähnlichkeit (`pg_trgm similarity >= 0.82`)

### Ergebnis im Dossier

- neue Treffer landen automatisch in der Timeline (`entry_type='link'`)
- Metadaten enthalten Quelle, Importzeit, Keywords
- im Dossier ist ein Filter **„Neu seit letztem Briefing“** verfügbar
