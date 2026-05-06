## Ziel

Das Selbsttest-Center bekommt einen **Demo-Modus**: Statt Daten zu erzeugen und sofort wieder zu löschen, kannst du pro Szenario realistische Datensätze in der Datenbank belassen und sie an ihrem normalen Ort im System ansehen (Kalender, Briefing-Widget, Event-Planung). Alle Demo-Datensätze tragen weiterhin das Prefix `[SELFTEST]` und werden über den bestehenden Notfall-Aufräumknopf entfernt.

## Änderungen im Selbsttest-Center

1. **Neuer Button „Demo-Daten erzeugen"** pro Szenario, neben „Ausführen".
   - Führt dieselben Steps aus wie der Test, aber **überspringt das Cleanup** am Ende.
   - Zeigt nach Abschluss eine Liste mit Deep-Links zu den erzeugten Datensätzen (z. B. „Termin öffnen", „Briefing ansehen", „Event-Planung öffnen").
2. **Aufräumen erweitern**: Der Notfall-Button räumt zusätzlich `daily_briefings`, `event_plannings`, `event_planning_*`-Kindtabellen sowie `appointment_preparations` mit `[SELFTEST]`-Prefix auf.
3. **Ausführen-Button** bleibt unverändert (Test mit Cleanup).

## Drei neue Szenarien

### A) Termine eigenständig (`appointment-lifecycle`)
Erzeugt einen vollständigen Termin, wie er im Kalender erscheint:
- `appointments` (Titel, Beschreibung, Start/Ende heute +2h, Ort, Kategorie, Priorität, `is_all_day`, optional `is_private`).
- `appointment_contacts` (1 Kontakt-Verknüpfung, falls vorhanden — sonst übersprungen).
- `appointment_preparations` mit strukturiertem `preparation_data` (visit_reason, conversation_partners, companions, program, sections) → testet das gesamte Briefing-/Vorbereitungs-System.
- Optional: `appointment_feedback` mit Bewertung 1–5 und Notizen.
- Verify: zurücklesen, Felder prüfen.
- Deep-Link: `/kalender` und `/termine/<id>`.

### B) Tages-Briefings (`daily-briefing-lifecycle`)
- `daily_briefings` für **heute** und **gestern** (zwei Datensätze mit unterschiedlichem Inhalt, damit die Vortag-Regel sichtbar wird).
- Verify: per RPC/Query prüfen, dass beide für `tenant_id` lesbar sind.
- Deep-Link: `/` (Dashboard) bzw. Briefing-Widget.

### C) Event-Planung (`event-planning-lifecycle`)
- `event_plannings` (Titel, Beschreibung, Ort, `is_digital`, optional digitale Felder).
- `event_planning_dates` (2 Terminoptionen, eine als `is_confirmed=true`).
- `event_planning_speakers` (1–2 Redner mit Bio/Topic/Order).
- `event_planning_contacts` (1 Ansprechpartner mit Rolle).
- `event_planning_checklist_items` (3–4 Items inkl. eines `type='social_media'` und `type='rsvp'` Punkts → testet Auto-Verlinkung).
- `event_planning_timeline_assignments` für eine Checkliste.
- Verify: alle Kindtabellen pro `event_planning_id` zählen und Felder stichprobenartig prüfen.
- Deep-Link: `/veranstaltungsplanung/<id>`.

## Technisches

- Neue Datei `src/features/selftest/scenarios/appointment-lifecycle.ts`, `daily-briefing-lifecycle.ts`, `event-planning-lifecycle.ts`.
- Registry erweitern.
- Runner: neue Option `runScenario(scenario, { …, keepData: true })`. Bei `keepData=true` wird `cleanupCreated` übersprungen und `state.cleanup.status='skipped'` mit Message „Demo-Modus: Daten behalten" gesetzt; zusätzlich wird `state.createdLinks` gefüllt.
- `TestScenario` erhält optional `links?: (ctx) => Array<{ label; href }>` zum Aufbau der Deep-Links nach erfolgreichem Lauf.
- `SelftestView`:
  - Zweiter Button „Demo-Daten erzeugen" (Variant `secondary`) ruft `runScenario` mit `keepData: true` auf.
  - Nach Abschluss eines Demo-Laufs wird unter den Steps eine Card „Im System ansehen" mit den Links angezeigt (öffnet via `useNavigate`).
- `purgeAllSelftestData`: Tabellen ergänzen — `appointment_feedback`, `appointment_preparations`, `appointment_contacts`, `event_planning_timeline_assignments`, `event_planning_checklist_items`, `event_planning_contacts`, `event_planning_speakers`, `event_planning_dates`, `event_plannings`, `daily_briefings`. Reihenfolge: Kinder vor Eltern.
- `CLEANUP_ORDER` im Runner entsprechend ergänzen, damit auch der reguläre Test-Modus die neuen Szenarien sauber abräumen kann.
- Coverage-Snapshot (`scripts/check-selftest-coverage.mjs` + `__schema-snapshot__/public-tables.json`) um die neuen Tabellen erweitern und in `docs/selftest-coverage.md` dokumentieren.

## Sicherheit / RLS

Alle neuen INSERTs setzen `tenant_id`, `created_by`/`user_id` korrekt (analog zu den bestehenden Szenarien) und nutzen die bereits laufende Preflight-Prüfung (Session + aktive Membership). Keine neuen Migrationen nötig.

## Was es **nicht** gibt

- Kein zusätzliches farbiges Badge in Listen (Prefix reicht laut deiner Antwort).
- Kein Auto-Cleanup-Toggle pro Lauf — bewusst zwei klar unterscheidbare Buttons.
