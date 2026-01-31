

# Plan: Meeting-Agenda Korrekturen (Teil 3)

## Zusammenfassung der identifizierten Probleme

Nach eingehender Codeanalyse wurden folgende technische Ursachen identifiziert:

---

## 1. Sekunden in Agenda-Titel noch vorhanden

**Ursache (MeetingsView.tsx Zeilen 3213-3214):**
```typescript
Agenda: {selectedMeeting.title} am {format(...)}
{selectedMeeting.meeting_time && ` um ${selectedMeeting.meeting_time} Uhr`}
```

Das `selectedMeeting.meeting_time` wird direkt verwendet, ohne die Sekunden zu entfernen. In anderen Stellen wird bereits `substring(0, 5)` verwendet, aber hier fehlt es.

**Lösung:**
```typescript
{selectedMeeting.meeting_time && ` um ${selectedMeeting.meeting_time.substring(0, 5)} Uhr`}
```

---

## 2. Stern-Markierung vor Meeting-Start und ohne Gruppierung

**Problem A:** In der Preview (bevor das Meeting gestartet ist) fehlen `meetingId` und `allowStarring` Props in SystemAgendaItem (Zeilen 3264-3270):

```typescript
<SystemAgendaItem 
  systemType={item.system_type}
  meetingDate={selectedMeeting?.meeting_date}
  linkedQuickNotes={linkedQuickNotes}
  isEmbedded={true}
  defaultCollapsed={...}
  // FEHLT: meetingId und allowStarring
/>
```

**Problem B:** `UpcomingAppointmentsSection` gruppiert markierte Termine nach oben.

**Aktuelle Logik fehlt** - die Appointments werden nur nach Zeit sortiert (Zeile 131), keine Gruppierung nach Sternen. Aber sie werden optisch hervorgehoben mit `bg-amber-50`.

**Lösung A:** Props hinzufügen in Zeilen 3264-3270:
```typescript
<SystemAgendaItem 
  systemType={item.system_type}
  meetingDate={selectedMeeting?.meeting_date}
  meetingId={selectedMeeting?.id}
  allowStarring={true}
  linkedQuickNotes={linkedQuickNotes}
  isEmbedded={true}
  defaultCollapsed={...}
/>
```

**Lösung B:** Die Sterne-Hervorhebung ist bereits korrekt implementiert - markierte Termine bleiben in chronologischer Reihenfolge mit visueller Hervorhebung. Das ist bereits das gewünschte Verhalten.

---

## 3. Fokus-Modus: Lange Punkte beginnen in der Mitte

**Ursache (FocusModeView.tsx Zeilen 181-186):**
```typescript
itemRefs.current[focusedItemIndex]?.scrollIntoView({
  behavior: 'smooth',
  block: 'center'
});
```

Das Problem: `block: 'center'` zentriert das Element vertikal. Bei langen Punkten bedeutet das, dass der Anfang nicht sichtbar ist.

**Lösung:** Statt `center` zu `start` ändern und scrollIntoView mit passendem offset verwenden:

```typescript
itemRefs.current[focusedItemIndex]?.scrollIntoView({
  behavior: 'smooth',
  block: 'start'
});
```

**Zusätzlich:** Tastenkürzel für Intra-Item-Scroll hinzufügen:
- `PageDown` / `d` - Im Punkt nach unten scrollen
- `PageUp` / `u` - Im Punkt nach oben scrollen

```typescript
case 'PageDown':
case 'd':
  e.preventDefault();
  window.scrollBy({ top: 200, behavior: 'smooth' });
  break;
case 'PageUp':
case 'u':
  e.preventDefault();
  window.scrollBy({ top: -200, behavior: 'smooth' });
  break;
```

Und in der Legende entsprechend erweitern.

---

## 4. Teammitglieder können bei Meeting-Erstellung nicht ausgewählt werden

**Ursache:** Die `UserSelector`-Komponente (Zeilen 52-107) lädt Benutzer über `user_tenant_memberships`. Das funktioniert korrekt, ABER das Problem ist das Timing.

**Problem:** Die UserSelector-Komponente wird im Dialog für "Neues Meeting" gerendert, BEVOR `currentTenant` vollständig geladen ist. Der useEffect in UserSelector hat zwar `currentTenant?.id` als Dependency, aber wenn der Wert initial `undefined` ist und dann schnell zu einer ID wechselt, kann das Renew übersehen werden.

**Lösung in UserSelector.tsx:** 
1. Einen initialen Fetch auch bei erstem Mount auslösen
2. Debug-Logging zur Überprüfung der geladenen Daten hinzufügen

```typescript
useEffect(() => {
  // Immer aufrufen, aber fetchUsers prüft intern auf currentTenant?.id
  fetchUsers();
}, [currentTenant?.id]);

const fetchUsers = async () => {
  if (!currentTenant?.id) {
    console.log('UserSelector: No tenant available yet');
    return;
  }
  // ... rest of fetch logic
};
```

**Zusätzlich:** MeetingParticipantsManager in Card-Bearbeitungsmodus integrieren (Zeilen 2528-2537):

```typescript
<div className="space-y-1.5">
  <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
    <Users className="h-3 w-3" />
    Teilnehmer
  </label>
  <MeetingParticipantsManager
    participants={editingMeetingParticipants || []}
    onAddParticipant={(userId, role) => {
      // Add participant logic
    }}
    onUpdateParticipant={(participantId, updates) => {
      // Update participant logic
    }}
    onRemoveParticipant={(participantId) => {
      // Remove participant logic
    }}
  />
</div>
```

Dazu benötigen wir neuen State:
```typescript
const [editingMeetingParticipants, setEditingMeetingParticipants] = useState<MeetingParticipant[]>([]);
```

