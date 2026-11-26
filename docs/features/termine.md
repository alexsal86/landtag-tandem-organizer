# Termine, Anfragen & Briefings

_Auto-generiert mit `npm run update:feature-catalog` aus dem zentralen Funktionskatalog (`src/features/feature-catalog/inventory/termine.json`). Nicht von Hand bearbeiten._

**Zweck:** Kalender führen, Termine anlegen und abstimmen, Einladungen und Erinnerungen versenden, Briefings vorbereiten und nachbereiten.

## Kennzahlen

- Funktionen: **17** in **8** Unterbereichen
- implementiert: **17**, teilweise: **0**, deaktiviert: **0**, potenziell verwaist: **0**
- ohne zugeordneten Test: **8**
- ohne Dokumentationsverweis: **11**

## Funktionen

| Funktion | Unterbereich | Kategorie | Implementierung | Einbindung | Abdeckung |
|---|---|---|---|---|---|
| `appointments.briefing-live` Live-Briefing und Nachbereitung | Briefings | fachlich | implementiert | UI | Selbsttest |
| `appointments.briefing` Terminbriefing erstellen | Briefings | fachlich | implementiert | rollenabhängig | Selbsttest |
| `appointments.jour-fixe` Jour-fixe-Agende und Systempunkte | Jour fixe | fachlich | implementiert | UI | Selbsttest |
| `calendar.holidays` Feiertage synchronisieren | Kalender | automatisiert | implementiert | systemseitig | kein Test |
| `calendar.guests` Gäste und Teilnehmende verwalten | Kalender | fachlich | implementiert | UI | kein Test |
| `calendar.create-appointment` Termin anlegen | Kalender | fachlich | implementiert | rollenabhängig | Selbsttest |
| `calendar.edit-move` Termin bearbeiten und verschieben | Kalender | fachlich | implementiert | UI | kein Test |
| `calendar.invitations` Termineinladungen und Kalendereinträge versenden | Kalender | integration | implementiert | UI | Unit-Test |
| `calendar.reminders` Terminerinnerungen | Kalender | automatisiert | implementiert | systemseitig | kein Test |
| `calendar.view` Terminkalender anzeigen | Kalender | fachlich | implementiert | UI | Selbsttest |
| `calendar.categories-locations` Terminkategorien und -orte pflegen | Kalender | administrativ | implementiert | rollenabhängig | kein Test |
| `appointments.debrief` Nachbereitung und Büro-Feedback | Nachbereitung | fachlich | implementiert | UI | kein Test |
| `appointments.feedback` Termin-Feedback erfassen | Nachbereitung | automatisiert | implementiert | systemseitig | kein Test |
| `daily.briefing` Tagesbriefing und Tageszettel | Tagesbriefing | fachlich | implementiert | UI | Selbsttest |
| `calendar.polls` Terminumfrage erstellen | Terminabstimmung | fachlich | implementiert | UI | Selbsttest |
| `appointments.requests` Terminanfrage stellen und entscheiden | Terminanfragen | fachlich | implementiert | rollenabhängig | Selbsttest |
| `appointments.preparation` Terminvorbereitung mit Vorschlägen | Vorbereitung | fachlich | implementiert | UI | kein Test |

## Unterbereiche

- Kalender
- Terminanfragen
- Briefings
- Nachbereitung
- Vorbereitung
- Jour fixe
- Tagesbriefing
- Terminabstimmung

## Rollen

`abgeordneter`, `bueroleitung`, `mitarbeiter`, `praktikant`, `system`, `admin`

## Datenbanktabellen

`appointment_categories`, `appointment_change_alerts`, `appointment_contacts`, `appointment_feedback`, `appointment_feedback_settings`, `appointment_guests`, `appointment_locations`, `appointment_polls`, `appointment_preparation_documents`, `appointment_preparation_templates`, `appointment_preparations`, `appointment_reminder_dispatches`, `appointment_requests`, `appointment_statuses`, `appointment_topics`, `appointments`, `case_items`, `daily_briefing_reads`, `daily_briefings`, `day_slips`, `default_appointment_guests`, `email_logs`, `external_events`, `meeting_agenda_items`, `meetings`, `notifications`, `poll_participants`, `poll_time_slots`, `public_holidays`, `starred_appointments`, `tasks`

