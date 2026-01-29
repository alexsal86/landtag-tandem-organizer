
# Plan: UI-Feinabstimmung der Quick Notes Cards

## Übersicht der 9 Punkte

| # | Problem | Lösung |
|---|---------|--------|
| 1 | Indikatoren sind Kreise statt Quadrate | `rounded-sm` → keine Rundung, größer (w-1.5 h-1.5), mehr Abstand (mt-3) |
| 2 | Anzahl der Notizen neben dem Level entfernen | Badge mit `{group.notes.length}` entfernen (Zeile 1539-1541) |
| 3+4 | Shared-Badge rechts statt bei Indikatoren | Share-Badge von Metadata-Zeile nach unten zu farbigen Indikatoren verschieben |
| 5 | Expand-Pfeil nach Beschreibung, dicker, rechts | Pfeil nach drei Punkten, `ArrowRight` Icon, `strokeWidth={2.5}` |
| 6 | Details-Button zeigt ">" → "> Details" bei Hover | Nur Pfeil standardmäßig, "Details" bei Hover sichtbar |
| 7 | Draggable nach rechts, keine Box, schönere Icons | Handle am Ende, keine Hintergrund-Box, einzelne Icons |
| 8 | Hover-Icons überdecken Details-Button | Hover-Icons nach oben rechts statt unten rechts |
| 9 | Pinned-Indicator kreativ gestalten | Goldene Ecke oben rechts bei gepinnten Notizen |

---

## 1. Farbige Indikatoren: Quadrate statt Kreise, größer, mehr Abstand

**Änderung in `renderNoteCard` (Zeilen 1033-1055):**

```typescript
{/* Status Indicators - small colored squares */}
{(hasLinkedItems || hasShared) && (
  <div className="flex items-center gap-2 mt-3">
    {/* Small squares - visible when not hovering card */}
    <div className="flex items-center gap-1.5 group-hover:hidden">
      {note.task_id && (
        <div 
          className="w-1.5 h-1.5 bg-blue-500" 
          title="Aufgabe"
        />
      )}
      {note.decision_id && (
        <div 
          className="w-1.5 h-1.5 bg-purple-500" 
          title="Entscheidung"
        />
      )}
      {note.meeting_id && (
        <div 
          className="w-1.5 h-1.5 bg-emerald-500" 
          title="Jour Fixe"
        />
      )}
      {/* Shared indicator als Quadrat */}
      {((note.share_count || 0) > 0 || (note.is_shared && note.owner)) && (
        <div 
          className="w-1.5 h-1.5 bg-violet-500" 
          title="Geteilt"
        />
      )}
    </div>
    
    {/* Full badges on hover */}
    <div className="hidden group-hover:flex items-center gap-1.5">
      {note.task_id && (
        <NoteLinkedBadge type="task" id={note.task_id} label="Aufgabe" />
      )}
      {/* ... rest of badges including shared badge ... */}
    </div>
  </div>
)}
```

---

## 2. Anzahl der Notizen neben Level entfernen

**Änderung (Zeilen 1539-1541 entfernen):**

```typescript
// VORHER:
<div className="flex items-center gap-2 mb-2">
  {group.level > 0 && (
    <span className="text-amber-500 text-sm">
      {'★'.repeat(group.level)}
    </span>
  )}
  <span className="text-xs font-medium text-muted-foreground">
    {group.label}
  </span>
  <Badge variant="secondary" className="text-xs px-1.5 py-0">  // ← ENTFERNEN
    {group.notes.length}                                        // ← ENTFERNEN
  </Badge>                                                      // ← ENTFERNEN
</div>

// NACHHER:
<div className="flex items-center gap-2 mb-2">
  {group.level > 0 && (
    <span className="text-amber-500 text-sm">
      {'★'.repeat(group.level)}
    </span>
  )}
  <span className="text-xs font-medium text-muted-foreground">
    {group.label}
  </span>
</div>
```

---

## 3 & 4. Shared-Badges zu den Indikatoren verschieben

**Aus der Metadata-Zeile entfernen (Zeilen 1286-1326) und nach unten verschieben:**

