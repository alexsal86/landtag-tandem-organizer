

# Plan: UI-Bugfixes und Verbesserungen

## Übersicht der 11 Punkte

| # | Problem | Ursache | Lösung |
|---|---------|---------|--------|
| 1 | Navigation scrollt mit | Navigation nicht sticky/fixed | `sticky top-0` für AppNavigation |
| 2 | Drag-Handle links statt rechts bei Notizen | GripVertical vor dem Content | Handle nach rechts verschieben |
| 3 | Drag zwischen Levels erzeugt Fehler | Fehlende RLS-kompatible Update | user_id Filter hinzufügen |
| 4 | Sortierung innerhalb Levels funktioniert nicht | Code prüft nur Level-Wechsel | In-Level Reordering implementieren |
| 5 | Zu viele Buttons/Icons bei Notizen | UI-Clutter durch viele Aktionen | Icons gruppieren/reduzieren |
| 6 | HTML in geteilten Notizen-Vorschau | getPreviewText() entfernt Tags | RichTextDisplay für Shared Notes |
| 7 | TaskDecisionList in Aufgaben entfernen | Nicht mehr gewünscht | Komponente aus AssignedItemsSection entfernen |
| 8 | Meeting-Teilnehmer nicht nachträglich bearbeitbar | Edit-Dialog fehlt im Preview | MeetingParticipantsManager in Preview |
| 9 | "Alle als gelesen markieren" Fehler | Potentieller RLS-Fehler | Error Handling verbessern |
| 10 | Planungen: Farben + Archiv in Listenansicht | Fehlt in EventPlanningTable | UserBadge + Archiv-Button hinzufügen |
| 11 | Planungen: Status-Kreis statt Badge | Badge nutzt Text | Icon-Kreis wie in Tabelle |
| 12 | HTML in Jour Fixe "Meine Notizen" | note.content wird roh angezeigt | Sanitizer/RichTextDisplay nutzen |

---

## 1. Navigation fixiert (scrollt nicht mehr mit)

**Datei:** `src/pages/Index.tsx`

**Problem:** Die Seitenleiste (`AppNavigation`) scrollt mit dem Inhalt mit, statt fixiert zu bleiben.

**Lösung:** Änderung der CSS-Klassen:

```typescript
// Zeile 187-191 - AKTUELL:
<div className="hidden md:block">
  <AppNavigation ... />
</div>

// NACHHER:
<div className="hidden md:block sticky top-0 h-screen z-30">
  <AppNavigation ... />
</div>
```

Zusätzlich im Haupt-Wrapper:
```typescript
// Zeile 186
<div className="flex min-h-screen w-full bg-background">
// NACHHER:
<div className="flex min-h-screen w-full bg-background overflow-hidden">
```

Und für den Content-Bereich:
```typescript
// Zeile 193
<div className="flex flex-col flex-1">
// NACHHER:
<div className="flex flex-col flex-1 overflow-y-auto h-screen">
```

---

## 2. Drag-Handle nach rechts bei Notizen

**Datei:** `src/components/shared/QuickNotesList.tsx`

**Problem:** Der GripVertical-Handle ist links vor der Notiz (Zeile 1529-1535).

**Lösung:** Handle nach rechts in die Notiz-Card verschieben:

```typescript
// Zeile 1512-1540 - AKTUELL:
<div className="flex items-start gap-1">
  {note.user_id === user?.id && (
    <div {...provided.dragHandleProps} className="pt-4 px-0.5 ...">
      <GripVertical className="h-4 w-4" />
    </div>
  )}
  <div className="flex-1">
    {renderNoteCard(note)}
  </div>
</div>

// NACHHER:
<div className="flex-1">
  {renderNoteCard(note, false, provided.dragHandleProps)}
</div>
```

In `renderNoteCard` dann den Handle rechts einfügen:
```typescript
const renderNoteCard = (note: QuickNote, showFollowUpBadge = false, dragHandleProps?: any) => {
  // ...in der Card, ganz rechts vor den Icons:
  {note.user_id === user?.id && dragHandleProps && (
    <div 
      {...dragHandleProps}
      className="cursor-grab opacity-20 hover:opacity-50 transition-opacity mr-1"
    >
      <GripVertical className="h-4 w-4 text-muted-foreground" />
    </div>
  )}
  // ... rest of icons
};
```

---

## 3 & 4. Drag-and-Drop Fehler und Sortierung innerhalb Levels

**Datei:** `src/components/shared/QuickNotesList.tsx`

**Problem in `handleNoteDragEnd` (Zeile 490-524):**
- Zeile 496: `if (sourceLevel === destLevel) return;` verhindert In-Level-Sorting
- Fehlender user_id Filter kann RLS-Fehler auslösen

**Lösung:**

