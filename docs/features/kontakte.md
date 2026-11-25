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

## Fremdschlüssel

Aus `docs/entity-map.md` für die oben genannten Tabellen. Eingehende Verweise zeigen, welche anderen Tabellen auf diesen Bereich zeigen.

### Ausgehend

| Tabelle | Spalte | Zieltabelle |
|---|---|---|
| `contact_activities` | `contact_id` | `contacts` |
| `contacts` | `organization_id` | `contacts` |
| `contacts` | `tenant_id` | `tenants` |

### Eingehend

| Zieltabelle im Bereich | Von | Spalte |
|---|---|---|
| `contacts` | `appointment_contacts` | `contact_id` |
| `contacts` | `appointments` | `contact_id` |
| `contacts` | `case_file_contacts` | `contact_id` |
| `contacts` | `case_items` | `contact_id` |
| `contacts` | `contact_activities` | `contact_id` |
| `contacts` | `contact_briefing_memory` | `contact_id` |
| `contacts` | `contact_topics` | `contact_id` |
| `contacts` | `contacts` | `organization_id` |
| `contacts` | `distribution_list_members` | `contact_id` |
| `contacts` | `document_contacts` | `contact_id` |
| `contacts` | `facts` | `contact_id` |
| `contacts` | `funding_participants` | `contact_id` |

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
