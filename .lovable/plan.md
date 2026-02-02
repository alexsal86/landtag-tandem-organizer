
# Plan: Meeting-System Verbesserungen (Teil 7)

## Zusammenfassung der 5 identifizierten Probleme

---

## 1. Teilnehmer werden nicht gespeichert und angezeigt

### Problem
Der `InlineMeetingParticipantsEditor` zeigt keine Teilnehmer an und das Hinzufügen funktioniert nicht. Die `meeting_participants` Tabelle ist leer.

### Ursache
Die RLS-Policy für `meeting_participants` prüft, ob der aktuelle Benutzer der `user_id` des zugehörigen Meetings entspricht. Der Code zum Hinzufügen sieht korrekt aus, aber es könnte ein Problem mit der Anzeige geben - der `InlineMeetingParticipantsEditor` wird mit `meeting.id` aufgerufen (Zeile 2762-2764), aber `meeting` hat dort den Typ des Schleifenelements, nicht des `editingMeeting`.

Weiteres Problem: Bei der Meeting-Erstellung werden Teilnehmer korrekt hinzugefügt (Zeilen 754-764), aber die Teilnehmer werden nicht auf der Card angezeigt, weil `MeetingParticipantAvatars` nur bei vorhandenen Meetings geladen wird.

### Lösung

1. **Rollen-Auswahl im Editor hinzufügen:**
```typescript
// InlineMeetingParticipantsEditor erweitern mit Rolle-Select
interface Participant {
  id: string;
  user_id: string;
  role: 'organizer' | 'participant' | 'optional';
  user?: {...};
}

// Select für Rolle beim Hinzufügen
const [selectedRole, setSelectedRole] = useState<'organizer' | 'participant' | 'optional'>('participant');
```

2. **Rolle ändern können:**
```typescript
const handleRoleChange = async (participantId: string, newRole: string) => {
  const { error } = await supabase
    .from('meeting_participants')
    .update({ role: newRole })
    .eq('id', participantId);
  
  if (!error) {
    setParticipants(prev => prev.map(p => 
      p.id === participantId ? { ...p, role: newRole } : p
    ));
  }
};
```

3. **UI für Rolle anzeigen:**
```typescript
{participants.map(p => (
  <div key={p.id} className="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
    <Avatar className="h-6 w-6">...</Avatar>
    <span className="flex-1 text-sm">{p.user?.display_name}</span>
    <Select value={p.role} onValueChange={(v) => handleRoleChange(p.id, v)}>
      <SelectTrigger className="w-28 h-7 text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="organizer">Organisator</SelectItem>
        <SelectItem value="participant">Teilnehmer</SelectItem>
        <SelectItem value="optional">Optional</SelectItem>
      </SelectContent>
    </Select>
    <Button onClick={() => handleRemoveParticipant(p.id)}>...</Button>
  </div>
))}
```

---

## 2. Meeting-Sichtbarkeit: Nur Teilnehmer sehen Agenda + Öffentlich-Option

### Problem
Aktuell kann jeder Benutzer im gleichen Tenant alle Meetings sehen. Es gibt keine Unterscheidung zwischen privat (nur Teilnehmer) und öffentlich.

### Lösung

**A) Datenbank-Änderung:**
```sql
-- Neue Spalte für öffentliche Meetings
ALTER TABLE meetings ADD COLUMN is_public BOOLEAN DEFAULT false;

-- Neue RLS-Policies für Sichtbarkeit
CREATE POLICY "Users can view meetings they created or participate in or are public"
ON meetings FOR SELECT
USING (
  user_id = auth.uid()
  OR is_public = true
  OR EXISTS (
    SELECT 1 FROM meeting_participants 
    WHERE meeting_id = meetings.id 
    AND user_id = auth.uid()
  )
);
```

**B) Frontend-Änderungen:**