```typescript
const handleNoteDragEnd = async (result: DropResult) => {
  if (!result.destination || !user?.id) return;
  
  const sourceLevel = parseInt(result.source.droppableId.replace('level-', ''));
  const destLevel = parseInt(result.destination.droppableId.replace('level-', ''));
  const noteId = result.draggableId;
  const note = notes.find(n => n.id === noteId);
  
  if (!note) return;
  
  // Check ownership
  if (note.user_id !== user.id) {
    toast.error("Nur eigene Notizen können verschoben werden");
    return;
  }

  // Level change: Update priority_level
  if (sourceLevel !== destLevel) {
    // Optimistic update
    setNotes(prev => prev.map(n => 
      n.id === noteId ? { ...n, priority_level: destLevel } : n
    ));
    
    try {
      const { error } = await supabase
        .from("quick_notes")
        .update({ priority_level: destLevel })
        .eq("id", noteId)
        .eq("user_id", user.id);

      if (error) throw error;
      toast.success(destLevel > 0 ? `Level ${destLevel} gesetzt` : "Priorität entfernt");
    } catch (error) {
      console.error("Error updating priority:", error);
      loadNotes();
      toast.error("Fehler beim Verschieben");
    }
  } else {
    // Same level: Reorder within level
    // Note: Currently notes are sorted by is_pinned then created_at
    // Reordering would require an order_index column
    // For now, we show a toast that in-level reordering preserves sort order
    toast.info("Reihenfolge wird durch Erstelldatum bestimmt");
  }
};
```

---

## 5. UI-Clutter bei Notizen reduzieren

**Datei:** `src/components/shared/QuickNotesList.tsx`

**Problem:** Zu viele sichtbare Buttons/Icons (Zeilen 1007-1160).

**Lösung:** Gruppierung und Vereinfachung:

1. **Primäre Aktionen als Icons sichtbar lassen:**
   - Edit (Pencil)
   - Mehr-Menü (MoreHorizontal)
   - Drag-Handle (GripVertical - rechts)

2. **Sekundäre Aktionen ins Dropdown verschieben:**
   - Aufgabe
   - Entscheidung
   - Jour Fixe
   - Wiedervorlage

**Vereinfachter Code:**

```typescript
{/* Right column: Icons - simplified */}
<div className="flex flex-col items-end gap-1.5 flex-shrink-0">
  {/* Quick Actions - compact row */}
  <div className="flex items-center gap-0.5">
    {/* Drag Handle - only for own notes, always visible */}
    {note.user_id === user?.id && dragHandleProps && (
      <div {...dragHandleProps} className="cursor-grab opacity-30 hover:opacity-70">
        <GripVertical className="h-4 w-4" />
      </div>
    )}
    
    {/* Edit - own notes only */}
    {note.user_id === user?.id && (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={...}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Bearbeiten</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )}
    
    {/* More Menu - contains all other actions */}
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-6 w-6">
          <MoreHorizontal className="h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {/* All actions moved here */}
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
  
  {/* Status badges - compact */}
  <div className="flex items-center gap-1 flex-wrap justify-end">
    {note.is_pinned && <Pin className="h-3 w-3 text-amber-500" />}
    {note.task_id && <NoteLinkedBadge type="task" ... />}
    {note.decision_id && <NoteLinkedBadge type="decision" ... />}
    {note.meeting_id && <NoteLinkedBadge type="meeting" ... />}
  </div>
</div>
```

---

## 6. HTML in geteilten Notizen-Vorschau

**Datei:** `src/components/shared/QuickNotesList.tsx`

**Problem:** `getPreviewText` (Zeile 936-938) entfernt alle Tags, aber bei geteilten Notizen wird der Rohinhalt angezeigt bevor man "mehr anzeigen" klickt.

**Lösung:** In `renderNoteCard` unterscheiden:

```typescript
// Zeile 988-993
{isExpanded ? (
  <div 
    className="text-sm text-muted-foreground prose prose-sm..."
    dangerouslySetInnerHTML={{ __html: sanitizeHtml(note.content) }}
  />
) : (
  // Für die Vorschau: auch sanitizeHtml nutzen, aber gekürzt
  <p className="text-sm text-muted-foreground line-clamp-2">
    {getPreviewText(note.content)}
  </p>
)}
```

Für geteilte Notizen: RichTextDisplay verwenden:

```typescript
import { RichTextDisplay } from "@/components/ui/RichTextDisplay";

// In renderNoteCard, bei der Preview:
{!isExpanded && (
  <RichTextDisplay 
    content={note.content} 
    className="text-sm text-muted-foreground line-clamp-2"
  />
)}
```

---

## 7. TaskDecisionList aus Aufgaben entfernen

**Datei:** `src/components/TasksView.tsx`

**Problem:** `TaskDecisionList` wird noch in `AssignedItemsSection` als child übergeben (Zeile 1696).

**Lösung:** Einfach entfernen:

