
# Plan: Meeting-Korrekturen (Teil 5) - Umfassende Fehlerbehebung

## Zusammenfassung der Probleme und Lösungen

---

## 1. Kalender-Zeiten werden falsch gespeichert

### Problem A: Zeitverschiebung bei Erstellung
**Ursache:** Der Timezone-Offset-Code in Zeilen 720-726 hat einen Logikfehler. JavaScript's `getTimezoneOffset()` gibt die Differenz in Minuten von UTC zu lokaler Zeit zurück, aber mit umgekehrtem Vorzeichen! Wenn CET = UTC+1, dann gibt `getTimezoneOffset()` -60 zurück, nicht +60.

Aktueller (falscher) Code:
```typescript
const timezoneOffset = -now.getTimezoneOffset(); // FALSCH: negiert nochmal!
```

Das Ergebnis: Bei CET (UTC+1) wird `+01:00` erzeugt, aber weil wir `-` verwenden, wird es zu `-01:00` oder die Zeit wird falsch interpretiert.

**Datenbankbeweis:**
- Meeting Test 7: `meeting_time: 14:00:00`
- Appointment: `start_time: 2026-02-03 13:00:00+00` (14:00 CET = 13:00 UTC ist RICHTIG!)
- ABER Test 6: `meeting_time: 21:30:00`, Appointment: `start_time: 09:00:00+00` (völlig falsch!)

Das Problem ist, dass der Appointment bei Update auf `10:00` zurückgesetzt wird weil `timeToUse` den Fallback `'10:00'` nimmt.

### Problem B: Zeit wird auf 10:00 zurückgesetzt bei Speichern
**Ursache (Zeile 2085):**
```typescript
const timeToUse = meetingTimeOverride || updates.meeting_time || editingMeeting?.meeting_time || '10:00';
```

Wenn man die Card bearbeitet und speichert, wird `updateMeeting(meeting.id!, editingMeeting)` aufgerufen. Das `editingMeeting` enthält `meeting_time`, aber es muss korrekt übergeben werden.

Das Problem: `updates` ist das `editingMeeting` Objekt, aber `meeting_time` könnte `null` oder `undefined` sein wenn es nicht explizit gesetzt wird.

**Lösung:**
1. Timezone-Berechnung vereinfachen - einfach ISO-String mit Offset verwenden:
```typescript
// Lokale Zeit als ISO-String mit Zeitzone
const localDate = new Date(`${meetingDateStr}T${newMeetingTime}:00`);
const startIso = localDate.toISOString();
// Berechne Endzeit (1 Stunde später)
const endDate = new Date(localDate.getTime() + 60 * 60 * 1000);
const endIso = endDate.toISOString();
```

2. Bei `updateMeeting` sicherstellen, dass `meeting_time` IMMER aus dem editingMeeting gelesen wird:
```typescript
const timeToUse = editingMeeting?.meeting_time?.substring(0, 5) || meeting?.meeting_time?.substring(0, 5) || '10:00';
```

3. Auch bei Update Timezone korrekt behandeln.

---

## 2. Teilnehmer in Card-Bearbeitung aktualisierbar machen

### Problem
Aktuell zeigt die Card-Bearbeitung nur einen Platzhalter-Text (Zeilen 2572-2580):
```typescript
<p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
  Teilnehmer können nach dem Speichern in der Detailansicht bearbeitet werden.
</p>
```

### Lösung
1. Neuen State für bearbeitete Teilnehmer:
```typescript
const [editingMeetingParticipants, setEditingMeetingParticipants] = useState<MeetingParticipant[]>([]);
```

2. Beim Start der Bearbeitung Teilnehmer laden:
```typescript
const loadEditingMeetingParticipants = async (meetingId: string) => {
  const { data } = await supabase
    .from('meeting_participants')
    .select('*, user:profiles!user_id(user_id, display_name, avatar_url)')
    .eq('meeting_id', meetingId);
  // Transformieren und setzen
};
```

3. `MeetingParticipantsManager` in die Card-Bearbeitung integrieren statt Platzhalter-Text.

4. Teilnehmer-Avatare auch im normalen Ansichtsmodus der Card anzeigen (unter dem Datum).

5. Beim Speichern Teilnehmer-Änderungen anwenden.

---

## 3. Fokus-Modus: Tastatur-Konflikte beim Zuweisungs-Dialog

### Problem
Wenn der Dialog offen ist, werden Pfeiltasten und Enter trotzdem von der globalen handleKeyDown-Funktion abgefangen (Zeilen 108-115).

**Ursache:**
```typescript
if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
  return; // Nur für Input/Textarea!
}
```

Der Dialog enthält aber ein `Select` Element, das weder Input noch Textarea ist.

### Lösung
Prüfen ob der Zuweisungs-Dialog offen ist:
```typescript
// Am Anfang von handleKeyDown:
if (showAssignDialog) {
  // Nur Escape erlauben um Dialog zu schließen
  if (e.key === 'Escape') {
    e.preventDefault();
    setShowAssignDialog(false);
  }
  return; // Alle anderen Keys ignorieren wenn Dialog offen
}
```

