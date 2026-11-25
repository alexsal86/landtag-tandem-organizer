# Vorgänge

_Auto-generiert mit `npm run update:feature-catalog` aus den Selbsttest-Szenarien. Nicht von Hand bearbeiten._

**Zweck:** Bürgeranliegen und Eingänge erfassen, „Wer ist am Zug?" führen, Schritte und Fristen setzen und den Vorgang abschließen.

## Seiten

- `/vorgaenge/:caseItemId`
- `/mywork?tab=cases`
- `/casefiles`

## Rollen

`abgeordneter`, `bueroleitung` (aus den Szenarien; zusätzlich gilt die aktive Büro-Mitgliedschaft)

## Tabellen

Diese Tabellen schreiben die Szenarien laut `touches`. Fehlende Tabellen bedeuten nicht, dass der Bereich sie nicht liest.

| Tabelle | Szenario |
|---|---|
| `appointment_requests` | `case-item-lifecycle` |
| `case_item_handover_log` | `case-item-lifecycle` |
| `case_item_interactions` | `case-item-lifecycle` |
| `case_items` | `case-item-lifecycle` |
| `day_slips` | `case-item-lifecycle` |
| `task_decision_participants` | `case-item-lifecycle` |
| `task_decision_responses` | `case-item-lifecycle` |
| `task_decisions` | `case-item-lifecycle` |
| `tasks` | `case-item-lifecycle` |

## Prüfumfang

### `case-item-lifecycle` — Vorgangs-Lifecycle (Am Zug → Schritt → Wiedervorlage → Entscheidung → Tageszettel → Abschluss)

- **Prüfungen:**
  - Geschäftsregeln für Wiedervorlage und Fristen
  - Übergabe über die Anwendungs-RPC
  - Entscheidung und Abstimmung
  - Tageszettel-Link nach erneutem Laden
  - Vorgang bleibt im eigenen Büro
- **Grenzen:**
  - Keine Bedienprüfung der Vorgangsoberfläche
  - Übergabe benötigt eine zweite aktive Person im Büro

## Detaildoku

- [case-items-intake-validation.md](../case-items-intake-validation.md)
- [my-work-architecture.md](../my-work-architecture.md)

## Regeln

Fachliche Invarianten stehen in [AGENTS.md](../../AGENTS.md); Rollen und Rechte in [rollenrechte-matrix.md](../rollenrechte-matrix.md).