## Selbsttest-Szenarien

| Szenario | Titel | deklarierte Tabellen | deklarierte Prüfungen |
|---|---|---:|---:|
| `appointment-briefing-lifecycle` | Briefing-Lifecycle (vergeben → Aufgabe → vorlegen → freigeben) | 3 | 5 |
| `appointment-lifecycle` | Termin-Lifecycle (Kalender + Briefing + Feedback) | 3 | 0 |
| `appointment-request-lifecycle` | Terminanfragen-Lifecycle (Eingang → Sperre → Entscheidung → Termin) | 2 | 4 |
| `daily-briefing-lifecycle` | Tages-Briefings (Vortag-Regel) | 1 | 0 |
| `day-slip-lifecycle` | Tageszettel-Lifecycle (Links → Neuladen → Übernahme auf Folgetag) | 1 | 8 |
| `jour-fixe-platform-integration` | Jour Fixe: Plattformquellen & Stafetten-Abschluss | 4 | 4 |
| `poll-lifecycle` | Terminabstimmung (Gewinner-Slot übernehmen + Nachfassen) | 5 | 6 |

## Funktionsdetails

### `calendar.view` — Terminkalender anzeigen
Stellt Termine in Monats-, Wochen- und Tagesansicht dar, inklusive Quellen, Kollisionen und Statusfiltern.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** Selbsttest
- **Letztes Testergebnis:** nicht-ausgefuehrt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`, `praktikant`
- **Routen:** `/calendar`
- **Frontend-Komponenten:** `src/features/calendar/components/CalendarView.tsx`, `src/components/calendar/EnhancedCalendar.tsx`, `src/components/calendar/MonthView.tsx`, `src/components/calendar/WeekView.tsx`, `src/components/calendar/DayView.tsx`
- **Services:** —
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** —
- **Tabellen:** `appointments`, `appointment_statuses`, `appointment_categories`, `external_events`, `starred_appointments`
- **Abhängigkeiten:** —
- **Selbsttests:** `appointment-lifecycle`
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** `docs/rollenrechte-matrix.md`

**Nachweise im Quellcode**

- src/features/calendar/components/CalendarView.tsx
- src/components/calendar/EnhancedCalendar.tsx
- src/features/selftest/scenarios/appointment-lifecycle.ts

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `calendar.create-appointment` — Termin anlegen
Legt Termine mit Zeitraum, Ort, Kategorie, Kontakten, Gästen und Vorbereitungsbezug an.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** rollenabhängig
- **Testabdeckung:** Selbsttest
- **Letztes Testergebnis:** nicht-ausgefuehrt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`, `praktikant`
- **Routen:** —
- **Frontend-Komponenten:** `src/features/appointments/components/CreateAppointmentDialog.tsx`
- **Services:** —
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** —
- **Tabellen:** `appointments`, `appointment_categories`, `appointment_locations`, `appointment_contacts`
- **Abhängigkeiten:** `calendar.categories-locations`
- **Selbsttests:** `appointment-lifecycle`
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/features/appointments/components/CreateAppointmentDialog.tsx
- src/pages/Index.tsx

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `calendar.edit-move` — Termin bearbeiten und verschieben
Ändert Termine, verschiebt sie im Kalender und erzeugt bei relevanten Änderungen Hinweise an Beteiligte.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`
- **Routen:** —
- **Frontend-Komponenten:** `src/features/appointments/change-alerts/AppointmentChangeAlerts.tsx`
- **Services:** `src/features/appointments/change-alerts/changeModel.ts`
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** `reset_appointment_reminders_on_move`, `reopen_changed_appointment_briefing`
- **Tabellen:** `appointments`, `appointment_change_alerts`, `appointment_reminder_dispatches`
- **Abhängigkeiten:** `calendar.create-appointment`
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/features/appointments/change-alerts/AppointmentChangeAlerts.tsx
- src/features/appointments/change-alerts/changeModel.ts

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `calendar.guests` — Gäste und Teilnehmende verwalten
Verwaltet Termingäste, Standardgäste und Zu-/Absagen mit E-Mail-Normalisierung.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`, `praktikant`
- **Routen:** —
- **Frontend-Komponenten:** `src/features/appointments/components/GuestManager.tsx`, `src/features/appointments/components/DefaultGuestsAdmin.tsx`
- **Services:** —
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** `upsert_appointment_guests`, `normalize_appointment_guest_email`
- **Tabellen:** `appointment_guests`, `default_appointment_guests`, `appointments`
- **Abhängigkeiten:** `calendar.create-appointment`
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/features/appointments/components/GuestManager.tsx
- src/features/appointments/components/DefaultGuestsAdmin.tsx

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `calendar.reminders` — Terminerinnerungen
Versendet In-App-, Push- und optional E-Mail-Erinnerungen gemäß reminder_minutes und verhindert Doppelversand.