1. **Meeting-Erstellung erweitern:**
```typescript
// In newMeeting State:
const [newMeeting, setNewMeeting] = useState<Meeting>({
  ...
  is_public: false
});

// Im Dialog:
<div className="flex items-center space-x-2">
  <Checkbox 
    id="is_public" 
    checked={newMeeting.is_public || false}
    onCheckedChange={(checked) => setNewMeeting({ ...newMeeting, is_public: !!checked })}
  />
  <label htmlFor="is_public" className="text-sm">
    Öffentliches Meeting (alle Teammitglieder können es sehen)
  </label>
</div>
```

2. **Schreibschutz für Nicht-Teilnehmer:**
```typescript
// Prüfen ob Benutzer Teilnehmer oder Ersteller ist
const canEdit = meeting.user_id === user?.id || 
  meetingParticipants.some(p => p.user_id === user?.id);

// Bei öffentlichen Meetings ohne Teilnehmerschaft: Nur-Lesen-Modus
{!canEdit && (
  <Badge variant="outline" className="text-xs">Nur Ansicht</Badge>
)}
```

---

## 3. Fokus-Modus: Unterpunkte navigierbar + Stern-Navigation

### Problem A: Termin-Markierung (n/p/s) funktioniert nicht
Die Tastenkürzel `n`, `p`, `s` für die Termin-Navigation werden nicht korrekt ausgeführt, weil `focusedAppointmentIndex` nur initialisiert wird, wenn man bereits im System-Item ist.

### Problem B: Unterpunkte nicht einzeln navigierbar
Aktuell werden nur Hauptpunkte navigiert. Unterpunkte werden unter dem Hauptpunkt angezeigt, aber nicht fokussiert.

### Lösung A: Termin-Navigation reparieren

```typescript
// Reset focusedAppointmentIndex when leaving upcoming_appointments item
useEffect(() => {
  if (currentItem?.system_type !== 'upcoming_appointments') {
    setFocusedAppointmentIndex(-1);
  }
}, [currentItem?.system_type]);

// Beim Fokussieren auf "Kommende Termine" automatisch starten
case 'n':
  e.preventDefault();
  if (currentItem?.system_type === 'upcoming_appointments') {
    if (focusedAppointmentIndex < 0) {
      // Ersten Termin fokussieren
      setFocusedAppointmentIndex(0);
    } else if (appointmentsCount > 0) {
      setFocusedAppointmentIndex(prev => Math.min(prev + 1, appointmentsCount - 1));
    }
  }
  break;
```

### Lösung B: Unterpunkte navigierbar machen

**Neues Konzept:**
- `focusedItemIndex` bleibt für Hauptpunkte
- Neuer State `focusedSubItemIndex` für Unterpunkte (-1 = keiner fokussiert)
- Navigation: Wenn auf Hauptpunkt mit Unterpunkten → Tab oder → Pfeil-rechts wechselt zu erstem Unterpunkt
- Wenn letzter Unterpunkt → weiter zum nächsten Hauptpunkt
- Ein Hauptpunkt ist "besprochen", wenn alle seine Unterpunkte besprochen wurden

```typescript
// Neuer State
const [focusedSubItemIndex, setFocusedSubItemIndex] = useState(-1);

// Alle navigierbaren Items (flat list)
const allNavigableItems = useMemo(() => {
  const result: Array<{item: AgendaItem; isSubItem: boolean; parentIndex: number}> = [];
  mainItems.forEach((main, mainIdx) => {
    result.push({ item: main, isSubItem: false, parentIndex: mainIdx });
    const subs = agendaItems.filter(sub => 
      sub.parent_id === main.id || sub.parentLocalKey === main.id
    );
    subs.forEach(sub => {
      result.push({ item: sub, isSubItem: true, parentIndex: mainIdx });
    });
  });
  return result;
}, [mainItems, agendaItems]);

// Navigation durch alle Items
case 'ArrowDown':
case 'j':
  e.preventDefault();
  setFlatIndex(prev => Math.min(prev + 1, allNavigableItems.length - 1));
  break;
```

