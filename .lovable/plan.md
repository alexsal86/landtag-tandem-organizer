

# Plan: Neugestaltung der Quick Notes Cards

## Übersicht der Änderungen

| # | Änderung | Beschreibung |
|---|----------|--------------|
| 1 | Titel & Beschreibung | Titel größer (text-base), Beschreibung grau (text-muted-foreground) |
| 2 | Badge-Farben | Deutlichere Farbunterschiede: Blau (Aufgabe), Violett (Entscheidung), Grün (Jour Fixe) |
| 3 | Menü-Struktur | Logische Gruppierung mit Trennlinien, Erstellungsdatum am Ende |
| 4 | Icons on Hover | Nur Menü-Icon standardmäßig sichtbar, alle anderen Icons bei Hover |
| 5 | Farbige Indikatoren | Kleine farbige Quadrate unter Beschreibung, werden zu Badges bei Hover |
| 6 | Details-Button | Zeigt nur ">" ohne Hover, "Details" erscheint bei Hover |

---

## 1. Titel und Beschreibung anpassen

**Aktuelle Implementierung (Zeile 993-1007):**
```typescript
{note.title && (
  <h4 className="font-semibold text-sm truncate mb-1">
    {note.title}
  </h4>
)}
```

**Neue Implementierung:**
```typescript
{note.title && (
  <h4 className="font-semibold text-base truncate mb-1">
    {note.title}
  </h4>
)}
{isExpanded ? (
  <div className="text-sm text-muted-foreground/80 prose prose-sm...">
    {/* sanitized content */}
  </div>
) : (
  <RichTextDisplay 
    content={note.content} 
    className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2"
  />
)}
```

---

## 2. Badge-Farben deutlicher unterscheiden

**Datei:** `src/components/shared/NoteLinkedBadge.tsx`

Aktuelle Farben sind ähnlich. Neue, kontrastreichere Farben:

```typescript
const getColor = () => {
  switch (type) {
    case 'task': 
      return 'text-blue-700 bg-blue-100 border-blue-300 hover:bg-blue-200 dark:text-blue-300 dark:bg-blue-900/50 dark:border-blue-700';
    case 'decision': 
      return 'text-purple-700 bg-purple-100 border-purple-300 hover:bg-purple-200 dark:text-purple-300 dark:bg-purple-900/50 dark:border-purple-700';
    case 'meeting': 
      return 'text-emerald-700 bg-emerald-100 border-emerald-300 hover:bg-emerald-200 dark:text-emerald-300 dark:bg-emerald-900/50 dark:border-emerald-700';
  }
};
```

---

## 3. Menü neu strukturieren (kontextabhängig)

**Neue Reihenfolge mit Trennlinien:**

```
┌───────────────────────────────────┐
│ ✏️ Bearbeiten                      │ 
│ ☑️ Als Aufgabe / Aufgabe entfernen │  ← Kontextabhängig
│ 🗳️ Als Entscheidung / Entscheidung aktiv │
│ 📅 Auf Jour Fixe / Von JF entfernen│
├───────────────────────────────────┤
│ ⭐ Priorität                →     │
│ 🕐 Wiedervorlage            →     │
│ 🔗 Freigeben                       │
│ 📝 In Einzelnotizen aufteilen      │
├───────────────────────────────────┤
│ 📌 Anpinnen / Loslösen             │
│ 📦 Archivieren                     │
│ 🔄 Versionshistorie                │
├───────────────────────────────────┤
│ 🗑️ Löschen                         │
├───────────────────────────────────┤
│ 🕐 Erstellt: 28.01.2026 14:30     │  ← Ganz am Ende
└───────────────────────────────────┘
```

**Kontextabhängige Menüpunkte:**
```typescript
// Task
{note.task_id ? (
  <DropdownMenuItem onClick={() => removeTaskFromNote(note)} className="text-blue-600">
    <CheckSquare className="h-3 w-3 mr-2" />
    Aufgabe entfernen
  </DropdownMenuItem>
) : (
  <DropdownMenuItem onClick={() => createTaskFromNote(note)}>
    <CheckSquare className="h-3 w-3 mr-2" />
    Als Aufgabe
  </DropdownMenuItem>
)}

// Decision - already implemented

// Meeting - already implemented
```

---

## 4. Icons bei Hover anzeigen (unten rechts in Card)

