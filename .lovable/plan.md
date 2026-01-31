# Plan: Meeting-Agenda Korrekturen und Fokus-Modus

## ✅ IMPLEMENTIERT

Die folgenden Änderungen wurden umgesetzt:

1. **meeting_time bei Erstellung speichern** - createMeeting enthält jetzt meeting_time
2. **Edit-Modus verwendet editingMeeting.meeting_time** - nicht mehr newMeetingTime
3. **loadMeetings filtert archivierte Meetings** - neq('status', 'archived')
4. **loadProfiles nutzt Tenant-Filter** - nur user_tenant_memberships
5. **loadTasks filtert nach user_id/assigned_to** - client-side Filter
6. **updateAgendaItem speichert assigned_to als Array** - [value] statt value
7. **SystemAgendaItem übergibt meetingId/allowStarring** - Props hinzugefügt
8. **UserSelector entfernt Fallback bei Tenant** - nur Tenant-Mitglieder
9. **Fokus-Modus implementiert** - FocusModeView mit Tastaturnavigation

---


## 1. Uhrzeit und Teilnehmer fehlen in Meeting-Details

### 1.1 Uhrzeit wird bei Erstellung nicht gespeichert

**Ursache (Zeilen 654-665):** In `createMeeting` wird `meeting_time` NICHT mit gespeichert:

```typescript
const insertData: any = {
  title: newMeeting.title,
  // ... andere Felder
  // FEHLT: meeting_time: newMeetingTime
};
```

**Lösung:**
```typescript
const insertData: any = {
  // ...
  meeting_time: newMeetingTime,  // Hinzufügen!
};
```

### 1.2 Bearbeitung verwendet falsche Zeit-Variable

**Ursache (Zeilen 2429-2432):** Der TimePickerCombobox im Edit-Modus nutzt `newMeetingTime`, aber das ist eine globale Variable für NEUE Meetings, nicht für das bearbeitete Meeting:

```typescript
<TimePickerCombobox
  value={newMeetingTime}  // FALSCH - nutzt globale Variable
  onChange={setNewMeetingTime}
/>
```

**Lösung:** Statt `newMeetingTime` muss `editingMeeting.meeting_time` verwendet werden:
```typescript
<TimePickerCombobox
  value={editingMeeting.meeting_time || '10:00'}
  onChange={(time) => setEditingMeeting({ ...editingMeeting, meeting_time: time })}
/>
```

### 1.3 updateMeeting verwendet falsche Zeit

**Ursache (Zeilen 1996-1999):** Die `updateMeeting`-Funktion verwendet `newMeetingTime` als Fallback:

```typescript
const timeToUse = meetingTimeOverride || newMeetingTime;  // FALSCH
```

**Lösung:** Die Zeit muss aus dem `updates`-Objekt kommen:
```typescript
const timeToUse = updates.meeting_time || editingMeeting?.meeting_time;
```

### 1.4 Teilnehmer fehlen in Meeting-Card-Anzeige und Bearbeitung

**Ursache (Zeilen 2436-2460):** Die Meeting-Card zeigt keine Teilnehmer an, weder in der Anzeige noch im Edit-Modus.

**Lösung:** 
1. In der Anzeige: Teilnehmer-Avatare hinzufügen (ähnlich wie bei der Erstellung)
2. Im Edit-Modus: `MeetingParticipantsManager` integrieren

---

## 2. Archivierte Meetings erscheinen temporär in der Liste

**Ursache (Zeilen 689-690):** Nach `createMeeting` wird das neue Meeting zur Liste hinzugefügt, aber dann lädt Zeile 833-842 ALLE Meetings neu - ohne Filterung nach User:

```typescript
const { data: allMeetings } = await supabase
  .from('meetings')
  .select('*')
  .eq('tenant_id', currentTenant.id)  // Filtert nur nach Tenant!
  .order('meeting_date', { ascending: false });
```