- **Kategorie:** automatisiert
- **Implementierung:** implementiert
- **Einbindung:** systemseitig
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `system`, `abgeordneter`, `bueroleitung`, `mitarbeiter`
- **Routen:** —
- **Frontend-Komponenten:** —
- **Services:** `supabase/functions/_shared/appointmentReminder.ts`, `src/features/appointments/reminderRules.ts`
- **Hooks:** —
- **Edge Functions:** `send-appointment-reminders`
- **Datenbankfunktionen:** `dispatch_due_appointment_reminders`, `seed_appointment_reminder_type`
- **Tabellen:** `appointments`, `appointment_reminder_dispatches`, `notifications`
- **Abhängigkeiten:** `calendar.create-appointment`
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** `docs/operations`

**Nachweise im Quellcode**

- src/features/appointments/reminderRules.ts
- supabase/functions/send-appointment-reminders/index.ts
- supabase/functions/_shared/appointmentReminder.ts

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `calendar.invitations` — Termineinladungen und Kalendereinträge versenden
Erzeugt ICS-Einladungen, versendet sie und stempelt den Versand am Termin.

- **Kategorie:** integration
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** Unit-Test
- **Letztes Testergebnis:** unbekannt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`
- **Routen:** —
- **Frontend-Komponenten:** —
- **Services:** `supabase/functions/_shared/appointmentInvite.ts`, `src/features/appointments/invitations/invitationRules.ts`
- **Hooks:** —
- **Edge Functions:** `generate-calendar-invite`, `send-appointment-invitation`
- **Datenbankfunktionen:** `stamp_appointment_calendar_invite`
- **Tabellen:** `appointments`, `appointment_guests`, `email_logs`
- **Abhängigkeiten:** `calendar.guests`, `integration.email`
- **Selbsttests:** —
- **Unit-Tests:** `supabase/functions/_shared/appointmentInvite.test.ts`
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- supabase/functions/_shared/appointmentInvite.ts
- supabase/functions/generate-calendar-invite/index.ts
- supabase/functions/send-appointment-invitation/index.ts

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `appointments.requests` — Terminanfrage stellen und entscheiden
Erfasst Terminanfragen in einer eigenen Tabelle; nur die Entscheiderrolle darf über decide_appointment_request zusagen und damit atomar einen Termin erzeugen.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** rollenabhängig
- **Testabdeckung:** Selbsttest
- **Letztes Testergebnis:** nicht-ausgefuehrt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`
- **Routen:** —
- **Frontend-Komponenten:** `src/features/appointment-requests/AppointmentRequestHost.tsx`, `src/features/appointment-requests/AppointmentRequestCreateDialog.tsx`, `src/features/appointment-requests/AppointmentRequestDetailDialog.tsx`, `src/features/appointment-requests/AppointmentRequestList.tsx`
- **Services:** —
- **Hooks:** `src/features/appointment-requests/useAppointmentRequests.ts`
- **Edge Functions:** —
- **Datenbankfunktionen:** `decide_appointment_request`, `appointment_requests_guard`
- **Tabellen:** `appointment_requests`, `appointments`
- **Abhängigkeiten:** `calendar.create-appointment`
- **Selbsttests:** `appointment-request-lifecycle`
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** `docs/rollenrechte-matrix.md`