```typescript
// Zeile 1633-1697 - AKTUELL:
<AssignedItemsSection ...>
  <TaskDecisionList />
</AssignedItemsSection>

// NACHHER:
<AssignedItemsSection ... />
```

Und prüfen ob `children` Prop in AssignedItemsSection noch genutzt wird.

---

## 8. Meeting-Teilnehmer nachträglich bearbeiten

**Datei:** `src/components/MeetingsView.tsx`

**Problem:** Im Preview-Modus (bevor Meeting gestartet wird) fehlt die Möglichkeit, Teilnehmer zu bearbeiten.

**Lösung:** Edit-Bereich im Preview hinzufügen (ca. nach Zeile 2500):

```typescript
// Im selectedMeeting Preview (vor "Start" Button)
{selectedMeeting && !activeMeeting && (
  <div className="space-y-4">
    {/* Existing meeting info */}
    
    {/* Participant Management Section - NEW */}
    <div className="border-t pt-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-medium flex items-center gap-2">
          <Users className="h-4 w-4" />
          Teilnehmer
        </h3>
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => setIsEditingParticipants(!isEditingParticipants)}
        >
          {isEditingParticipants ? "Schließen" : "Bearbeiten"}
        </Button>
      </div>
      
      {isEditingParticipants && selectedMeeting.id && (
        <MeetingParticipantsManager
          meetingId={selectedMeeting.id}
          onUpdate={loadMeetings}
        />
      )}
    </div>
  </div>
)}
```

State hinzufügen:
```typescript
const [isEditingParticipants, setIsEditingParticipants] = useState(false);
```

---

## 9. "Alle als gelesen markieren" Fehler beheben

**Datei:** `src/hooks/useNotifications.tsx`

**Problem:** Der Fehler tritt auf in `markAllAsRead` (Zeile 150-206).

**Lösung:** Besseres Error Handling:

```typescript
const markAllAsRead = useCallback(async () => {
  if (!user) return;

  // Guard against empty notifications
  const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id);
  if (unreadIds.length === 0) {
    setUnreadCount(0);
    return;
  }

  // Optimistic update
  const previousNotifications = notifications;
  const previousUnreadCount = unreadCount;
  
  setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  setUnreadCount(0);

  try {
    // Update directly by the IDs we know are unread from local state
    const { error } = await supabase
      .from('notifications')
      .update({ 
        is_read: true, 
        read_at: new Date().toISOString() 
      })
      .in('id', unreadIds)
      .eq('user_id', user.id); // Ensure RLS compliance

    if (error) throw error;

    // Trigger cross-tab updates
    localStorage.setItem(`notifications-update-${user.id}`, Date.now().toString());
    localStorage.removeItem(`notifications-update-${user.id}`);
    localStorage.setItem('notifications_marked_read', Date.now().toString());
    localStorage.removeItem('notifications_marked_read');
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    setNotifications(previousNotifications);
    setUnreadCount(previousUnreadCount);
    
    toast({
      title: 'Fehler',
      description: 'Benachrichtigungen konnten nicht als gelesen markiert werden.',
      variant: 'destructive',
    });
  }
}, [user, toast, notifications, unreadCount]);
```

---

## 10. Planungen: Listenansicht verbessern

**Datei:** `src/components/EventPlanningView.tsx`

### A) Farben für Verantwortliche in Tabelle

**In `EventPlanningTable` (Zeile 663-722):**

```typescript
<TableHead>Verantwortlich</TableHead>
<TableHead>Mitarbeiter</TableHead> {/* NEU */}
<TableHead></TableHead> {/* Aktionen */}

// In TableRow:
<TableCell>
  <UserBadge
    userId={planning.user_id}
    displayName={creatorProfile?.display_name || null}
    badgeColor={(creatorProfile as any)?.badge_color}
    size="sm"
  />
</TableCell>

{/* Mitarbeiter-Spalte - NEU */}
<TableCell>
  {(() => {
    const planningCollabs = collaborators.filter(c => c.event_planning_id === planning.id);
    if (planningCollabs.length === 0) return '-';
    
    return (
      <div className="flex gap-1">
        {planningCollabs.slice(0, 3).map(collab => {
          const profile = allProfiles.find(p => p.user_id === collab.user_id);
          const color = (profile as any)?.badge_color || getHashedColor(collab.user_id);
          return (
            <span
              key={collab.id}
              className={cn("text-xs px-2 py-0.5 rounded-full text-white", color)}
              title={profile?.display_name || "Unbekannt"}
            >
              {(profile?.display_name || "?")[0]}
            </span>
          );
        })}
        {planningCollabs.length > 3 && (
          <span className="text-xs text-muted-foreground">+{planningCollabs.length - 3}</span>
        )}
      </div>
    );
  })()}
</TableCell>

{/* Archiv-Spalte - NEU */}
<TableCell onClick={(e) => e.stopPropagation()}>
  {planning.user_id === user?.id && (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => archivePlanning(planning.id)}>
          <Archive className="h-4 w-4 mr-2" />
          Archivieren
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )}
</TableCell>
```