**Konzept:**
- Standard: Nur MoreHorizontal (drei Punkte) sichtbar
- Bei Hover über Card: Alle Quick-Action Icons erscheinen
- Position: Unten rechts in der Card

**Neue Card-Struktur:**
```typescript
<div className="p-3 rounded-lg border transition-colors hover:shadow-sm bg-card border-l-4 group relative">
  {/* Content */}
  <div className="flex items-start justify-between gap-2">
    <div className="flex-1 min-w-0">
      {/* Title & Content */}
    </div>
    
    {/* Always visible: Menu icon only */}
    <div className="flex-shrink-0">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-6 w-6">
            <MoreHorizontal className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        {/* Menu content */}
      </DropdownMenu>
    </div>
  </div>
  
  {/* Status indicators (squares/badges) */}
  {/* ... under description ... */}
  
  {/* Hover Quick Actions - bottom right */}
  <div className={cn(
    "absolute bottom-2 right-2 flex items-center gap-0.5",
    "opacity-0 group-hover:opacity-100 transition-opacity",
    "bg-background/90 backdrop-blur-sm rounded-md px-1 py-0.5 border shadow-sm"
  )}>
    {/* Drag Handle */}
    {note.user_id === user?.id && dragHandleProps && (
      <div {...dragHandleProps} className="cursor-grab p-1 hover:bg-muted rounded">
        <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
    )}
    
    {/* Edit */}
    {note.user_id === user?.id && (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEditDialog(note)}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Bearbeiten</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )}
    
    {/* Task */}
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button 
            variant="ghost" 
            size="icon" 
            className={cn("h-6 w-6", note.task_id && "text-blue-600")}
            onClick={() => note.task_id ? removeTaskFromNote(note) : createTaskFromNote(note)}
          >
            <CheckSquare className="h-3.5 w-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{note.task_id ? "Aufgabe entfernen" : "Als Aufgabe"}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
    
    {/* Decision */}
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button 
            variant="ghost" 
            size="icon" 
            className={cn("h-6 w-6", note.decision_id && "text-purple-600")}
            onClick={() => ...}
          >
            <Vote className="h-3.5 w-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Als Entscheidung</TooltipContent>
      </Tooltip>
    </TooltipProvider>
    
    {/* Follow-up */}
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button 
            variant="ghost" 
            size="icon" 
            className={cn("h-6 w-6", note.follow_up_date && "text-amber-600")}
            onClick={() => ...}
          >
            <Clock className="h-3.5 w-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Wiedervorlage</TooltipContent>
      </Tooltip>
    </TooltipProvider>
    
    {/* Jour Fixe */}
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button 
            variant="ghost" 
            size="icon" 
            className={cn("h-6 w-6", note.meeting_id && "text-emerald-600")}
            onClick={() => ...}
          >
            <CalendarIcon className="h-3.5 w-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{note.meeting_id ? "Von Jour Fixe entfernen" : "Auf Jour Fixe"}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  </div>
</div>
```

---

## 5. Farbige Indikatoren unter der Beschreibung

**Konzept:**
- Kleine farbige Quadrate (6x6px) zeigen an, ob Aufgabe/Entscheidung/Jour Fixe verknüpft
- Bei Hover über Card: Quadrate werden zu vollen Badges mit Text
- Bei Hover über Badge: Pfeil erscheint (bereits implementiert)

**Implementierung:**
```typescript
{/* Status Indicators - under description */}
{(note.task_id || note.decision_id || note.meeting_id) && (
  <div className="flex items-center gap-1.5 mt-2">
    {note.task_id && (
      <div className={cn(
        "transition-all duration-200 cursor-pointer",
        // Default: small square
        "group-hover:hidden"
      )}>
        <div 
          className="w-2 h-2 rounded-sm bg-blue-500" 
          title="Aufgabe"
        />
      </div>
    )}
    {note.decision_id && (
      <div className={cn(
        "transition-all duration-200 cursor-pointer",
        "group-hover:hidden"
      )}>
        <div 
          className="w-2 h-2 rounded-sm bg-purple-500" 
          title="Entscheidung"
        />
      </div>
    )}
    {note.meeting_id && (
      <div className={cn(
        "transition-all duration-200 cursor-pointer",
        "group-hover:hidden"
      )}>
        <div 
          className="w-2 h-2 rounded-sm bg-emerald-500" 
          title="Jour Fixe"
        />
      </div>
    )}
    
    {/* Full badges - only visible on hover */}
    <div className={cn(
      "hidden group-hover:flex items-center gap-1.5",
      "transition-all duration-200"
    )}>
      {note.task_id && (
        <NoteLinkedBadge type="task" id={note.task_id} label="Aufgabe" />
      )}
      {note.decision_id && (
        <NoteLinkedBadge type="decision" id={note.decision_id} label="Entscheidung" />
      )}
      {note.meeting_id && (
        <NoteLinkedBadge 
          type="meeting" 
          id={note.meeting_id} 
          label={note.meetings?.meeting_date 
            ? `JF: ${format(new Date(note.meetings.meeting_date), "dd.MM.", { locale: de })}`
            : "Jour Fixe"
          } 
        />
      )}
    </div>
  </div>
)}
```

