

## Plan: Alle 3 Verbesserungen umsetzen

### Teil 1: Hook-Tests erstellen (useTaskOperations, useMeetingsData, useDocumentsData)

Gleiche Test-Architektur wie die bestehenden useAuth/useTenant Tests: `vi.hoisted` für Supabase-Mock, `renderHook` mit Provider-Wrapper.

**`src/components/tasks/hooks/__tests__/useTaskOperations.test.ts`**
- Test: `toggleTaskStatus` setzt Status auf "completed", archiviert und löscht Task
- Test: `toggleTaskStatus` setzt "completed" zurück auf "todo"
- Test: `addComment` fügt Kommentar hinzu und lädt Comments neu
- Test: `snoozeTask` erstellt/aktualisiert Snooze-Eintrag
- Mock-Setup: `useAuth`, `useTenant`, plus die übergebenen Callback-Funktionen (loadTasks etc.)

**`src/components/meetings/hooks/__tests__/useMeetingsData.test.ts`**
- Test: Initiales Laden der Meetings bei vorhandenem User/Tenant
- Test: Leere Meetings-Liste bei fehlendem Tenant
- Test: Profile-Laden
- Mock-Setup: `useAuth`, `useTenant`, `useSearchParams`, `useNotificationHighlight`

**`src/components/documents/hooks/__tests__/useDocumentsData.test.ts`**
- Test: `fetchDocuments` lädt Dokumente für aktiven Tenant
- Test: `fetchLetters` wird bei activeTab="letters" aufgerufen
- Test: `fetchFolders` liefert Ordner mit documentCount
- Test: Error-Toast bei fehlgeschlagenem Laden

### Teil 2: `catch (error: any)` → `catch (error: unknown)` (Batch 2)

51 Dateien mit 665 Vorkommen. Umstellung in Gruppen:

**Gruppe A – Components mit vielen catch-Blöcken** (~30 Dateien):
- `useTaskOperations.ts` (6x), `useCaseFileDetails.tsx` (5x), `EmployeeMeetingProtocol.tsx` (6x)
- `EmailHistory.tsx`, `DocumentContactManager.tsx`, `DefaultGuestsAdmin.tsx`
- `ConfigurableTypeSettings.tsx`, `DocumentCategoryAdminSettings.tsx`, `NewUserForm.tsx`
- `TaskDecisionResponse.tsx`, `AnnualTasksView.tsx`
- Alle weiteren Dateien in `src/components/`

**Gruppe B – Features** (2 Dateien):
- `useCaseItems.tsx`, `useCaseFileDetails.tsx`

**Pattern**: Wo `error.message` oder `error.code` verwendet wird:
```typescript
catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  // für error.code: 
  const code = error && typeof error === 'object' && 'code' in error ? (error as {code: string}).code : '';
}
```

Spezialfall `useCaseFileDetails.tsx`: Prüft `error.code === '23505'` für Duplikat-Erkennung – hier brauchen wir den `code`-Zugriff über Type-Guard.

### Teil 3: Interface-Bereinigung (selektiv)

Nur die klarsten Fälle, die direkt Typ-Sicherheit verbessern:

1. **`useTasksData.ts` Zeile 154**: `(comment.profiles as any)?.display_name` – Supabase Join liefert hier ein Objekt. Fix: Type-Assert auf `{ display_name: string }` statt `any`.

2. **`useTasksData.ts` Zeile 258**: `mappedChildTasks as any` bei `setSubtasks` – das gemappte Array passt nicht zum `Subtask`-Interface. Fix: fehlende Felder (`result_text`, `completed_at`) explizit setzen.

3. **`useTaskOperations.ts` Zeilen 65/87**: `archived_tasks.insert({...} as any)` – die Insert-Payloads haben Felder die nicht im DB-Type sind (`auto_delete_after_days`). Fix: Feld entfernen wenn es nicht in der DB existiert, oder nur DB-konforme Felder senden.

4. **`useMeetingsData.ts`**: `tasks: any[]`, `linkedQuickNotes: any[]`, etc. – diese State-Variablen brauchen richtige Interfaces statt `any[]`. Fix: Interfaces in `meetings/types.ts` definieren.

### Umsetzungsreihenfolge

1. Tests erstellen (3 Dateien) – unabhängig vom Rest
2. `catch (error: any)` Batch 2 (51 Dateien) – mechanische Umstellung
3. Interface-Bereinigung (4 Dateien) – gezielte Fixes

Geschätzter Umfang: ~55 Datei-Änderungen, ~665 `any`-Entfernungen, 3 neue Testdateien.