---

## 4. Stern-Markierungen im Protokoll vermerken

### Problem
Die `MeetingProtocolView` zeigt keine Informationen über markierte Termine an.

### Lösung
1. Starred appointments für das Meeting laden:
```typescript
const loadStarredAppointments = async () => {
  const { data } = await supabase
    .from('starred_appointments')
    .select(`
      id,
      appointment_id,
      external_event_id,
      appointments:appointment_id(id, title, start_time),
      external_events:external_event_id(id, title, start_time)
    `)
    .eq('meeting_id', meetingId);
  // ...
};
```

2. Neue Sektion "Besprochene Termine" im Protokoll nach den Tagesordnungspunkten:
```typescript
{starredAppointments.length > 0 && (
  <div className="space-y-4 mt-8">
    <h3 className="text-xl font-semibold">Markierte Termine zur Besprechung</h3>
    {starredAppointments.map(apt => (
      <div key={apt.id} className="flex items-center gap-2">
        <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
        <span>{apt.title}</span>
        <span className="text-muted-foreground">
          ({format(new Date(apt.start_time), 'dd.MM.yyyy HH:mm')})
        </span>
      </div>
    ))}
  </div>
)}
```

---

## 5. Gebündelte Aufgabe für markierte Termine erstellen

### Problem
Nach Beendigung der Besprechung sollen markierte Termine als eine Aufgabe an alle Teilnehmer zugewiesen werden.

### Lösung
In `archiveMeeting` (nach Step 5, vor Step 6) hinzufügen:

```typescript
// Step 5b: Create task for starred appointments
const { data: starredAppts } = await supabase
  .from('starred_appointments')
  .select(`
    id,
    appointment_id,
    external_event_id,
    appointments:appointment_id(title, start_time),
    external_events:external_event_id(title, start_time)
  `)
  .eq('meeting_id', meeting.id);

if (starredAppts && starredAppts.length > 0) {
  // Get all meeting participants
  const { data: participants } = await supabase
    .from('meeting_participants')
    .select('user_id')
    .eq('meeting_id', meeting.id);
  
  const participantIds = participants?.map(p => p.user_id) || [user.id];
  
  // Build task description with all starred appointments
  const appointmentsList = starredAppts.map(s => {
    const apt = s.appointments || s.external_events;
    return `- ${apt?.title} (${format(new Date(apt?.start_time), 'dd.MM.yyyy HH:mm')})`;
  }).join('\n');
  
  // Create one task for each participant
  for (const userId of participantIds) {
    await supabase.from('tasks').insert({
      user_id: user.id,
      title: `Vorbereitung: Markierte Termine aus ${meeting.title}`,
      description: `Folgende Termine wurden in der Besprechung als besonders wichtig markiert:\n\n${appointmentsList}`,
      priority: 'medium',
      category: 'meeting',
      status: 'todo',
      assigned_to: userId,
      tenant_id: currentTenant?.id,
      due_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 Tage
      source_meeting_id: meeting.id
    });
  }
}
```

---

## 6. Tastatur-Auswahl für Sterne

### Umsetzung
Ja, das ist möglich! Im Fokus-Modus bei "Kommende Termine" System-Item:
- Neues Tastenkürzel `s` für "Stern toggle"
- Fokussierter Termin innerhalb der Liste mit `n`/`p` (next/previous) navigierbar

**Implementierung in FocusModeView:**
```typescript
// State für fokussierten Termin innerhalb des System-Items
const [focusedAppointmentIndex, setFocusedAppointmentIndex] = useState(0);

// Keyboard shortcuts:
case 'n': // Next appointment within system item
  if (currentItem?.system_type === 'upcoming_appointments') {
    setFocusedAppointmentIndex(prev => prev + 1);
  }
  break;
case 'p': // Previous appointment
  if (currentItem?.system_type === 'upcoming_appointments') {
    setFocusedAppointmentIndex(prev => Math.max(0, prev - 1));
  }
  break;
case 's': // Toggle star
  if (currentItem?.system_type === 'upcoming_appointments') {
    toggleStarForFocusedAppointment();
  }
  break;
```

Legende erweitern:
```
s → Stern für markierten Termin setzen/entfernen (bei "Kommende Termine")
n/p → Im Termin-Block navigieren
```

---

## 7. Archivseite: Abstand und Ansichts-Toggle

### Problem A: Fehlender Abstand
Die `MeetingArchiveView` hat direkt `<div className="space-y-6">` ohne Container-Padding.

### Lösung
Standard-Container wie andere Seiten verwenden:
```typescript
<div className="p-6 space-y-6">
```

### Problem B: Keine Ansichts-Auswahl
Aktuell nur Card-Ansicht vorhanden (Zeilen 200-287).

### Lösung
1. State für Ansichtsmodus:
```typescript
const [viewMode, setViewMode] = useState<'cards' | 'list'>('cards');
```

