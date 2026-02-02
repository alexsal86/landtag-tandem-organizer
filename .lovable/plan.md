
# Plan: 5 Meeting-Verbesserungen

## Übersicht der Anforderungen

| # | Anforderung | Lösung |
|---|-------------|--------|
| 1 | Rollenänderung zeigt Fehler, aber funktioniert trotzdem | Toast-Logik korrigieren + State-Update nach erfolgreichem Save |
| 2 | Enter bei Hauptpunkten mit Unterpunkten darf Punkt nicht beenden | Enter-Logik anpassen: Hauptpunkte mit Unterpunkten überspringen |
| 3 | "Meine Notizen" und "Kommende Termine" als Unterpunkte | Sind bereits implementiert als `system_type`, nur Anzeige-Logik verbessern |
| 4 | Öffentlichkeitsstatus anzeigen und editierbar | Badge + Toggle in Detail-Card |
| 5 | Mehrfach-Zuweisung für Agenda-Punkte | Multi-Select UI + Aufgaben-Erstellung mit Array |

---

## 1. Rollenänderung zeigt falschen Fehler

### Ursache
Der Code zeigt eine Fehlermeldung, obwohl die Operation erfolgreich ist. Das Problem liegt darin, dass bei einem erfolgreichen UPDATE mit `.eq('id', ...)` kein `error` zurückgegeben wird, aber die Logik trotzdem manchmal fehlschlägt wegen Race Conditions im lokalen State.

### Lösung
**Datei:** `src/components/meetings/InlineMeetingParticipantsEditor.tsx`

```typescript
const handleRoleChange = async (participantId: string, newRole: 'organizer' | 'participant' | 'optional') => {
  const participant = participants.find(p => p.id === participantId);
  
  // Update local state FIRST for optimistic UI
  setParticipants(prev => prev.map(p => 
    p.id === participantId ? { ...p, role: newRole } : p
  ));
  
  const { error } = await supabase
    .from('meeting_participants')
    .update({ role: newRole })
    .eq('id', participantId);

  if (error) {
    console.error('❌ Error updating participant role:', error);
    // Revert on error
    setParticipants(prev => prev.map(p => 
      p.id === participantId ? { ...p, role: participant?.role || 'participant' } : p
    ));
    toast({
      title: "Fehler",
      description: "Rolle konnte nicht geändert werden.",
      variant: "destructive"
    });
    return;
  }
  
  // Success toast
  toast({
    title: "Rolle geändert",
    description: `${participant?.user?.display_name} ist jetzt ${roleLabels[newRole].label}.`,
  });
};
```

---

## 2. Enter-Logik bei Unterpunkten

### Problem
Aktuell markiert Enter jeden fokussierten Punkt als "besprochen", auch wenn der Hauptpunkt Unterpunkte hat. Das gewünschte Verhalten: Wenn ein Hauptpunkt Unterpunkte hat, soll Enter zum ersten Unterpunkt navigieren, nicht den Hauptpunkt beenden.

### Lösung
**Datei:** `src/components/meetings/FocusModeView.tsx`

```typescript
case 'Enter':
  e.preventDefault();
  if (currentNavigable && currentGlobalIndex !== -1) {
    // Check if current is a main item with uncompleted sub-items
    if (!currentNavigable.isSubItem) {
      const subItems = agendaItems.filter(sub => 
        (sub.parent_id === currentItem.id || sub.parentLocalKey === currentItem.id) &&
        !sub.system_type
      );
      
      // If has sub-items and not all completed, navigate to first uncompleted sub-item
      if (subItems.length > 0) {
        const firstUncompletedSub = subItems.find(sub => !sub.is_completed);
        if (firstUncompletedSub) {
          const subNavIndex = allNavigableItems.findIndex(n => n.item.id === firstUncompletedSub.id);
          if (subNavIndex !== -1) {
            setFlatFocusIndex(subNavIndex);
            return; // Don't complete the parent
          }
        }
      }
    }
    
    // Standard behavior: toggle completion
    const isNowCompleted = !currentItem.is_completed;
    handleItemComplete(currentNavigable, isNowCompleted);
    
    if (isNowCompleted) {
      setTimeout(() => {
        if (checkAllCompleted()) {
          setShowArchiveConfirm(true);
        } else {
          setFlatFocusIndex(prev => Math.min(prev + 1, allNavigableItems.length - 1));
        }
      }, 50);
    }
  }
  break;
```

---

## 3. System-Agenda-Punkte als Unterpunkte

### Aktueller Stand
"Meine Notizen" (`quick_notes`) und "Kommende Termine" (`upcoming_appointments`) sind bereits als `system_type` implementiert und können als Unterpunkte in Templates konfiguriert werden. Sie werden über `SystemAgendaItem` gerendert.

### Verbesserung
Die aktuelle Implementierung funktioniert bereits. Falls gewünscht, kann die Sichtbarkeit in der Preview-Ansicht verbessert werden, aber die Basisfunktionalität ist vorhanden.