**Nachweise im Quellcode**

- src/features/appointment-requests/AppointmentRequestHost.tsx
- src/features/appointment-requests/logic.ts
- src/features/selftest/scenarios/appointment-request-lifecycle.ts

**Bekannte Einschränkungen**

- Ein direkter Statuswechsel wird durch einen Trigger blockiert; der Negativpfad ist im Szenario geprüft.

**Offene Prüfpunkte**

- Keine.

### `appointments.briefing` — Terminbriefing erstellen
Erstellt Kurz-, 7-Phasen- und Live-Briefings auf einem gemeinsamen preparation_data-Datensatz und erzeugt Folgeaufgaben.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** rollenabhängig
- **Testabdeckung:** Selbsttest
- **Letztes Testergebnis:** nicht-ausgefuehrt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`
- **Routen:** `/appointment-preparation/:id`
- **Frontend-Komponenten:** `src/features/appointments/components/AppointmentPreparationSidebar.tsx`, `src/features/appointments/briefing/CompactBriefingEditor.tsx`, `src/features/appointments/briefing/AppointmentBriefingStatusCard.tsx`
- **Services:** —
- **Hooks:** `src/features/appointments/briefing/useBriefing.ts`, `src/hooks/useAppointmentPreparation.tsx`
- **Edge Functions:** —
- **Datenbankfunktionen:** `set_appointment_briefing`, `set_appointment_briefing_depth`, `advance_appointment_briefing`, `complete_appointment_briefing`, `create_briefing_follow_up_task`, `appointment_preparation_ready`, `auto_archive_completed_preparations`, `create_preparation_followup`, `preserve_preparation_task_links`, `record_preparation_history`, `validate_appointment_briefing_status`
- **Tabellen:** `appointment_preparations`, `appointment_preparation_documents`, `appointments`, `tasks`
- **Abhängigkeiten:** `tasks.create`, `integration.ai-suggestions`
- **Selbsttests:** `appointment-briefing-lifecycle`
- **Unit-Tests:** `src/features/appointments/briefing.test.ts`
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** `docs/dossier-umsetzungsplan.md`

**Nachweise im Quellcode**

- src/features/appointments/briefing/briefingModel.ts
- src/features/appointments/briefing.ts
- src/features/selftest/scenarios/appointment-briefing-lifecycle.ts

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `appointments.briefing-live` — Live-Briefing und Nachbereitung
Führt das Briefing im Termin, erlaubt Statusfortschritt und erzeugt Nachbereitungsaufgaben mit Stafette-Feldern.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** Selbsttest
- **Letztes Testergebnis:** nicht-ausgefuehrt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`
- **Routen:** `/briefing-live/:id`
- **Frontend-Komponenten:** `src/pages/BriefingLivePage.tsx`, `src/features/appointments/briefing/PendingBriefingNotice.tsx`
- **Services:** `src/features/appointments/briefing/briefingModel.ts`
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** `advance_appointment_briefing`, `complete_appointment_briefing`
- **Tabellen:** `appointment_preparations`, `tasks`
- **Abhängigkeiten:** `appointments.briefing`, `integration.transcription`
- **Selbsttests:** `appointment-briefing-lifecycle`
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/pages/BriefingLivePage.tsx
- src/features/appointments/briefing/useBriefingEditorView.ts
- src/features/appointments/briefing/debriefActions.ts

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `appointments.debrief` — Nachbereitung und Büro-Feedback
Sammelt Rückmeldungen aus dem Termin, zeigt offene Nachbereitungen und schließt Feedback-Erinnerungen.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`
- **Routen:** —
- **Frontend-Komponenten:** `src/features/appointments/briefing/OfficeDebriefInboxCard.tsx`, `src/features/appointments/briefing/OfficeFeedbackCard.tsx`, `src/features/appointments/briefing/DeputyDebriefReview.tsx`
- **Services:** `src/features/appointments/briefing/officeDebriefInbox.ts`, `src/features/appointments/briefing/officeFeedback.ts`
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** `list_office_debriefs`, `update_office_debrief`, `close_office_feedback_reminder`
- **Tabellen:** `appointment_feedback`, `appointment_preparations`
- **Abhängigkeiten:** `appointments.briefing`
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/features/appointments/briefing/OfficeDebriefInboxCard.tsx
- src/features/appointments/briefing/officeDebriefInbox.ts
- src/features/appointments/briefing/OfficeFeedbackCard.tsx

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `appointments.feedback` — Termin-Feedback erfassen
Erfasst Feedback zu vergangenen Terminen, erzeugt Feedback-Einträge automatisch und steuert Erinnerungen.

- **Kategorie:** automatisiert
- **Implementierung:** implementiert
- **Einbindung:** systemseitig
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`, `system`
- **Routen:** —
- **Frontend-Komponenten:** `src/components/dashboard/AppointmentFeedbackWidget.tsx`
- **Services:** —
- **Hooks:** —
- **Edge Functions:** `create-daily-appointment-feedback`
- **Datenbankfunktionen:** `create_appointment_feedback_entry`, `create_appointment_feedback_on_past`, `create_feedback_for_past_appointment`, `dispatch_office_feedback_reminders`, `request_birthday_congratulations`
- **Tabellen:** `appointment_feedback`, `appointment_feedback_settings`
- **Abhängigkeiten:** `calendar.create-appointment`
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- supabase/functions/create-daily-appointment-feedback/index.ts
- src/components/dashboard/AppointmentFeedbackWidget.tsx

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `appointments.preparation` — Terminvorbereitung mit Vorschlägen
Bereitet Termine mit Dokumenten, Themen, Kontaktwissen und KI-Vorschlägen vor.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`
- **Routen:** `/appointment-preparation/:id`
- **Frontend-Komponenten:** `src/pages/AppointmentPreparationDetail.tsx`, `src/components/appointment-preparations`
- **Services:** —
- **Hooks:** `src/hooks/useAppointmentPreparation.tsx`, `src/hooks/useAppointmentPreparationShortcuts.ts`
- **Edge Functions:** `generate-preparation-suggestions`, `detect-appointment-district`
- **Datenbankfunktionen:** —
- **Tabellen:** `appointment_preparations`, `appointment_preparation_templates`, `appointment_topics`, `appointment_preparation_documents`
- **Abhängigkeiten:** `appointments.briefing`, `integration.ai-suggestions`
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/pages/AppointmentPreparationDetail.tsx
- src/hooks/useAppointmentPreparation.tsx

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `appointments.jour-fixe` — Jour-fixe-Agende und Systempunkte
Füllt die Jour-fixe-Agende aus Vorgängen, Aufgaben, Geburtstagen und weiteren Quellen und reserviert Termine.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** Selbsttest
- **Letztes Testergebnis:** nicht-ausgefuehrt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`
- **Routen:** —
- **Frontend-Komponenten:** `src/components/meetings/PlatformAgendaSection.tsx`, `src/components/meetings/PendingJourFixeCaseItems.tsx`, `src/components/meetings/PendingJourFixeNotes.tsx`
- **Services:** —
- **Hooks:** `src/hooks/useMyWorkJourFixeMeetings.ts`, `src/hooks/useMyWorkJourFixeSystemData.ts`
- **Edge Functions:** —
- **Datenbankfunktionen:** `claim_jour_fixe_reservations`, `capture_archived_jour_fixe_task`, `restore_jour_fixe_task_provenance`, `sync_jour_fixe_agenda_timer`, `respond_to_meeting_invitation`
- **Tabellen:** `meetings`, `meeting_agenda_items`, `case_items`, `tasks`
- **Abhängigkeiten:** `meetings.agenda`
- **Selbsttests:** `jour-fixe-platform-integration`
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** `docs/team-rituals.md`

