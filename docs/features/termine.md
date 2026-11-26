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

| Szenario | Titel | deklarierte Tabellen | deklarierte Prüfungen | letzter Lauf |
|---|---|---:|---:|---|
| `appointment-briefing-lifecycle` | Briefing-Lifecycle (vergeben → Aufgabe → vorlegen → freigeben) | 3 | 5 | — |
| `appointment-lifecycle` | Termin-Lifecycle (Kalender + Briefing + Feedback) | 3 | 0 | — |
| `appointment-request-lifecycle` | Terminanfragen-Lifecycle (Eingang → Sperre → Entscheidung → Termin) | 2 | 4 | — |
| `daily-briefing-lifecycle` | Tages-Briefings (Vortag-Regel) | 1 | 0 | — |
| `day-slip-lifecycle` | Tageszettel-Lifecycle (Links → Neuladen → Übernahme auf Folgetag) | 3 | 14 | — |
| `jour-fixe-platform-integration` | Jour Fixe: Plattformquellen & Stafetten-Abschluss | 4 | 4 | — |
| `poll-lifecycle` | Terminabstimmung (Gewinner-Slot übernehmen + Nachfassen) | 5 | 6 | — |

## Selbsttest-Schritte

Diese Schritte führen die Szenarien aus; „letzter Lauf“ stammt aus `src/features/selftest/last-runs.json`, nicht aus dieser Doku.

