# Plan: In-App Test-Runner („Selbsttest-Center")

Eine Admin-Seite, auf der du komplette Anwendungs-Szenarien gegen die echte Supabase-Datenbank ausführen kannst — inklusive automatischer Aufräumung, damit keine Daten zurückbleiben.

## Ziel

- Reale End-to-End-Tests aus der laufenden App heraus starten (nicht nur Unit-Tests)
- Pro Szenario sehen, welche Schritte erfolgreich/fehlgeschlagen sind
- Garantierter Cleanup, auch wenn ein Schritt mittendrin scheitert
- Einfach erweiterbar um weitere Szenarien (Aufgaben, Briefe, Termine, Entscheidungen…)

## Wie das in einer Web-App realisiert wird (Konzept)

Drei etablierte Bausteine, die wir kombinieren:

1. **Test-Szenario-Registry** — jedes Szenario ist eine Datei mit `setup → steps → cleanup`. Schritte sind kleine async-Funktionen, die echte Supabase-Calls absetzen und ein Ergebnis zurückgeben.
2. **Test-Runner** — führt die Schritte sequentiell aus, fängt Fehler ab, sammelt Logs, ruft am Ende **immer** den Cleanup auf (`try/finally`-Pattern, wie in `scripts/e2e-smoke-flows.mjs` bereits etabliert).
3. **Tagging für Cleanup-Sicherheit** — alle erzeugten Datensätze bekommen einen Marker (z.B. Titel-Prefix `[TEST-<runId>]` und ein `tenant_id`-Scope). Selbst wenn Cleanup teilweise scheitert, kann ein „Aufräumen"-Button alle Datensätze mit diesem Prefix gezielt löschen.

## Umsetzung

### 1. Neue Seite: `/admin/selbsttest`

- Nur sichtbar für Rolle `abgeordneter`/`bueroleitung` (analog `team`-Tab)
- Liste der verfügbaren Szenarien mit „Ausführen"-Button
- Live-Anzeige: Schritt für Schritt mit ✅/❌/⏳, ausklappbarer Fehler-Log
- Globaler „Test-Daten aufräumen"-Button (löscht alle Datensätze mit `[TEST-…]`-Prefix im aktuellen Tenant)

### 2. Test-Framework (`src/features/selftest/`)

```
src/features/selftest/
  types.ts              # TestScenario, TestStep, TestContext, TestResult
  runner.ts             # runScenario() mit try/finally Cleanup
  registry.ts           # Liste aller Szenarien
  cleanup.ts            # purgeTestData(tenantId) - löscht alles mit TEST-Prefix
  scenarios/
    meeting-lifecycle.ts
    task-lifecycle.ts
    letter-lifecycle.ts
  components/
    SelftestView.tsx
    ScenarioCard.tsx
    StepLog.tsx
```

### 3. Beispiel-Szenario „Meeting-Lifecycle"

Schritte, die nacheinander ausgeführt und einzeln angezeigt werden:

1. Meeting erstellen (`meetings` insert, Titel `[TEST-abc123] Selbsttest-Meeting`)
2. Verknüpften Kalender-Termin erzeugen (`appointments`)
3. Teilnehmer hinzufügen (`meeting_participants`)
4. Agenda-Punkt anlegen (`meeting_agenda_items`)
5. Aufgabe aus Agenda erzeugen (`tasks` mit `meeting_id`)
6. Meeting archivieren (Edge Function aufrufen, prüfen dass Aufgaben übernommen werden)
7. Verifizieren: Aufgabe existiert, Status ist korrekt, Kalender-Termin verknüpft
8. **Cleanup** (immer): Aufgaben → Agenda → Teilnehmer → Termin → Meeting löschen

Jeder Schritt gibt zurück: `{ ok: boolean, message: string, durationMs: number, createdIds?: string[] }`. Erstellte IDs werden im `TestContext` gesammelt — der Cleanup arbeitet diese Liste rückwärts ab, unabhängig davon wo der Fehler auftrat.

### 4. Sicherheitsmechanismen

- **Tenant-Scope**: Alle Operationen laufen im aktuellen Tenant des angemeldeten Users → keine Auswirkung auf andere Mandanten
- **Prefix-Marker**: `[TEST-<runId>]` im Titel + `description` enthält `__SELFTEST__`
- **Notfall-Cleanup**: separater Button `purgeTestData()` löscht alle Records mit diesen Markern, scoped auf Tenant
- **Bestätigungsdialog** vor jedem Lauf, weil echte DB-Writes passieren
- **Run-Historie** (optional, in localStorage) zeigt die letzten 10 Läufe

### 5. Erweiterbarkeit

Ein neues Szenario = eine neue Datei in `scenarios/` + Eintrag in `registry.ts`. Vorgesehene weitere Szenarien:

- Aufgaben (Erstellen, Zuweisen, Status-Wechsel, Archiv)
- Briefe (Wizard → Entwurf → Freigabe → Archiv → Folge-Aufgabe)
- Terminabstimmung (Erstellen → Gast-Antwort → Auto-Termin)
- Entscheidungen (Erstellen → Kommentar → Abschluss)
- Vorgänge (Erstellen → Verknüpfen → Schließen)

## Technische Details

- **Runner-Pattern**: `try { for (step of steps) await step(ctx) } finally { await cleanup(ctx) }` — derselbe Ansatz wie in `scripts/e2e-smoke-flows.mjs`, aber im Browser statt Node
- **State-Sammlung**: `TestContext` ist ein Objekt mit `createdIds: { meetings: [], tasks: [], … }`, das jeder Step befüllt; Cleanup iteriert in umgekehrter Abhängigkeitsreihenfolge
- **Edge Functions**: Werden über `supabase.functions.invoke()` aufgerufen, genau wie in der echten App — testet damit auch CORS/Auth-Pfade
- **UI**: shadcn `Card` pro Szenario, `Collapsible` für Step-Logs, `Badge` für Status, `useState` für Live-Updates während des Laufs
- **Keine neuen Dependencies** nötig

## Was du nach Approval bekommst

1. Neue Route `/admin/selbsttest` mit der UI
2. Test-Framework-Code in `src/features/selftest/`
3. **Erstes Szenario „Meeting-Lifecycle"** voll implementiert mit ~8 Schritten und Cleanup
4. Gerüst für weitere Szenarien + ein einfaches Beispiel `task-lifecycle` als Vorlage
5. Globaler „Aufräumen"-Notfallknopf

Weitere Szenarien (Briefe, Terminabstimmung, Entscheidungen) können danach inkrementell hinzugefügt werden — sag einfach welche du als nächstes willst.