# Strict-Migrationsfortschritt

## Operative Batch-Reihenfolge

Jede vorhandene `tsconfig.*-strict.json` Datei bildet einen operativen Migrationsbatch. Die Reihenfolge ist verbindlich in den `typecheck:*`-Skripten aus `package.json` abgebildet und wird zusätzlich über `npm run typecheck:strict-all` in genau dieser Reihenfolge ausgeführt. Ein Batch gilt erst dann als abgeschlossen, wenn

- der zugehörige Typecheck grün ist,
- die für den Batch relevanten Tests grün sind,
- keine neuen `@ts-ignore`-Workarounds eingeführt wurden,
- und der Fortschritt danach in diesem Dokument aktualisiert wurde.

Die Flag-Priorität ist für alle Batches identisch:

1. `strictNullChecks`
2. `noImplicitAny`
3. `noUnusedLocals` und `noUnusedParameters`

## Batch-Board

| Reihenfolge | Batch / Script | Neu aufgenommene Dateien im Scope | Zuerst zu erfüllende Flags | Exit-Kriterium | Status |
|---|---|---|---|---|---|
| 1 | `typecheck:knowledge` (`tsconfig.knowledge-strict.json`) | `src/hooks/useKnowledgeDocumentTopics.tsx`, `src/hooks/useTopics.tsx` | `strictNullChecks`, danach `noImplicitAny` | Typecheck grün, relevante Hook-/Knowledge-Tests grün, keine neuen `@ts-ignore` | In Arbeit |
| 2 | `typecheck:auth` (`tsconfig.auth-strict.json`) | `src/hooks/useAuth.tsx`, `src/hooks/useTenant.tsx`, `src/hooks/useFeatureFlag.tsx` | `strictNullChecks`, danach `noImplicitAny` | Typecheck grün, relevante Auth-/Tenant-Tests grün, keine neuen `@ts-ignore` | In Arbeit |
| 3 | `typecheck:quicknotes` (`tsconfig.quicknotes-strict.json`) | `src/hooks/useQuickNotes.ts` | `strictNullChecks`, danach `noImplicitAny` | Typecheck grün, relevante Quick-Notes-Tests grün, keine neuen `@ts-ignore` | In Arbeit |
| 4 | `typecheck:notifications` (`tsconfig.notifications-strict.json`) | `src/hooks/useNotifications.tsx`, `src/hooks/useMessagesRealtime.tsx`, `src/hooks/useNavigationNotifications.tsx` | `strictNullChecks`, danach `noImplicitAny` | Typecheck grün, relevante Notification-Tests grün, keine neuen `@ts-ignore` | In Arbeit |
| 5 | `typecheck:dashboard` (`tsconfig.dashboard-strict.json`) | `src/hooks/useDashboardData.ts`, `src/hooks/useMyWorkTasksData.ts`, `src/hooks/useMyWorkDecisionsData.ts`, `src/hooks/useMyWorkDecisionsSidebarData.ts`, `src/hooks/useCounts.tsx` | `strictNullChecks`, danach `noImplicitAny` | Typecheck grün, relevante Dashboard-/My-Work-Tests grün, keine neuen `@ts-ignore` | In Arbeit |
| 6 | `typecheck:utils` (`tsconfig.strict-utils.json`) | Siehe `tsconfig.strict-utils.json`; dieser Batch bleibt in der Reihenfolge verankert, obwohl die Detail-Dokumentation außerhalb dieses Dokuments gepflegt wird. | `strictNullChecks`, danach `noImplicitAny`, danach `noUnusedLocals`/`noUnusedParameters` falls konfiguriert | Typecheck grün, relevante Utility-Tests grün, keine neuen `@ts-ignore` | In Arbeit |
| 7 | `typecheck:hooks-batch1` (`tsconfig.hooks-batch1-strict.json`) | `useAuditLog`, `useNavCollapse`, `usePersistentState`, `useTypewriter`, `useViewPreference`, `useFavicon`, `useAutoSave`, `useSpeechDictation`, `useCombinedTimeEntries`, `useDecisionComments`, `useTags`, `useAppointmentCategories`, `useUserDisplay`, `useNewItemIndicators`, `useLoginCustomization`, `useAppSettings`, `useNoteSharing`, `useGlobalNoteSharing`, `useCelebrationSettings`, `useDecisionRefreshScheduler`, `useNotificationDisplayPreferences`, `useUserPreference` | `strictNullChecks` | Typecheck grün, relevante Hook-Tests grün, keine neuen `@ts-ignore` | In Arbeit |
| 8 | `typecheck:hooks-batch2` (`tsconfig.hooks-batch2-strict.json`) | `useUserStatus`, `useTeamFeedbackFeed`, `useTeamAnnouncements`, `useMyWorkNewCounts`, `useMyWorkSettings`, `useMyWorkJourFixeMeetings`, `useMyWorkJourFixeSystemData`, `useContactDocuments`, `useContactDocumentCounts`, `useContactFundings`, `useContactTopics`, `useAppointmentTopics`, `useDecisionTopics`, `useTaskTopics`, `useAppointmentPreparation`, `useAppointmentFeedback`, `useLetterArchiving`, `useDecisionAttachmentUpload`, `useAllPersonContacts`, `useDashboardGrid`, `useDashboardLayout`, `useMapFlags`, `useMapFlagStakeholders`, `useMapFlagTopics`, `useMapFlagTypes`, `useStakeholderPreload`, `useCaseFileProcessingStatuses`, `useDocumentCategories`, `useDocumentContacts`, `useMeetingParticipants`, `useInfiniteContacts`, `useYearlyBalance`, `usePlanningPreferences`, `useDefaultDecisionSettings`, `useTimeEntryReminder`, `useNewItemIndicators`, `useTenantUsers`, `useNotificationHighlight`, `usePartyAssociations`, `useElectionDistricts`, `useDistrictDetection`, `useDistrictNotes`, `useHeatmapData`, `useKarlsruheDistricts`, `use-mobile`, `use-toast`, `useYjsCollaboration` | `strictNullChecks`, danach `noImplicitAny` | Typecheck grün, relevante Hook-Tests grün, keine neuen `@ts-ignore` | In Arbeit |
| 9 | `typecheck:hooks-batch3` (`tsconfig.hooks-batch3-strict.json`) | `src/hooks/useMyWorkJourFixeSystemData.ts`, `src/hooks/useQuickNotes.ts`, `src/hooks/useNotificationHighlight.tsx` | `strictNullChecks`, danach `noImplicitAny`, danach `noUnusedLocals`/`noUnusedParameters` | Typecheck grün, relevante Hook-Tests grün, keine neuen `@ts-ignore` | In Arbeit |
| 10 | `typecheck:contexts` (`tsconfig.contexts-strict.json`) | `src/contexts/NotificationContext.tsx`, `src/contexts/MatrixUnreadContext.tsx`, `src/contexts/MatrixClientContext.tsx`, `src/providers/AppProviders.tsx` | `strictNullChecks`, danach `noImplicitAny` | Typecheck grün, relevante Provider-/Context-Tests grün, keine neuen `@ts-ignore` | In Arbeit |
| 11 | `typecheck:services-features` (`tsconfig.services-features-strict.json`) | Alle Dateien unter `src/services/**` und `src/features/**` | `strictNullChecks` | Typecheck grün, relevante Service-/Feature-Tests grün, keine neuen `@ts-ignore` | In Arbeit |
| 12 | `typecheck:services-features-batch2` (`tsconfig.services-features-batch2-strict.json`) | `src/services/headerRenderer.ts`, `src/features/matrix-widget/api.ts`, `src/features/matrix-widget/types.ts` | `strictNullChecks`, danach `noImplicitAny` | Typecheck grün, relevante Service-/Feature-Tests grün, keine neuen `@ts-ignore` | In Arbeit |
| 13 | `typecheck:services-features-batch3` (`tsconfig.services-features-batch3-strict.json`) | `src/services/headerRenderer.ts`, `src/features/matrix-widget/types.ts` | `strictNullChecks`, danach `noImplicitAny`, danach `noUnusedLocals`/`noUnusedParameters` | Typecheck grün, relevante Service-/Feature-Tests grün, keine neuen `@ts-ignore` | In Arbeit |
| 14 | `typecheck:components-batch1` (`tsconfig.components-batch1-strict.json`) | `src/components/*`, `src/components/ui/**`, `src/components/shared/**`, `src/components/layout/**`, `src/components/navigation/**`, `src/components/widgets/**` | `strictNullChecks` | Typecheck grün, relevante Komponenten-Tests grün, keine neuen `@ts-ignore` | In Arbeit |
| 15 | `typecheck:components-batch2` (`tsconfig.components-batch2-strict.json`) | `src/components/appointments/**`, `calendar/**`, `contacts/**`, `tasks/**`, `documents/**`, `contact-import/**` | `strictNullChecks` | Typecheck grün, relevante Komponenten-Tests grün, keine neuen `@ts-ignore` | In Arbeit |
| 16 | `typecheck:components-batch3` (`tsconfig.components-batch3-strict.json`) | `src/components/letters/**`, `letter-templates/**`, `letter-pdf/**`, `meetings/**`, `chat/**`, `emails/**`, `dashboard/**`, `admin/**`, `administration/**` | `strictNullChecks` | Typecheck grün, relevante Komponenten-Tests grün, keine neuen `@ts-ignore` | In Arbeit |
| 17 | `typecheck:components-batch4` (`tsconfig.components-batch4-strict.json`) | `src/components/events/**`, `expenses/**`, `knowledge/**`, `drucksachen/**`, `press/**`, `stakeholders/**`, `my-work/**`, `account/**`, `announcements/**`, `celebrations/**`, `dayslip/**`, `employees/**`, `event-planning/**`, `karlsruhe/**`, `nodes/**`, `plugins/**`, `poll/**`, `timetracking/**`, `topics/**`, `task-decisions/**`, `task-detail/**`, `appointment-preparations/**`, `canvas-engine/**` | `strictNullChecks` | Typecheck grün, relevante Komponenten-Tests grün, keine neuen `@ts-ignore` | In Arbeit |
| 18 | `typecheck:components-toplevel` (`tsconfig.components-toplevel-strict.json`) | Top-Level-Dateien `src/components/*.ts` und `src/components/*.tsx` | `strictNullChecks` | Typecheck grün, relevante Komponenten-Tests grün, keine neuen `@ts-ignore` | In Arbeit |
| 19 | `typecheck:pages` (`tsconfig.pages-strict.json`) | Alle Dateien unter `src/pages/**` | `strictNullChecks` | Typecheck grün, relevante Seiten-Tests grün, keine neuen `@ts-ignore` | In Arbeit |
| 20 | `typecheck:pages-batch2` (`tsconfig.pages-batch2-strict.json`) | `src/pages/Administration.tsx`, `src/pages/Index.tsx`, `src/pages/NotificationsPage.tsx` | `strictNullChecks`, danach `noImplicitAny` | Typecheck grün, relevante Seiten-Tests grün, keine neuen `@ts-ignore` | In Arbeit |
| 21 | `typecheck:pages-batch3` (`tsconfig.pages-batch3-strict.json`) | `src/pages/PollGuest.tsx`, `src/pages/NotFound.tsx` | `strictNullChecks`, danach `noImplicitAny`, danach `noUnusedLocals`/`noUnusedParameters` | Typecheck grün, relevante Seiten-Tests grün, keine neuen `@ts-ignore` | In Arbeit |