Die Shared-Badges werden:
1. Aus der rechten Metadata-Zeile (1286-1326) entfernt
2. In die Indikatoren-Sektion unter der Beschreibung integriert

```typescript
{/* Full badges - visible on card hover (including shared) */}
<div className="hidden group-hover:flex items-center gap-1.5 flex-wrap">
  {note.task_id && (
    <NoteLinkedBadge type="task" id={note.task_id} label="Aufgabe" />
  )}
  {note.decision_id && (
    <NoteLinkedBadge type="decision" id={note.decision_id} label="Entscheidung" />
  )}
  {note.meeting_id && (
    <NoteLinkedBadge type="meeting" id={note.meeting_id} label={...} />
  )}
  
  {/* Shared - von mir geteilt */}
  {(note.share_count || 0) > 0 && (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className="text-xs px-1.5 py-0 h-4 text-violet-600 cursor-help">
            <Users className="h-3 w-3 mr-0.5" />
            {note.share_count}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>...</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )}
  
  {/* Shared - mit mir geteilt */}
  {note.is_shared && note.owner && (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="secondary" className="text-xs px-1.5 py-0 h-4 cursor-help">
            <Share2 className="h-3 w-3 mr-0.5" />
            {note.owner.display_name?.split(' ')[0] || 'Geteilt'}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>...</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )}
</div>
```

---

## 5. Expand-Pfeil nach Beschreibung, dicker, nach rechts

**Änderung des Details-Buttons (Zeilen 1012-1030):**

```typescript
{/* Description mit inline Expand-Pfeil */}
{isExpanded ? (
  <div className="text-sm text-muted-foreground/70 prose prose-sm...">
    {/* expanded content */}
    <button 
      className="inline-flex items-center ml-1 text-primary hover:underline"
      onClick={(e) => toggleNoteExpand(note.id, e)}
    >
      <ChevronUp className="h-3.5 w-3.5" strokeWidth={2.5} />
    </button>
  </div>
) : (
  <div className="flex items-start">
    <RichTextDisplay 
      content={note.content} 
      className="text-sm text-muted-foreground/70 line-clamp-2"
    />
    {needsTruncation && (
      <button 
        className="inline-flex items-center ml-0.5 text-primary hover:underline flex-shrink-0"
        onClick={(e) => toggleNoteExpand(note.id, e)}
      >
        <span className="text-muted-foreground">...</span>
        <ArrowRight className="h-3.5 w-3.5 ml-0.5" strokeWidth={2.5} />
      </button>
    )}
  </div>
)}
```

---

## 6. Details-Button: ">" → "> Details" bei Hover

Der separate Details-Button wird ersetzt durch den inline Pfeil aus Punkt 5. Falls ein separater Button gewünscht ist:

```typescript
{/* Details Button - bottom right for expand */}
{needsTruncation && !isExpanded && (
  <button 
    className="absolute bottom-2 left-3 text-xs text-primary font-medium flex items-center group/details"
    onClick={(e) => toggleNoteExpand(note.id, e)}
  >
    <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.5} />
    <span className="max-w-0 overflow-hidden group-hover:max-w-[60px] transition-all duration-200">
      &nbsp;Details
    </span>
  </button>
)}
```

---

## 7. Hover-Icons: Draggable rechts, keine Box, einzelne Icons

**Änderung (Zeilen 1362-1485):**

```typescript
{/* Hover Quick Actions - TOP right, individual icons without box */}
{note.user_id === user?.id && (
  <div className={cn(
    "absolute top-2 right-8 flex items-center gap-1",
    "opacity-0 group-hover:opacity-100 transition-opacity duration-200"
  )}>
    {/* Edit */}
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 hover:bg-muted/80 rounded-full"
            onClick={(e) => { e.stopPropagation(); openEditDialog(note); }}
          >
            <Pencil className="h-3 w-3" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">Bearbeiten</TooltipContent>
      </Tooltip>
    </TooltipProvider>
    
    {/* Task */}
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn("h-6 w-6 hover:bg-muted/80 rounded-full", note.task_id && "text-blue-600")}
            onClick={(e) => { e.stopPropagation(); ... }}
          >
            <CheckSquare className="h-3 w-3" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">...</TooltipContent>
      </Tooltip>
    </TooltipProvider>
    
    {/* ... Decision, Follow-up, Jour Fixe ... */}
    
    {/* Drag Handle - ZULETZT */}
    {dragHandleProps && (
      <div {...dragHandleProps} className="cursor-grab p-1 hover:bg-muted/80 rounded-full">
        <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
    )}
  </div>
)}
```