**Keine Code-Änderungen erforderlich** - bereits implementiert.

---

## 4. Öffentlichkeitsstatus anzeigen und ändern

### Anforderung
1. Badge zeigen ob Meeting öffentlich ist
2. Toggle in Detail-Card zum nachträglichen Ändern

### Lösung
**Datei:** `src/components/MeetingsView.tsx`

**A. Badge in Meeting-Card anzeigen (Zeile ~2791):**
```typescript
<CardTitle className="text-base flex items-center gap-2">
  {meeting.title}
  {meeting.is_public && (
    <Badge variant="outline" className="text-xs">
      <Globe className="h-3 w-3 mr-1" />
      Öffentlich
    </Badge>
  )}
</CardTitle>
```

**B. Toggle im Edit-Modus hinzufügen (nach Teilnehmer-Sektion, ~Zeile 2787):**
```typescript
{/* Public Toggle */}
<div className="space-y-1.5">
  <div className="flex items-center space-x-2 p-2 bg-muted/50 rounded-md">
    <Checkbox 
      id={`edit_is_public_${meeting.id}`}
      checked={editingMeeting?.is_public || false}
      onCheckedChange={(checked) => setEditingMeeting({ 
        ...editingMeeting!, 
        is_public: !!checked 
      })}
    />
    <label htmlFor={`edit_is_public_${meeting.id}`} className="text-sm flex items-center gap-1.5">
      <Globe className="h-3.5 w-3.5" />
      Öffentlich für alle Teammitglieder
    </label>
  </div>
</div>
```

**C. Import hinzufügen:**
```typescript
import { Globe } from "lucide-react"; // Bereits vorhanden bei anderen Komponenten
```

---

## 5. Mehrfach-Zuweisung für Agenda-Punkte

### Aktueller Stand
- `meeting_agenda_items.assigned_to` ist bereits als `TEXT[]` Array definiert
- Die UI verwendet aktuell nur Einzelauswahl

### Lösung
**Datei:** Neue Komponente für Multi-User-Selektion oder Erweiterung des `UserSelector`

**A. Multi-Select State in Agenda-Item:**
```typescript
// Agenda item already supports array:
assigned_to?: string[] | null;
```

**B. UI-Änderung in der Agenda-Bearbeitung:**

Statt einzelner `UserSelector`, verwende einen Multi-Select:

```typescript
// In der Agenda-Item-Zeile
<Popover>
  <PopoverTrigger asChild>
    <Button variant="outline" size="sm" className="h-8">
      <Users className="h-3.5 w-3.5 mr-1" />
      {item.assigned_to?.length || 0} Zuständige
    </Button>
  </PopoverTrigger>
  <PopoverContent className="w-64">
    <div className="space-y-2">
      <p className="text-sm font-medium">Zuständige auswählen</p>
      {profiles.map(profile => (
        <div key={profile.user_id} className="flex items-center gap-2">
          <Checkbox 
            checked={(item.assigned_to || []).includes(profile.user_id)}
            onCheckedChange={(checked) => {
              const current = item.assigned_to || [];
              const updated = checked 
                ? [...current, profile.user_id]
                : current.filter(id => id !== profile.user_id);
              updateAgendaItem(index, 'assigned_to', updated);
            }}
          />
          <span className="text-sm">{profile.display_name}</span>
        </div>
      ))}
    </div>
  </PopoverContent>
</Popover>
```

**C. Aufgaben-Erstellung mit Mehrfach-Zuweisung:**

Die bestehende Aufgaben-Tabelle `tasks.assigned_to` ist ebenfalls ein `TEXT[]`, daher funktioniert die Mehrfachzuweisung automatisch wenn die Aufgabe aus einem Agenda-Punkt erstellt wird.

---

## Zusammenfassung der Dateien

| Datei | Änderungen |
|-------|------------|
| `src/components/meetings/InlineMeetingParticipantsEditor.tsx` | Optimistic UI für Rollenänderung |
| `src/components/meetings/FocusModeView.tsx` | Enter-Logik für Unterpunkte |
| `src/components/MeetingsView.tsx` | Öffentlichkeits-Badge + Toggle, Multi-Assign UI |

## Umsetzungsreihenfolge

1. **Rollenänderung-Fix** - Einfach, schnelles Fix
2. **Öffentlichkeitsstatus** - UI-Erweiterung in Detail-Card
3. **Enter-Logik** - Fokus-Modus anpassen
4. **Multi-Assign** - UI für Mehrfachauswahl

---

## Technische Details

### Optimistic UI Pattern (Punkt 1)
```
User Action → Update Local State → API Call → On Error: Revert State
```

### Enter-Navigation Logik (Punkt 2)
```
Enter pressed on Main Item with Sub-Items
  → Find first uncompleted Sub-Item
  → Navigate to it (don't complete parent)
  
Enter pressed on Sub-Item OR Main Item without Sub-Items
  → Toggle completion
  → Auto-complete parent if all subs done
  → Navigate to next
```