**Lösung:** Den Filter für `status !== 'archived'` und User-ID hinzufügen:
```typescript
const { data: allMeetings } = await supabase
  .from('meetings')
  .select('*')
  .eq('tenant_id', currentTenant.id)
  .neq('status', 'archived')
  .eq('user_id', user.id)
  .order('meeting_date', { ascending: false });
```

---

## 3. Stern-Markierung für Termine nicht in UI integriert

**Ursache:** `UpcomingAppointmentsSection` hat die Props `allowStarring` und `meetingId`, aber `SystemAgendaItem` übergibt diese nicht:

```typescript
// SystemAgendaItem.tsx Zeile 43-47
<UpcomingAppointmentsSection 
  meetingDate={meetingDate} 
  // FEHLT: meetingId und allowStarring
/>
```

**Lösung:** Props in `SystemAgendaItem` hinzufügen und weitergeben:

```typescript
interface SystemAgendaItemProps {
  // ...existing props
  meetingId?: string;
  allowStarring?: boolean;
}

<UpcomingAppointmentsSection 
  meetingDate={meetingDate}
  meetingId={meetingId}
  allowStarring={allowStarring}
/>
```

Dann in `MeetingsView.tsx` wo `SystemAgendaItem` verwendet wird:
```typescript
<SystemAgendaItem 
  systemType="upcoming_appointments" 
  meetingDate={activeMeeting.meeting_date}
  meetingId={activeMeeting.id}
  allowStarring={true}
/>
```

---

## 4. Zuweisung von Tagesordnungspunkten bleibt nicht bestehen

**Ursache (Zeile 1353):** `updateAgendaItem` speichert den Wert direkt:

```typescript
await supabase
  .from('meeting_agenda_items')
  .update({ [field]: value })  // value = user_id als String
  .eq('id', updated[index].id);
```

Aber die Datenbank-Spalte `assigned_to` erwartet ein Array (TEXT[]):

```sql
assigned_to: ["user-id-1"]  -- Erwartet Array
```

**Lösung:**
```typescript
// In updateAgendaItem
let dbValue = value;
if (field === 'assigned_to') {
  dbValue = value ? [value] : null;  // Als Array speichern
}

await supabase
  .from('meeting_agenda_items')
  .update({ [field]: dbValue })
  .eq('id', updated[index].id);
```

---

## 5. Profiles laden alle Benutzer, nicht nur Tenant-Mitglieder

**Ursache (Zeilen 350-369):** `loadProfiles` lädt ALLE Profile ohne Tenant-Filter:

```typescript
const { data, error } = await supabase
  .from('profiles')
  .select('user_id, display_name');  // Kein Tenant-Filter!
```

**Lösung:** Nur Tenant-Mitglieder laden:
```typescript
const loadProfiles = async () => {
  if (!currentTenant?.id) return;
  
  try {
    // Get user IDs from tenant memberships
    const { data: memberships } = await supabase
      .from('user_tenant_memberships')
      .select('user_id')
      .eq('tenant_id', currentTenant.id)
      .eq('is_active', true);
    
    if (!memberships) return;
    
    const userIds = memberships.map(m => m.user_id);
    
    const { data, error } = await supabase
      .from('profiles')
      .select('user_id, display_name')
      .in('user_id', userIds);
    
    // ... rest of logic
  }
};
```

---

## 6. Teilnehmer-Auswahl bei Erstellung nicht Tenant-beschränkt

**Analyse:** Der `UserSelector` (Zeilen 52-107) filtert bereits nach `tenant_id` wenn verfügbar, aber hat einen Fallback auf alle Profile. Der Fallback sollte entfernt oder eingeschränkt werden.

**Lösung:** Fallback entfernen, um sicherzustellen, dass nur Tenant-Mitglieder auswählbar sind:
```typescript
// In UserSelector.tsx Zeile 85-98: Fallback entfernen
if (usersData.length === 0 && !currentTenant?.id) {
  // Nur wenn KEIN Tenant vorhanden ist, Fallback verwenden
  // Ansonsten: leere Liste
}
```

---

## 7. Fokus-Modus für laufende Besprechungen

