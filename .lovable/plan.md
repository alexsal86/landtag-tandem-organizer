

# 7 Features für das Automation-System

## Status-Check: Was existiert bereits

- **Template-Galerie**: 5 Templates vorhanden, UI funktioniert
- **Fehler-Alerts**: Banner im Manager + Edge Function benachrichtigt Admins bei Fehlern
- **Conditions-Builder**: Dropdowns für Feld/Operator/Wert existieren, aber nur AND-Logik
- **Rate Limiting / Retry / Audit**: Nicht vorhanden

---

## Feature 2: Template-Galerie erweitern

Mehr vordefinierte Templates in `RULE_TEMPLATES` hinzufügen:
- Urlaubs-/Krankmeldung eingegangen → Benachrichtigung an Teamleitung
- Dokument erstellt → Review-Aufgabe an Autor
- Kontakt ohne Aktivität seit 30 Tagen → Erinnerung
- Fallakte Status "abgeschlossen" → Archivierungs-Task
- Neues Teammitglied → Onboarding-Aufgaben erstellen

Reine Frontend-Änderung in `AutomationRuleWizard.tsx`.

## Feature 3: Fehler-Alerts Dashboard

- Neuer Tab/Abschnitt "Fehler-Monitor" im Automation-Manager
- Tabelle mit allen fehlgeschlagenen Runs (Regel, Zeitpunkt, Fehlermeldung)
- Badge-Counter für Fehler in der Admin-Navigation
- "Erneut ausführen"-Button pro fehlgeschlagenem Run

Neue Komponente `AutomationErrorDashboard.tsx`, Integration in `AutomationRulesManager.tsx`.

## Feature 5: Mehr Trigger-Tabellen

DB-Trigger auf zusätzliche Tabellen, die `run-automation-rule` aufrufen:
- `contacts` (Kontakte)
- `knowledge_documents` (Wissen)
- `case_files` (Fallakten)

Migration: Neue Trigger-Funktionen analog zum bestehenden Pattern. Erweitert `FIELD_OPTIONS_BY_MODULE` um neue Module wie `contacts`.

## Feature 6: Visueller Conditions-Builder

Aktuell nur AND-Verknüpfung. Erweiterung um:
- Toggle zwischen "Alle Bedingungen (UND)" und "Mindestens eine (ODER)"
- Visuelle Gruppierung mit Karten und Verbindungs-Badges ("UND"/"ODER")
- Speicherung als `{ all: [...] }` oder `{ any: [...] }` in JSONB

Änderungen in `AutomationRuleWizard.tsx` (Conditions-Step) und `run-automation-rule/index.ts` (evaluateConditions).

## Feature 7: Rate Limiting für Actions

- Neue Tabelle `automation_rate_limits` mit Zählern pro Tenant/Action-Typ/Zeitfenster
- Edge Function prüft vor jeder Action das Limit (z.B. max 50 E-Mails/Stunde, max 200 Notifications/Stunde)
- Bei Überschreitung: Run-Step als "rate_limited" markieren, nicht ausführen
- Konfigurierbare Limits pro Tenant in `app_settings`

## Feature 8: Retry mit Backoff

- Neue Spalten auf `automation_rule_runs`: `retry_count`, `max_retries`, `next_retry_at`
- Bei transientem Fehler (Netzwerk, Timeout): Run auf "retry_pending" setzen
- Cron-Job (pg_cron) prüft alle 5 Min auf retry-fähige Runs und ruft Edge Function erneut auf
- Exponentielles Backoff: 1min, 5min, 15min (max 3 Retries)
- Permanente Fehler (Validierung, 4xx) → kein Retry

## Feature 9: Audit-Trail & Rollenmodell

- Audit-Events bei: Regel erstellen/ändern/löschen/aktivieren/deaktivieren
- Integration mit bestehendem `audit_log_entries` System via `log-audit-event` Edge Function
- Rollenprüfung: Nur `abgeordneter`-Rolle darf Regeln erstellen/ändern; `mitarbeiter` darf nur aktivieren/deaktivieren
- Frontend: Deaktivierte Buttons + Hinweis für Nicht-Admins
- Audit-Log-Ansicht pro Regel (wer hat wann was geändert)

---

## Umsetzungsreihenfolge

1. **Template-Galerie erweitern** (klein, Frontend-only)
2. **Visueller Conditions-Builder** (Frontend + Edge Function)
3. **Fehler-Alerts Dashboard** (neue Komponente)
4. **Audit-Trail & Rollenmodell** (Frontend + Edge Function Integration)
5. **Rate Limiting** (DB + Edge Function)
6. **Retry mit Backoff** (DB + Edge Function + Cron)
7. **Mehr Trigger-Tabellen** (DB Migration)

## Betroffene Dateien

- `AutomationRuleWizard.tsx` — Templates, Conditions-Builder
- `AutomationRulesManager.tsx` — Dashboard-Integration, Rollenprüfung
- `AutomationErrorDashboard.tsx` — Neu
- `run-automation-rule/index.ts` — Rate Limiting, Retry, OR-Conditions
- 3-4 Migrations — Rate Limits Tabelle, Retry-Spalten, DB-Trigger, Audit

