# Virtual-List Migrations-Plan (Phase 6 / Track A)

`@tanstack/react-virtual` ist installiert. Wiederverwendbarer Wrapper liegt unter `src/components/shared/VirtualList.tsx`.

## Migrationsziele (alle > 200 Zeilen typisch)

| Liste | Datei | Item-Höhe | Status |
| --- | --- | --- | --- |
| Vorgänge-Liste | `src/features/cases/items/components/CaseItemsRow.tsx` (Parent: Workspace) | ~64 px | TODO |
| Kontakte-Liste | `src/features/contacts/components/...List.tsx` | ~56 px | TODO |
| Dokumente-Liste | `src/features/documents/components/DocumentsView.tsx` | ~48 px | TODO |
| MyWork-Tasks | `src/features/dashboard/components/MyWorkView.tsx` | ~72 px | TODO |

## Pattern

```tsx
import { VirtualList } from "@/components/shared/VirtualList";

<VirtualList
  items={tasks}
  estimateSize={72}
  getItemKey={(t) => t.id}
  height="calc(100vh - 200px)"
  renderItem={(task) => <TaskRow task={task} />}
/>
```

## Caveats
- `contain: strict` setzt der Container — eltern dürfen kein `overflow: visible` erwarten.
- Bei dynamischen Höhen ruft TanStack `measureElement` automatisch — keine extra Logik nötig.
- Drag-and-Drop (`@hello-pangea/dnd`) ist mit Virtual-Listen schwierig: vor Migration prüfen ob die Liste D&D nutzt. Falls ja, separater Spike.
- Sticky Header / Group-Headers: zusätzliches Konzept (z. B. Index-Lookup) — nicht Teil dieses Helpers.

## Rollout
Pro Liste ein eigener PR mit visueller Validierung (Scroll-Performance, Tastatur-Navigation, Filter).
