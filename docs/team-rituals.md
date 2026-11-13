# Team-Rituale: UI und Umsetzung

Stand: 13.11.2026. Zuständig: `team-platform`, Vertretung: `team-office`.

## Wo im UI?

- **Mitarbeiter → Team-Rituale** (`/employee?tab=rituals`): Wochenfrage, persönliche Geburtstags-/Teilnahmefreigaben, eigene drei Quiz-Aussagen, Monatsquiz und lokales Bingo.
- **Abgeordnete und Büroleitung** sehen dort zusätzlich die Fragenbank, Mandantenfreigabe und Bingo-Feldkonfiguration. Die fachlichen Rechte kommen aus aktiven `user_tenant_memberships`, geprüft durch `is_tenant_admin`; sie hängen nicht vom alten Mitarbeiter-Admin-Layout ab.
- **Dashboard → Plus → Hinzufügen**: „Frage der Woche“, „Zwei Wahrheiten, eine Lüge“ und „Mandats-Bingo“. Bestehende Widget-Layouts werden nicht automatisch geändert.
- **Dashboard-Begrüßung**: Eintrittsjubiläen automatisch aus dem vorhandenen `employee_settings.employment_start_date`, ohne persönliche Freigabe. Geburtstage werden weiterhin nur mit Freigabe angezeigt. Der Mandant kann alle Dashboard-Rituale abschalten.
- **Erste Schritte**: „Lerne dein Team kennen“ erscheint bei aktiviertem Mandantenfeature und führt zur Mitarbeiterverwaltung. Der Schritt und die Spielteilnahme sind freiwillig.
- **Administration → Automatisierung → Jahresroutinen → Vorlagen fürs Bürojahr**: „Walk & Talk mit Eis-Check“, „Heimat-Snack im Büro“, „Mini-Ausflug im Wahlkreis“. Auch im vorhandenen Regel-Assistenten auswählbar. Vorlagen werden erst nach ausdrücklich gespeicherter/aktivierter Regel ausgeführt und lassen sich dort deaktivieren.

## Kompakte Fragenbank

Neue Fragen stehen oberhalb der bestehenden Fragen, durch Linien abgesetzt. Jede Zeile enthält Aktiv-Status, Fragetext, letzte Einsatzwoche und Speichern. Die letzte Einsatzwoche stammt aus `max(team_question_weeks.week_start)` je Mandant und Frage; ohne Einsatz erscheint „Noch nie gestellt“. Vor Anwendung der Migration `20261113170000_team_question_last_used.sql` erscheint stattdessen „Letzter Einsatz unbekannt“. Die bestehende Rotation (unbenutzte, dann am längsten nicht verwendete aktive Fragen) bleibt erhalten.

## Annahmen und Datenwege

Eintrittsdaten bleiben ausschließlich im bestehenden Mitarbeiter-Datenbestand. Eine tenant-geprüfte Projektion liefert nur User-ID, Anzeigename und Eintrittsdatum; keine privaten HR-Felder. Das frühere doppelte Ritual-Eintrittsdatum wird geleert und bei Schreibaufrufen ignoriert. Geburtstag und Fun Facts bleiben separat freiwillig.

Das Monatsquiz speichert einen stabilen Snapshot je Mandant/Monat in Berliner Zeit. Nur aktive, teilnehmende Personen mit Quizfreigabe kommen infrage. Die allgemeinen Quiz-Payloads enthalten vor der eigenen Antwort weder Lügenindex noch Auflösung. Ausschließlich der persönliche Profil-Editor kann die eigene Markierung laden. Die erste Quizantwort gilt; erneute Aufrufe liefern dieselbe persönliche Auflösung, ohne weitere Versuche oder Punkte.

Private Quiz-Tabellen haben keine Client-Leserechte; RPCs prüfen Tenant und Teilnahme. Freigabeentzug entfernt eigene Quiz-Snapshots; Teilnahmeende, Mitgliedschaftsentzug und bestehende GDPR-Kontolöschung entfernen Aussagen und Antworten durch Trigger/Cascades. Profiländerungen gelten für kommende Monatsquiz; bestehende Quiz werden bei Entzug der Freigabe gelöscht.

Bingo speichert nur die neutrale Feldkonfiguration im Backend. Auswahl und freiwilliger Start bleiben im Browser je Benutzer/Mandant und werden bei Wochen-/Konfigurationswechsel zurückgesetzt. Keine Teilnahme-/Leistungsmetriken, Bestenlisten oder Streaks.

## Schlanke Validierung