**Auto-Complete Hauptpunkt:**
```typescript
// Wenn letzter Unterpunkt abgehakt wird, Hauptpunkt auch abhaken
const handleSubItemComplete = (subItem, isCompleted) => {
  onUpdateItem(subItemIndex, 'is_completed', isCompleted);
  
  if (isCompleted) {
    // Prüfen ob alle Unterpunkte des Hauptpunkts jetzt erledigt sind
    const parentItem = mainItems[currentParentIndex];
    const allSubItems = agendaItems.filter(s => s.parent_id === parentItem.id);
    const allSubsCompleted = allSubItems.every(s => 
      s.id === subItem.id ? true : s.is_completed
    );
    
    if (allSubsCompleted && !parentItem.is_completed) {
      onUpdateItem(parentIndex, 'is_completed', true);
    }
  }
};
```

---

## 4. Archiv: Protokolle für Teilnehmer und öffentliche Meetings

### Problem
Die `MeetingArchiveView` zeigt nur Meetings, bei denen der Benutzer der `user_id` (Ersteller) ist.

### Lösung

```typescript
// Erweiterte Abfrage in loadArchivedMeetings
const loadArchivedMeetings = async () => {
  try {
    setLoading(true);
    
    // 1. Eigene archivierte Meetings
    const { data: ownMeetings } = await supabase
      .from('meetings')
      .select('*')
      .eq('user_id', user?.id)
      .eq('status', 'archived')
      .order('meeting_date', { ascending: false });
    
    // 2. Archivierte Meetings, an denen man Teilnehmer war
    const { data: participantMeetings } = await supabase
      .from('meeting_participants')
      .select('meeting_id, meetings(*)')
      .eq('user_id', user?.id);
    
    const participantArchivedMeetings = (participantMeetings || [])
      .filter(p => p.meetings?.status === 'archived')
      .map(p => p.meetings);
    
    // 3. Öffentliche archivierte Meetings (gleicher Tenant)
    const { data: publicMeetings } = await supabase
      .from('meetings')
      .select('*')
      .eq('status', 'archived')
      .eq('is_public', true)
      .eq('tenant_id', currentTenant?.id)
      .neq('user_id', user?.id); // Nicht die eigenen nochmal
    
    // Kombinieren und Duplikate entfernen
    const allMeetingsMap = new Map();
    [...(ownMeetings || []), ...participantArchivedMeetings, ...(publicMeetings || [])]
      .forEach(m => allMeetingsMap.set(m.id, m));
    
    const allMeetings = Array.from(allMeetingsMap.values())
      .sort((a, b) => new Date(b.meeting_date).getTime() - new Date(a.meeting_date).getTime());
    
    setArchivedMeetings(allMeetings);
  } finally {
    setLoading(false);
  }
};
```

---

## 5. Carryover-Aufgaben: Inhalt und Zuweisung fehlen

### Problem
Die Datenbank zeigt, dass `assigned_to` bei manchen Items als `[[userId]]` (doppelt verschachtelt) gespeichert wird. Dies kommt vom FocusModeView:

```typescript
onUpdateItem(currentItemGlobalIndex, 'assigned_to', value ? [value] : null);
```

Und in `updateAgendaItem` wird nochmal `flat()` aufgerufen, aber das Problem ist, dass die DB bereits `[[userId]]` enthält.

### Ursache der falschen Aufgaben
In `archiveMeeting` Step 3 wird korrekt gefiltert:
```typescript
const itemsWithAssignment = agendaItemsData?.filter(item => 
  item.assigned_to && item.result_text?.trim() && !item.task_id
) || [];
```

ABER: Die Prüfung `item.result_text?.trim()` schlägt fehl für Items, die KEIN result_text haben. Zum Beispiel:
- "Aktuelles aus dem Landtag" hat `assigned_to: [[ff0e6d83...]]` aber `result_text: null`
- "Begrüßung" hat `assigned_to: [ff0e6d83...]` (korrekt) UND `result_text` (sollte funktionieren!)