| Szenario | Schritt | Bezeichnung | Art | letzter Lauf |
|---|---|---|---|---|
| `appointment-briefing-lifecycle` | `personal-sent-changes` | Gemeldete Änderungen nur heute und persönlich ausblendbar | logic | — |
| `appointment-briefing-lifecycle` | `day-appointment-progress` | Dein Tag: vergangen, laufend und als nächstes | logic | — |
| `appointment-briefing-lifecycle` | `appointment-change-rules` | Terminänderung: Schnellwahl, eigene Zeit, Ort und Hinweis-Chip | logic | — |
| `appointment-briefing-lifecycle` | `dashboard-briefing-status` | Dashboard-Briefing: Auftrag, Entscheidung und Freigabe | logic | — |
| `appointment-briefing-lifecycle` | `appointment-dashboard-focus` | Termin-Fokus: Größe, Abfahrt und laufender Termin | logic | — |
| `appointment-briefing-lifecycle` | `office-debrief-inbox` | Nachbereitung: Zusagen priorisieren und Quelle anzeigen | logic | — |
| `appointment-briefing-lifecycle` | `today-priorities` | Heute zuerst: Rangfolge und Berliner Tagesgrenzen | logic | — |
| `appointment-briefing-lifecycle` | `office-feedback` | Bürorückmeldung: Abschluss, Erinnerung und ältere Termine | logic | — |
| `appointment-briefing-lifecycle` | `day-summary` | Tagesüberblick: leere Tage, laufende Termine, Briefings und offene Rückmeldungen | logic | — |
| `appointment-briefing-lifecycle` | `reminder` | Briefing-Hinweis: Zuständigkeit, Vorlauf und Montag | logic | — |
| `appointment-briefing-lifecycle` | `rules` | Regeln: nur Entscheider geben frei; Frist am Vortag 12:00 | logic | — |
| `appointment-briefing-lifecycle` | `model` | Regeln: Kurz/Dossier-Umrechnung, Live nur am Termintag, Folgeaufgabe, Abschluss | logic | — |
| `appointment-briefing-lifecycle` | `create` | Termin anlegen (Briefing offen) | db | — |
| `appointment-briefing-lifecycle` | `change-alert` | Eil-Änderung mit neuer Zeit und Hinweis speichern | workflow | — |
| `appointment-briefing-lifecycle` | `assign` | Briefing vergeben → Aufgabe entsteht | workflow | — |
| `appointment-briefing-lifecycle` | `submit` | Vorlegen → Ball bei Abgeordnete/r | workflow | — |
| `appointment-briefing-lifecycle` | `approve` | Freigeben → Aufgabe erledigt | workflow | — |
| `appointment-briefing-lifecycle` | `none` | „Kein Briefing“ setzt Status und löst Aufgabe | workflow | — |
| `appointment-briefing-lifecycle` | `accept-with-briefing` | Zusage im Jour Fixe vergibt Briefing in einem Schritt | workflow | — |
| `appointment-lifecycle` | `birthday-congratulations-options` | Dashboard und Jour fixe teilen die Glückwunsch-Optionen | logic | — |
| `appointment-lifecycle` | `dashboard-occasions` | Geburtstage und ganztägige Termine getrennt darstellen | logic | — |
| `appointment-lifecycle` | `invitation-uid-sequence` | Einladungen: stabile UID und fortlaufende SEQUENCE | logic | — |
| `appointment-lifecycle` | `invitation-guest-identity` | Einladungen: Gäste per E-Mail angleichen, RSVP und Antwortlink erhalten | logic | — |
| `appointment-lifecycle` | `poll-slot-suggestions` | Terminabstimmung: Slots aus Frei/Gebucht samt Puffer | logic | — |
| `appointment-lifecycle` | `poll-answer-followup` | Terminabstimmung: automatisches Nachfassen ohne Antwort | logic | — |
| `appointment-lifecycle` | `poll-followup-queue` | Terminabstimmung: Versandwarteschlange mit Wiederholungen | logic | — |
| `appointment-lifecycle` | `appointment-reminder-due` | Termin-Erinnerung: Vorlauf, Fälligkeit und ein Versand je Termin | logic | — |
| `appointment-lifecycle` | `appointment-reminder-reset-on-move` | Terminverschiebung macht die Erinnerung wieder scharf | logic | — |
| `appointment-lifecycle` | `create-appointment` | Termin anlegen (heute, 2h Block) | db | — |
| `appointment-lifecycle` | `create-preparation` | Briefing/Vorbereitung mit allen Strukturfeldern | db | — |
| `appointment-lifecycle` | `create-feedback` | Feedback (abgeschlossen, mit Notizen) | db | — |
| `appointment-lifecycle` | `feedback-unique` | Zweite Rückmeldung zum selben Termin wird abgewiesen | workflow | — |
| `appointment-request-lifecycle` | `create` | Anfrage anlegen | db | — |
| `appointment-request-lifecycle` | `guard` | Direkte Statusänderung wird blockiert | db | — |
| `appointment-request-lifecycle` | `decide` | Über Freigabe-Funktion zusagen → Termin entsteht | workflow | — |
| `appointment-request-lifecycle` | `repeat-decision` | Erneute Zusage wird abgewiesen; kein doppelter Termin | workflow | — |
| `daily-briefing-lifecycle` | `relative-read-day` | Lesebestätigung unterscheidet heute und gestern in Berlin | logic | — |
| `daily-briefing-lifecycle` | `read-ahead` | Vorliegende Tagesbriefings vorab lesen | logic | — |
| `daily-briefing-lifecycle` | `collapse-read-briefing` | Nur gelesene Tagesbriefings einklappen | logic | — |
| `daily-briefing-lifecycle` | `read-receipt-time` | Lesezeitpunkt als Berliner Uhrzeit anzeigen | logic | — |
| `daily-briefing-lifecycle` | `date-chips` | Morgen und übermorgen sind Berliner Kalendertage | logic | — |
| `daily-briefing-lifecycle` | `reject-today` | Vortag-Regel: Briefing für heute wird abgelehnt | db | — |
| `daily-briefing-lifecycle` | `create-yesterday` | Briefing für morgen anlegen | db | — |
| `daily-briefing-lifecycle` | `create-today` | Briefing für übermorgen anlegen | db | — |
| `daily-briefing-lifecycle` | `verify-list` | Beide Briefings für Tenant lesbar | db | — |
| `day-slip-lifecycle` | `write` | Tageszettel mit 4 verlinkten Zeilen speichern | db | — |
| `day-slip-lifecycle` | `reload` | Neuladen: alle Links + Sprungziele vorhanden | db | — |
| `day-slip-lifecycle` | `carry` | Offene Zeilen auf Folgetag übernehmen (Links bleiben) | db | — |
| `day-slip-lifecycle` | `no-duplicate-carry` | Erneute Übernahme erzeugt keine doppelten Zeilen | logic | — |
| `day-slip-lifecycle` | `template-flag-persisted` | Vorlagenentscheidung bleibt nach Speichern und Neuladen erhalten | db | — |
| `day-slip-lifecycle` | `start-injection-once` | Vorlage, Wochenplan und Routinen entscheiden einmal pro Tag | logic | — |
| `day-slip-lifecycle` | `navigation-rules` | Frühere Tage lesbar, Zukunft gesperrt | logic | — |
| `day-slip-lifecycle` | `open-past-days` | Offene frühere Tage werden aufgelistet | logic | — |
| `day-slip-lifecycle` | `snooze-presets` | Snooze-Vorschläge ohne doppeltes Ziel | logic | — |
| `day-slip-lifecycle` | `template-decision` | Wochentag-Vorlage nur an unbegonnenen Zetteln, Entscheidung je Tag festgehalten | logic | — |
| `day-slip-lifecycle` | `export-idempotent` | Export trifft dasselbe Ziel ohne Dublette | db | — |
| `day-slip-lifecycle` | `foreign-slip-blocked` | Fremder Zettel bleibt schreib- und lesegeschützt | db | — |
| `day-slip-lifecycle` | `mood-persisted` | Stimmung bleibt nach Speichern und Neuladen erhalten | db | — |
| `day-slip-lifecycle` | `archive-after-reload` | Archiv trennt abgeschlossene und offene Tage nach dem Neuladen | db | — |
| `day-slip-lifecycle` | `delete-undo` | Löschen mit Rückgängig erhält Reihenfolge und Verknüpfung | logic | — |
| `day-slip-lifecycle` | `line-shortcuts` | Getippte Kürzel werden erkannt und aufgelöst | logic | — |
| `day-slip-lifecycle` | `archive-status` | Archiv trennt erledigt von zugewiesen und bleibt durchsuchbar | logic | — |
| `jour-fixe-platform-integration` | `agenda-combine` | Agenda: Hauptpunkt mit Unterpunkten unter anderen Hauptpunkt verschieben | logic | — |
| `jour-fixe-platform-integration` | `agenda-timing` | Agenda: nur Hauptpunkte zählen, Altbestand ohne erfundene Endzeit | logic | — |
| `jour-fixe-platform-integration` | `radar-rules` | Radar: mehrfache Anstupser, 7-Tage-Grenze und abgeschlossene Aufgaben | logic | — |
| `jour-fixe-platform-integration` | `horizon-rules` | Zeitfenster: Redaktion 10, Briefings/Abwesenheiten 14 und Veranstaltungen 60 Tage | logic | — |
| `jour-fixe-platform-integration` | `zombie-points` | Agenda: Zombie-Punkte ab der dritten Verschiebung | logic | — |
| `jour-fixe-platform-integration` | `actual-times` | Agenda: Ist-Zeiten, Rundung und Abweichung | logic | — |
| `jour-fixe-platform-integration` | `meeting-decision-note` | Beschluss: Entscheidungsblock verliert keine bestehende Notiz | logic | — |
| `jour-fixe-platform-integration` | `create` | Sitzung, Hauptpunkt, alle Systemtypen und zwei gleichnamige Entscheidungen | db | — |
| `jour-fixe-platform-integration` | `archive` | Gemeinsamen Sitzungsabschluss ausführen und Stafetten-Aufgabe zurücklesen | workflow | — |
| `jour-fixe-platform-integration` | `retry` | Erneuter Abschluss erzeugt keine zweite Folgeaufgabe | workflow | — |
| `poll-lifecycle` | `create-poll` | Abstimmung mit Slots und Teilnehmern anlegen | db | — |
| `poll-lifecycle` | `confirm-winner` | Gewinner-Slot übernehmen (idempotent, genau ein Termin) | db | — |
| `poll-lifecycle` | `confirm-winner-guards` | Ersteller-, Slot- und Mandantenprüfung | db | — |

