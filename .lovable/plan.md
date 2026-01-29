

# Plan: Quick Notes - Bottom Bar Korrektur

## Das Problem

Anhand deiner Bilder sehe ich jetzt genau das Problem:

**Aktueller Zustand (falsch):**
```
┌─────────────────────────────────────────────────────────────────────────┐
│ Titel                                                             [⋮]  │
│ Beschreibung Text...→                                                   │
│                                                              > Details  │  ← DIESES Element (NoteLinkedDetails) 
│ ■ ■ ■ ■                                                                 │     steht SEPARAT und IMMER sichtbar
│                              [→ Details | ✏️ ☑️ 🗳️ ≡] (nur bei Hover)  │
└─────────────────────────────────────────────────────────────────────────┘
```

**Gewünschter Zustand:**
```
Ohne Hover:
┌─────────────────────────────────────────────────────────────────────────┐
│ Titel                                                             [⋮]  │
│ Beschreibung Text...→                                                   │
│                                                                         │
│ ■ ■ ■ ■                                                         [>]    │
└─────────────────────────────────────────────────────────────────────────┘
              ↑ gleiche Zeile und Höhe ↑                      ↑ nur ">" ↑

Mit Hover:
┌─────────────────────────────────────────────────────────────────────────┐
│ Titel                                                             [⋮]  │
│ Beschreibung Text...→                                                   │
│                                                                         │
│ [Aufgabe→] [Entscheidung→] [JF→]     [→ Details | ✏️ ☑️ 🗳️ 🕐 📅 ≡]   │
└─────────────────────────────────────────────────────────────────────────┘
                                        ↑ "→ Details" öffnet die Collapsible
```

---

## Ursache

Es gibt **zwei separate Elemente**, die "Details" anzeigen:

1. **`NoteLinkedDetails` Komponente** (Zeilen 1594-1601 in QuickNotesList.tsx)
   - Ein separates Collapsible
   - Zeigt "> Details" in grau IMMER an (nicht nur beim Hover)
   - Steht unterhalb der Cards, nicht in der Bottom-Bar

2. **"→ Details" Button in der UNIFIED BOTTOM BAR** (Zeilen 1212-1223)
   - Erscheint nur beim Hovern
   - Ruft `toggleNoteExpand()` auf - was die BESCHREIBUNG erweitert, nicht die verknüpften Details!

---

## Lösung

### Schritt 1: `NoteLinkedDetails` Collapsible-Trigger entfernen, Inhalt behalten

Die Komponente `NoteLinkedDetails` behält den CollapsibleContent (Task/Decision/Meeting Details), aber der Trigger wird entfernt. Der Trigger-State wird von außen gesteuert.

**Datei: `src/components/shared/NoteLinkedDetails.tsx`**

```typescript
interface NoteLinkedDetailsProps {
  taskId?: string | null;
  decisionId?: string | null;
  meetingId?: string | null;
  isExpanded: boolean;  // ← NEU: Von außen gesteuert
}

export function NoteLinkedDetails({ taskId, decisionId, meetingId, isExpanded }: NoteLinkedDetailsProps) {
  const hasLinks = taskId || decisionId || meetingId;
  
  if (!hasLinks) return null;
  
  // KEIN interner State mehr, KEIN CollapsibleTrigger
  // Nur der Content, der von isExpanded gesteuert wird
  return (
    <Collapsible open={isExpanded}>
      <CollapsibleContent className="pt-2 space-y-2" onClick={(e) => e.stopPropagation()}>
        {/* Task Status */}
        {taskId && (
          <div className="p-2 bg-blue-50 ...">
            ...
          </div>
        )}
        {/* Decision Status */}
        {decisionId && (...)}
        {/* Meeting Status */}
        {meetingId && (...)}
      </CollapsibleContent>
    </Collapsible>
  );
}
```

### Schritt 2: State für expandierte Details in `QuickNotesList.tsx`

**Neuer State für Details-Expansion (nicht für Beschreibung!):**
```typescript
const [expandedDetails, setExpandedDetails] = useState<Set<string>>(new Set());

const toggleDetailsExpand = (noteId: string, e: React.MouseEvent) => {
  e.stopPropagation();
  setExpandedDetails(prev => {
    const newSet = new Set(prev);
    if (newSet.has(noteId)) {
      newSet.delete(noteId);
    } else {
      newSet.add(noteId);
    }
    return newSet;
  });
};
```