Ein gemeinsamer gezielter Vitest-Lauf über die bestehende `logic.test.ts` und die kleine neue `bingo.test.ts`: **8 Tests bestanden**. Für Phase 2 und 4 kamen keine Unit-Testdateien hinzu. Die neuen Regeln haben Logic-Schritte im bestehenden Selbsttest-Szenario; dieses wurde nicht gegen eine Datenbank ausgeführt.

Ein Typecheck: `npx tsc -p tsconfig.app.json --noEmit --types node,react,react-dom,vite/client` erfolgreich. Wie in Phase 1 umgeht die explizite Typenliste den bestehenden defekten `@types/react-grid-layout@2.1.0`-Stub. Ein gezielter ESLint-Lauf über die geänderten TS/TSX-Dateien: **0 Fehler, 19 bestehende Warnungen**, neuer Featurecode ohne Warnungen. Keine neuen Abhängigkeiten, kein Build, keine Komponenten-/E2E-/RLS-Suites, keine Edge-Function-Deployments.

## Noch auf Supabase anzuwenden und angemeldet zu prüfen

Neue Migrationen nach der bereits gelieferten Phase-1-Migration in dieser Reihenfolge anwenden:

1. `20261113160500_team_ritual_employee_access.sql`
2. `20261113161000_team_two_truths.sql`
3. `20261113162000_team_bingo.sql`

Offen bleiben echte Rollen-/Tenant-Prüfungen, eigene Antwort und Quiz-Auflösung vor/nach Antwort, Parallelaufrufe, Monatswechsel, Freigabe-/Mitgliedschaftsentzug, GDPR-Löschung sowie das Übernehmen/Ausführen einer Routine. Es steht keine angemeldete Supabase-Testsitzung bereit. Die offenen Checkboxen stehen in `roadmap.md`.

## Geänderte Dateien pro Phase

### Ergänzungen Phase 1

- `roadmap.md`
- `src/features/employees/components/EmployeesView.tsx`
- `src/features/selftest/scenarios/team-rituals.ts`
- `src/features/team-rituals/QuestionBank.tsx`
- `src/features/team-rituals/TeamEvents.tsx`
- `src/features/team-rituals/TeamRitualWorkspace.tsx`
- `src/features/team-rituals/WeeklyQuestionWidget.tsx`
- `src/features/team-rituals/actions.ts`
- `src/features/team-rituals/data.ts`
- `src/features/team-rituals/logic.test.ts`
- `src/features/team-rituals/logic.ts`
- `supabase/migrations/20261113160500_team_ritual_employee_access.sql`

### Phase 2

- `roadmap.md`
- `src/components/dashboard/WidgetPalette.tsx`
- `src/components/dashboard/WidgetQuickAccess.tsx`
- `src/features/dashboard/components/DashboardWidget.tsx`
- `src/features/selftest/scenarios/team-rituals.ts`
- `src/features/team-rituals/FunFactsEditor.tsx`
- `src/features/team-rituals/TeamRitualWorkspace.tsx`
- `src/features/team-rituals/TwoTruthsWidget.tsx`
- `src/features/team-rituals/data.ts`
- `src/features/team-rituals/twoTruths.ts`
- `src/hooks/useDashboardLayout.tsx`
- `src/hooks/useOnboardingChecklist.ts`
- `src/integrations/supabase/types.ts`
- `src/types/dashboardWidgets.ts`
- `supabase/migrations/20261113161000_team_two_truths.sql`

### Phase 3

- `roadmap.md`
- `src/components/dashboard/WidgetPalette.tsx`
- `src/components/dashboard/WidgetQuickAccess.tsx`
- `src/features/dashboard/components/DashboardWidget.tsx`
- `src/features/selftest/scenarios/team-rituals.ts`
- `src/features/team-rituals/BingoWidget.tsx`
- `src/features/team-rituals/TeamRitualWorkspace.tsx`
- `src/features/team-rituals/bingo.test.ts`
- `src/features/team-rituals/bingo.ts`
- `src/hooks/useDashboardLayout.tsx`
- `src/integrations/supabase/types.ts`
- `src/types/dashboardWidgets.ts`
- `supabase/migrations/20261113162000_team_bingo.sql`

### Phase 4

- `roadmap.md`
- `src/features/automation/officeRoutineTemplates.ts`
- `src/features/selftest/scenarios/team-rituals.ts`

Die parallel eingegangenen Annotationserweiterungen auf `main` wurden danach ohne inhaltliche Konflikte übernommen. Die neue Eintrittsdatum-Migration verwendet deshalb Version `20261113160500`, damit sie nicht mit der dortigen Annotation-Audit-Migration kollidiert. Die fachlichen Ritual-Implementierungen blieben unverändert; keine zusätzlichen breiten Prüfläufe.