## Deklarierter Prüfumfang

### `appointment-briefing-lifecycle`

1. Regeln für Freigabe und Fristvorschlag
2. Aufgabe entsteht beim Vergeben
3. Ball wechselt bei Vorlage
4. Freigabe erledigt Aufgabe
5. Kein Briefing schließt Aufgabe

### `appointment-lifecycle`

Keine Prüfungen deklariert.

### `appointment-request-lifecycle`

1. Statussperre bei direktem Schreiben
2. Zusage über die Anwendungs-RPC
3. Verknüpfter Termin
4. Wiederholung erzeugt keinen zweiten Termin

### `daily-briefing-lifecycle`

Keine Prüfungen deklariert.

### `day-slip-lifecycle`

1. Speichern und erneutes Laden
2. Link-Erhalt bei Übernahme
3. Keine doppelte Übernahme
4. Wochentag-Vorlage, Wochenplan und Routinen entscheiden einmal pro Tag; nur leere Zettel erhalten Vorlage und Plan
5. Archivierte Vorlagenentscheidung übersteht Speichern und Neuladen
6. Export trifft dasselbe Ziel ohne Dublette (Aufgabe und Notiz)
7. Schreiben in einen fremden Zettel wird verweigert, fremde Zettel bleiben unlesbar
8. Stimmung übersteht Speichern und Neuladen
9. Archiv trennt abgeschlossene und offene Tage nach dem Neuladen
10. Frühere Tage ohne Abschluss bleiben lesbar
11. Snooze-Vorschläge ohne doppeltes Ziel
12. Löschen mit Rückgängig
13. Getippte Kürzel ohne Automatik
14. Archiv: erledigt/zugewiesen/offen, Suche, Datumsnachbarn