2. Toggle-Button in der Header-Zeile:
```typescript
<div className="flex items-center gap-2">
  <Button
    variant={viewMode === 'cards' ? 'secondary' : 'ghost'}
    size="sm"
    onClick={() => setViewMode('cards')}
  >
    <LayoutGrid className="h-4 w-4" />
  </Button>
  <Button
    variant={viewMode === 'list' ? 'secondary' : 'ghost'}
    size="sm"
    onClick={() => setViewMode('list')}
  >
    <List className="h-4 w-4" />
  </Button>
</div>
```

3. Listen-Ansicht als Alternative:
```typescript
{viewMode === 'list' ? (
  <div className="border rounded-lg divide-y">
    {filteredMeetings.map(meeting => (
      <div key={meeting.id} className="flex items-center justify-between p-4 hover:bg-muted/50">
        <div className="flex items-center gap-4">
          <div>
            <span className="font-medium">{meeting.title}</span>
            <p className="text-sm text-muted-foreground">
              {format(new Date(meeting.meeting_date), 'PPP', { locale: de })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Action buttons */}
        </div>
      </div>
    ))}
  </div>
) : (
  /* Existing card grid */
)}
```

---

## Zusammenfassung der Änderungen

| # | Datei | Änderung |
|---|-------|----------|
| 1 | `MeetingsView.tsx` | Timezone-Berechnung korrigieren mit ISO-Strings |
| 2 | `MeetingsView.tsx` | `timeToUse` Logik in updateMeeting korrigieren |
| 3 | `MeetingsView.tsx` | Teilnehmer-State und -Bearbeitung in Card |
| 4 | `MeetingsView.tsx` | Teilnehmer-Avatare auf Card anzeigen |
| 5 | `FocusModeView.tsx` | `showAssignDialog`-Check in handleKeyDown |
| 6 | `MeetingProtocolView.tsx` | Starred appointments laden und anzeigen |
| 7 | `MeetingsView.tsx` | Aufgabe für starred appointments in archiveMeeting |
| 8 | `FocusModeView.tsx` | Tastenkürzel s/n/p für Stern-Navigation |
| 9 | `MeetingArchiveView.tsx` | Container-Padding hinzufügen |
| 10 | `MeetingArchiveView.tsx` | Ansichts-Toggle (List/Cards) implementieren |

---

## Technische Details

### Timezone-Korrektur (Detail)
```typescript
// VORHER (falsch):
const timezoneOffset = -now.getTimezoneOffset();
start_time: `${meetingDateStr}T${newMeetingTime}:00${tzString}`

// NACHHER (korrekt):
// Erstelle ein Date-Objekt in lokaler Zeit
const localDateTime = new Date(`${meetingDateStr}T${newMeetingTime}:00`);
// Konvertiere zu ISO-String (wird automatisch zu UTC mit korrektem Offset)
const start_time = localDateTime.toISOString();
const end_time = new Date(localDateTime.getTime() + 60 * 60 * 1000).toISOString();
```

### Participant Avatar Display (Detail)
```typescript
// In der Card-Ansicht nach dem Ort/Datum:
{meeting.participants && meeting.participants.length > 0 && (
  <div className="flex items-center gap-1 mt-2">
    <Users className="h-3.5 w-3.5 text-muted-foreground" />
    <div className="flex -space-x-2">
      {meeting.participants.slice(0, 5).map(p => (
        <Avatar key={p.user_id} className="h-6 w-6 border-2 border-background">
          <AvatarImage src={p.user?.avatar_url} />
          <AvatarFallback className="text-xs">
            {getInitials(p.user?.display_name)}
          </AvatarFallback>
        </Avatar>
      ))}
      {meeting.participants.length > 5 && (
        <span className="text-xs text-muted-foreground ml-2">
          +{meeting.participants.length - 5}
        </span>
      )}
    </div>
  </div>
)}
```

---

## Erwartete Ergebnisse

1. **Kalender-Zeit korrekt** - Meeting um 21:30 erscheint um 21:30 im Kalender
2. **Keine Zeit-Reset** - Bearbeiten ohne Änderungen behält die Zeit bei
3. **Teilnehmer bearbeitbar** - In der Card direkt Teilnehmer hinzufügen/entfernen
4. **Teilnehmer sichtbar** - Avatare auf der Meeting-Card
5. **Dialog-Tasten isoliert** - Pfeiltasten/Enter funktionieren im Zuweisungs-Dialog
6. **Protokoll mit Sternen** - Markierte Termine werden im Protokoll gelistet
7. **Automatische Aufgaben** - Nach Archivierung erhalten alle Teilnehmer eine Aufgabe
8. **Tastatur-Sterne** - Mit s/n/p Termine navigieren und markieren
9. **Archiv-Abstand** - Korrektes Padding wie andere Seiten
10. **Ansichts-Toggle** - Wechsel zwischen Listen- und Card-Ansicht
