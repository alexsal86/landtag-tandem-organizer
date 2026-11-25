# Mitarbeit & Personal

_Auto-generiert mit `npm run update:feature-catalog` aus den Selbsttest-Szenarien. Nicht von Hand bearbeiten._

**Zweck:** Onboarding und Offboarding, Mitarbeitergespräche, Zuständigkeiten und Teamrituale inklusive Sichtbarkeitsregeln.

## Seiten

- `/employee`
- `/employee-meeting/:id`
- `/meetings`

## Rollen

`abgeordneter`, `bueroleitung` (aus den Szenarien; zusätzlich gilt die aktive Büro-Mitgliedschaft)

## Tabellen

Diese Tabellen schreiben die Szenarien laut `touches`. Fehlende Tabellen bedeuten nicht, dass der Bereich sie nicht liest.

| Tabelle | Szenario |
|---|---|
| `appointments` | `meeting-lifecycle` |
| `employee_hr_evidence` | `onboarding-hr` |
| `employee_hr_gdpr_declarations` | `onboarding-hr` |
| `employee_hr_reminder_log` | `onboarding-hr` |
| `employee_hr_templates` | `onboarding-hr` |
| `employee_lifecycle` | `onboarding-hr` |
| `meeting_agenda_documents` | `meeting-lifecycle` |
| `meeting_agenda_items` | `meeting-lifecycle` |
| `meeting_participants` | `meeting-lifecycle` |
| `meeting_protocol_addenda` | `meeting-lifecycle` |
| `meeting_protocol_details` | `meeting-lifecycle` |
| `meeting_templates` | `meeting-lifecycle` |
| `meetings` | `meeting-lifecycle` |
| `notification_types` | `onboarding-hr` |
| `notifications` | `onboarding-hr` |
| `routine_package_runs` | `onboarding-hr` |
| `routine_package_steps` | `onboarding-hr` |
| `subtasks` | `onboarding-hr` |
| `tasks` | `onboarding-hr`, `responsibilities`, `meeting-lifecycle` |

## Prüfumfang

### `onboarding-hr` — HR-Onboarding und Offboarding

- **Prüfungen:**
  - Keine Einzelprüfungen deklariert; der Lauf bestätigt nur den Ablauf.
- **Grenzen:**
  - Der Servertest rollt seine vollständigen Fixtures zurück. Echte Zustellung und der 15-Minuten-Job benötigen eine bereitgestellte Datenbank.

### `responsibilities` — Zuständigkeiten & Matrix

- **Prüfungen:**
  - Keine Einzelprüfungen deklariert; der Lauf bestätigt nur den Ablauf.
- **Grenzen:**
  - Der Fremdtenant-Lesetest verwendet für das angemeldete Konto nicht zugängliche IDs. Zwei echte Sitzungen und RPC-Schreibtests werden zusätzlich im isolierten Datenbanktest geprüft.

### `team-rituals` — Freiwillige Team-Rituale

- **Prüfungen:**
  - Keine Einzelprüfungen deklariert; der Lauf bestätigt nur den Ablauf.
- **Grenzen:**
  - RLS, Rollen, parallele RPC-Aufrufe, Freigaben und GDPR-Löschung mit Anmeldung separat prüfen.

### `meeting-lifecycle` — Meeting-Lifecycle (vollständig + Field-Verifikation)

- **Prüfungen:**
  - Keine Einzelprüfungen deklariert; der Lauf bestätigt nur den Ablauf.
- **Grenzen:**
  - Keine deklariert.

## Detaildoku

- [employee-meeting-leadership.md](../employee-meeting-leadership.md)
- [team-rituals.md](../team-rituals.md)
- [rollenrechte-matrix.md](../rollenrechte-matrix.md)

## Regeln

Fachliche Invarianten stehen in [AGENTS.md](../../AGENTS.md); Rollen und Rechte in [rollenrechte-matrix.md](../rollenrechte-matrix.md).
