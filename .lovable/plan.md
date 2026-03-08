

## Plan: TypeScript-Qualität verbessern – Batch 1

### Ziel
Die schlimmsten `any`-Casts systematisch entfernen, aufgeteilt in 3 Kategorien nach Impact.

### Kategorie 1: `.from('table' as any)` entfernen (16 Dateien, 81 Vorkommen)

Alle betroffenen Tabellen (`user_sessions`, `case_file_processing_statuses`, `case_file_status_history`, `case_item_notes`, `letter_template_settings`, `case_items`) existieren bereits in den generierten Supabase-Types. Die `as any` Casts sind überflüssig und verhindern Typ-Prüfung der Query-Ergebnisse.

**Dateien:**
- `src/hooks/useAuth.tsx` (4x `user_sessions as any`)
- `src/hooks/useCaseFileProcessingStatuses.tsx` (1x)
- `src/features/cases/files/components/CaseFileCurrentStatus.tsx` (2x `case_file_status_history as any`)
- `src/components/letters/LetterLayoutCanvasDesigner.tsx` (1x `letter_template_settings as any`)
- `src/features/cases/items/components/MyWorkCaseItemsTab.tsx` (1x `case_items as any`)
- `src/components/meetings/hooks/useMeetingArchive.ts` (2x `case_item_notes as any`, `tasks as any[]`)
- `src/components/my-work/MyWorkCasesWorkspace.tsx` (~6x `.update({...} as any)`)
- `src/components/account/ActiveSessionsCard.tsx` (falls noch vorhanden)
- Verbleibende Dateien aus den 16 Treffern

**Aktion:** `as any` entfernen, ggf. Payload-Typen korrigieren wo TypeScript dann Fehler meldet.

### Kategorie 2: `catch (error: any)` → `catch (error: unknown)` (73 Dateien, 870 Vorkommen)

In diesem Batch die **20 meistgenutzten Dateien** umstellen. Pattern:

```typescript
// Vorher:
catch (error: any) {
  toast({ description: error.message });
}

// Nachher:
catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  toast({ description: message });
}
```

**Prioritäre Dateien** (höchste Anzahl an catch-Blöcken):
- `useMeetingsData.ts`, `useEmailComposer.ts`, `MyWorkCasesWorkspace.tsx`
- `useMeetingCreate.ts`, `useTimeTrackingOperations.ts`
- `useDocumentsData.ts`, `useTasksData.ts`, `useAuth.tsx`
- `LetterStatusWorkflow.tsx`, `EmailTemplateManager.tsx`

### Kategorie 3: Sonstige `as any` auf Supabase-Daten (selektiv)

Nur die klarsten Fälle in diesem Batch:
- `useTasksData.ts`: `(comment.profiles as any)?.display_name` → korrekten Join-Typ nutzen
- `AnnualTasksView.tsx`: `supabase.rpc('...' as any)` → prüfen ob RPC in Types vorhanden
- `useEmployeeOperations.ts`: `status: newStatus as any` → DB-Enum-Typ nutzen
- `useTimeTrackingOperations.ts`: `status: newStatus as any` → DB-Enum-Typ nutzen

### Nicht in diesem Batch
- `catch (error: any)` in den übrigen ~50 Dateien (Folge-Batch)
- `as any` auf Leaflet/externe Libraries (bewusst behalten)
- `: any` Typ-Annotationen auf lokalen Variablen (separates Projekt)
- `zodResolver(...) as any` (bekanntes Kompatibilitätsproblem)

### Geschätzter Umfang
~25 Dateien, ~150 einzelne `any`-Entfernungen. Kein funktionaler Impact, rein typsicherheitsgetrieben.