Das Problem mit der Datenbank-Anzeige:
```
"Begrüßung": assigned_to: [ff0e6d83...]  <- Array
"Aktuelles aus dem Landtag": assigned_to: [[ff0e6d83...]] <- Doppelt-nested
```

### Lösung

1. **Zuweisung im FocusModeView korrigieren:**
Das Problem ist bereits im `updateAgendaItem` behoben mit `flat()`, aber die bestehenden Daten sind kaputt.

2. **archiveMeeting robuster machen:**
```typescript
// Step 3: Create standalone tasks für zugewiesene Items
const itemsWithAssignment = agendaItemsData?.filter(item => {
  // Robuste Prüfung für assigned_to (kann [[id]], [id] oder id sein)
  let hasAssignment = false;
  if (item.assigned_to) {
    if (Array.isArray(item.assigned_to)) {
      const flattened = item.assigned_to.flat();
      hasAssignment = flattened.length > 0 && flattened[0];
    } else {
      hasAssignment = true;
    }
  }
  return hasAssignment && item.result_text?.trim() && !item.task_id;
}) || [];

for (const item of itemsWithAssignment) {
  // Robuste Extraktion des assigned user
  let assignedUserId: string | null = null;
  if (item.assigned_to) {
    const flattened = Array.isArray(item.assigned_to) 
      ? item.assigned_to.flat() 
      : [item.assigned_to];
    assignedUserId = flattened[0] as string || null;
  }
  
  const taskDescription = `**Aus Besprechung:** ${meeting.title}...
**Tagesordnungspunkt:** ${item.title}
${item.description ? `**Beschreibung:** ${item.description}` : ''}
${item.notes ? `**Notizen:** ${item.notes}` : ''}

**Ergebnis:**
${item.result_text}`;
  
  await supabase.from('tasks').insert({
    user_id: user.id,
    title: item.title,
    description: taskDescription,
    assigned_to: assignedUserId,
    // ...
  });
}
```

3. **Korrektur für "nur result_text aber kein assigned_to":**
Umgekehrt: Wenn ein Item `result_text` hat aber keine `assigned_to`, sollte trotzdem ein Subtask erstellt werden (das funktioniert bereits in Step 5).

---

## Zusammenfassung der Änderungen

| # | Datei | Änderung |
|---|-------|----------|
| 1a | `InlineMeetingParticipantsEditor.tsx` | Rollen-Auswahl hinzufügen |
| 1b | `InlineMeetingParticipantsEditor.tsx` | Rollen-Änderung ermöglichen |
| 2a | DB-Migration | `is_public` Spalte hinzufügen |
| 2b | `MeetingsView.tsx` | Öffentlich-Checkbox bei Erstellung |
| 2c | `MeetingsView.tsx` | Nur-Lesen-Modus für Nicht-Teilnehmer |
| 3a | `FocusModeView.tsx` | Termin-Navigation (n/p/s) reparieren |
| 3b | `FocusModeView.tsx` | Unterpunkt-Navigation implementieren |
| 3c | `FocusModeView.tsx` | Auto-Complete Hauptpunkt bei allen Unterpunkten |
| 4 | `MeetingArchiveView.tsx` | Erweiterte Abfrage für Teilnehmer + öffentliche Meetings |
| 5a | `MeetingsView.tsx` | Robuste assigned_to Extraktion in archiveMeeting |
| 5b | `MeetingsView.tsx` | Task-Beschreibung mit Tagesordnungspunkt-Inhalt |

---

## Technische Details

### Datenbank-Migration für is_public