### Schritt 3: UNIFIED BOTTOM BAR anpassen

```typescript
{/* UNIFIED BOTTOM BAR */}
<div className="absolute bottom-2 left-3 right-3 flex items-center justify-between gap-2">
  {/* LEFT: Status indicators */}
  <div className="flex items-center gap-2 flex-1 min-w-0">
    {/* Small squares - visible when NOT hovering */}
    <div className="flex items-center gap-1.5 group-hover:hidden">
      {note.task_id && <div className="w-1.5 h-1.5 bg-blue-500" />}
      {note.decision_id && <div className="w-1.5 h-1.5 bg-purple-500" />}
      {note.meeting_id && <div className="w-1.5 h-1.5 bg-emerald-500" />}
      {hasShared && <div className="w-1.5 h-1.5 bg-violet-500" />}
    </div>
    
    {/* Full badges - visible on hover */}
    <div className="hidden group-hover:flex items-center gap-1.5 flex-wrap">
      {/* ... NoteLinkedBadge components ... */}
    </div>
  </div>
  
  {/* RIGHT: ">" (default) / "→ Details | Icons" (hover) - ALLE IN EINER ZEILE */}
  <div className="flex items-center gap-1 flex-shrink-0">
    {/* Simple ">" - visible when NOT hovering, only if linked items exist */}
    {hasLinkedItems && (
      <span className="text-sm text-muted-foreground group-hover:hidden">›</span>
    )}
    
    {/* "→ Details" + Icons - visible on hover */}
    <div className={cn(
      "flex items-center gap-1",
      "hidden group-hover:flex"  // ← GEÄNDERT: hidden/flex statt opacity
    )}>
      {/* "→ Details" button - öffnet jetzt die VERKNÜPFTEN DETAILS, nicht die Beschreibung */}
      {hasLinkedItems && (
        <>
          <button 
            className="text-xs text-muted-foreground hover:text-foreground flex items-center"
            onClick={(e) => toggleDetailsExpand(note.id, e)}  // ← NEU: toggleDetailsExpand
          >
            <ChevronRight className={cn(
              "h-3 w-3 transition-transform",
              isDetailsExpanded && "rotate-90"
            )} />
            <span className="ml-0.5">Details</span>
          </button>
          {note.user_id === user?.id && (
            <div className="h-4 w-px bg-border mx-1" />
          )}
        </>
      )}
      
      {/* Quick action icons */}
      {note.user_id === user?.id && (
        <TooltipProvider>
          <div className="flex items-center gap-1">
            {/* Edit, Task, Decision, etc. */}
          </div>
        </TooltipProvider>
      )}
    </div>
  </div>
</div>
```

### Schritt 4: NoteLinkedDetails mit externem State verbinden

```typescript
{/* Collapsible Details for linked items */}
{hasLinkedItems && (
  <NoteLinkedDetails 
    taskId={note.task_id} 
    decisionId={note.decision_id} 
    meetingId={note.meeting_id}
    isExpanded={expandedDetails.has(note.id)}  // ← NEU: Von außen gesteuert
  />
)}
```

---

## Zusammenfassung der Änderungen

| Datei | Änderung |
|-------|----------|
| `src/components/shared/NoteLinkedDetails.tsx` | CollapsibleTrigger entfernen, `isExpanded` Prop hinzufügen |
| `src/components/shared/QuickNotesList.tsx` | Neuer `expandedDetails` State, "→ Details" Button ruft `toggleDetailsExpand` auf |

---

## Visuelles Ergebnis

**Standard (kein Hover):**
- Farbige Quadrate links unten
- ">" rechts unten (gleiche Zeile)

**Mit Hover:**
- Badges links unten (Aufgabe→, Entscheidung→, etc.)
- "→ Details | ✏️ ☑️ 🗳️ 🕐 📅 ≡" rechts unten (gleiche Zeile)
- Klick auf "→ Details" öffnet die Task/Decision/Meeting Infos unter der Card

---

## Geschätzter Aufwand

| Änderung | Zeit |
|----------|------|
| NoteLinkedDetails Props ändern | 5 Min |
| QuickNotesList State + Button | 15 Min |
| Testen | 5 Min |
| **Gesamt** | **~25 Min** |