---

## 6. Details-Button mit Hover-Effekt

**Aktueller Text:** "...mehr anzeigen"

**Neues Konzept:**
```typescript
{needsTruncation && (
  <button 
    className="text-xs text-primary hover:underline mt-1 font-medium flex items-center gap-0.5 group/details"
    onClick={(e) => toggleNoteExpand(note.id, e)}
  >
    {isExpanded ? (
      <>
        <ChevronDown className="h-3 w-3 rotate-180" />
        <span>Weniger</span>
      </>
    ) : (
      <>
        <ChevronDown className="h-3 w-3" />
        <span className="hidden group-hover/details:inline transition-all">Details</span>
      </>
    )}
  </button>
)}
```

---

## Visuelle Darstellung

**Normal (ohne Hover):**
```
┌──────────────────────────────────────────────────────────────┐
│ █ Notiz-Titel                                           [⋮] │
│ ─────────────────────────────────────────────────────────────│
│ Hier steht die Beschreibung der Notiz in grauer             │
│ Schrift mit maximal zwei Zeilen...                          │
│ [>]                                                          │
│ ■ ■ ■  (kleine farbige Quadrate: blau, lila, grün)          │
└──────────────────────────────────────────────────────────────┘
```

**Mit Hover:**
```
┌──────────────────────────────────────────────────────────────┐
│ █ Notiz-Titel                                           [⋮] │
│ ─────────────────────────────────────────────────────────────│
│ Hier steht die Beschreibung der Notiz in grauer             │
│ Schrift mit maximal zwei Zeilen...                          │
│ [> Details]                                                  │
│ [Aufgabe →] [Entscheidung →] [JF: 28.01. →]                 │
│                    [≡] [✏️] [☑️] [🗳️] [🕐] [📅] ← unten rechts │
└──────────────────────────────────────────────────────────────┘
```

---

## Zusammenfassung der Dateien

| Datei | Änderungen |
|-------|------------|
| `src/components/shared/QuickNotesList.tsx` | Card-Layout, Menü-Struktur, Hover-Icons, Indikatoren |
| `src/components/shared/NoteLinkedBadge.tsx` | Verstärkte Badge-Farben mit Hintergrund |

---

## Zusätzliche Ideen

1. **Schnelles Farbändern:** Ein kleiner Farbpunkt neben dem Titel, der bei Klick eine Farbauswahl öffnet

2. **Tastatur-Shortcuts:** 
   - `E` = Bearbeiten
   - `T` = Als Aufgabe
   - `D` = Als Entscheidung
   - `P` = Priorität

3. **Swipe-Gesten (Mobile):**
   - Nach rechts wischen = Archivieren
   - Nach links wischen = Löschen

4. **Pinned-Indicator:** Statt nur Pin-Icon, eine dezente goldene Ecke oben rechts bei gepinnten Notizen

5. **Prioritäts-Streifen:** Die linke Farbkante zeigt bei hoher Priorität einen subtilen Glow-Effekt

---

## Geschätzter Aufwand

| Änderung | Zeit |
|----------|------|
| Titel/Beschreibung Styling | 10 Min |
| Badge-Farben anpassen | 10 Min |
| Menü-Struktur umbauen | 25 Min |
| Hover-Icons unten rechts | 30 Min |
| Farbige Indikatoren + Transformation | 25 Min |
| Details-Button Effekt | 10 Min |
| **Gesamt** | **~110 Min** |

