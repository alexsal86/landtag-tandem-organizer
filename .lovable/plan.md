

# Umsetzungsplan: Build-Fix + Drag & Drop + Kontextmenü + Verknüpfungsanzeige

## 1. Build-Fehler beheben
Das `else`-Branch der ternären Verzweigung (Zeile 465-808) hat zwei Geschwister-Elemente (`<div>` Grid + Dialoge) ohne gemeinsamen Wrapper. Fix: In ein Fragment `<>...</>` wrappen.

## 2. Drag & Drop: Vorgänge auf FallAkten ziehen
- `@hello-pangea/dnd` ist bereits installiert
- `DragDropContext` umschließt das gesamte Grid
- Jeder Vorgang in der linken Spalte wird `<Draggable>` mit einem Drag-Handle (`GripVertical`-Icon)
- Jede FallAkte in der rechten Spalte wird `<Droppable>` mit `droppableId="casefile-{id}"`
- Beim Hover während Drag: blauer Rand + Hinweistext "Vorgang hier ablegen zum Verknüpfen"
- `onDragEnd`: extrahiert `caseFileId` aus `droppableId`, führt `supabase.from("case_items").update({ case_file_id })` aus + lokales State-Update + Toast

## 3b. Kontextmenü (Rechtsklick) auf Vorgängen
- Verwendet bestehende `ContextMenu`-Komponente aus `src/components/ui/context-menu.tsx`
- Drei Untermenüs:
  - **Status ändern** → Submenu mit: Offen, In Bearbeitung, Wartend, Gelöst, Geschlossen (aktueller Status hervorgehoben)
  - **Priorität ändern** → Submenu mit farbigen Kreisen: Niedrig/Mittel/Hoch/Dringend
  - **Akte zuordnen** → Submenu mit Liste aller FallAkten (max 20), plus "Verknüpfung lösen" wenn bereits verknüpft
- Jede Aktion: direkter `supabase.update()` + lokales State-Update + Toast-Feedback

## 3c. Verknüpfungsanzeige
- Verknüpfte Vorgänge zeigen neben dem Betreff ein kleines `Link2`-Icon in Blau
- Tooltip (via `TooltipProvider`) zeigt Aktenname + Aktenzeichen
- FallAkten zeigen farbige Status-Badges (Offen=grün, In Bearbeitung=blau, Geschlossen=grau)
- Hinweistext unter dem Vorgänge-Header: "Vorgänge auf eine FallAkte ziehen, um sie zu verknüpfen"

## Technische Details
Alle Änderungen in einer einzigen Datei: `src/components/my-work/MyWorkCasesWorkspace.tsx`

**Neue Imports:**
- `DragDropContext, Droppable, Draggable` aus `@hello-pangea/dnd`
- `ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuSub, ContextMenuSubContent, ContextMenuSubTrigger, ContextMenuTrigger` aus `@/components/ui/context-menu`
- `Tooltip, TooltipContent, TooltipProvider, TooltipTrigger` aus `@/components/ui/tooltip`
- `GripVertical, Link2` aus `lucide-react`
- `toast` aus `sonner`

**Neue Handler-Funktionen:**
- `handleQuickStatusChange(item, newStatus)` — update + lokales State + Toast
- `handleQuickPriorityChange(item, newPriority)` — update + lokales State + Toast
- `handleQuickLinkToFile(item, caseFileId)` — update + lokales State + Toast
- `handleUnlinkFromFile(item)` — set `case_file_id: null` + Toast
- `handleDragEnd(result)` — prüft `destination.droppableId`, ruft `handleQuickLinkToFile` auf

**Neue Hilfsfunktion:**
- `caseFileStatusBadge(status)` — gibt farbiges Badge zurück

**Grid-Spaltenänderung:** Header und Zeilen bekommen eine zusätzliche 28px-Spalte am Anfang für das Drag-Handle.

