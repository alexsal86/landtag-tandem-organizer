# Externe Schnittstellen

_Auto-generiert mit `npm run update:feature-catalog` aus dem zentralen Funktionskatalog (`src/features/feature-catalog/inventory/schnittstellen.json`). Nicht von Hand bearbeiten._

**Zweck:** Anbindung an Kalenderanbieter, E-Mail, Push, ICS, Geocoding, KI-Dienste und Betriebsüberwachung.

## Kennzahlen

- Funktionen: **10** in **7** Unterbereichen
- implementiert: **10**, teilweise: **0**, deaktiviert: **0**, potenziell verwaist: **0**
- ohne zugeordneten Test: **8**
- ohne Dokumentationsverweis: **5**

## Funktionen

| Funktion | Unterbereich | Kategorie | Implementierung | Einbindung | Abdeckung |
|---|---|---|---|---|---|
| `integration.push` Push-Benachrichtigungen | Benachrichtigungen | integration | implementiert | systemseitig | kein Test |
| `integration.edge-contract-tests` Edge-Function-Vertragstests | Betrieb | sicherheit | implementiert | nicht anwendbar | Security-Test |
| `integration.egress-monitoring` Egress-Überwachung | Betrieb | sicherheit | implementiert | systemseitig | kein Test |
| `integration.email` Transaktions-E-Mail-Versand | E-Mail | integration | implementiert | systemseitig | kein Test |
| `integration.geocoding` Adress-Geocoding | Geodaten | integration | implementiert | systemseitig | kein Test |
| `integration.calendar-sync` Externe Kalender synchronisieren | Kalender | integration | implementiert | rollenabhängig | kein Test |
| `integration.ics` ICS-Feeds und Einladungsdateien | Kalender | integration | implementiert | rollenabhängig | Unit-Test |
| `integration.ai-suggestions` KI-Vorschläge für Vorbereitung und Eingang | KI | integration | implementiert | rollenabhängig | kein Test |
| `integration.transcription` Sprachaufnahme transkribieren | KI | integration | implementiert | rollenabhängig | kein Test |
| `integration.unsplash` Bildsuche für Beiträge | Medien | integration | implementiert | UI | kein Test |

## Unterbereiche

- Kalender
- E-Mail
- Benachrichtigungen
- Geodaten
- KI
- Medien
- Betrieb

## Rollen

`abgeordneter`, `bueroleitung`, `mitarbeiter`, `system`, `admin`

## Datenbanktabellen

`appointment_preparations`, `appointments`, `calendar_sync_settings`, `contacts`, `egress_anomalies`, `egress_metrics`, `election_districts`, `email_logs`, `email_templates`, `external_calendars`, `external_events`, `letters`, `mobile_push_tokens`, `notifications`, `press_releases`, `push_subscriptions`, `quick_notes`, `scheduled_emails`, `social_assets`, `system_health`, `tasks`

## Selbsttest-Szenarien

Keine Szenarien zugeordnet. Das bedeutet nicht, dass der Bereich ungetestet ist – es fehlt eine Selbsttest-Abdeckung.

## Funktionsdetails

### `integration.calendar-sync` — Externe Kalender synchronisieren
Synchronisiert verbundene externe Kalender bidirektional, claimt Zeitfenster atomar und protokolliert den Sync.

