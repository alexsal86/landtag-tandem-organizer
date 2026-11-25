# Veranstaltungen & Umfragen

_Auto-generiert mit `npm run update:feature-catalog` aus dem zentralen Funktionskatalog (`src/features/feature-catalog/inventory/veranstaltungen.json`). Nicht von Hand bearbeiten._

**Zweck:** Veranstaltungen planen, Gäste einladen, öffentliche Rückmeldungen einsammeln und Termin-/Meinungsumfragen durchführen.

## Kennzahlen

- Funktionen: **9** in **3** Unterbereichen
- implementiert: **8**, teilweise: **0**, deaktiviert: **0**, potenziell verwaist: **0**
- ohne zugeordneten Test: **3**
- ohne Dokumentationsverweis: **6**

## Funktionen

| Funktion | Unterbereich | Kategorie | Implementierung | Einbindung | Abdeckung |
|---|---|---|---|---|---|
| `events.legacy-rsvp` Legacy-Einladungslinks | Einladungen | fachlich | veraltet | UI | kein Test |
| `events.rsvp-public` Öffentliche Veranstaltungs-Rückmeldung | Einladungen | integration | implementiert | UI | Integrationstest |
| `events.invitations` Veranstaltungseinladungen versenden | Einladungen | integration | implementiert | rollenabhängig | kein Test |
| `events.speakers-documents` Redner und Dokumente zur Veranstaltung | Planung | fachlich | implementiert | UI | kein Test |
| `events.plan` Veranstaltung planen | Planung | fachlich | implementiert | rollenabhängig | Selbsttest |
| `events.checklist` Veranstaltungs-Checkliste und Aufgaben | Planung | fachlich | implementiert | UI | Selbsttest |
| `polls.respond` An Umfrage teilnehmen | Umfragen | fachlich | implementiert | UI | Selbsttest |
| `polls.manage` Umfragen verwalten und auswerten | Umfragen | fachlich | implementiert | UI | Selbsttest |
| `polls.availability` Verfügbarkeit und Zeitfenster | Umfragen | fachlich | implementiert | UI | Unit-Test |

## Unterbereiche

- Planung
- Einladungen
- Umfragen

## Rollen

`abgeordneter`, `bueroleitung`, `mitarbeiter`, `oeffentlich`

## Datenbanktabellen

`appointment_polls`, `email_logs`, `event_email_templates`, `event_planning_action_logs`, `event_planning_checklist_items`, `event_planning_collaborators`, `event_planning_contacts`, `event_planning_dates`, `event_planning_documents`, `event_planning_item_actions`, `event_planning_speakers`, `event_planning_timeline_assignments`, `event_plannings`, `event_rsvp_public_links`, `event_rsvps`, `poll_notifications`, `poll_participants`, `poll_responses`, `poll_time_slots`, `poll_versions`

## Selbsttest-Szenarien

| Szenario | Titel | deklarierte Tabellen | deklarierte Prüfungen |
|---|---|---:|---:|
| `event-planning-lifecycle` | Event-Planung (komplett: Termine, Speaker, Checkliste, Timeline) | 6 | 0 |
| `poll-lifecycle` | Terminabstimmung (Gewinner-Slot übernehmen + Nachfassen) | 5 | 6 |

## Funktionsdetails