**Implementierung:** Neuer Vollbild-Modus für aktive Meetings mit:

### 7.1 State für Fokus-Modus
```typescript
const [isFocusMode, setIsFocusMode] = useState(false);
const [focusedItemIndex, setFocusedItemIndex] = useState(0);
const focusItemRefs = useRef<(HTMLDivElement | null)[]>([]);
```

### 7.2 Tastaturnavigation
```typescript
useEffect(() => {
  if (!isFocusMode) return;
  
  const handleKeyDown = (e: KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
      case 'j':
        setFocusedItemIndex(prev => Math.min(prev + 1, activeMeetingItems.length - 1));
        break;
      case 'ArrowUp':
      case 'k':
        setFocusedItemIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        // Toggle completed status
        break;
      case 'Escape':
        setIsFocusMode(false);
        break;
      case '?':
        // Show keyboard shortcuts legend
        break;
    }
  };
  
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [isFocusMode, focusedItemIndex]);
```

### 7.3 Auto-Scroll zum fokussierten Element
```typescript
useEffect(() => {
  if (isFocusMode && focusItemRefs.current[focusedItemIndex]) {
    focusItemRefs.current[focusedItemIndex]?.scrollIntoView({
      behavior: 'smooth',
      block: 'center'
    });
  }
}, [focusedItemIndex, isFocusMode]);
```

### 7.4 UI-Komponente: FocusModeView
```typescript
const FocusModeView = () => (
  <div className="fixed inset-0 z-50 bg-background flex flex-col">
    <header className="p-4 border-b flex justify-between items-center">
      <h1 className="text-2xl font-bold">{activeMeeting?.title}</h1>
      <div className="flex gap-2">
        <Button variant="ghost" onClick={() => setShowKeyboardLegend(true)}>
          <Keyboard className="h-4 w-4 mr-2" /> Tastenkürzel
        </Button>
        <Button variant="outline" onClick={() => setIsFocusMode(false)}>
          <X className="h-4 w-4 mr-2" /> Fokus-Modus beenden
        </Button>
      </div>
    </header>
    
    <main className="flex-1 overflow-auto p-8">
      {/* Fortschrittsanzeige */}
      <div className="mb-6">
        <Progress value={(completedItems / totalItems) * 100} />
        <span className="text-sm text-muted-foreground">
          {completedItems} von {totalItems} Punkten besprochen
        </span>
      </div>
      
      {/* Agenda-Punkte mit Hervorhebung */}
      {activeMeetingItems.map((item, index) => (
        <div 
          key={item.id}
          ref={(el) => focusItemRefs.current[index] = el}
          className={cn(
            "p-6 rounded-lg mb-4 transition-all",
            index === focusedItemIndex && "ring-2 ring-primary bg-primary/5 scale-[1.02]",
            item.is_completed && "opacity-60 line-through"
          )}
        >
          {/* Item content */}
        </div>
      ))}
    </main>
  </div>
);
```

### 7.5 Tastenkürzel-Legende
| Taste | Aktion |
|-------|--------|
| ↓ / j | Nächster Punkt |
| ↑ / k | Vorheriger Punkt |
| Enter | Punkt als besprochen markieren |
| Space | Notizen-Feld öffnen |
| r | Ergebnis eingeben |
| c | Auf nächste Besprechung übertragen |
| Esc | Fokus-Modus beenden |
| ? | Tastenkürzel anzeigen |

---

## 8. Keine Aufgaben bei "Aufgabe hinzufügen"

**Ursache (Zeilen 372-391):** Die `loadTasks`-Abfrage:

```typescript
.or(`created_by.eq.${user?.id},assigned_to.ilike.%${user?.id}%`)
```

Das Problem: `assigned_to` ist ein Array-Feld (TEXT[]), aber `.ilike` funktioniert nur mit Strings. Bei Array-Feldern muss `@>` (contains) oder `cs` (contains substring für JSON) verwendet werden.