### `jour-fixe-platform-integration`

1. Quellenabfragen unter bestehenden Zugriffsrechten
2. Folgeaufgaben mit Zuständigkeit und Verlauf
3. Notizen ändern keine Abstimmung
4. Wiederholung erzeugt keine Duplikate

### `poll-lifecycle`

1. confirm_poll_winner legt genau einen Termin an und verknüpft ihn mit der Abstimmung
2. Zweiter Aufruf (gleicher und anderer Slot) liefert denselben Termin und den tatsächlich gespeicherten Slot
3. Externe Teilnehmer werden als Gäste am Termin angelegt, interne nicht
4. Fremde Slots und unbekannte Abstimmungen werden abgelehnt
5. Fremde Abstimmungen im Mandanten können nicht übernommen werden
6. get_poll_availability verweigert fremde Mandanten

## Funktionsdetails

### `calendar.view` — Terminkalender anzeigen
Stellt Termine in Monats-, Wochen- und Tagesansicht dar, inklusive Quellen, Kollisionen und Statusfiltern.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** Selbsttest
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
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
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
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
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
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
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
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
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
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
- **Letztes Testergebnis:** unbekannt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
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
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
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
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
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
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
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
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
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
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
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
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
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
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
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
Erzeugt Tagesbriefings und Tageszettel mit Terminen und Aufgaben, hält Lesebestätigungen fest und archiviert Tageszettel. Vergangene Zettel bleiben auch ohne Abschluss lesbar; Löschen ist rückgängig zu machen. Getippte Kürzel (+ Aufgabe, ~ Notiz, ? Entscheidung, @Person, >Fälligkeit) belegen die Zuordnung am Tagesende vor. Das Archiv ist durchsuchbar, per Datum anwählbar und zeigt je Zeile, ob sie erledigt, zugewiesen oder offen ist. Der Stimmungsverlauf der letzten 14 Tage steht als schmale Leiste neben dem Tagesabschluss. Tagesvorlagen lassen sich je Wochentag fest zuordnen (Standard: Dienstag Plenartag, Donnerstag Ausschusstag) und werden nur an noch leeren, unbegonnenen Tagen einmalig automatisch eingefügt; die Vorlagenentscheidung wird für den Tag festgehalten, sodass auch ein später geleerter, bereits begonnener Zettel unverändert bleibt.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** Selbsttest
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
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

- Frühere Tage sind schreibgeschützt; abgeschlossen werden kann nur der aktuelle Tag.
- Wochentag-Vorlage, Wochenplan und wiederkehrende Punkte werden als eine Startentscheidung einmal pro Tag getroffen: Vorlage und Wochenplan kommen nur in noch unbegonnene Zettel und auch nach späterem Leeren nicht nachträglich; Routinen höchstens einmal, auch auf einem bereits begonnenen Zettel. Die Entscheidung wird auch dann festgehalten, wenn nichts eingefügt wurde. Manuell gewählte Vorlagen ersetzen sie für den Tag.
- Kürzel belegen die Zuordnung nur vor; mehrdeutige Namen und unbekannte Fälligkeiten bleiben Text und werden in der Zuordnung geklärt.

**Offene Prüfpunkte**

- Keine.

### `calendar.categories-locations` — Terminkategorien und -orte pflegen
Verwaltet konfigurierbare Terminkategorien, Status und Orte in der Administration.

- **Kategorie:** administrativ
- **Implementierung:** implementiert
- **Einbindung:** rollenabhängig
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
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
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
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
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
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