### `events.plan` — Veranstaltung planen
Plant Veranstaltungen mit Terminen, Checklisten, Rednern, Dokumenten, Beteiligten und Statusübergängen.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** rollenabhängig
- **Testabdeckung:** Selbsttest
- **Letztes Testergebnis:** nicht-ausgefuehrt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`
- **Routen:** `/eventplanning`
- **Frontend-Komponenten:** `src/features/event-planning/components/EventPlanningView.tsx`, `src/components/event-planning/useEventPlanningData.ts`
- **Services:** —
- **Hooks:** `src/components/event-planning/useEventPlanningData.ts`
- **Edge Functions:** —
- **Datenbankfunktionen:** `confirm_event_planning_calendar_date`
- **Tabellen:** `event_plannings`, `event_planning_dates`, `event_planning_collaborators`, `event_planning_contacts`, `event_planning_timeline_assignments`, `event_planning_action_logs`
- **Abhängigkeiten:** —
- **Selbsttests:** `event-planning-lifecycle`
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** `docs/public-event-invitations.md`

**Nachweise im Quellcode**

- src/features/event-planning/components/EventPlanningView.tsx
- src/components/event-planning/useEventPlanningData.ts
- supabase/migrations/20261125113000_appointment_dashboard_focus.sql
- src/features/selftest/scenarios/event-planning-lifecycle.ts

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `events.checklist` — Veranstaltungs-Checkliste und Aufgaben
Führt Checklistenpunkte und Aktionen je Veranstaltung und protokolliert deren Ausführung.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** Selbsttest
- **Letztes Testergebnis:** nicht-ausgefuehrt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`
- **Routen:** —
- **Frontend-Komponenten:** —
- **Services:** —
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** `create_default_checklist_items`
- **Tabellen:** `event_planning_checklist_items`, `event_planning_item_actions`
- **Abhängigkeiten:** —
- **Selbsttests:** `event-planning-lifecycle`
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/features/event-planning/components/EventPlanningView.tsx

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `events.speakers-documents` — Redner und Dokumente zur Veranstaltung
Verwaltet Redner, Dokumente und Gästelisten einer Veranstaltung.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`
- **Routen:** —
- **Frontend-Komponenten:** —
- **Services:** —
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** —
- **Tabellen:** `event_planning_speakers`, `event_planning_documents`
- **Abhängigkeiten:** —
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/features/event-planning/components/EventPlanningView.tsx

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `events.invitations` — Veranstaltungseinladungen versenden
Versendet Einladungen auf Basis von Vorlagen und protokolliert den Versand.

- **Kategorie:** integration
- **Implementierung:** implementiert
- **Einbindung:** rollenabhängig
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`
- **Routen:** —
- **Frontend-Komponenten:** `src/components/administration/EventEmailTemplateManager.tsx`
- **Services:** —
- **Hooks:** —
- **Edge Functions:** `send-event-invitation`
- **Datenbankfunktionen:** —
- **Tabellen:** `event_email_templates`, `event_rsvps`, `email_logs`
- **Abhängigkeiten:** —
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** `docs/public-event-invitations.md`

**Nachweise im Quellcode**

- supabase/functions/send-event-invitation/index.ts
- src/components/administration/EventEmailTemplateManager.tsx

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `events.rsvp-public` — Öffentliche Veranstaltungs-Rückmeldung
Lädt Gastdaten ausschließlich über einen starken public_code und nimmt Zu-/Absagen ohne Anmeldung entgegen, mit Rate-Limits und Widerrufsprüfung.

- **Kategorie:** integration
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** Integrationstest
- **Letztes Testergebnis:** unbekannt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `oeffentlich`
- **Routen:** `/einladung/:code`
- **Frontend-Komponenten:** `src/pages/EventRSVP.tsx`
- **Services:** —
- **Hooks:** —
- **Edge Functions:** `get-public-event-invitation`, `respond-public-event-invitation`
- **Datenbankfunktionen:** —
- **Tabellen:** `event_rsvps`, `event_rsvp_public_links`, `event_plannings`
- **Abhängigkeiten:** —
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** `e2e/public.spec.ts`
- **Dokumentation:** `docs/public-event-invitations.md`

**Nachweise im Quellcode**

- src/pages/EventRSVP.tsx
- supabase/functions/get-public-event-invitation/index.ts
- supabase/functions/respond-public-event-invitation/index.ts

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Ein vollständiger öffentlicher RSVP-Durchlauf gegen ein echtes Backend ist nicht in dieser Umgebung ausgeführt worden.

### `events.legacy-rsvp` — Legacy-Einladungslinks
Leitet alte Einladungs- und Gastlinks auf die aktuellen Pfade um, solange Altlinks im Umlauf sind.

