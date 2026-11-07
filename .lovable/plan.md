# Termin-Briefings: Kalender, Jour Fixe und Kompakt-Briefing

## Ziel
Nicht jeder Termin braucht ein Briefing. Der Bedarf wird gezielt geklärt, an eine Person vergeben, und am Ende entsteht ein schlanker 1-Pager. Die bestehende Terminentscheidung im Jour Fixe wird dafür erweitert, nicht verdoppelt.

## 1. Ein gemeinsamer Jour-Fixe-Block „Termine"
Die bestehende Karte „Terminanfragen zur Entscheidung" wird zu einem Block „Termine" mit zwei Reitern:

```text
┌ Termine im Jour Fixe ─────────────────────────────────────┐
│ [Anfragen entscheiden (3)]  [Briefing-Bedarf 14 Tage (5)] │
├───────────────────────────────────────────────────────────┤
│ Reiter 1: wie heute – Zusagen / Absagen / Vertagen        │
│   NEU bei Zusage: Briefing gleich mitentscheiden          │
│   (o) Kein Briefing  (o) Briefing an [Person] bis [Frist] │
│                                                           │
│ Reiter 2: zugesagte Termine der nächsten 14 Tage ohne     │
│   Briefing-Entscheidung                                   │
│   Mi 12.11. 18:00  Bürgerverein Nord                      │
│   [Kein Briefing]  [Briefing vergeben ▾]                  │
└───────────────────────────────────────────────────────────┘
```
- Entschiedene Termine verschwinden aus der Liste. Der Zähler zeigt, was noch offen ist.
- Gleicher Block in der Vorbereitung und während der laufenden Sitzung (beide Stellen, an denen die Karte heute schon steht).

## 2. Briefing-Kachel im Kalender
In der Termin-Seitenleiste:
- Noch offen: `[Kein Briefing nötig]` `[Briefing anfordern]`
- Anfordern öffnet ein kleines Fenster mit 3 Angaben: Person, Frist (Vorschlag: Vortag 12:00), Auftrag/Fokus
- Danach zeigt die Kachel den Stand: Kein Briefing (grau) · In Zuarbeit: Anna, Frist Mi 12:00 (blau) · Zur Freigabe (lila) · Freigegeben (grün), mit Knopf „Briefing öffnen"

## 3. Automatische Aufgabe (Stafette)
- Briefing vergeben → Aufgabe „Briefing: <Termin>" bei der Person, Frist wie gewählt, verknüpft mit dem Termin
- „Zur Freigabe vorlegen" → Ball wechselt zur/zum Abgeordneten
- „Freigeben" → Aufgabe wird erledigt, Briefing erscheint im Tagesbriefing des Termintags
- „Zurück mit Anmerkung" → Ball zurück zur Zuarbeit
- Briefing auf „Kein Briefing" ändern → offene Aufgabe wird geschlossen

## 4. Kompakt-Briefing (1-Pager)
Standardansicht mit 5 Abschnitten: Kopf (Termin, Ort, Status, Zuständig) · Gesprächspartner · Anlass & Ziel · Unsere Position (Stichpunkte) · Unterlagen.
Zuschaltbar, nie Pflicht: Kritische Fragen & Antworten, Fakten/Zitate, Nachbereitung. Die bisherige ausführliche Ansicht bleibt per Umschalter erreichbar; vorhandene Briefings gehen nicht verloren.

## 5. Selbsttest
Neues Szenario „Briefing-Lifecycle": vergeben → Aufgabe entsteht → vorlegen → freigeben → Aufgabe erledigt; plus „Kein Briefing" und Zusage mit Briefing im Jour Fixe.

## Technische Details
- Migration `appointments`: `briefing_status` (`undecided|none|assigned|in_review|approved`, Default `undecided`), `briefing_assignee_id`, `briefing_due_at`, `briefing_instructions`; `tasks.appointment_id` (FK, falls nicht vorhanden).
- RPC `set_appointment_briefing(appointment_id, decision, assignee, due, instructions)`: tenant- und rollengeprüft, legt/schließt die Aufgabe atomar, schreibt Task-Timeline. RPC `advance_appointment_briefing(appointment_id, action)` für vorlegen/freigeben/zurück.
- `decide_appointment_request` bekommt optionale Briefing-Parameter und ruft bei Zusage `set_appointment_briefing` in derselben Transaktion.
- Reine Regeln (Status-Übergänge, Fristvorschlag Vortag 12:00, 14-Tage-Filter) in `src/features/appointments/briefing.ts` mit Tests.
- UI: `JourFixeRequestsCard` → `JourFixeAppointmentsCard` mit Tabs (alte Karte nutzt die neue intern, Einbindung in `AgendaEditorPanel`/`ActiveMeetingPanel` bleibt), `AppointmentBriefingStatusCard`, `BriefingRequestPopover`, `CompactBriefingEditor` auf Basis von `appointment_preparations`.
- Selftest-Szenario in `src/features/selftest/scenarios/`, AGENTS.md-Regel zur Briefing-RPC ergänzen.