- **Kategorie:** integration
- **Implementierung:** implementiert
- **Einbindung:** rollenabhängig
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`, `system`
- **Routen:** —
- **Frontend-Komponenten:** `src/features/calendar/components/ExternalCalendarSettings.tsx`, `src/components/administration/CalendarSyncSettings.tsx`, `src/features/calendar/components/CalendarSyncDebug.tsx`
- **Services:** —
- **Hooks:** —
- **Edge Functions:** `sync-external-calendar`, `auto-sync-calendars`, `force-resync-calendar`
- **Datenbankfunktionen:** `claim_calendar_sync`, `finish_calendar_sync`, `calendar_sync_slot`
- **Tabellen:** `external_calendars`, `external_events`, `calendar_sync_settings`
- **Abhängigkeiten:** —
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** `docs/ci-quality-gates.md`, `docs/operations`

**Nachweise im Quellcode**

- src/features/calendar/components/ExternalCalendarSettings.tsx
- supabase/functions/sync-external-calendar/index.ts
- supabase/functions/auto-sync-calendars/index.ts

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Ein echter Sync gegen einen externen Anbieter ist nicht ausgeführt worden; nur Code und Contract-Tests liegen vor.

### `integration.ics` — ICS-Feeds und Einladungsdateien
Erzeugt ICS-Dateien, prüft ICS-Zugriffe und stellt Feed-Endpunkte für Abonnements bereit.

- **Kategorie:** integration
- **Implementierung:** implementiert
- **Einbindung:** rollenabhängig
- **Testabdeckung:** Unit-Test
- **Letztes Testergebnis:** unbekannt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `admin`, `bueroleitung`, `abgeordneter`
- **Routen:** —
- **Frontend-Komponenten:** —
- **Services:** `supabase/functions/_shared/icsTime.ts`
- **Hooks:** —
- **Edge Functions:** `ics-validation`, `generate-calendar-invite`
- **Datenbankfunktionen:** `validate_contract_file`
- **Tabellen:** `appointments`, `external_calendars`
- **Abhängigkeiten:** —
- **Selbsttests:** —
- **Unit-Tests:** `supabase/functions/_shared/icsTime.test.ts`
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** `docs/security-function-matrix.md`

**Nachweise im Quellcode**

- supabase/functions/ics-validation/index.ts
- supabase/functions/_shared/icsTime.ts

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `integration.email` — Transaktions-E-Mail-Versand
Versendet E-Mails über zentrale Vorlagen, protokolliert Zustellungen und verarbeitet geplante E-Mails.

- **Kategorie:** integration
- **Implementierung:** implementiert
- **Einbindung:** systemseitig
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `system`, `admin`
- **Routen:** —
- **Frontend-Komponenten:** —
- **Services:** —
- **Hooks:** —
- **Edge Functions:** `process-scheduled-emails`, `send-checklist-email`
- **Datenbankfunktionen:** —
- **Tabellen:** `email_logs`, `email_templates`, `scheduled_emails`
- **Abhängigkeiten:** —
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- supabase/functions/process-scheduled-emails/index.ts
- src/components/emails

**Bekannte Einschränkungen**

- Ein echter Mailversand ist in dieser Umgebung nicht geprüft; Zustellbarkeit und Bounce-Verhalten sind offen.

**Offene Prüfpunkte**

- Zentrale Vorlagenpflege und Versand sind über mehrere Funktionen verteilt; eine vollständige Liste der Absender liegt nicht zentral vor.

### `integration.push` — Push-Benachrichtigungen
Registriert Push-Token, versendet Push-Nachrichten für Benachrichtigungen und räumt veraltete Tokens auf.

- **Kategorie:** integration
- **Implementierung:** implementiert
- **Einbindung:** systemseitig
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `system`, `abgeordneter`, `bueroleitung`, `mitarbeiter`
- **Routen:** —
- **Frontend-Komponenten:** —
- **Services:** —
- **Hooks:** —
- **Edge Functions:** `dispatch-mobile-push`, `send-push-notification`, `push-notification-worker`, `register-mobile-push-token`
- **Datenbankfunktionen:** `dispatch_mobile_push_on_notification`, `notify_push_on_insert`, `track_employee_settings_changes`, `touch_mobile_push_tokens`
- **Tabellen:** `push_subscriptions`, `mobile_push_tokens`, `notifications`
- **Abhängigkeiten:** —
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** `docs/security-function-matrix.md`

**Nachweise im Quellcode**

- supabase/functions/dispatch-mobile-push/index.ts
- supabase/functions/push-notification-worker/index.ts

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `integration.geocoding` — Adress-Geocoding
Geokodiert Kontaktadressen einzeln und im Batch und triggert Geocoding bei Adressänderungen.

- **Kategorie:** integration
- **Implementierung:** implementiert
- **Einbindung:** systemseitig
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `system`, `mitarbeiter`, `bueroleitung`
- **Routen:** —
- **Frontend-Komponenten:** —
- **Services:** —
- **Hooks:** —
- **Edge Functions:** `geocode-contact-address`, `batch-geocode-contacts`
- **Datenbankfunktionen:** `trigger_geocoding_on_address_change`
- **Tabellen:** `contacts`, `election_districts`
- **Abhängigkeiten:** —
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- supabase/functions/geocode-contact-address/index.ts
- supabase/functions/batch-geocode-contacts/index.ts

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `integration.ai-suggestions` — KI-Vorschläge für Vorbereitung und Eingang
Erzeugt Vorbereitungsvorschläge und Aufgaben-Vorschläge aus freiem Text über einen zentralen KI-Client mit Ratenbegrenzung.

- **Kategorie:** integration
- **Implementierung:** implementiert
- **Einbindung:** rollenabhängig
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`
- **Routen:** —
- **Frontend-Komponenten:** —
- **Services:** `supabase/functions/_shared/aiClient.ts`
- **Hooks:** —
- **Edge Functions:** `generate-preparation-suggestions`, `propose-task-from-intake`
- **Datenbankfunktionen:** —
- **Tabellen:** `appointment_preparations`, `tasks`
- **Abhängigkeiten:** —
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- supabase/functions/generate-preparation-suggestions/index.ts
- supabase/functions/propose-task-from-intake/index.ts
- supabase/functions/_shared/aiClient.ts

