# Performance- & Egress-Audit – Mai 2026

Stand: Beginn der Optimierungsschleife laut `.lovable/plan.md` (Schritt 1).

## Methodik
- `rg`-Scans über `src/` für: `select('*')`, `useQuery`-Hooks ohne `staleTime`, `supabase.channel`-Subscriptions, `lucide-react`-Importmuster.
- React-Query-Heuristik: nur Hooks, die unter `useQuery({ … })` laufen, profitieren von `staleTime`/`gcTime`.
- Realtime-Heuristik: jeder Channel braucht eindeutige Bezeichnung (`crypto.randomUUID()`), tenant-/user-scoped Filter und 250 ms Debounce.

## Kennzahlen vor Optimierung
| Bereich | Wert |
| --- | --- |
| Dateien mit `useQuery` | 57 |
| `.select('*')`-Stellen | 72 |
| Dateien mit `supabase.channel` | 7 (alle bereits mit `crypto.randomUUID()` benannt) |
| Dateien mit `lucide-react` Import | 572 (alle Named-Imports — Tree-Shake OK) |

## Hotspot-Liste – `select('*')` (Top 20 nach Häufigkeit/Impact)
1. `src/hooks/useNotifications.tsx` — bereits explizit, kein Treffer
2. `src/hooks/useGlobalNoteSharing.tsx` — 2 Stellen, läuft beim App-Start
3. `src/hooks/useNoteSharing.tsx` — pro Notiz beim Detail-Load
4. `src/hooks/useAppointmentPreparation.tsx` — beim Termindialog
5. `src/hooks/useAppointmentFeedback.tsx` — pro Termin
6. `src/hooks/useDistrictNotes.tsx` — Wahlkreis-Karte
7. `src/hooks/useElectionDistricts.tsx` — Wahlkreis-Karte
8. `src/hooks/useContactBriefingMemory.ts` — pro Kontakt
9. `src/hooks/useCelebrationSettings.ts` — pro Login
10. `src/hooks/useMapFlagTypes.tsx` — Karte
11. `src/components/expenses/hooks/useExpenseData.ts` — Auslagenformular
12. `src/components/event-planning/useEventPlanningData.ts` — 2 Planungs-Subqueries
13. `src/components/dashboard/TodaySchedule.tsx` — Dashboard-Hot-Path
14. `src/components/dashboard/TasksSummary.tsx` — Counts (kann head:true bleiben)
15. `src/components/emails/EmailHistory.tsx` — 2 Listenansichten
16. `src/components/emails/hooks/useEmailComposer.ts` — Verteiler-Counts
17. `src/components/notifications/NotificationSettings.tsx` — Settings-Page (2x)
18. `src/utils/letterDOCXGenerator.ts` / `letterPDFGenerator.ts` — 7 Stellen, einmal pro Export, geringer Egress aber langsam
19. `src/features/timetracking/components/AnnualTasksView.tsx` — Adminliste
20. `src/components/administration/MeetingTemplateManager.tsx` — Adminliste

## Realtime-Channels
Alle 7 nutzen bereits `crypto.randomUUID()`. Keine Doppel-Subscriptions identifiziert. ✅

## React Query
Stichproben (`useTodayBriefings`, `useMyDraftBriefing`, Dossiers, Facts) zeigen konsistent gesetzte `staleTime` (30–60 s). Keine systematische Lücke.

## Bundle-Hotspots (geplant)
Wird im Folgeschritt mit `scripts/report-bundle-size.mjs` ergänzt.

## Quick-Fix-Plan (umgesetzt im selben Commit)
- Explizite Spalten in 10 Hot-Path-Hooks (Liste oben Punkt 2–13).
- Letter-Export-Helper bleiben mit `*`, da OneShot-Use mit hoher Spaltenabdeckung — kein Egress-Hotspot.
- TasksSummary-Counts bleiben (`count: 'exact', head: true` lädt keine Zeilen).

## Nicht im Quick-Fix-Set (Folge-Tickets)
- Vollständige Migration aller 72 `select('*')`-Stellen.
- `react-query`-Devtools im Dev-Build aktivieren, Cache-Hit-Rate messen.
- Profiler-Pass auf Dashboard / Kalender / Vorgänge.
- Bundle-Splitting Lexical-Plugins, Letter-Designer, Map-Layer, Recharts.
