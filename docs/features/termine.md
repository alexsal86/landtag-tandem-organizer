# Termine & Briefings

_Auto-generiert mit `npm run update:feature-catalog` aus den Selbsttest-Szenarien. Nicht von Hand bearbeiten._

**Zweck:** Kalender, Terminanfragen, Briefings, Veranstaltungen und Terminabstimmungen inklusive Einladungs- und Erinnerungsregeln.

## Seiten

- `/calendar`
- `/eventplanning`
- `/appointment-preparation/:id`
- `/briefing-live/:id`

## Rollen

`abgeordneter`, `bueroleitung` (aus den Szenarien; zusätzlich gilt die aktive Büro-Mitgliedschaft)

## Tabellen

Diese Tabellen schreiben die Szenarien laut `touches`. Fehlende Tabellen bedeuten nicht, dass der Bereich sie nicht liest.

| Tabelle | Szenario |
|---|---|
| `appointment_change_alerts` | `appointment-briefing-lifecycle` |
| `appointment_feedback` | `appointment-lifecycle` |
| `appointment_guests` | `poll-lifecycle` |
| `appointment_polls` | `poll-lifecycle` |
| `appointment_preparations` | `appointment-lifecycle` |
| `appointment_requests` | `appointment-request-lifecycle` |
| `appointments` | `appointment-lifecycle`, `appointment-request-lifecycle`, `appointment-briefing-lifecycle`, `poll-lifecycle` |
| `event_planning_checklist_items` | `event-planning-lifecycle` |
| `event_planning_contacts` | `event-planning-lifecycle` |
| `event_planning_dates` | `event-planning-lifecycle` |
| `event_planning_speakers` | `event-planning-lifecycle` |
| `event_planning_timeline_assignments` | `event-planning-lifecycle` |
| `event_plannings` | `event-planning-lifecycle` |
| `poll_participants` | `poll-lifecycle` |
| `poll_time_slots` | `poll-lifecycle` |
| `tasks` | `appointment-briefing-lifecycle` |

## Prüfumfang

### `appointment-lifecycle` — Termin-Lifecycle (Kalender + Briefing + Feedback)

- **Prüfungen:**
  - Keine Einzelprüfungen deklariert; der Lauf bestätigt nur den Ablauf.
- **Grenzen:**
  - Keine deklariert.

### `appointment-request-lifecycle` — Terminanfragen-Lifecycle (Eingang → Sperre → Entscheidung → Termin)

- **Prüfungen:**
  - Statussperre bei direktem Schreiben
  - Zusage über die Anwendungs-RPC
  - Verknüpfter Termin
  - Wiederholung erzeugt keinen zweiten Termin
- **Grenzen:**
  - Bedienung der Kalenderoberfläche und externe Kalendersynchronisation werden nicht geprüft.

### `appointment-briefing-lifecycle` — Briefing-Lifecycle (vergeben → Aufgabe → vorlegen → freigeben)

- **Prüfungen:**
  - Regeln für Freigabe und Fristvorschlag
  - Aufgabe entsteht beim Vergeben
  - Ball wechselt bei Vorlage
  - Freigabe erledigt Aufgabe
  - Kein Briefing schließt Aufgabe
- **Grenzen:**
  - Bedienung von Kalender- und Jour-Fixe-Oberfläche wird nicht geprüft.

### `event-planning-lifecycle` — Event-Planung (komplett: Termine, Speaker, Checkliste, Timeline)

- **Prüfungen:**
  - Keine Einzelprüfungen deklariert; der Lauf bestätigt nur den Ablauf.
- **Grenzen:**
  - Keine deklariert.

### `poll-lifecycle` — Terminabstimmung (Gewinner-Slot übernehmen + Nachfassen)

- **Prüfungen:**
  - confirm_poll_winner legt genau einen Termin an und verknüpft ihn mit der Abstimmung
  - Zweiter Aufruf (gleicher und anderer Slot) liefert denselben Termin und den tatsächlich gespeicherten Slot
  - Externe Teilnehmer werden als Gäste am Termin angelegt, interne nicht
  - Fremde Slots und unbekannte Abstimmungen werden abgelehnt
  - Fremde Abstimmungen im Mandanten können nicht übernommen werden
  - get_poll_availability verweigert fremde Mandanten
- **Grenzen:**
  - Die Erstellerprüfung läuft gegen eine vorhandene fremde Abstimmung im Mandanten; in einem Büro ohne fremde Abstimmung meldet der Schritt diese Teilprüfung als nicht ausführbar.
  - Eine ausgeschiedene Büromitgliedschaft lässt sich im Selbsttest nicht gefahrlos simulieren; die Prüfung auf aktive Mitgliedschaft und der Versand der Erinnerungswarteschlange sind in der Migration und in den Logikschritten abgesichert.

## Detaildoku

- [dossier-umsetzungsplan.md](../dossier-umsetzungsplan.md)
- [public-event-invitations.md](../public-event-invitations.md)
- [rollenrechte-matrix.md](../rollenrechte-matrix.md)

## Regeln

Fachliche Invarianten stehen in [AGENTS.md](../../AGENTS.md); Rollen und Rechte in [rollenrechte-matrix.md](../rollenrechte-matrix.md).
