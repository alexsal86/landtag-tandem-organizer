# Strict-Migrationsfortschritt

## Zweck des Dokuments

Dieses Dokument ist kein reines Reporting mehr, sondern das operative Steuerungsdokument für die laufende TypeScript-Strict-Migration. Es beantwortet für jeden Bereich:

- **wo der reale Fortschritt steht**,
- **wer aktuell die Verantwortung trägt**,
- **welcher Batch als Nächstes geliefert werden soll**,
- **welcher Batch zuletzt abgeschlossen wurde**,
- und **welche Blocker aktiv gemanagt werden müssen**.

> Maßgeblich ist immer der **tatsächlich gemergte Stand auf `main`/`master`**. Geplante Batch-Reihenfolgen bleiben relevant, aber Fortschritt und Status werden ausschließlich anhand real abgeschlossener Merges gepflegt.

## Operative Batch-Reihenfolge

Seit dem Update vom 2026-03-18 wird die Migration **fachlich flow-first** gesteuert. Die fünf Flow-Pakete

1. `typecheck:flow-auth-tenant`
2. `typecheck:flow-calendar-sync`
3. `typecheck:flow-letter-workflow`
4. `typecheck:flow-notifications`
5. `typecheck:flow-edge-auth-role-tenant`

sind die verbindliche primäre Reihenfolge. Die vorhandenen Ordner-/Batch-Configs bleiben als nachgelagerte technische Schutznetze bestehen. `npm run typecheck:strict-all` führt jetzt zuerst die globale Baseline (`typecheck:baseline-global`), danach die batch-gesteuerten Verschärfungen (`typecheck:batch-governed`) und zuletzt die Legacy-Ausnahme-Batches (`typecheck:legacy-exceptions`) aus.

Jede vorhandene `tsconfig.*-strict.json` Datei bildet weiterhin einen operativen Migrationsbatch. Ein Batch gilt erst dann als abgeschlossen, wenn

- der zugehörige Typecheck grün ist,
- die für den Batch relevanten Tests grün sind,
- keine neuen `@ts-ignore`-Workarounds eingeführt wurden,
- das Batch-Dokument bzw. die betroffene Fortschrittsdokumentation aktualisiert wurde,
- und der Fortschritt danach in diesem Dokument auf den **real gemergten** Stand gesetzt wurde.

Die Flag-Priorität für die **aktuelle Migrationsphase** folgt den priorisierten Kernflows aus `docs/ci-quality-gates.md` (Auth / Tenant, Kalender, Letters, Notifications, Edge-Grenzen) und ist für alle Batches identisch:

1. `strictNullChecks`
2. `noImplicitAny`

`noUnusedLocals` und `noUnusedParameters` sind **bewusst nicht Teil des aktuellen Programms** und werden erst in einer späteren Phase batchweise eingeplant.

## Governance-Status (Stand: 2026-03-25)

Die Konfiguration ist ab dieser Migrationsstufe in **globale Baseline** und **Legacy-Ausnahme-Batches** getrennt:

- **Global aktiv (Baseline via `tsconfig.app.json`):**
  - `strictNullChecks: true`
- **Flow-/batch-gesteuert (nur in ausgewählten `tsconfig.*-strict.json`):**
  - `noImplicitAny: true`
- **Legacy-Ausnahmen (zentral via `tsconfig.legacy-relaxed.json`):**
  - `noImplicitAny: false`
  - `noUnusedLocals: false`
  - `noUnusedParameters: false`

Für CI und lokale Steuerung gelten damit drei Ebenen:

1. `npm run typecheck:baseline-global` (globale Mindestanforderung)
2. `npm run typecheck:batch-governed` (Migrationsbatches mit zusätzlichen Flags, insbesondere `noImplicitAny`)
3. `npm run typecheck:legacy-exceptions` (explizite Ausnahme-Batches auf Basis der Legacy-Relaxed-Config)

## Steuerungsregeln

### Verbindliches Test-Gate vor jeder neuen Migrationswelle in `src/hooks/**`

- Bevor ein weiterer Hook-Batch oder ein zusätzlicher priorisierter Hook auf `strictNullChecks` oder `noImplicitAny` umgestellt wird, ist für die betroffenen Kernmodule ein dokumentierter **Happy-Path- und Negativtest** nachzuweisen.
- Für die priorisierten Kernmodule `src/hooks/useAuth.tsx`, `src/hooks/useTenant.tsx`, `src/hooks/useNotifications.tsx` und `src/hooks/useLetterArchiving.tsx` gilt dieses Gate mit Vorrang vor jeder weiteren TypeScript-Verschärfung.
- Maßgebliche Freigabegrundlage ist `docs/architecture-guidelines.md`: Tests müssen relevant sein, bei Datenzugriff Supabase mocken und den fachlichen Kernflow sichtbar machen.
- Fehlt dieser Nachweis oder ist er fachlich zu schwach, wird die Migration **zuerst** durch fehlende Tests ergänzt und **erst danach** auf `strictNullChecks` bzw. `noImplicitAny` erweitert.
- Die Freigabe ist pro Welle in `docs/strict-test-gate-report.md` oder in einem gleichwertigen Batch-Dokument festzuhalten.

### Pflegegrundsatz: realer Fortschritt statt Plan-Fortschritt

