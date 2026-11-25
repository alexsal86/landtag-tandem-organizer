# Aufgaben & Stafette

_Auto-generiert mit `npm run update:feature-catalog` aus den Selbsttest-Szenarien. Nicht von Hand bearbeiten._

**Zweck:** Aufgaben anlegen, zuweisen, über Fristen und Wiedervorlagen führen, im Stafette-Modell weitergeben und abschließen.

## Seiten

- `/tasks`
- `/tasks/archive`
- `/tasks/new`
- `/mywork?tab=tasks`
- `/mywork?tab=dashboard`

## Rollen

`abgeordneter`, `bueroleitung` (aus den Szenarien; zusätzlich gilt die aktive Büro-Mitgliedschaft)

## Tabellen

Diese Tabellen schreiben die Szenarien laut `touches`. Fehlende Tabellen bedeuten nicht, dass der Bereich sie nicht liest.

| Tabelle | Szenario |
|---|---|
| `annual_task_completions` | `annual-task-stafette` |
| `annual_tasks` | `annual-task-stafette` |
| `daily_briefings` | `daily-briefing-lifecycle` |
| `day_slips` | `day-slip-lifecycle` |
| `meeting_agenda_items` | `jour-fixe-platform-integration` |
| `meetings` | `jour-fixe-platform-integration` |
| `task_decisions` | `task-lifecycle`, `jour-fixe-platform-integration` |
| `tasks` | `task-lifecycle`, `task-stafette-lifecycle`, `annual-task-stafette`, `jour-fixe-platform-integration` |

## Prüfumfang

### `task-lifecycle` — Aufgaben-Lifecycle (Zuweisung → Frist → Entscheidung → Jour fixe → erledigt)

- **Prüfungen:**
  - Keine Einzelprüfungen deklariert; der Lauf bestätigt nur den Ablauf.
- **Grenzen:**
  - Keine deklariert.

### `task-stafette-lifecycle` — Aufgaben-Stafette (Am Zug, Wiedervorlage, Freigabe)

- **Prüfungen:**
  - Zonen Mein Zug / Wartet / Wiedervorlage
  - Verlaufseinträge bei Übergaben und Erledigungen
  - Sammelaktionen: Vorschau ohne erfundene Frist, ohne überschriebene Schritte, mit Rücknahme
  - Wochenreview, Eskalationsgründe, Einzeiler-Befehle und SLA-Stufen als reine Regeln
- **Grenzen:**
  - Regeln laufen ohne Datenbank; die Sammelaktionen werden zusätzlich über die RPCs geprüft.
  - Weitere Speicherungen deckt der Aufgaben-Lebenszyklus ab.

### `annual-task-stafette` — Jahresaufgabe → Büroaufgabe → Jahresabschluss

- **Prüfungen:**
  - Exakte Stichtage
  - System-Routinen nicht delegierbar
  - Eine Aufgabe pro Jahr
  - Abschluss und Wiederöffnung synchron
  - Direkter Jahresabschluss gesperrt
- **Grenzen:**
  - Die automatische Ausführung am tatsächlichen Stichtag und Personaländerungen werden nicht durch diesen Selbsttest ausgelöst.

### `jour-fixe-platform-integration` — Jour Fixe: Plattformquellen & Stafetten-Abschluss

- **Prüfungen:**
  - Quellenabfragen unter bestehenden Zugriffsrechten
  - Folgeaufgaben mit Zuständigkeit und Verlauf
  - Notizen ändern keine Abstimmung
  - Wiederholung erzeugt keine Duplikate
- **Grenzen:**
  - Quellenabfragen bestätigen bei leerem Bestand nur die Erreichbarkeit.
  - Freigaben und Sichtbarkeit für andere Rollen erfordern zusätzliche persönliche Sitzungen.

### `day-slip-lifecycle` — Tageszettel-Lifecycle (Links → Neuladen → Übernahme auf Folgetag)

- **Prüfungen:**
  - Speichern und erneutes Laden
  - Link-Erhalt bei Übernahme
  - Keine doppelte Übernahme
- **Grenzen:**
  - Die verlinkten Ziele sind Test-IDs; ihre Bedienung wird nicht geprüft.

### `daily-briefing-lifecycle` — Tages-Briefings (Vortag-Regel)

- **Prüfungen:**
  - Keine Einzelprüfungen deklariert; der Lauf bestätigt nur den Ablauf.
- **Grenzen:**
  - Keine deklariert.

## Detaildoku

- [my-work-architecture.md](../my-work-architecture.md)
- [workflow-consistency.md](../workflow-consistency.md)
- [automation-no-code-umsetzung.md](../automation-no-code-umsetzung.md)

## Regeln

Fachliche Invarianten stehen in [AGENTS.md](../../AGENTS.md); Rollen und Rechte in [rollenrechte-matrix.md](../rollenrechte-matrix.md).
