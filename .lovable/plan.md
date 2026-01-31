
# Plan: Meeting-Agenda Korrekturen (Teil 2) und Fokus-Modus Verbesserungen

## Zusammenfassung der identifizierten Probleme

Nach eingehender Codeanalyse wurden folgende technischen Ursachen identifiziert:

---

## 1. Enter in Fokus-Modus: Automatisch zum nächsten Punkt & Archivierungs-Frage

**Aktuelle Logik (FocusModeView.tsx Zeilen 102-107):**
```typescript
case 'Enter':
  e.preventDefault();
  if (currentItem?.id && currentItemGlobalIndex !== -1) {
    onUpdateItem(currentItemGlobalIndex, 'is_completed', !currentItem.is_completed);
  }
  break;
```

**Probleme:**
- Nach dem Markieren bleibt der Fokus auf dem gleichen Punkt
- Keine Prüfung, ob es der letzte Punkt ist
- Keine Archivierungs-Abfrage

**Lösung:**
```typescript
case 'Enter':
  e.preventDefault();
  if (currentItem?.id && currentItemGlobalIndex !== -1) {
    const isNowCompleted = !currentItem.is_completed;
    onUpdateItem(currentItemGlobalIndex, 'is_completed', isNowCompleted);
    
    // Wenn markiert: zum nächsten unerledigten Punkt springen
    if (isNowCompleted) {
      // Prüfen ob es der letzte Punkt ist (nach Aktualisierung alle erledigt)
      const allCompletedAfter = mainItems.every((item, idx) => 
        idx === focusedItemIndex ? true : item.is_completed
      );
      
      if (allCompletedAfter) {
        // Alle Punkte erledigt - Archivierungs-Dialog anzeigen
        setShowArchiveConfirm(true);
      } else {
        // Zum nächsten Punkt navigieren
        setFocusedItemIndex(prev => Math.min(prev + 1, mainItems.length - 1));
      }
    }
  }
  break;
```

**Zusätzlich:** Neuer State und AlertDialog für Archivierungs-Bestätigung:
```typescript
const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
```

Props erweitern für onArchive-Callback:
```typescript
interface FocusModeViewProps {
  // ... existing props
  onArchive: () => void;
}
```

---

## 2. Unterpunkte und dynamische Inhalte im Fokus-Modus anzeigen

**Aktuelle Logik (FocusModeView.tsx Zeilen 278-300):**
Die Sub-Items werden bereits angezeigt, aber `SystemAgendaItem` (für "Kommende Termine" und "Meine Notizen") fehlt.

**Lösung:**
Props erweitern um `linkedQuickNotes` und System-Item-Rendering hinzufügen:

```typescript
interface FocusModeViewProps {
  // ... existing props
  linkedQuickNotes?: any[];
  meetingId?: string;
  onUpdateQuickNoteResult?: (noteId: string, result: string) => void;
}

// Im Rendering nach item.notes:
{item.system_type === 'upcoming_appointments' && (
  <div className="mt-4">
    <UpcomingAppointmentsSection 
      meetingDate={meeting.meeting_date}
      meetingId={meeting.id}
      allowStarring={true}
      defaultCollapsed={false}
    />
  </div>
)}

{item.system_type === 'quick_notes' && linkedQuickNotes && (
  <div className="mt-4">
    <SystemAgendaItem 
      systemType="quick_notes"
      linkedQuickNotes={linkedQuickNotes}
      isEmbedded={true}
    />
  </div>
)}
```

---

## 3. Space/r für Ergebnis-Eingabe funktioniert nicht

**Aktuelle Logik (FocusModeView.tsx Zeilen 108-115):**
```typescript
case ' ':
  e.preventDefault();
  setShowResultInput(true);  // State wird gesetzt...
  break;
```

**Problem:** `showResultInput` State wird gesetzt, aber nirgendwo verwendet! Das Ergebnis-Textarea ist bereits immer sichtbar (Zeilen 303-331) für den fokussierten Item.