**Lösung:**
```typescript
const loadTasks = async () => {
  if (!user?.id || !currentTenant?.id) return;
  
  try {
    // Load tasks where user is creator
    const { data: createdTasks, error: createdError } = await supabase
      .from('tasks')
      .select('*')
      .eq('tenant_id', currentTenant.id)
      .eq('status', 'todo')
      .eq('created_by', user.id);
    
    // Load tasks where user is assigned
    const { data: assignedTasks, error: assignedError } = await supabase
      .from('tasks')
      .select('*')
      .eq('tenant_id', currentTenant.id)
      .eq('status', 'todo')
      .or(`assigned_to.cs.{"${user.id}"},assigned_to.eq.${user.id}`);
    
    // Combine and deduplicate
    const allTaskIds = new Set<string>();
    const allTasks: any[] = [];
    
    [...(createdTasks || []), ...(assignedTasks || [])].forEach(task => {
      if (!allTaskIds.has(task.id)) {
        allTaskIds.add(task.id);
        allTasks.push(task);
      }
    });
    
    setTasks(allTasks.sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    ));
  }
};
```

---

## 9. UI/UX-Verbesserungen

### 9.1 Meeting-Card Verbesserungen

| Element | Verbesserung |
|---------|--------------|
| Teilnehmer | Avatare in der Card anzeigen |
| Zeit | Uhrzeit prominent neben Datum |
| Beschreibung | Unter Titel mit line-clamp |
| Status-Indikator | Badge für "Geplant", "Laufend", "Abgeschlossen" |

### 9.2 Aktives Meeting visuell verbessern

- Fortschrittsbalken oben: "X von Y Punkten besprochen"
- Timer: Verstrichene Zeit seit Meeting-Start
- Abgehakte Punkte: Durchgestrichen mit grünem Häkchen
- Farbige Hervorhebung für übertragene Punkte

### 9.3 Fokus-Modus Button

```typescript
<Button 
  variant="outline" 
  onClick={() => setIsFocusMode(true)}
  className="gap-2"
>
  <Maximize className="h-4 w-4" />
  Fokus-Modus
</Button>
```

---

## Zusammenfassung der Änderungen

| # | Datei | Änderung |
|---|-------|----------|
| 1 | `MeetingsView.tsx` | `createMeeting`: `meeting_time` speichern |
| 2 | `MeetingsView.tsx` | Edit-Modus: `editingMeeting.meeting_time` statt `newMeetingTime` |
| 3 | `MeetingsView.tsx` | `loadMeetings` nach Erstellung: `status !== 'archived'` Filter |
| 4 | `MeetingsView.tsx` | `loadProfiles`: Tenant-Filter hinzufügen |
| 5 | `MeetingsView.tsx` | `loadTasks`: Korrekte Array-Suche für `assigned_to` |
| 6 | `MeetingsView.tsx` | `updateAgendaItem`: `assigned_to` als Array speichern |
| 7 | `MeetingsView.tsx` | Meeting-Card: Teilnehmer und Uhrzeit in Anzeige/Edit |
| 8 | `MeetingsView.tsx` | Fokus-Modus mit Tastaturnavigation implementieren |
| 9 | `SystemAgendaItem.tsx` | `meetingId` und `allowStarring` Props hinzufügen |
| 10 | `UserSelector.tsx` | Fallback entfernen wenn Tenant vorhanden |

---

## Erwartete Ergebnisse

1. **Uhrzeit wird korrekt gespeichert** - Bei Erstellung und Bearbeitung
2. **Teilnehmer sichtbar und bearbeitbar** - In Card und Edit-Modus
3. **Keine archivierten Meetings** - Korrekte Filterung
4. **Stern-Markierung funktioniert** - In "Kommende Termine"
5. **Zuweisung bleibt bestehen** - Array-Format für DB
6. **Nur Tenant-Mitglieder** - In allen Auswahlen
7. **Fokus-Modus** - Vollbild mit Tastaturnavigation
8. **Aufgaben werden angezeigt** - Korrekte Suche
9. **Verbesserte UI** - Moderner und übersichtlicher

