

## Zwei Aufgaben

### 1. Umbenennung: "FallAkte" → "Fallakte" (durchgehend)

Alle sichtbaren UI-Strings in **24 Dateien** ändern, in denen "FallAkte" oder "FallAkten" vorkommt. Beispiele:

- "FallAkten" → "Fallakten"
- "FallAkte" → "Fallakte"
- "FallAkten-Typen" → "Fallakten-Typen"

Betrifft unter anderem:
- `navigationConfig.ts`, `Navigation.tsx`, `AppHeader.tsx`, `GlobalSearchCommand.tsx`
- `AdminSidebar.tsx`, `TopicSettings.tsx`, `CaseFileTypeSettings.tsx`, `Administration.tsx`
- `MyWorkCasesWorkspace.tsx`, `CaseItemDetailPanel.tsx`
- `CaseFileCreateDialog.tsx`, `CaseFileEditDialog.tsx`, `CaseFileDetail.tsx`
- `CaseFileNextSteps.tsx`, `CaseFileSelector.tsx`, `CaseFileCard.tsx`
- `useCaseFiles.tsx`, `useCaseFileTypes.tsx`
- `MyWorkCaseFilesTab.tsx`
- und weitere

Nur UI-Strings (Labels, Toasts, Descriptions) — keine Code-Bezeichner (Variablennamen, Interfaces, etc.).

### 2. Rechte Spalte "Fallakten" in Vorgänge: Letzte 5 + Typ-Gruppierung

In `MyWorkCasesWorkspace.tsx` die Darstellung der `filteredCaseFiles` umstrukturieren:

**Logik (neues `useMemo`):**
1. Die gefilterten Akten nach `updated_at` sortieren
2. Die ersten 5 als "Zuletzt bearbeitet"-Gruppe abtrennen
3. Die restlichen nach `case_type` gruppieren (Map von Typ-Name → Akten-Array)

**Darstellung:**
1. **"Zuletzt bearbeitet"** — immer sichtbar, zeigt die 5 zuletzt geänderten Akten
2. **Pro Typ eine Collapsible-Gruppe** — Header zeigt Typ-Label + Anzahl, per Klick auf-/zuklappbar (standardmäßig zugeklappt). Verwendet die bestehende `Collapsible`-Komponente.

```text
┌─ Fallakten ─────────── [+ Neu] [🔍 Filtern] ┐
│                                               │
│  Zuletzt bearbeitet                           │
│  ├─ Akte A                                    │
│  ├─ Akte B                                    │
│  └─ ...                                       │
│                                               │
│  ▸ Beschwerde (3)                             │
│  ▸ Anfrage (7)                                │
│  ▸ Projekt (2)                                │
└───────────────────────────────────────────────┘
```

Die `caseFileTypes` sind bereits über den Hook `useCaseFileTypes` verfügbar und liefern `label` und `color` pro Typ. Die CaseFile-Objekte haben `updated_at` und `case_type`.

**Dateien:**
- `MyWorkCasesWorkspace.tsx` — Gruppierungslogik + Collapsible-Rendering
- Alle 24 Dateien — String-Umbenennung