**Nachweise im Quellcode**

- src/components/meetings/PlatformAgendaSection.tsx
- src/hooks/useMyWorkJourFixeSystemData.ts
- src/features/selftest/scenarios/jour-fixe-platform-integration.ts

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `daily.briefing` — Tagesbriefing und Tageszettel
Erzeugt Tagesbriefings und Tageszettel mit Terminen und Aufgaben, hält Lesebestätigungen fest und archiviert Tageszettel. Vergangene Zettel bleiben auch ohne Abschluss lesbar; Löschen ist rückgängig zu machen. Getippte Kürzel (+ Aufgabe, ~ Notiz, ? Entscheidung, @Person, >Fälligkeit) belegen die Zuordnung am Tagesende vor. Das Archiv ist durchsuchbar, per Datum anwählbar und zeigt je Zeile, ob sie erledigt, zugewiesen oder offen ist. Der Stimmungsverlauf der letzten 14 Tage steht als schmale Leiste neben dem Tagesabschluss. Tagesvorlagen lassen sich je Wochentag fest zuordnen (Standard: Dienstag Plenartag, Donnerstag Ausschusstag) und werden nur an noch leeren, unbegonnenen Tagen einmalig automatisch eingefügt; begonnene Zettel bleiben unverändert.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** Selbsttest
- **Letztes Testergebnis:** nicht-ausgefuehrt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`
- **Routen:** —
- **Frontend-Komponenten:** `src/features/briefings/components/TodayBriefingPanel.tsx`, `src/features/briefings/components/BriefingComposerCard.tsx`, `src/components/dayslip/GlobalDaySlipPanel.tsx`, `src/components/dayslip/DaySlipLexicalEditor.tsx`, `src/components/dayslip/DaySlipAppointments.tsx`, `src/components/dayslip/DaySlipCommandHelp.tsx`, `src/components/dayslip/DaySlipMoodTrend.tsx`, `src/components/dayslip/WeekPlanningBanner.tsx`
- **Services:** —
- **Hooks:** `src/features/briefings/hooks/useTodayBriefings.ts`, `src/features/briefings/hooks/useMarkBriefingRead.ts`, `src/features/briefings/hooks/useMyDraftBriefing.ts`, `src/components/dayslip/hooks/useDaySlipStore.ts`, `src/components/dayslip/hooks/useDaySlipPersistence.ts`
- **Edge Functions:** —
- **Datenbankfunktionen:** `can_view_daily_briefing_receipt`, `get_authored_daily_briefing_read_status`, `validate_daily_briefing_date`
- **Tabellen:** `daily_briefings`, `daily_briefing_reads`, `day_slips`
- **Abhängigkeiten:** —
- **Selbsttests:** `daily-briefing-lifecycle`, `day-slip-lifecycle`
- **Unit-Tests:** `src/components/dayslip/__tests__/GlobalDaySlipPanel.test.tsx`, `src/components/dayslip/__tests__/daySlipNavigation.test.ts`, `src/components/dayslip/__tests__/daySlipShorthand.test.ts`, `src/components/dayslip/__tests__/daySlipArchive.test.ts`, `src/components/dayslip/__tests__/daySlipState.test.ts`, `src/components/dayslip/__tests__/DaySlipLexicalEditor.test.tsx`, `src/components/dayslip/__tests__/daySlipLifecycle.test.tsx`, `src/features/selftest/scenarios/day-slip-lifecycle.test.ts`
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** `docs/my-work-architecture.md`

**Nachweise im Quellcode**

- src/features/briefings/components/TodayBriefingPanel.tsx
- src/features/briefings/hooks/useTodayBriefings.ts
- src/components/dayslip/GlobalDaySlipPanel.tsx
- src/components/dayslip/daySlipNavigation.ts
- src/components/dayslip/daySlipShorthand.ts
- src/components/dayslip/daySlipArchive.ts
- src/components/dayslip/daySlipState.ts
- src/components/dayslip/hooks/useDaySlipStore.ts
- src/components/dayslip/__tests__/daySlipNavigation.test.ts
- src/features/selftest/scenarios/daily-briefing-lifecycle.ts
- src/features/selftest/scenarios/day-slip-lifecycle.ts

**Bekannte Einschränkungen**

- Vortage sind schreibgeschützt; abgeschlossen werden kann nur der aktuelle Tag.
- Die automatische Wochentag-Vorlage wird nur einmal pro Tag, nur an noch leeren Zetteln und nie an abgeschlossenen oder bereits begonnenen Tagen eingefügt; manuell gewählte Vorlagen ersetzen sie für den Tag.
- Kürzel belegen die Zuordnung nur vor; mehrdeutige Namen und unbekannte Fälligkeiten bleiben Text und werden in der Zuordnung geklärt.

**Offene Prüfpunkte**

- Keine.

### `calendar.categories-locations` — Terminkategorien und -orte pflegen
Verwaltet konfigurierbare Terminkategorien, Status und Orte in der Administration.

- **Kategorie:** administrativ
- **Implementierung:** implementiert
- **Einbindung:** rollenabhängig
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `admin`, `bueroleitung`
- **Routen:** —
- **Frontend-Komponenten:** `src/components/administration/ConfigurableTypeSettings.tsx`
- **Services:** —
- **Hooks:** `src/hooks/useAppointmentCategories.tsx`
- **Edge Functions:** —
- **Datenbankfunktionen:** `config_delete_guard`, `delete_config_item`, `rename_config_item`, `config_rename_keys`
- **Tabellen:** `appointment_categories`, `appointment_statuses`, `appointment_locations`
- **Abhängigkeiten:** —
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/components/administration/ConfigurableTypeSettings.tsx
- src/hooks/useAppointmentCategories.tsx

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `calendar.polls` — Terminumfrage erstellen
Erstellt Terminumfragen mit Zeitfenstern und Teilnehmenden und wertet Antworten aus.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** Selbsttest
- **Letztes Testergebnis:** nicht-ausgefuehrt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`
- **Routen:** —
- **Frontend-Komponenten:** —
- **Services:** `src/features/polls/pollRules.ts`
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** `create_appointment_poll_with_details`
- **Tabellen:** `appointment_polls`, `poll_time_slots`, `poll_participants`
- **Abhängigkeiten:** `polls.manage`
- **Selbsttests:** `poll-lifecycle`
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/features/polls/pollRules.ts
- supabase/functions/_shared/pollSlotSuggestion.ts

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `calendar.holidays` — Feiertage synchronisieren
Lädt gesetzliche Feiertage und stellt sie Kalender- und Fristberechnungen zur Verfügung.

- **Kategorie:** automatisiert
- **Implementierung:** implementiert
- **Einbindung:** systemseitig
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `system`
- **Routen:** —
- **Frontend-Komponenten:** —
- **Services:** —
- **Hooks:** —
- **Edge Functions:** `sync-holidays`
- **Datenbankfunktionen:** —
- **Tabellen:** `public_holidays`
- **Abhängigkeiten:** —
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- supabase/functions/sync-holidays/index.ts

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Der Sync-Lauf wurde nicht ausgeführt; Datenquelle und Aktualisierungsintervall sind nicht dokumentiert.

## Regeln

Fachliche Invarianten stehen in [AGENTS.md](../../AGENTS.md); Rollen und Rechte in [rollenrechte-matrix.md](../rollenrechte-matrix.md).
