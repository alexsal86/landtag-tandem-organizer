# Architekturrichtlinien für neue Hooks und Edge Functions

Stand: 2026-03-13

Ziel dieser Richtlinie: Neue Implementierungen sollen von Anfang an wartbar, testbar und sicher sein.

## 1) Geltungsbereich

Diese Richtlinie ist verpflichtend für:

- neue Hooks in `src/hooks/**`
- neue Supabase Edge Functions in `supabase/functions/**`

## 2) Ownership (verpflichtend)

Jede neue Hook / Function benötigt:

1. **Verantwortliche Person** (Primary Owner)
2. **Vertretung** (Secondary Owner)
3. **Zuordnung zu einem Feature-Bereich** (z. B. Kontakte, Kalender, Briefe)

### Dokumentation der Ownership

- Hooks: In einem Header-Kommentar mit `@owner` und `@feature`.
- Edge Functions: In der jeweiligen `index.ts` mit `@owner`, `@feature`, `@security-model`.
- Zusätzlich muss die Ownership in der Team-Doku / im Ticket-System hinterlegt sein.

Beispiel:

```ts
/**
 * @owner team-platform
 * @secondary-owner team-office
 * @feature calendar-sync
 */
```

## 3) Testpflicht (verpflichtend)

### Für Hooks

- Jeder neue Hook braucht mindestens:
  - **1 Positivtest** (Happy Path)
  - **1 Negativtest** (Fehler-/Edge-Fall)
- Testdatei liegt neben dem Hook oder unter `__tests__/`.
- Bei Datenzugriff muss Supabase gemockt werden.

### Für Edge Functions

- Jede neue Function braucht mindestens:
  - **1 Auth-Test** (unauthorized request wird abgelehnt)
  - **1 Berechtigungs-/Scope-Test** (Role/Tenant)
  - **1 Erfolgsfall** (gültiger Request)
- Bei `verify_jwt = false` sind verpflichtend zusätzliche Negativtests für Secret/Signatur erforderlich.

## 4) Security-Checklist (Merge-Blocker)

Vor Merge müssen für neue/angepasste Edge Functions alle Punkte erfüllt sein:

1. **Auth-Modell definiert**
   - `authenticated`, `internal-scheduled`, `public-webhook` oder `public-readonly`
2. **`verify_jwt` korrekt gesetzt**
   - Default: `true`
   - Ausnahme nur dokumentiert mit Zusatzschutz
3. **Autorisierung im Code vorhanden**
   - Rollenprüfung und/oder Tenant-Scope für schreibende Operationen
4. **CORS bewertet**
   - Kein pauschales `*` für sensible Endpunkte
5. **Fehlerantworten gehärtet**
   - keine Stacktraces / internen Details an Clients
6. **Auditierbarkeit**
   - sicherheitsrelevante Aktionen werden nachvollziehbar geloggt
7. **Doku aktualisiert**
   - Eintrag in `docs/security-function-matrix.md` bei neuem/angepasstem Sicherheitsmodell

## 5) Definition of Done

Eine neue Hook / Function ist nur „done“, wenn:

- Ownership dokumentiert ist
- Testpflicht erfüllt ist
- Security-Checklist vollständig abgehakt ist
- CI-Grundchecks grün sind

## 6) Review-Checkfragen

Reviewer prüfen mindestens:

- Ist klar, wer das Modul betreibt?
- Sind Tests relevant und nicht nur formal?
- Ist die Security-Einstufung plausibel und dokumentiert?
- Werden Fehlerszenarien sicher behandelt?

## 7) CI-Verankerung

- `pytest -q` ist als verpflichtender Job aktiv.
- Neue Python-/Parser-Änderungen müssen mindestens einen echten Testfall mitbringen.
- Security-Hygiene-Checks und Drift-Checks bleiben verpflichtend.
