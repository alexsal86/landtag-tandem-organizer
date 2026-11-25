# Entscheidungen

_Auto-generiert mit `npm run update:feature-catalog` aus den Selbsttest-Szenarien. Nicht von Hand bearbeiten._

**Zweck:** Entscheidungen anlegen, Teilnehmende abstimmen lassen, Antworten zurücknehmen und archivieren.

## Seiten

- `/decisions`
- `/decision-response/:participantId`

## Rollen

Keine besondere Rolle deklariert; es gilt die aktive Büro-Mitgliedschaft.

## Tabellen

Diese Tabellen schreiben die Szenarien laut `touches`. Fehlende Tabellen bedeuten nicht, dass der Bereich sie nicht liest.

| Tabelle | Szenario |
|---|---|
| `task_decision_participants` | `decision-lifecycle` |
| `task_decision_responses` | `decision-lifecycle` |
| `task_decisions` | `decision-lifecycle` |

## Prüfumfang

### `decision-lifecycle` — Entscheidungs-Lifecycle (active → open → archived)

- **Prüfungen:**
  - Keine Einzelprüfungen deklariert; der Lauf bestätigt nur den Ablauf.
- **Grenzen:**
  - Keine deklariert.

## Detaildoku

- [my-work-decisions-button-flowchart.md](../my-work-decisions-button-flowchart.md)
- [task-decision-reactions-rollout.md](../task-decision-reactions-rollout.md)

## Regeln

Fachliche Invarianten stehen in [AGENTS.md](../../AGENTS.md); Rollen und Rechte in [rollenrechte-matrix.md](../rollenrechte-matrix.md).