- Die Statusangabe `Abgeschlossen` darf nur verwendet werden, wenn der Batch bereits gemergt ist.
- `In Arbeit` bedeutet: Batch ist laufend, aber noch nicht vollständig gemergt.
- `Geplant` bedeutet: in der Reihenfolge vorgesehen, aber operativ noch nicht begonnen.
- Prozentwerte in diesem Dokument zeigen ausschließlich **erreichte** Migration auf Basis des aktuell gemergten Codes.
- Wenn ein Merge nur einen Teil eines Bereichs verbessert, wird die **reale Teilmenge** eingetragen, inklusive aktualisierter Zielmenge und Blocker.

### Update-Anlass

Dieses Dokument ist nach jedem Merge zu aktualisieren, wenn mindestens einer der folgenden Punkte zutrifft:

- ein Strict-Batch wurde abgeschlossen oder neu begonnen,
- sich die reale Zahl migrierter Dateien verändert hat,
- ein Owner wechselt,
- sich Zielmenge oder Blocker eines Bereichs ändern,
- ein Kernmodul in einen anderen Eskalationsstatus wechselt.

## Kernmodule mit besonderer Steuerung

Diese Module sind programmkritisch und werden zusätzlich zu den Batch-Tabellen separat geführt.

| Kernmodul         | Scope                                                                                                                                          | Aktueller Owner       | Reale Lage                                                                            | Nächste Zielmenge                                                                                                     | Letzter abgeschlossener Batch                     | Bekannte Blocker                                                        |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | ----------------------------------------------------------------------- |
| **Auth / Tenant** | `src/hooks/useAuth.tsx`, `src/hooks/useTenant.tsx`, `src/hooks/useFeatureFlag.tsx`                                                             | Plattform / Identity  | Batch aktiv, noch nicht als gemergt abgeschlossen markiert                            | Abschluss von `typecheck:auth` mit `strictNullChecks` und `noImplicitAny` für alle 3 Hooks                            | Kein abgeschlossener Kernmodul-Batch dokumentiert | Nullability an Session-/Tenant-Kontexten, implizite API-Rückgabetypen; Unused-Cleanup explizit nachgelagert |
| **Notifications** | `src/hooks/useNotifications.tsx`, `src/hooks/useMessagesRealtime.tsx`, `src/hooks/useNavigationNotifications.tsx`, Notification-Contexts/Pages | Kommunikation / Inbox | Hook-Batch aktiv; Folgearbeiten in Contexts und Pages verbleiben                      | Abschluss von `typecheck:notifications`, danach Übergabe an `typecheck:contexts` und `typecheck:pages-batch2`         | Kein abgeschlossener Kernmodul-Batch dokumentiert | Realtime-Events, Context-Abhängigkeiten, Querabhängigkeiten zu Seiten; Unused-Cleanup explizit nachgelagert |
| **Letters**       | `src/components/letters/**`, `letter-templates/**`, `letter-pdf/**`                                                                            | Dokumente / Output    | Noch nicht begonnen als eigener abgeschlossener Strict-Batch                          | Start und Abschluss von `typecheck:components-batch3` für Letter-Scope                                                | Kein abgeschlossener Kernmodul-Batch dokumentiert | Breiter UI-Scope, PDF-/Template-Typen, potenziell geringe Testabdeckung; Unused-Cleanup explizit nachgelagert |
| **Kalender**      | `src/components/calendar/**`, angrenzende Appointment-Komponenten                                                                              | Termine / Kalender    | Im Komponentenpfad eingeplant, aber noch ohne separat gemergten Kernmodul-Meilenstein | Fortschritt innerhalb `typecheck:components-batch2` sichtbar machen und kalenderbezogenen Teilabschluss dokumentieren | Kein abgeschlossener Kernmodul-Batch dokumentiert | Komplexe Datums-/Event-Typen, Abhängigkeiten zu Appointments und Tasks; Unused-Cleanup explizit nachgelagert |

## Batch-Board