**Bekannte Einschränkungen**

- Der Vorschlag erzeugt keine Datenbankeinträge; die Übernahme bleibt eine bewusste Benutzeraktion.

**Offene Prüfpunkte**

- Kein Test für Prompt-Grenzen oder Ratenbegrenzung vorhanden.

### `integration.transcription` — Sprachaufnahme transkribieren
Transkribiert Sprachaufnahmen serverseitig für Notizen und Brieftexte.

- **Kategorie:** integration
- **Implementierung:** implementiert
- **Einbindung:** rollenabhängig
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`
- **Routen:** —
- **Frontend-Komponenten:** —
- **Services:** `src/lib/speechToTextAdapter.ts`
- **Hooks:** `src/hooks/useSpeechDictation.ts`
- **Edge Functions:** `transcribe-voice-note`
- **Datenbankfunktionen:** —
- **Tabellen:** `quick_notes`, `letters`
- **Abhängigkeiten:** —
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- supabase/functions/transcribe-voice-note/index.ts
- src/hooks/useSpeechDictation.ts

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `integration.unsplash` — Bildsuche für Beiträge
Sucht passende Bilder über Unsplash und übernimmt sie in Pressemitteilungen und Social-Beiträge.

- **Kategorie:** integration
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`
- **Routen:** —
- **Frontend-Komponenten:** `src/components/dashboard/UnsplashImagePicker.tsx`, `src/components/press/FeatureImagePicker.tsx`
- **Services:** —
- **Hooks:** —
- **Edge Functions:** `search-unsplash`
- **Datenbankfunktionen:** —
- **Tabellen:** `press_releases`, `social_assets`
- **Abhängigkeiten:** —
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- supabase/functions/search-unsplash/index.ts
- src/components/dashboard/UnsplashImagePicker.tsx

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `integration.egress-monitoring` — Egress-Überwachung
Sammelt Egress-Metriken, erkennt Anomalien und stellt sie im Betriebs-Dashboard bereit.

- **Kategorie:** sicherheit
- **Implementierung:** implementiert
- **Einbindung:** systemseitig
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `system`, `admin`
- **Routen:** —
- **Frontend-Komponenten:** —
- **Services:** —
- **Hooks:** —
- **Edge Functions:** `collect-egress-metrics`, `check-egress-anomaly`
- **Datenbankfunktionen:** —
- **Tabellen:** `egress_metrics`, `egress_anomalies`, `system_health`
- **Abhängigkeiten:** —
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** `docs/performance-audit-2026-05.md`

**Nachweise im Quellcode**

- supabase/functions/collect-egress-metrics/index.ts
- supabase/functions/check-egress-anomaly/index.ts

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `integration.edge-contract-tests` — Edge-Function-Vertragstests
Prüft Auth-, Rollen- und Mandantengrenzen der Edge Functions über Contract-Tests.

- **Kategorie:** sicherheit
- **Implementierung:** implementiert
- **Einbindung:** nicht anwendbar
- **Testabdeckung:** Security-Test
- **Letztes Testergebnis:** unbekannt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `system`
- **Routen:** —
- **Frontend-Komponenten:** —
- **Services:** `scripts/check-edge-function-security.mjs`, `scripts/security-function-whitelist.json`
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** —
- **Tabellen:** —
- **Abhängigkeiten:** —
- **Selbsttests:** —
- **Unit-Tests:** `supabase/functions/contract-tests.edge-functions.test.ts`
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** `docs/security-function-matrix.md`, `docs/ci-quality-gates.md`

**Nachweise im Quellcode**

- supabase/functions/contract-tests.edge-functions.test.ts
- scripts/check-edge-function-security.mjs

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Die Contract-Tests wurden hier nicht ausgeführt; der Nachweis ist die Datei.

## Regeln

Fachliche Invarianten stehen in [AGENTS.md](../../AGENTS.md); Rollen und Rechte in [rollenrechte-matrix.md](../rollenrechte-matrix.md).
