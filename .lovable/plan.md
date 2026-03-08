

# Code-Bereinigung

Basierend auf der Analyse gibt es drei Hauptbereiche zum Bereinigen:

---

## 1. Console.log-Statements entfernen (~2.640 in 77 src-Dateien)

Die groessten Verursacher im `src/`-Ordner:

| Datei | Anzahl (ca.) | Inhalt |
|-------|-------------|--------|
| `DocumentsView.tsx` | ~12 | Template-Debug-Logs |
| `CustomizableDashboard.tsx` | ~8 | Layout/Widget-Debug |
| `SimpleLeafletMap.tsx` | ~8 | Karten-Debug |
| `ReviewAssignmentDialog.tsx` | ~6 | Assignment-Debug |
| `InlineMeetingParticipantsEditor.tsx` | ~8 | Teilnehmer-Debug |
| `shared/QuickNotesList.tsx` | ~6 | Archiv/Follow-up-Debug |
| `useGlobalNoteSharing.tsx` | ~8 | Share-Debug |
| `useNewItemIndicators.tsx` | ~4 | Indicator-Debug |
| `useNotifications.tsx` | ~8 | Push-Debug |
| `useAutoSave.tsx` | ~2 | Auto-Save-Debug |
| `UserSelector.tsx` | ~2 | Fetch-Debug |
| `ui/multi-select-simple.tsx` | ~1 | Render-Debug (besonders schlecht -- loggt bei jedem Render!) |
| `dashboard/GridDebugOverlay.tsx` | ~2 | Grid-Debug |
| `utils/pdfParser.ts` | ~40+ | PDF-Parsing-Debug |
| `utils/dashboard/weatherApi.ts` | ~6 | Wetter-Debug |

**Vorgehen**: Alle `console.log` in `src/` entfernen oder durch `debugConsole` ersetzen. `console.error` und `console.warn` bei tatsaechlichen Fehlern beibehalten. In Edge Functions (`supabase/functions/`) bleiben die Logs -- dort sind sie fuer Server-Debugging nuetzlich.

---

## 2. Verbleibende `select('*')` optimieren (~240 in 29 Dateien)

Die wichtigsten Kandidaten:

| Datei | Tabelle | Aktion |
|-------|---------|--------|
| `ExpenseManagement.tsx` | `expense_categories`, `expense_budgets` | Explizite Spalten |
| `SettingsView.tsx` | `profiles` | Explizite Spalten |
| `EditContact.tsx` | `contacts` | Explizite Spalten |
| `EmployeeYearlyStatsView.tsx` | `employee_yearly_stats` | Explizite Spalten |
| `MatrixSettings.tsx` | `matrix_subscriptions` | Explizite Spalten |
| `EmailHistory.tsx` | `email_logs`, `scheduled_emails` | Explizite Spalten |
| `AdminTimeTrackingView.tsx` | `time_entries`, `time_entry_corrections` | Explizite Spalten |
| `useCaseFileDetails.tsx` | `case_item_interactions` | Explizite Spalten |
| `useTeamAnnouncements.ts` | `team_announcements` | Explizite Spalten |
| `useNoteSharing.tsx` | `quick_note_shares` | Explizite Spalten |
| `MyWorkCaseItemsTab.tsx` | `case_items` | Explizite Spalten |
| `AnnualTasksView.tsx` | `annual_tasks` | Explizite Spalten |

---

## 3. Test-/Debug-Komponenten bereinigen

Folgende Dateien sind reine Test-/Debug-Komponenten, die in der Produktion nichts verloren haben:

- `EventPlanningViewTest.tsx` -- Test-Variante der EventPlanningView
- `UnicornAnimationTest.tsx` -- Einhorn-Animation-Test
- `GridDebugOverlay.tsx` -- Debug-Overlay fuer Dashboard-Grid

Diese sollten entweder entfernt oder hinter ein Debug-Flag gestellt werden (wie `debugConsole`).

Die folgenden Test-Komponenten sind in der **Administration** eingebunden und dort sinnvoll (Push-Notification-Debugging):
- `DirectPushTest.tsx`, `PushNotificationTest.tsx`, `VapidKeyTest.tsx` -- bleiben in Admin
- `CalendarSyncDebug.tsx` -- bleibt als Admin-Debug-Tab
- `CreateDemoUsers.tsx` -- bleibt als Admin-Tool

---

## Zusammenfassung

| Massnahme | Dateien | Effekt |
|-----------|---------|--------|
| Console.log entfernen/ersetzen | ~77 Dateien in src/ | Saubere Konsole, weniger Noise |
| `select('*')` → explizite Spalten | ~12 Dateien | Weniger Egress, schnellere Queries |
| Test-Komponenten bereinigen | 3 Dateien | Kleinerer Bundle |

Alle Aenderungen sind funktionsneutral.

