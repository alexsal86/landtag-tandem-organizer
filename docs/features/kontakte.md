# Kontakte

_Auto-generiert mit `npm run update:feature-catalog` aus den Selbsttest-Szenarien. Nicht von Hand bearbeiten._

**Zweck:** Kontakte mit Stammdaten, Kategorien und Aktivitäten pflegen, Import-Duplikate auflösen und Zusammenführungen ohne Datenverlust ausführen.

## Seiten

- `/contacts`
- `/contacts/:id`
- `/contacts/:id/edit`
- `/contacts/import`

## Rollen

Keine besondere Rolle deklariert; es gilt die aktive Büro-Mitgliedschaft.

## Tabellen

Diese Tabellen schreiben die Szenarien laut `touches`. Fehlende Tabellen bedeuten nicht, dass der Bereich sie nicht liest.

| Tabelle | Szenario |
|---|---|
| `contact_activities` | `contact-lifecycle` |
| `contact_usage_stats` | `contact-lifecycle` |
| `contacts` | `contact-lifecycle` |

## Prüfumfang

### `contact-lifecycle` — Kontakt-Lifecycle (Anlegen → Kategorie/Tags → Aktivität → Suche)

- **Prüfungen:**
  - Keine Einzelprüfungen deklariert; der Lauf bestätigt nur den Ablauf.
- **Grenzen:**
  - Keine deklariert.

## Detaildoku

- [contacts-system-review.md](../contacts-system-review.md)
- [contacts-overhaul-proposals.md](../contacts-overhaul-proposals.md)

## Regeln

Fachliche Invarianten stehen in [AGENTS.md](../../AGENTS.md); Rollen und Rechte in [rollenrechte-matrix.md](../rollenrechte-matrix.md).