**Wichtige Änderungen:**
- Position: `top-2 right-8` statt `bottom-2 right-2`
- Kein Container-Styling (`bg-background`, `border`, `shadow-sm` entfernt)
- `rounded-full` für einzelne Icons
- Drag Handle am Ende der Reihe

---

## 8. Konflikt zwischen Hover-Icons und Details-Button vermeiden

Durch die Verschiebung der Hover-Icons nach oben rechts (Punkt 7) entsteht kein Konflikt mehr mit dem Details-Button unten.

**Neue Positionierung:**
- Hover-Icons: `top-2 right-8` (rechts vom Drei-Punkte-Menü)
- Details-Button: `bottom-2 left-3` oder inline nach Beschreibung
- Drei-Punkte-Menü: bleibt `top-2 right-2`

---

## 9. Pinned-Indicator: Goldene Ecke oben rechts

**Neue visuelle Darstellung für gepinnte Notizen:**

```typescript
{/* Pinned Indicator - subtle gold corner */}
{note.is_pinned && (
  <div className="absolute top-0 right-0 w-0 h-0 
    border-t-[16px] border-r-[16px] 
    border-t-amber-400 border-r-transparent
    rounded-tr-lg"
    title="Angepinnt"
  />
)}
```

Alternative mit Icon im Dreieck:

```typescript
{note.is_pinned && (
  <div className="absolute -top-0.5 -right-0.5">
    <div className="w-6 h-6 bg-gradient-to-br from-amber-400 to-amber-500 
      rounded-tr-lg rounded-bl-xl flex items-end justify-start p-0.5">
      <Pin className="h-3 w-3 text-white rotate-45" />
    </div>
  </div>
)}
```

Das Pin-Icon in der Metadata-Zeile (Zeile 1283-1285) kann dann entfernt werden.

---

## Visuelle Darstellung

**Ohne Hover:**
```
┌─────────────────────────────────────────────────────────────────────────┐
│ [🔶]                                                              [⋮]  │ ← Goldene Ecke wenn gepinnt
│ Notiz-Titel (größer, text-base)                                        │
│ Beschreibung in grau mit maximal zwei Zeilen und dann...  [→]         │
│                                                                         │
│ ■ ■ ■ ■  (Quadrate: blau, lila, grün, violett für shared)              │
│                                        [→ Details] ← unten links       │
└─────────────────────────────────────────────────────────────────────────┘
```

**Mit Hover:**
```
┌─────────────────────────────────────────────────────────────────────────┐
│ [🔶]              [✏️] [☑️] [🗳️] [🕐] [📅] [≡]                   [⋮]  │
│ Notiz-Titel (größer, text-base)                                        │
│ Beschreibung in grau mit maximal zwei Zeilen und dann...  [→]         │
│                                                                         │
│ [Aufgabe →] [Entscheidung →] [JF: 28.01. →] [Mit 2 geteilt]            │
│                                        [→ Details] ← unten links       │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Zusammenfassung der Dateien

| Datei | Änderungen |
|-------|------------|
| `src/components/shared/QuickNotesList.tsx` | Alle 9 Punkte implementieren |

---

## Geschätzter Aufwand

| Änderung | Zeit |
|----------|------|
| Quadrate statt Kreise + Größe + Abstand | 5 Min |
| Badge-Anzahl entfernen | 2 Min |
| Shared-Badges verschieben | 15 Min |
| Expand-Pfeil neu gestalten | 10 Min |
| Details-Button Hover-Effekt | 10 Min |
| Hover-Icons neu anordnen + schöner | 15 Min |
| Konflikt vermeiden | 5 Min |
| Pinned-Indicator (goldene Ecke) | 10 Min |
| **Gesamt** | **~72 Min** |