Und beim Start des Editierens laden:
```typescript
const loadMeetingParticipants = async (meetingId: string) => {
  const { data, error } = await supabase
    .from('meeting_participants')
    .select('*, profiles:user_id(user_id, display_name, avatar_url)')
    .eq('meeting_id', meetingId);
  
  if (!error && data) {
    setEditingMeetingParticipants(data.map(p => ({
      id: p.id,
      user_id: p.user_id,
      role: p.role,
      status: p.status,
      user: p.profiles
    })));
  }
};

// In onClick für Edit-Button:
setEditingMeeting(meeting);
if (meeting.id) loadMeetingParticipants(meeting.id);
```

---

## 5. Meetings werden nicht im Kalender eingetragen

**Ursache (Zeilen 690-707):** `createMeeting` speichert das Meeting in der `meetings`-Tabelle, aber erstellt KEINEN Eintrag in der `appointments`-Tabelle.

**Problem:** Es gibt keine Verknüpfung zwischen `meetings` und `appointments`. Das `updateMeeting` versucht zwar, einen Appointment zu aktualisieren (Zeilen 2061-2078), aber es gibt keinen zu aktualisieren, weil er nie erstellt wurde!

```typescript
await supabase
  .from('appointments')
  .update(appointmentUpdate)
  .eq('meeting_id', meetingId);  // Kein Match, weil nie erstellt!
```

**Lösung 1:** In `createMeeting` auch einen Appointment erstellen:

```typescript
// Nach dem Meeting-Insert (Zeile 710):
if (data.id) {
  // Create corresponding appointment in calendar
  const meetingDateStr = format(newMeeting.meeting_date, 'yyyy-MM-dd');
  const appointmentData = {
    title: newMeeting.title,
    description: newMeeting.description || null,
    location: newMeeting.location || null,
    start_time: `${meetingDateStr}T${newMeetingTime}:00`,
    end_time: `${meetingDateStr}T${String(parseInt(newMeetingTime.split(':')[0]) + 1).padStart(2, '0')}:${newMeetingTime.split(':')[1]}:00`,
    category: 'meeting',
    status: 'planned',
    user_id: user.id,
    tenant_id: currentTenant?.id,
    meeting_id: data.id  // Wichtig: Verknüpfung!
  };
  
  await supabase.from('appointments').insert(appointmentData);
}
```

**Hinweis:** Die `appointments`-Tabelle braucht eine `meeting_id` Spalte für die Verknüpfung. Diese scheint bereits zu existieren (da `updateMeeting` darauf filtert).

**Lösung 2:** Auch für zukünftige wiederkehrende Meetings (Zeilen 816-854) den Appointment erstellen.

---

## 6. Uhrzeit in "Meine Arbeit" Jour Fixe Tab stimmt nicht

**Ursache (MyWorkJourFixeTab.tsx Zeilen 200-203):**
```typescript
<div className="flex items-center gap-1 text-xs text-muted-foreground">
  <Clock className="h-3 w-3" />
  {format(meetingDate, "HH:mm", { locale: de })} Uhr
</div>
```

Das Problem: `meetingDate` wird aus `meeting.meeting_date` abgeleitet (Zeile 170), aber `meeting_date` ist nur ein DATUM (ohne Zeit)! Die `meeting_time` wird gar nicht geladen (Zeile 71: select enthält nicht `meeting_time`).

**Lösung:**
1. `meeting_time` in den Select aufnehmen (Zeile 71 und 84):
```typescript
.select("id, title, meeting_date, meeting_time, status, description")
```

2. Interface erweitern (Zeile 14-20):
```typescript
interface Meeting {
  id: string;
  title: string;
  meeting_date: string;
  meeting_time?: string | null;
  status: string;
  description?: string | null;
}
```

3. Anzeige anpassen (Zeilen 200-203):
```typescript
{meeting.meeting_time && (
  <div className="flex items-center gap-1 text-xs text-muted-foreground">
    <Clock className="h-3 w-3" />
    {meeting.meeting_time.substring(0, 5)} Uhr
  </div>
)}
```

---

## Zusammenfassung der Änderungen

| # | Datei | Änderung |
|---|-------|----------|
| 1 | `MeetingsView.tsx` | Zeile 3214: Sekunden aus Agenda-Titel entfernen |
| 2 | `MeetingsView.tsx` | Zeilen 3264-3270: `meetingId` und `allowStarring` Props hinzufügen |
| 3 | `FocusModeView.tsx` | `block: 'start'` statt `'center'` + Intra-Item-Scroll |
| 4 | `UserSelector.tsx` | Fetch bei Tenant-Wechsel sicherstellen |
| 5 | `MeetingsView.tsx` | MeetingParticipantsManager in Card-Edit integrieren |
| 6 | `MeetingsView.tsx` | Appointment bei Meeting-Erstellung erstellen |
| 7 | `MyWorkJourFixeTab.tsx` | `meeting_time` laden und korrekt anzeigen |

---

## Erwartete Ergebnisse

1. **Keine Sekunden im Agenda-Titel** - `10:00 Uhr` statt `10:00:00 Uhr`
2. **Stern-Markierung in Preview möglich** - Props korrekt übergeben
3. **Fokus-Modus: Punkte beginnen oben** - Scroll zu `start` statt `center`
4. **Intra-Item-Navigation** - Mit PageDown/d und PageUp/u
5. **Teammitglieder auswählbar** - Bei Erstellung UND Bearbeitung
6. **Meetings im Kalender** - Automatische Appointment-Erstellung
7. **Korrekte Uhrzeit in Meine Arbeit** - `meeting_time` wird angezeigt