```sql
-- Add is_public column to meetings
ALTER TABLE public.meetings 
ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false;

-- Update RLS policy for viewing meetings
DROP POLICY IF EXISTS "Users can view own meetings" ON meetings;

CREATE POLICY "Users can view meetings they own, participate in, or are public"
ON meetings FOR SELECT
USING (
  user_id = auth.uid()
  OR is_public = true
  OR EXISTS (
    SELECT 1 FROM meeting_participants mp 
    WHERE mp.meeting_id = meetings.id 
    AND mp.user_id = auth.uid()
  )
);

-- Policy for meeting_agenda_items (only participants can see agenda of private meetings)
DROP POLICY IF EXISTS "Users can view agenda items of their meetings" ON meeting_agenda_items;

CREATE POLICY "Users can view agenda items of accessible meetings"
ON meeting_agenda_items FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM meetings m
    WHERE m.id = meeting_agenda_items.meeting_id
    AND (
      m.user_id = auth.uid()
      OR m.is_public = true
      OR EXISTS (
        SELECT 1 FROM meeting_participants mp 
        WHERE mp.meeting_id = m.id 
        AND mp.user_id = auth.uid()
      )
    )
  )
);
```

### Unterpunkt-Navigation (Flat Index)

```typescript
// In FocusModeView.tsx
interface NavigableItem {
  item: AgendaItem;
  isSubItem: boolean;
  parentIndex: number;
  globalIndex: number; // Index im agendaItems array
}

const allNavigableItems: NavigableItem[] = useMemo(() => {
  const result: NavigableItem[] = [];
  mainItems.forEach((main, mainIdx) => {
    const globalIdx = agendaItems.findIndex(i => i.id === main.id);
    result.push({ item: main, isSubItem: false, parentIndex: mainIdx, globalIndex: globalIdx });
    
    const subs = agendaItems.filter(sub => 
      (sub.parent_id === main.id || sub.parentLocalKey === main.id) &&
      !sub.system_type // Skip system sub-items
    );
    subs.forEach(sub => {
      const subGlobalIdx = agendaItems.findIndex(i => i.id === sub.id);
      result.push({ item: sub, isSubItem: true, parentIndex: mainIdx, globalIndex: subGlobalIdx });
    });
  });
  return result;
}, [mainItems, agendaItems]);

// Navigation state
const [flatFocusIndex, setFlatFocusIndex] = useState(0);
const currentNavigable = allNavigableItems[flatFocusIndex];
```

### Teilnehmer-Anzeige mit Rollen-Badge

```typescript
const roleLabels = {
  organizer: { label: 'Org', color: 'bg-purple-100 text-purple-700' },
  participant: { label: 'Teiln', color: 'bg-blue-100 text-blue-700' },
  optional: { label: 'Opt', color: 'bg-gray-100 text-gray-700' }
};

{participants.map(p => (
  <div key={p.id} className="flex items-center gap-2">
    <Avatar>...</Avatar>
    <span>{p.user?.display_name}</span>
    <Badge className={roleLabels[p.role].color}>
      {roleLabels[p.role].label}
    </Badge>
    <Select value={p.role} onValueChange={v => handleRoleChange(p.id, v)}>
      ...
    </Select>
    <Button onClick={() => handleRemove(p.id)}>×</Button>
  </div>
))}
```

---

## Erwartete Ergebnisse

1. **Teilnehmer bearbeitbar** - Rollen können vergeben und geändert werden
2. **Öffentliche Meetings** - Option bei Erstellung, Nur-Lesen für Nicht-Teilnehmer
3. **Termin-Sterne funktionieren** - n/p/s navigieren und markieren korrekt
4. **Unterpunkte navigierbar** - Pfeiltasten navigieren durch alle Items
5. **Auto-Complete Hauptpunkte** - Wenn alle Unterpunkte erledigt → Hauptpunkt auch
6. **Archiv zeigt alle zugänglichen Protokolle** - Eigene + Teilnehmer + Öffentliche
7. **Aufgaben enthalten vollständigen Inhalt** - Titel, Beschreibung, Notizen, Ergebnis
8. **Aufgaben korrekt zugewiesen** - Robuste Extraktion aus assigned_to