## Fortschritt nach Verzeichnis

| Verzeichnis | TS/TSX-Dateien gesamt | Batch 1 (`strictNullChecks`) | Batch 2 (`noImplicitAny`) | Batch 3 (`noUnusedLocals`/`noUnusedParameters`) | Letztes Update |
|---|---:|---:|---:|---:|---|
| hooks (`src/hooks`) | 93 | 22 (23.7%) + 2 Knowledge + 3 Auth + 1 QuickNotes + 3 Notifications + 5 Dashboard | 47 (50.5%) + 2 Knowledge + 3 Auth + 1 QuickNotes + 3 Notifications + 5 Dashboard | 3 (3.2%) | 2026-03-18 |
| contexts/providers (`src/contexts`, `src/providers`) | 4 | 4 (100.0%) | 0 (0.0%) | 0 (0.0%) | 2026-03-18 |
| services-features (`src/services`, `src/features`) | 42 | 42 (100.0%) | 3 (7.1%) | 2 (4.8%) | 2026-03-18 |
| components (`src/components`) | n. a. (nach Batch-Zuschnitten gesteuert) | 5 Batch-Slices + Top-Level in Planung | 0 dedizierte `noImplicitAny`-Batches | 0 dedizierte `noUnused*`-Batches | 2026-03-18 |
| pages (`src/pages`) | 22 | 22 (100.0%) | 3 (13.6%) | 2 (9.1%) | 2026-03-18 |

## Pflegeprozess nach Batch-Abschluss

Nach jedem abgeschlossenen Batch wird dieses Dokument wie folgt aktualisiert:

1. Status des betroffenen Batches auf `Abgeschlossen` setzen.
2. Konkretes Abschlussdatum ergänzen.
3. Fortschrittszahlen im Abschnitt „Fortschritt nach Verzeichnis“ anpassen.
4. Falls Folgearbeiten übrig bleiben, diese als nächste Batch-Kandidaten oder Datei-Follow-ups dokumentieren.
