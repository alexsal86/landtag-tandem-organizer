# Funktionskatalog

_Auto-generiert mit `npm run update:feature-catalog`. Nicht von Hand bearbeiten._

Der Katalog ist ein Zeiger, keine zweite Wahrheit: Zweck, Seiten und Rollen stammen aus dieser Bereichsliste, Prüfumfang und Tabellen aus den Selbsttest-Szenarien. Die Regeln selbst stehen in [AGENTS.md](../../AGENTS.md).

8 Bereiche mit zusammen 25 Szenarien.

## Bereiche

| Bereich | Seiten | Szenarien | Tabellen | Rollen |
|---|---|---:|---:|---|
| [Aufgaben & Stafette](./aufgaben.md) | `/tasks`, `/tasks/archive`, `/tasks/new`, `/mywork?tab=tasks`, `/mywork?tab=dashboard` | 6 | 8 | `abgeordneter`, `bueroleitung` |
| [Vorgänge](./vorgaenge.md) | `/vorgaenge/:caseItemId`, `/mywork?tab=cases`, `/casefiles` | 1 | 9 | `abgeordneter`, `bueroleitung` |
| [Termine & Briefings](./termine.md) | `/calendar`, `/eventplanning`, `/appointment-preparation/:id`, `/briefing-live/:id` | 5 | 16 | `abgeordneter`, `bueroleitung` |
| [Entscheidungen](./entscheidungen.md) | `/decisions`, `/decision-response/:participantId` | 1 | 3 | — |
| [Dokumente & Wissen](./dokumente.md) | `/documents`, `/knowledge`, `/wissen` | 3 | 9 | — |
| [Kontakte](./kontakte.md) | `/contacts`, `/contacts/:id`, `/contacts/:id/edit`, `/contacts/import` | 1 | 3 | — |
| [Mitarbeit & Personal](./mitarbeit.md) | `/employee`, `/employee-meeting/:id`, `/meetings` | 4 | 19 | `abgeordneter`, `bueroleitung` |
| [Wahlanalyse & Wahlhistorie](./wahl.md) | `/karten`, `/daten` | 4 | 0 | — |

## Szenarien ohne eigenen Bereich

Diese Szenarien sind registriert, aber keinem der Startbereiche zugeordnet. Sie zuordnen oder bewusst hier stehen lassen.

- `access-boundaries` — Zugriffsschutz (Bürogrenzen und Entscheiderrolle)
- `admin-controls` — Adminregeln: Feldschutz, Aktionen, Export, Rücknahme und Feeds
- `letter-lifecycle` — Brief-Lifecycle (Entwurf → Prüfung → Freigabe → Archiv und Folgeaufgabe)
- `quick-note-lifecycle` — Notizen-Lifecycle (Anlegen → Priorität → Anheften → Aufgabe → Archiv)
- `workflow-rules` — Geschäftsregeln (Freigabe, Rollen, Fristen)

## Pflege

- Bereich hinzufügen oder Seiten ändern: `scripts/build-feature-catalog.mjs`.
- Prüfungen ändern: das jeweilige Szenario unter `src/features/selftest/scenarios`.
- Danach `npm run update:feature-catalog`; `npm run check:feature-catalog` meldet Abweichungen in der CI.