**Lösung Option 1 (Empfohlen):** Das Textarea beim fokussierten Item automatisch fokussieren:
```typescript
case ' ':
case 'r':
  e.preventDefault();
  // Focus auf das Textarea setzen
  const textarea = document.querySelector(`#result-input-${currentItem?.id}`) as HTMLTextAreaElement;
  if (textarea) {
    textarea.focus();
    textarea.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  break;
```

Textarea ID hinzufügen:
```typescript
<Textarea
  id={`result-input-${item.id}`}
  value={item.result_text || ''}
  // ...
/>
```

---

## 4. Teilnehmer-Liste bei Meeting-Erstellung ist leer

**Ursache:** `loadProfiles` und `UserSelector` laden korrekt aus `user_tenant_memberships`, aber die Timing/Dependency ist falsch.

**Analyse des UserSelector (Zeilen 40-43):**
```typescript
useEffect(() => {
  console.log('UserSelector: Fetching users, tenant:', currentTenant?.id);
  fetchUsers();
}, [currentTenant?.id]);
```

**Problem:** Wenn `currentTenant` noch `undefined` ist beim ersten Render, dann lädt der Selector nichts. Da `loadProfiles` denselben Tenant braucht, liegt das Problem in der Reihenfolge.

**Lösung in MeetingsView.tsx:**
`loadProfiles` in der Dependency-Liste von useEffect überprüfen und sicherstellen, dass es NACH dem Tenant geladen wird:

```typescript
useEffect(() => {
  if (user && currentTenant?.id) {  // Beide müssen vorhanden sein
    loadMeetings();
    loadProfiles();
    loadTasks();
    loadMeetingTemplates();
  }
}, [user, currentTenant?.id]);  // Tenant als Dependency hinzufügen
```

---

## 5. Zeit mit Sekunden angezeigt (hh:mm:ss statt hh:mm)

**Ursachen:**
1. Die Datenbank speichert `meeting_time` als TIME-Feld, das automatisch Sekunden enthält
2. Das Frontend zeigt den Wert direkt an ohne Formatierung

**Betroffene Stellen:**
- `MeetingsView.tsx` Zeile 2512: `{meeting.meeting_time} Uhr`
- `MeetingsView.tsx` Zeile 3165: `${selectedMeeting.meeting_time} Uhr`
- `FocusModeView.tsx` Zeile 156: `${meeting.meeting_time} Uhr`

**Lösung:** Hilfsfunktion zum Formatieren der Zeit:
```typescript
const formatMeetingTime = (time: string | undefined) => {
  if (!time) return null;
  // Entferne Sekunden falls vorhanden (HH:MM:SS -> HH:MM)
  return time.substring(0, 5);
};

// Verwendung:
<span>{formatMeetingTime(meeting.meeting_time)} Uhr</span>
```

---

## 6. Card-Bearbeitung Design verbessern + rote Umrandung bei Uhrzeit

**Aktuelle Card-Bearbeitung (Zeilen 2452-2496):** Einfache Inputs ohne Labels oder Icons.

**Rote Umrandung:** Die `TimePickerCombobox` zeigt `border-destructive` bei ungültiger Zeit (Zeile 141):
```typescript
className={cn(
  "pl-9 pr-3",
  !isValid && "border-destructive focus-visible:ring-destructive"
)}
```

**Problem:** Wenn der Wert `23:00:00` (mit Sekunden) ist, validiert es nicht gegen `HH:MM` Regex.

**Lösung 1: Sekunden beim Setzen entfernen:**
```typescript
<TimePickerCombobox
  value={(editingMeeting.meeting_time || '10:00').substring(0, 5)}
  onChange={(time) => setEditingMeeting({ ...editingMeeting, meeting_time: time })}
/>
```

**Lösung 2: Card-Design mit Labels und Icons verbessern:**
```typescript
<div className="space-y-3">
  <div className="space-y-1.5">
    <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
      <span>Titel</span>
    </label>
    <Input
      value={editingMeeting.title}
      onChange={(e) => setEditingMeeting({ ...editingMeeting, title: e.target.value })}
      className="font-semibold"
    />
  </div>
  
  <div className="space-y-1.5">
    <label className="text-xs font-medium text-muted-foreground">Beschreibung</label>
    <Textarea ... />
  </div>
  
  <div className="space-y-1.5">
    <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
      <MapPin className="h-3 w-3" /> Ort
    </label>
    <Input ... />
  </div>
  
  <div className="grid grid-cols-2 gap-3">
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
        <CalendarIcon className="h-3 w-3" /> Datum
      </label>
      <Popover>...</Popover>
    </div>
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
        <Clock className="h-3 w-3" /> Uhrzeit
      </label>
      <TimePickerCombobox ... />
    </div>
  </div>
</div>
```

---

## 7. Zugewiesene Person wird nicht angezeigt

**Ursache (Zeilen 2701-2702):**
```typescript
<Select
  value={item.assigned_to || 'unassigned'}
```

**Problem:** `assigned_to` ist ein ARRAY (`string[]`) in der Datenbank, nicht ein String! 
Nach dem Speichern wird `[userId]` zurückgeladen, aber Select erwartet einen String-Wert.

**Lösung:**
```typescript
const assignedValue = Array.isArray(item.assigned_to) && item.assigned_to.length > 0
  ? item.assigned_to[0]
  : 'unassigned';

<Select
  value={assignedValue}
  onValueChange={(value) => updateAgendaItem(
    agendaItems.findIndex(i => i.id === item.id), 
    'assigned_to', 
    value === 'unassigned' ? null : value
  )}
>
```

---

## 8. Stern-Markierung für Termine funktioniert nicht

**Aktuelle Situation:**
- `UpcomingAppointmentsSection` hat den Code für Stern-Markierung (Zeilen 162-216)
- `SystemAgendaItem` übergibt `meetingId` und `allowStarring` bereits korrekt (Zeilen 47-50)
- In `MeetingsView.tsx` Zeilen 2731-2736 wird aber NUR `meetingDate` und `isEmbedded` übergeben:

```typescript
<SystemAgendaItem 
  systemType="upcoming_appointments" 
  meetingDate={activeMeeting.meeting_date}
  isEmbedded={true}
/>
```

**Lösung:** Die fehlenden Props hinzufügen:
```typescript
<SystemAgendaItem 
  systemType="upcoming_appointments" 
  meetingDate={activeMeeting.meeting_date}
  meetingId={activeMeeting.id}
  allowStarring={true}
  isEmbedded={true}
/>
```

---

## Zusammenfassung der Änderungen

| # | Datei | Änderung |
|---|-------|----------|
| 1 | `FocusModeView.tsx` | Enter → nächster Punkt + Archivierungs-Frage |
| 2 | `FocusModeView.tsx` | System-Items (Termine, Notizen) anzeigen |
| 3 | `FocusModeView.tsx` | Space/r fokussiert Ergebnis-Textarea |
| 4 | `MeetingsView.tsx` | `loadProfiles` Dependency auf `currentTenant?.id` |
| 5 | `MeetingsView.tsx` | Zeit-Formatierung: Sekunden entfernen |
| 6 | `MeetingsView.tsx` | Card-Bearbeitung Design mit Labels/Icons |
| 7 | `MeetingsView.tsx` | `assigned_to` Array-Handling im Select |
| 8 | `MeetingsView.tsx` | `meetingId` + `allowStarring` für SystemAgendaItem |

---

## Erwartete Ergebnisse

1. **Fokus wechselt nach Enter** - Automatisch zum nächsten Punkt
2. **Archivierungs-Frage** - Bei letztem Punkt erscheint Dialog
3. **System-Inhalte sichtbar** - Termine und Notizen im Fokus-Modus
4. **Ergebnis-Eingabe funktioniert** - Space/r fokussiert Textarea
5. **Teilnehmer-Liste gefüllt** - Tenant-basierte Benutzer geladen
6. **Zeit ohne Sekunden** - `10:00` statt `10:00:00`
7. **Schöneres Card-Design** - Labels und Icons bei Bearbeitung
8. **Zuweisung wird angezeigt** - Korrektes Array-Handling
9. **Stern-Markierung funktioniert** - Props korrekt übergeben