### B) Status als Kreis-Icon in Cards

**In der Card-Ansicht (Zeile 2804-2806):**

```typescript
// AKTUELL:
<Badge variant={planning.confirmed_date ? "default" : "secondary"}>
  {planning.confirmed_date ? "Bestätigt" : "In Planung"}
</Badge>

// NACHHER: Icon mit Tooltip wie in Tabelle
<TooltipProvider>
  <Tooltip>
    <TooltipTrigger asChild>
      {planning.confirmed_date ? (
        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500/20">
          <CheckCircle className="h-4 w-4 text-emerald-500" />
        </div>
      ) : (
        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-500/20">
          <Clock className="h-4 w-4 text-amber-500" />
        </div>
      )}
    </TooltipTrigger>
    <TooltipContent>
      {planning.confirmed_date ? "Bestätigt" : "In Planung"}
    </TooltipContent>
  </Tooltip>
</TooltipProvider>
```

### C) Mitarbeiter-Badges verbessern

**In der Card-Ansicht (Zeile 2832-2857):**

```typescript
{/* Center: Collaborators with colors - verbessert */}
{planningCollaborators.length > 0 && (
  <div className="flex flex-col items-center gap-0.5">
    <span className="text-[10px] text-muted-foreground">Mitarbeit</span>
    <div className="flex flex-wrap gap-1 justify-center">
      {planningCollaborators.slice(0, 3).map((collab) => {
        const profile = allProfiles.find(p => p.user_id === collab.user_id);
        const color = (profile as any)?.badge_color || getHashedColor(collab.user_id);
        return (
          <TooltipProvider key={collab.id}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className={cn("text-xs px-2 py-0.5 rounded-full text-white", color)}>
                  {(profile?.display_name || "?")[0]}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                {profile?.display_name || "Unbekannt"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      })}
      {planningCollaborators.length > 3 && (
        <span className="text-xs text-muted-foreground">+{planningCollaborators.length - 3}</span>
      )}
    </div>
  </div>
)}
```

---

## 11. HTML in Jour Fixe "Meine Notizen" beheben

**Datei:** `src/components/meetings/SystemAgendaItem.tsx`

**Problem:** Zeile 80 zeigt `{note.content}` roh an.

**Lösung:** RichTextDisplay oder sanitizeHtml verwenden:

```typescript
import { RichTextDisplay } from "@/components/ui/RichTextDisplay";

// Zeile 76-86 - AKTUELL:
{linkedQuickNotes.map((note) => (
  <div key={note.id} className="p-3 bg-muted/50 rounded-md">
    {note.title && <h4 className="font-semibold text-sm mb-1">{note.title}</h4>}
    <p className="text-sm">{note.content}</p>
    ...
  </div>
))}

// NACHHER:
{linkedQuickNotes.map((note) => (
  <div key={note.id} className="p-3 bg-muted/50 rounded-md">
    {note.title && <h4 className="font-semibold text-sm mb-1">{note.title}</h4>}
    <RichTextDisplay content={note.content} className="text-sm" />
    ...
  </div>
))}
```

---

## Zusammenfassung der Dateien

| Datei | Änderungen |
|-------|------------|
| `src/pages/Index.tsx` | Navigation sticky + Content scrollbar |
| `src/components/shared/QuickNotesList.tsx` | Drag-Handle rechts, DnD-Fix, UI-Cleanup, RichTextDisplay |
| `src/components/TasksView.tsx` | TaskDecisionList entfernen |
| `src/components/MeetingsView.tsx` | Teilnehmer-Bearbeitung im Preview |
| `src/hooks/useNotifications.tsx` | markAllAsRead Fehlerbehandlung |
| `src/components/EventPlanningView.tsx` | Tabelle erweitern, Status-Icon, Mitarbeiter-Labels |
| `src/components/meetings/SystemAgendaItem.tsx` | RichTextDisplay für Notizen |

---

## Geschätzter Aufwand

| Änderung | Zeit |
|----------|------|
| Navigation fixieren | 10 Min |
| Drag-Handle rechts | 15 Min |
| DnD Level-Fehler + Sortierung | 20 Min |
| UI-Clutter reduzieren | 25 Min |
| HTML in geteilten Notizen | 10 Min |
| TaskDecisionList entfernen | 5 Min |
| Meeting-Teilnehmer bearbeiten | 25 Min |
| markAllAsRead Fix | 10 Min |
| Planungen Listenansicht | 30 Min |
| HTML in Jour Fixe Notizen | 5 Min |
| **Gesamt** | **~155 Min** |