| Reihenfolge | Batch / Script                                                                         | Bereich                    | Neu aufgenommene Dateien im Scope                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Zuerst zu erfüllende Flags                                                                                  | Exit-Kriterium                                                                    | Status    | Letzter real abgeschlossener Stand    |
| ----------- | -------------------------------------------------------------------------------------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | --------- | ------------------------------------- |
| 1           | `typecheck:knowledge` (`tsconfig.knowledge-strict.json`)                               | Hooks / Knowledge          | `src/hooks/useKnowledgeDocumentTopics.tsx`, `src/hooks/useTopics.tsx`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | `strictNullChecks`, danach `noImplicitAny`                                                                  | Typecheck grün, relevante Hook-/Knowledge-Tests grün, keine neuen `@ts-ignore`    | In Arbeit | Noch kein Abschlussdatum dokumentiert |
| 2           | `typecheck:auth` (`tsconfig.auth-strict.json`)                                         | Kernmodul Auth / Tenant    | `src/hooks/useAuth.tsx`, `src/hooks/useTenant.tsx`, `src/hooks/useFeatureFlag.tsx`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | `strictNullChecks`, danach `noImplicitAny`                                                                  | Typecheck grün, relevante Auth-/Tenant-Tests grün, keine neuen `@ts-ignore`       | In Arbeit | Noch kein Abschlussdatum dokumentiert |
| 3           | `typecheck:quicknotes` (`tsconfig.quicknotes-strict.json`)                             | Hooks / Quick Notes        | `src/hooks/useQuickNotes.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | `strictNullChecks`, danach `noImplicitAny`                                                                  | Typecheck grün, relevante Quick-Notes-Tests grün, keine neuen `@ts-ignore`        | In Arbeit | Noch kein Abschlussdatum dokumentiert |
| 4           | `typecheck:notifications` (`tsconfig.notifications-strict.json`)                       | Kernmodul Notifications    | `src/hooks/useNotifications.tsx`, `src/hooks/useMessagesRealtime.tsx`, `src/hooks/useNavigationNotifications.tsx`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | `strictNullChecks`, danach `noImplicitAny`                                                                  | Typecheck grün, relevante Notification-Tests grün, keine neuen `@ts-ignore`       | In Arbeit | Noch kein Abschlussdatum dokumentiert |
| 5           | `typecheck:dashboard` (`tsconfig.dashboard-strict.json`)                               | Hooks / Dashboard          | `src/hooks/useDashboardData.ts`, `src/hooks/useMyWorkTasksData.ts`, `src/hooks/useMyWorkDecisionsData.ts`, `src/hooks/useMyWorkDecisionsSidebarData.ts`, `src/hooks/useCounts.tsx`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | `strictNullChecks`, danach `noImplicitAny`                                                                  | Typecheck grün, relevante Dashboard-/My-Work-Tests grün, keine neuen `@ts-ignore` | In Arbeit | Noch kein Abschlussdatum dokumentiert |
| 6           | `typecheck:utils` (`tsconfig.strict-utils.json`)                                       | Utilities                  | Siehe `tsconfig.strict-utils.json`; dieser Batch bleibt in der Reihenfolge verankert, obwohl die Detail-Dokumentation außerhalb dieses Dokuments gepflegt wird.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | `strictNullChecks`, danach `noImplicitAny` | Typecheck grün, relevante Utility-Tests grün, keine neuen `@ts-ignore`            | In Arbeit | Noch kein Abschlussdatum dokumentiert |
| 7           | `typecheck:hooks-batch1` (`tsconfig.hooks-batch1-strict.json`)                         | Hooks                      | `useAuditLog`, `useNavCollapse`, `usePersistentState`, `useTypewriter`, `useViewPreference`, `useFavicon`, `useAutoSave`, `useSpeechDictation`, `useCombinedTimeEntries`, `useDecisionComments`, `useTags`, `useAppointmentCategories`, `useUserDisplay`, `useNewItemIndicators`, `useLoginCustomization`, `useAppSettings`, `useNoteSharing`, `useGlobalNoteSharing`, `useCelebrationSettings`, `useDecisionRefreshScheduler`, `useNotificationDisplayPreferences`, `useUserPreference`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | `strictNullChecks`                                                                                          | Typecheck grün, relevante Hook-Tests grün, keine neuen `@ts-ignore`               | In Arbeit | Noch kein Abschlussdatum dokumentiert |
| 8           | `typecheck:hooks-batch2` (`tsconfig.hooks-batch2-strict.json`)                         | Hooks                      | `useUserStatus`, `useTeamFeedbackFeed`, `useTeamAnnouncements`, `useMyWorkNewCounts`, `useMyWorkSettings`, `useMyWorkJourFixeMeetings`, `useMyWorkJourFixeSystemData`, `useContactDocuments`, `useContactDocumentCounts`, `useContactFundings`, `useContactTopics`, `useAppointmentTopics`, `useDecisionTopics`, `useTaskTopics`, `useAppointmentPreparation`, `useAppointmentFeedback`, `useLetterArchiving`, `useDecisionAttachmentUpload`, `useAllPersonContacts`, `useDashboardGrid`, `useDashboardLayout`, `useMapFlags`, `useMapFlagStakeholders`, `useMapFlagTopics`, `useMapFlagTypes`, `useStakeholderPreload`, `useCaseFileProcessingStatuses`, `useDocumentCategories`, `useDocumentContacts`, `useMeetingParticipants`, `useInfiniteContacts`, `useYearlyBalance`, `usePlanningPreferences`, `useDefaultDecisionSettings`, `useTimeEntryReminder`, `useNewItemIndicators`, `useTenantUsers`, `useNotificationHighlight`, `usePartyAssociations`, `useElectionDistricts`, `useDistrictDetection`, `useDistrictNotes`, `useHeatmapData`, `useKarlsruheDistricts`, `use-mobile`, `use-toast`, `useYjsCollaboration` | `strictNullChecks`, danach `noImplicitAny`                                                                  | Typecheck grün, relevante Hook-Tests grün, keine neuen `@ts-ignore`               | In Arbeit | Noch kein Abschlussdatum dokumentiert |
| 9           | `typecheck:hooks-batch3` (`tsconfig.hooks-batch3-strict.json`)                         | Hooks                      | `src/hooks/useMyWorkJourFixeSystemData.ts`, `src/hooks/useQuickNotes.ts`, `src/hooks/useNotificationHighlight.tsx`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | `strictNullChecks`, danach `noImplicitAny`                                                                   | Typecheck grün, relevante Hook-Tests grün, keine neuen `@ts-ignore`               | In Arbeit | Noch kein Abschlussdatum dokumentiert |
| 10          | `typecheck:contexts` (`tsconfig.contexts-strict.json`)                                 | Contexts / Providers       | `src/contexts/NotificationContext.tsx`, `src/contexts/MatrixUnreadContext.tsx`, `src/contexts/MatrixClientContext.tsx`, `src/providers/AppProviders.tsx`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | `strictNullChecks`, danach `noImplicitAny`                                                                  | Typecheck grün, relevante Provider-/Context-Tests grün, keine neuen `@ts-ignore`  | In Arbeit | Noch kein Abschlussdatum dokumentiert |
| 11          | `typecheck:services-features` (`tsconfig.services-features-strict.json`)               | Services / Features        | Alle Dateien unter `src/services/**` und `src/features/**`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | `strictNullChecks`                                                                                          | Typecheck grün, relevante Service-/Feature-Tests grün, keine neuen `@ts-ignore`   | In Arbeit | Noch kein Abschlussdatum dokumentiert |
| 12          | `typecheck:services-features-batch2` (`tsconfig.services-features-batch2-strict.json`) | Services / Features        | `src/services/headerRenderer.ts`, `src/features/matrix-widget/api.ts`, `src/features/matrix-widget/types.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | `strictNullChecks`, danach `noImplicitAny`                                                                  | Typecheck grün, relevante Service-/Feature-Tests grün, keine neuen `@ts-ignore`   | In Arbeit | Noch kein Abschlussdatum dokumentiert |
| 13          | `typecheck:services-features-batch3` (`tsconfig.services-features-batch3-strict.json`) | Services / Features        | `src/services/headerRenderer.ts`, `src/features/matrix-widget/types.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | `strictNullChecks`, danach `noImplicitAny`                                                                   | Typecheck grün, relevante Service-/Feature-Tests grün, keine neuen `@ts-ignore`   | In Arbeit | Noch kein Abschlussdatum dokumentiert |
| 14          | `typecheck:components-batch1` (`tsconfig.components-batch1-strict.json`)               | Komponenten                | `src/components/*`, `src/components/ui/**`, `src/components/shared/**`, `src/components/layout/**`, `src/components/navigation/**`, `src/components/widgets/**`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | `strictNullChecks`                                                                                          | Typecheck grün, relevante Komponenten-Tests grün, keine neuen `@ts-ignore`        | In Arbeit | Noch kein Abschlussdatum dokumentiert |
| 15          | `typecheck:components-batch2` (`tsconfig.components-batch2-strict.json`)               | Komponenten inkl. Kalender | `src/components/appointments/**`, `calendar/**`, `contacts/**`, `tasks/**`, `documents/**`, `contact-import/**`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | `strictNullChecks`                                                                                          | Typecheck grün, relevante Komponenten-Tests grün, keine neuen `@ts-ignore`        | In Arbeit | Noch kein Abschlussdatum dokumentiert |
| 16          | `typecheck:components-batch3` (`tsconfig.components-batch3-strict.json`)               | Komponenten inkl. Letters  | `src/components/letters/**`, `letter-templates/**`, `letter-pdf/**`, `meetings/**`, `chat/**`, `emails/**`, `dashboard/**`, `admin/**`, `administration/**`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | `strictNullChecks`                                                                                          | Typecheck grün, relevante Komponenten-Tests grün, keine neuen `@ts-ignore`        | In Arbeit | Noch kein Abschlussdatum dokumentiert |
| 17          | `typecheck:components-batch4` (`tsconfig.components-batch4-strict.json`)               | Komponenten                | `src/components/events/**`, `expenses/**`, `knowledge/**`, `drucksachen/**`, `press/**`, `stakeholders/**`, `my-work/**`, `account/**`, `announcements/**`, `celebrations/**`, `dayslip/**`, `employees/**`, `event-planning/**`, `karlsruhe/**`, `nodes/**`, `plugins/**`, `poll/**`, `timetracking/**`, `topics/**`, `task-decisions/**`, `task-detail/**`, `appointment-preparations/**`, `canvas-engine/**`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | `strictNullChecks`                                                                                          | Typecheck grün, relevante Komponenten-Tests grün, keine neuen `@ts-ignore`        | In Arbeit | Noch kein Abschlussdatum dokumentiert |
| 18          | `typecheck:components-toplevel` (`tsconfig.components-toplevel-strict.json`)           | Komponenten                | Top-Level-Dateien `src/components/*.ts` und `src/components/*.tsx`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | `strictNullChecks`                                                                                          | Typecheck grün, relevante Komponenten-Tests grün, keine neuen `@ts-ignore`        | In Arbeit | Noch kein Abschlussdatum dokumentiert |
| 19          | `typecheck:pages` (`tsconfig.pages-strict.json`)                                       | Pages                      | Alle Dateien unter `src/pages/**`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | `strictNullChecks`                                                                                          | Typecheck grün, relevante Seiten-Tests grün, keine neuen `@ts-ignore`             | In Arbeit | Noch kein Abschlussdatum dokumentiert |
| 20          | `typecheck:pages-batch2` (`tsconfig.pages-batch2-strict.json`)                         | Pages / Notifications      | `src/pages/Administration.tsx`, `src/pages/Index.tsx`, `src/pages/NotificationsPage.tsx`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | `strictNullChecks`, danach `noImplicitAny`                                                                  | Typecheck grün, relevante Seiten-Tests grün, keine neuen `@ts-ignore`             | In Arbeit | Noch kein Abschlussdatum dokumentiert |
| 21          | `typecheck:pages-batch3` (`tsconfig.pages-batch3-strict.json`)                         | Pages                      | `src/pages/PollGuest.tsx`, `src/pages/NotFound.tsx`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | `strictNullChecks`, danach `noImplicitAny`                                                                   | Typecheck grün, relevante Seiten-Tests grün, keine neuen `@ts-ignore`             | In Arbeit | Noch kein Abschlussdatum dokumentiert |


## Zielzustand der aktuellen Migrationsphase

Für die laufende Phase ist der Zielzustand bewusst auf die Kernbereiche und die fünf priorisierten Kernflows aus `docs/ci-quality-gates.md` begrenzt. Als **erreicht** gilt die Phase erst, wenn in den jeweils priorisierten Batches ausschließlich die folgenden Kriterien erfüllt sind:

- **vollständige Null-Sicherheit in Kernbereichen** (`strictNullChecks`),
- **keine impliziten `any` in Kernbereichen** (`noImplicitAny`).

Nicht Bestandteil dieser Phase sind Arbeiten zu `noUnusedLocals` und `noUnusedParameters`. Solche Bereinigungen werden nicht mehr als Exit-Kriterium, Fortschrittsmetrik oder Batch-Ziel der laufenden Migration geführt, sondern explizit in eine spätere Anschlussphase verschoben.

## Fortschritt nach Bereich

| Bereich                                                | Aktueller Owner                |                    TS/TSX-Dateien gesamt |                                            Reale Fortschritte `strictNullChecks` |                                               Reale Fortschritte `noImplicitAny` | Nächste Zielmenge                                                                                                                                 | Letzter abgeschlossener Batch                                                                               | Bekannte Blocker                                                                                    | Letztes Update |
| ------------------------------------------------------ | ------------------------------ | ---------------------------------------: | -------------------------------------------------------------------------------: | -------------------------------------------------------------------------------: | ------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | -------------- |
| Hooks (`src/hooks`)                                    | Frontend Plattform             |                                       93 | 22 (23.7%) + 2 Knowledge + 3 Auth + 1 QuickNotes + 3 Notifications + 5 Dashboard | 47 (50.5%) + 2 Knowledge + 3 Auth + 1 QuickNotes + 3 Notifications + 5 Dashboard | `typecheck:knowledge`, `typecheck:auth`, `typecheck:quicknotes`, `typecheck:notifications`, `typecheck:dashboard` entlang der Kernflows Auth/Tenant und Notifications auf gemergten Abschluss bringen | `hooks`-Bestand nur teilweise auf Batch-Ebene dokumentiert; kein Abschlussdatum eingetragen                 | Heterogene Hook-Signaturen, Nullability in Supabase-/Realtime-Flows, wiederverwendete Utility-Typen | 2026-03-18     |
| Contexts / Providers (`src/contexts`, `src/providers`) | Frontend Plattform             |                                        4 |                                                                       4 (100.0%) |                                                                         0 (0.0%) | `typecheck:contexts` mit `noImplicitAny` abschließen und Notification-Kontexte mit Kernmodul Notifications synchronisieren                        | `strictNullChecks` im Verzeichnis real erreicht; Batch als Ganzes noch nicht als abgeschlossen dokumentiert | Context-Kopplung an Notifications und Matrix-Clients                                                | 2026-03-18     |
| Services / Features (`src/services`, `src/features`)   | Plattform / Integrationen      |                                       42 |                                                                      42 (100.0%) |                                                                         3 (7.1%) | `typecheck:services-features-batch2` und danach `typecheck:services-features-batch3` abschließen; Edge-Auth/Role/Tenant-Grenzen als Kernflow berücksichtigen | `strictNullChecks` im Verzeichnis real erreicht; Folge-Batches offen                                        | API-Typgrenzen, Rendering-/Widget-Schnittstellen                                                    | 2026-03-18     |
| Komponenten (`src/components`)                         | Frontend Produktteams          | n. a. (nach Batch-Zuschnitten gesteuert) |                                            5 Batch-Slices + Top-Level in Planung |                                             0 dedizierte `noImplicitAny`-Batches | Zuerst `typecheck:components-batch2` für Kalender-nahe Flows und `typecheck:components-batch3` für Letters sichtbar steuern                       | Noch kein Komponenten-Batch als real abgeschlossen dokumentiert                                             | Großer Scope, unterschiedliche Domänen, teils fehlende feingranulare Fortschrittsmessung            | 2026-03-18     |
| Pages (`src/pages`)                                    | Frontend Plattform / App Shell |                                       22 |                                                                      22 (100.0%) |                                                                        3 (13.6%) | `typecheck:pages-batch2` abschließen, insbesondere `NotificationsPage.tsx` entlang des Kernflows Benachrichtigungen                             | `strictNullChecks` im Verzeichnis real erreicht; Folge-Batches offen                                        | Seitenspezifische Abhängigkeiten zu Hooks, Contexts und Router-Daten                                | 2026-03-18     |


### Verbindliche Any-Abbau-Tabellen je Bereich

Stand: **2026-03-25**, basierend auf `npm run report:any-usage` plus Bereichs-Spotcheck in den jeweils führenden Dateien.

#### Hooks (`src/hooks`)

| Datei | Anzahl verbleibender `any` | Begründung | Owner | Zieltermin |
| --- | ---: | --- | --- | --- |
| `src/hooks/useYjsCollaboration.tsx` | 17 | Interop mit Yjs-/Awareness-Event-Payloads noch ohne stabile App-spezifische Typ-Adapter. | Frontend Plattform | 2026-04-08 |
| `src/hooks/useDashboardDeadlines.ts` | 10 | Heterogene Dashboard-Datenquellen; Rückgabetypen noch nicht vollständig vereinheitlicht. | Frontend Plattform | 2026-04-08 |
| `src/hooks/useUserPreference.ts` | 7 | Dynamische Preference-Keys und API-Mapping noch mit loser Typkopplung. | Frontend Plattform | 2026-04-15 |

#### Contexts / Providers (`src/contexts`, `src/providers`)

| Datei | Anzahl verbleibender `any` | Begründung | Owner | Zieltermin |
| --- | ---: | --- | --- | --- |
| `src/contexts/MatrixClientContext.tsx` | 20 | Matrix-SDK-Interop (E2EE/UIA/Event-Emitter) mit noch unvollständigen Upstream-Typen; verbleibende Stellen sind als `INTEROP-ANY` markiert. | Kommunikation / Inbox | 2026-04-22 |

#### Services / Features (`src/services`, `src/features`)

| Datei | Anzahl verbleibender `any` | Begründung | Owner | Zieltermin |
| --- | ---: | --- | --- | --- |
| `src/features/redaktion/components/Kalenderansicht.tsx` | 1 | DnD-Interop von `react-big-calendar` liefert weiterhin unscharfen `start`-Payload. | Plattform / Integrationen | 2026-04-29 |
| `src/features/redaktion/hooks/useTopicBacklog.ts` | 1 | Join-Payload `social_content_item_channels` bleibt bis zur View-Typisierung dynamisch. | Plattform / Integrationen | 2026-04-22 |
| `src/features/cases/files/**` + `src/features/cases/items/hooks/useCaseItems.tsx` | 11 | Verbleibende Interop-`any` sind mit `INTEROP-ANY` + Ticket markiert (JSONB/Join-/RPC-Grenzen) und werden im nächsten Cases-Teilbatch über Adapter-Typen abgebaut. | Plattform / Integrationen | 2026-04-22 |

#### Komponenten (`src/components`)

| Datei | Anzahl verbleibender `any` | Begründung | Owner | Zieltermin |
| --- | ---: | --- | --- | --- |
| `src/components/letter-templates/TemplateFormTabs.tsx` | 69 | Größter Letter-Template-Hotspot mit Legacy-Form-State und variablen Template-Blöcken. | Dokumente / Output | 2026-04-22 |
| `src/components/letters/LetterLayoutCanvasDesigner.tsx` | 37 | Canvas-/Drag&Drop-Interop mit teils untypisierten Drittanbieter-Objekten. | Dokumente / Output | 2026-04-29 |
| `src/components/dayslip/hooks/useDaySlipStore.ts` | 29 | Store-Slices historisch ohne strikte Actions/Selectors modelliert. | Frontend Produktteams | 2026-04-22 |

#### Pages (`src/pages`)

| Datei | Anzahl verbleibender `any` | Begründung | Owner | Zieltermin |
| --- | ---: | --- | --- | --- |
| `src/pages/**` | 0 | Bereich aktuell `any`-frei nach Batch-Bereinigung; neue Ausnahmen nur noch als dokumentierte Interop-Fälle zulässig. | Frontend Plattform / App Shell | 2026-04-15 (halten) |

## Metrik: Any-Delta pro Batch

Zur operativen Steuerung von `noImplicitAny` wird zusätzlich eine Delta-Metrik geführt, die pro Migrations-Batch die Veränderung der `any`-/`as any`-Vorkommen ausweist.

| Metrik | Definition | Zielwert | CI-Gate |
| --- | --- | --- | --- |
| **Any-Delta pro Batch** | `Any-Total(Head)` minus `Any-Total(Base)` auf PR-Ebene (ermittelt durch `scripts/report-any-usage.mjs`) | `<= 0` | PRs mit positivem Delta schlagen fehl |

Pflegehinweis pro Batch:

1. Vor dem Merge den aktuellen Report mit `npm run report:any-usage` erzeugen und die betroffenen Verzeichnisse im Batch-Doc festhalten.
2. Im PR-Summary den Delta-Wert aus dem CI-Job „Any-Delta PR-Gate (nicht steigend)“ dokumentieren.
3. Bei Delta `0` ist Stagnation akzeptabel; bei negativem Delta ist die Reduktion als Fortschritt im Batch-Abschnitt zu notieren.

### Heute: Scope-Freeze (2026-03-25)

Für die laufende Welle ist der Scope bis zum Abschluss der drei nächsten PRs eingefroren:

- **Kein Parallel-Refactor außerhalb des Any-Abbaus** (keine Struktur-/Naming-/Feature-Änderungen ohne direkten Typisierungsbezug).
- **PRs werden sequenziell abgearbeitet (A → B → C)**, damit das Any-Delta pro Merge eindeutig messbar bleibt.
- **Neue `any` ohne Interop-Begründung (`INTEROP-ANY` + Ticket) sind blockierend**.

Die **verbindliche Trefferliste**, inklusive Clusterung A/B/C, Owner, ETA und Daily-Tracking, wird ab sofort ausschließlich hier gepflegt:

- `docs/tech-debt/any-trefferliste-scope-2026-03-25.md`

### Nächste 3 PRs (sofort aufgesetzt)

Baseline vor Start der Serie: **`Any-Total = 572`** (gemessen am 2026-03-25 via `npm run --silent report:any-usage:total`).

| PR | Fokus | Primärer Scope | Start-Baseline (`any`) | Ziel-Gate |
| --- | --- | --- | ---: | --- |
| **PR A** | Größte Hotspot-Dateien | `src/components/documents/hooks/__tests__/useDocumentsData.test.ts` (17), `src/components/ContactSelector.tsx` (14), `src/components/administration/MeetingTemplateManager.tsx` (11), `src/components/my-work/MyWorkPlanningsTab.tsx` (11) | 53 | Any-Delta `< 0`, keine neuen unbegründeten `any` |
| **PR B** | Context-/Hook-Hotspots | `src/contexts/MatrixClientContext.tsx` (20), `src/hooks/useYjsCollaboration.tsx` (17), `src/hooks/useDashboardDeadlines.ts` (10) | 47 | Any-Delta `< 0`, Interop-Randfälle nur mit Ticket |
| **PR C** | Rest-Sweep + Regelverschärfung | verbleibende Top-Dateien aus `report:any-usage:files` + Governance/Regeln (`docs/type-migration-rules.md`, PR-Template, CI-Hinweise) | aus Merge-Stand nach PR B neu zu messen | Any-Delta `<= 0` (kein Rückschritt), Governance-Gates aktiv |

### Merge-Rhythmus: Baseline nach jedem Merge neu messen

Nach jedem Merge von PR A/B/C sind folgende Schritte verpflichtend und im PR/Doc zu dokumentieren:

1. `npm run --silent report:any-usage:total` (neue globale Baseline erfassen).
2. `npm run --silent report:any-usage:clusters` (Cluster-Verschiebung prüfen).
3. `npm run --silent report:any-usage:files | head -n 40` (neue Top-Hotspots erfassen).
4. Werte in diesem Abschnitt und im jeweiligen PR-Abschnitt mit **vorher/nachher/Delta** aktualisieren.

### Fortschritts-Update (2026-03-25): Paket A/B/C (historisch)

| Paket | Scope | `any` vorher | `any` nachher | Delta |
| --- | --- | ---: | ---: | ---: |
| Paket A | `src/components/MessageSystem.tsx`, `src/components/AppointmentPreparationSidebar.tsx` | 16 | 0 | -16 |
| Paket B | `src/hooks/useYjsCollaboration.tsx` | 15 | 0 | -15 |
| Paket C | `src/contexts`, `src/pages`, `src/features`, `src/services`, `src/utils` (fokussierte Restbereinigung) | 66 | 33 | -33 |

## Any-Restschulden

Zentrale Liste für bewusst verbleibende `any`-/`as any`-Stellen in den aktiven Komponenten-Batches.

| Datum | Batch-Scope | Datei | Entscheidung | Begründung / Abbauplan |
| --- | --- | --- | --- | --- |
| 2026-03-25 | `tsconfig.components-batch2-strict.json` | `src/components/calendar/ProperReactBigCalendar.tsx` | Temporär belassen (begründete Ausnahme) | `react-big-calendar` + DnD-Addon liefert aktuell keine ausreichend präzisen generischen Typen für `view`, `onEventDrop`, `onEventResize` und `eventPropGetter`; Ersetzung durch `unknown` erfordert vorgelagerte Wrapper-Typen. Geplanter Abbau: eigene typed Adapter-Props im nächsten Kalender-Strict-Teilbatch einführen. |
| 2026-03-25 | `tsconfig.contexts-strict.json`, `tsconfig.services-features-batch2-strict.json` | `src/contexts/MatrixClientContext.tsx`, `src/features/redaktion/components/Kalenderansicht.tsx`, `src/features/redaktion/hooks/useTopicBacklog.ts`, `src/features/cases/**` (markierte Einzelstellen) | Temporär belassen (begründete Ausnahme) | Alle verbliebenen Stellen sind als `INTEROP-ANY(TS-4821..TS-4829)` markiert; Gründe: Matrix-SDK-Emitter/UIA, `react-big-calendar` DnD-Payloads, heterogene Supabase-Join/JSONB-Payloads. Nächste verbindliche Frist: **2026-04-22** (Kalender-Interop bis 2026-04-29). |

### Ausnahme-Register Cases (`INTEROP-ANY`)

| Ticket | Wrapper (typed boundary) | Reststelle (`any`) | Kurzbegründung | Ablöse-Aufgabe | Termin |
| --- | --- | --- | --- | --- | --- |
| TS-4824 | `buildCaseItemUpdatePayload` | `src/features/cases/shared/utils/caseInteropAdapters.ts` | Polymorphes `intake_payload` (JSONB) wird im Supabase-Update noch nicht präzise inferiert. | Supabase-`TablesUpdate<\"case_items\">` via Schema-Validator + discriminated union ableiten und Wrapper ohne `any` migrieren. | 2026-04-22 |
| TS-4825 | `extractLinkErrorCode` | `src/features/cases/shared/utils/caseInteropAdapters.ts` | Heterogene Fehlerobjekte aus Query-Library/Supabase bei Link-Mutationen. | Einheitlichen `CaseLinkError`-Adapter einführen und Mutations-`onError` auf typed union umstellen. | 2026-04-22 |
| TS-4826 | `getCaseTaskDescription` | `src/features/cases/shared/utils/caseInteropAdapters.ts` | Join-Payload `task` ist in Legacy-Selects noch nicht vollständig typisiert. | Join-Select auf explizites Projection-DTO umstellen und Task-Detail ohne Cast aus DB-Typen lesen. | 2026-04-22 |
| TS-4827 | `isMatchingCaseParentTaskLink` | `src/features/cases/shared/utils/caseInteropAdapters.ts` | `case_file_tasks`-Join liefert teilweise untypisierte nested rows. | Typed Query-Mapper für `case_file_tasks` + `tasks` bauen und Parent-Link-Ermittlung ohne Interop-Cast migrieren. | 2026-04-22 |
| TS-4828 | `getCaseFileProcessingStatuses` | `src/features/cases/shared/utils/caseInteropAdapters.ts` | Legacy-Mix aus `processing_status` (String) und `processing_statuses` (Array/JSONB). | DB-Schema auf einheitliches `processing_statuses text[]` finalisieren und Altfeld entfernen. | 2026-04-22 |
| TS-4829 | `buildCaseItemInteractionInsertPayload` | `src/features/cases/shared/utils/caseInteropAdapters.ts` | Polymorphe Interaktionsquellen (`source_type`) in Insert-Payload noch ohne saubere Insert-DTO-Typen. | Interaktions-Insert-DTO mit `TablesInsert<\"case_item_interactions\">` und source-Discriminant einführen. | 2026-04-22 |

## Verbindliche Sprint-Abbauquote (`any`)

Ab sofort gilt für **jeden Sprint und jeden Bereich** aus „Fortschritt nach Bereich“ eine verbindliche Abbauquote von **mindestens 15% und Zielkorridor 20%** der zu Sprintstart verbleibenden `any`-Vorkommen.

- Mindestziel je Sprint/Bereich: **>= 15% Reduktion**.
- Zielkorridor je Sprint/Bereich: **15–20% Reduktion**.
- Unter 15% ist eine dokumentierte Ausnahme mit Blocker, Gegenmaßnahme und neuem Termin im Bereichsabschnitt erforderlich.
- Über 20% ist zulässig und als vorgezogener Fortschritt für den Folgesprint zu dokumentieren.

Formel: `Sprint-Abbauquote = (Any_Beginn - Any_Ende) / Any_Beginn * 100`.

## Spätere Anschlussphase: Unused-Bereinigung

Arbeiten zu `noUnusedLocals` und `noUnusedParameters` werden erst nach Erreichen des oben definierten Zielzustands geplant. Für diese Anschlussphase gelten vorab folgende Leitplanken:

- Aufnahme erst, wenn die priorisierten Kernflows in ihren Kernbereichen Null-Sicherheit und Freiheit von implizitem `any` erreicht haben.
- Planung weiter entlang der vorhandenen `typecheck:*`-Reihenfolge aus `package.json`, damit keine neue Batch-Logik entsteht.
- Bereinigungen werden nur batchweise freigegeben und separat dokumentiert, damit produktkritische Kernflows nicht durch kosmetische Restarbeiten blockiert werden.

## Operativer Pflegeprozess nach jedem Merge

Nach jedem abgeschlossenen oder teilweise fortgeschrittenen Merge wird dieses Dokument wie folgt aktualisiert:

1. Status des betroffenen Batches auf den realen Stand setzen (`Geplant`, `In Arbeit`, `Abgeschlossen`).
2. Falls ein Batch vollständig gemergt wurde, den Abschnitt **„Letzter real abgeschlossener Stand“** mit Datum ergänzen.
3. Fortschrittszahlen im Abschnitt **„Fortschritt nach Bereich“** anpassen.
4. `Aktueller Owner`, `Nächste Zielmenge`, `Letzter abgeschlossener Batch` und `Bekannte Blocker` des betroffenen Bereichs aktualisieren.
5. Prüfen, ob eines der Kernmodule (Auth/Tenant, Notifications, Letters, Kalender) neu markiert oder eskaliert werden muss.
6. Falls Folgearbeiten übrig bleiben, diese als nächste Batch-Kandidaten oder Datei-Follow-ups dokumentieren.

## Abschlusskriterium der aktuellen `any`-Migrationsphase

Die Phase gilt erst dann als abgeschlossen, wenn in den priorisierten Kernflows `any` nur noch in **freigegebenen Interop-Randfällen** vorkommt.

Freigegebener Interop-Randfall bedeutet:

1. der Typ stammt aus einer externen, nicht ausreichend typisierten Boundary (z. B. Drittanbieter-SDK, dynamische Runtime-Payload, Legacy-Bridge),
2. die Stelle ist **inline kommentiert** (`INTEROP-ANY: Grund + Ticket/Owner + Sunset-Termin`),
3. es existiert ein konkreter Abbaupfad (Adapter-/Guard-/Schema-Schritt),
4. und der Fall ist in der jeweiligen Bereichstabelle in diesem Dokument nachgeführt.

Nicht kommentierte oder nicht freigegebene `any` zählen als Rückfall und blockieren die Fertigmeldung des Batches.

## Review- und CI-Hinweis

- Wenn ein Pull Request Strict-Migrationsdateien, `tsconfig.*-strict.json`, `package.json`-Typecheck-Skripte oder Batch-Scope-Dateien verändert, muss im Review geprüft werden, ob auch `docs/strict-progress.md` oder ein zugehöriges Batch-Dokument aktualisiert wurde.
- Die konkrete Follow-up-Liste für die nächste Strictness-Stufe des Protokoll-Scopes wird in `docs/tech-debt/strictness-next-level-followups.md` gepflegt.
- **Keine neuen unkommentierten `any` werden akzeptiert.** Jede neue `any`-Stelle muss als Interop-Randfall begründet und inline markiert werden (`INTEROP-ANY: ...`).
- Die CI darf diesen Fall mindestens als Hinweis im Job Summary ausgeben; Ziel ist Sichtbarkeit, nicht stilles Vergessen.
- Reviewer prüfen explizit, ob der dokumentierte Fortschritt den **real gemergten Stand** beschreibt und nicht nur den geplanten Zielzustand.
- Verbindliche Review-Pflichtfrage: **„Wurden neue `any` eingeführt?“** Falls ja, muss die Antwort die betroffenen Dateien, Begründungen und Zieltermine benennen.