- **Kategorie:** fachlich
- **Implementierung:** veraltet
- **Einbindung:** UI
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `oeffentlich`
- **Routen:** `/event-rsvp/:eventId`, `/guest-response/:token`
- **Frontend-Komponenten:** `src/pages/LegacyEventRSVPRedirect.tsx`, `src/pages/GuestResponse.tsx`
- **Services:** —
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** —
- **Tabellen:** `event_rsvps`
- **Abhängigkeiten:** —
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/pages/LegacyEventRSVPRedirect.tsx
- src/pages/GuestResponse.tsx

**Bekannte Einschränkungen**

- Bewusst nur Kompatibilität; das Entfernungsdatum hängt vom Ende alter Mailings ab.

**Offene Prüfpunkte**

- Offen: Prüfen, ob noch Altlinks aktiv sind, bevor die Route entfernt wird.

### `polls.respond` — An Umfrage teilnehmen
Erlaubt angemeldeten und öffentlichen Teilnehmenden die Abgabe und Änderung von Antworten über Token.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** Selbsttest
- **Letztes Testergebnis:** nicht-ausgefuehrt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `oeffentlich`, `abgeordneter`, `bueroleitung`, `mitarbeiter`
- **Routen:** `/poll-guest/:pollId`
- **Frontend-Komponenten:** `src/pages/PollGuest.tsx`
- **Services:** —
- **Hooks:** —
- **Edge Functions:** `get-poll-by-token`, `submit-poll-response-by-token`
- **Datenbankfunktionen:** `generate_participant_token`, `generate_guest_invitation_token`, `link_poll_participant_user`
- **Tabellen:** `poll_participants`, `poll_responses`, `poll_versions`, `appointment_polls`
- **Abhängigkeiten:** —
- **Selbsttests:** `poll-lifecycle`
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/pages/PollGuest.tsx
- supabase/functions/submit-poll-response-by-token/index.ts
- src/features/selftest/scenarios/poll-lifecycle.ts

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `polls.manage` — Umfragen verwalten und auswerten
Versendet Einladungen und Erinnerungen, wertet Antworten aus und bestätigt Gewinner-Zeitfenster.

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
- **Edge Functions:** `send-poll-invitation`, `resend-poll-invitation`, `send-poll-notifications`, `send-poll-followups`
- **Datenbankfunktionen:** `get_user_polls_with_aggregation`, `confirm_poll_winner`, `create_poll_notification`, `get_due_poll_followups`, `finalize_poll_followup`, `claim_poll_followup`, `auto_update_poll_status`, `poll_followup_send_key`
- **Tabellen:** `appointment_polls`, `poll_participants`, `poll_responses`, `poll_notifications`
- **Abhängigkeiten:** —
- **Selbsttests:** `poll-lifecycle`
- **Unit-Tests:** `supabase/functions/_shared/pollFollowup.test.ts`
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/features/polls/pollRules.ts
- supabase/functions/send-poll-followups/index.ts

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `polls.availability` — Verfügbarkeit und Zeitfenster
Ermittelt freie Zeitfenster und Verfügbarkeiten Beteiligter und schlägt Termine vor.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** Unit-Test
- **Letztes Testergebnis:** unbekannt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`
- **Routen:** —
- **Frontend-Komponenten:** —
- **Services:** `supabase/functions/_shared/pollSlotSuggestion.ts`
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** `get_poll_availability`
- **Tabellen:** `poll_time_slots`, `poll_responses`, `appointment_polls`
- **Abhängigkeiten:** —
- **Selbsttests:** —
- **Unit-Tests:** `supabase/functions/_shared/pollSlotSuggestion.test.ts`
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- supabase/functions/_shared/pollSlotSuggestion.ts
- supabase/functions/_shared/pollSlotSuggestion.test.ts

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

## Regeln

Fachliche Invarianten stehen in [AGENTS.md](../../AGENTS.md); Rollen und Rechte in [rollenrechte-matrix.md](../rollenrechte-matrix.md).
