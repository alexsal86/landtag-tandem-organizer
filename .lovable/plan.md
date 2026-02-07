
# Plan: Fuenf Verbesserungen fuer Meetings / Jour Fixe

## Uebersicht

| # | Anforderung | Loesung |
|---|-------------|---------|
| 1 | System-Items variabel als Haupt- oder Unterpunkt | System-Button auch innerhalb von Hauptpunkten anbieten (als Unterpunkt) und bestehende System-Items per Drag&Drop verschiebbar machen |
| 2 | Avatar + Name bei Notizen und Aufgaben in Agenda-Ansicht | `SystemAgendaItem` um `profiles`-Prop erweitern, Avatar+Name pro Notiz/Aufgabe anzeigen |
| 3 | HTML in Beschreibungen umwandeln | Alle Stellen in der Normalansicht, wo `subItem.description` als roher Text gerendert wird, durch `RichTextDisplay` ersetzen |
| 4 | Avatar + Name bei Notizen/Aufgaben in laufender Meeting-Ansicht | Neben dem Text "von Name" auch den Avatar des Profils anzeigen (profiles muss `avatar_url` mit-laden) |
| 5 | Ergebnisse bei Archivierung: Notizen-Ergebnis zurueckschreiben, Aufgaben-Ergebnis als Unteraufgabe, Termine-Aufgabe fuer alle mit Sternen als Unteraufgaben | `archiveMeeting` um drei neue Bloecke erweitern |

---

## 1. System-Items variabel als Haupt- oder Unterpunkt

### Problem
Derzeit werden System-Items (Meine Notizen, Kommende Termine, Aufgaben) immer als Hauptpunkte eingefuegt. Es gibt keinen Mechanismus, sie als Unterpunkte eines bestehenden Hauptpunkts hinzuzufuegen.

### Loesung

**MeetingsView.tsx - `addSystemAgendaItem` erweitern:**

Die Funktion bekommt einen optionalen `parentItem`-Parameter. Wenn angegeben, wird das System-Item als Unterpunkt (mit `parent_id` / `parentLocalKey`) eingefuegt.

```tsx
const addSystemAgendaItem = (
  systemType: 'upcoming_appointments' | 'quick_notes' | 'tasks',
  parentItem?: AgendaItem
) => {
  // ... bestehende Duplikat-Pruefung ...
  
  const newItem: AgendaItem = {
    title: titles[systemType],
    // ...
    system_type: systemType,
    parent_id: parentItem?.id || null,
    parentLocalKey: parentItem?.id || parentItem?.localKey || undefined,
  };
  // ...
};
```

**MeetingsView.tsx - Agenda-Editor UI:**

Im Plus-Button-Popover jedes Hauptpunkts (Zeile ~4124-4147) wird ein zusaetzlicher Abschnitt eingefuegt, der die drei System-Optionen (Termine, Notizen, Aufgaben) als Unterpunkt-Varianten anbietet - mit den gleichen Farbcodes und der gleichen Duplikat-Pruefung wie beim Haupt-"System"-Button.

```tsx
{/* System items as sub-items */}
<div className="border-t pt-2 mt-2">
  <p className="text-xs text-muted-foreground mb-1">System-Punkt als Unterpunkt:</p>
  <Button variant="outline" className="w-full justify-start border-blue-200 text-blue-700"
    onClick={() => addSystemAgendaItem('upcoming_appointments', item)}
    disabled={agendaItems.some(i => i.system_type === 'upcoming_appointments')}>
    <CalendarDays className="h-4 w-4 mr-2" /> Kommende Termine
  </Button>
  {/* ... analog fuer quick_notes und tasks */}
</div>
```

---

## 2. Avatar + Name bei Notizen und Aufgaben in der Agenda-Ansicht (Editor)

### Problem
`SystemAgendaItem` zeigt Notizen und Aufgaben ohne Ersteller-Information an. Die `profiles`-Daten (inkl. `avatar_url`) sind im Eltern-Component verfuegbar, werden aber nicht uebergeben.

### Loesung

**Profile-Interface erweitern (MeetingsView.tsx Zeile 114-117):**
```tsx
interface Profile {
  user_id: string;
  display_name: string | null;
  avatar_url?: string | null;
}
```

**`loadProfiles` erweitern (Zeile 434):**
```tsx
.select('user_id, display_name, avatar_url')
```

**`SystemAgendaItem.tsx` erweitern:**
- Neue Props: `profiles?: Array<{ user_id: string; display_name: string | null; avatar_url?: string | null }>`
- Bei jeder Notiz und jeder Aufgabe: Avatar + Name anzeigen

```tsx
{/* Bei Notizen */}
{note.user_id && profiles && (() => {
  const profile = profiles.find(p => p.user_id === note.user_id);
  return profile ? (
    <div className="flex items-center gap-1.5 mt-1">
      <Avatar className="h-5 w-5">
        <AvatarImage src={profile.avatar_url || undefined} />
        <AvatarFallback className="text-[10px]">
          {(profile.display_name || '?').charAt(0).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <span className="text-xs text-muted-foreground">{profile.display_name}</span>
    </div>
  ) : null;
})()}
```

Gleiche Logik fuer Tasks.

**Aufrufe in MeetingsView.tsx:**
An der Stelle wo `SystemAgendaItem` gerendert wird (Zeile ~4057-4067), `profiles` als Prop uebergeben:
```tsx
<SystemAgendaItem 
  systemType={item.system_type as ...}
  profiles={profiles}  // NEU
  // ... restliche Props
/>
```

---

## 3. HTML in Beschreibungen umwandeln

### Problem
An mehreren Stellen in der Normalansicht (laufendes Meeting) werden `subItem.description` und `note.content` als roher Text angezeigt, obwohl sie HTML enthalten koennen.

### Loesung
Pruefen, ob es noch Stellen gibt, wo `note.content` als roher Text gerendert wird. Aus der Analyse:
- Zeile 3929-3931 (Quick Notes Section am Ende): `<p>{note.content}</p>` - dies muss zu `<RichTextDisplay content={note.content} />` geaendert werden
- Die Sub-Item-Beschreibungen (Zeilen 3697-3701) verwenden bereits `RichTextDisplay`
- System-Sub-Items verwenden ebenfalls bereits `RichTextDisplay`

Die einzige verbleibende Stelle ist der Quick Notes Fallback-Block (Zeile 3929-3931).

---

## 4. Avatar bei Notizen/Aufgaben im laufenden Meeting

### Problem
In der laufenden Meeting-Ansicht steht bei Notizen und Aufgaben nur "von Name" als Text. Es fehlt der Avatar fuer eine konsistentere Darstellung.

### Loesung

Da `profiles` jetzt `avatar_url` enthaelt (siehe Punkt 2), kann der Avatar ueberall angezeigt werden.

**Neue Helper-Funktion in MeetingsView.tsx:**
```tsx
const getProfile = (userId: string) => profiles.find(p => p.user_id === userId);
```

**Rendering aendern (Zeilen 3348-3350, 3385-3387, 3595-3597, 3637-3639):**
Von:
```tsx
<span className="text-xs text-muted-foreground ml-6">von {getDisplayName(note.user_id)}</span>
```
Zu:
```tsx
{(() => {
  const profile = getProfile(note.user_id);
  return profile ? (
    <div className="flex items-center gap-1.5 ml-6 mt-1">
      <Avatar className="h-5 w-5">
        <AvatarImage src={profile.avatar_url || undefined} />
        <AvatarFallback className="text-[10px]">
          {(profile.display_name || '?').charAt(0).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <span className="text-xs text-muted-foreground">{profile.display_name}</span>
    </div>
  ) : null;
})()}
```

Gleiche Aenderung auch im **FocusModeView.tsx** (Zeile 568-569). Dafuer muss die Profile-Prop um `avatar_url` erweitert werden:
```tsx
interface Profile {
  user_id: string;
  display_name: string | null;
  avatar_url?: string | null;
}
```

---

## 5. Ergebnis-Verarbeitung bei Archivierung

### Aktuelle Logik (archiveMeeting, Zeile 1236-1527)
1. Items mit `assigned_to` + `result_text` => Standalone-Task
2. Follow-Up-Task mit Subtasks fuer restliche Items mit result_text
3. Starred-Appointments => eine Task pro Teilnehmer mit Liste aller Termine

### Neue Logik

Die Archivierung wird um drei neue Bloecke erweitert, die **vor** den bestehenden Steps ausgefuehrt werden:

#### 5a. Notizen: Ergebnis in die Notiz des Eigentuemers zurueckschreiben

Wenn eine Notiz (`quick_notes`) ein `meeting_result` hat, wird dieses Ergebnis direkt in die Notiz des Eigentuemers geschrieben - konkret wird `meeting_result` bereits waehrend des Meetings aktualisiert via `updateQuickNoteResult`. Bei Archivierung muss sichergestellt werden, dass die finale Version gespeichert ist. Zusaetzlich wird die Herkunft dokumentiert:

```tsx
// Step: Process quick note results
for (const note of linkedQuickNotes) {
  if (note.meeting_result?.trim()) {
    const meetingContext = `Besprechung "${meeting.title}" vom ${format(new Date(meeting.meeting_date), 'dd.MM.yyyy', { locale: de })}`;
    await supabase
      .from('quick_notes')
      .update({ 
        meeting_result: `[${meetingContext}]\n${note.meeting_result}` 
      })
      .eq('id', note.id);
  }
}
```

#### 5b. Aufgaben: Ergebnis als Unteraufgabe mit Zuweisung an Eigentuemer

Fuer jede Aufgabe, die ein Ergebnis hat (gespeichert als JSON in `result_text` des System-Agenda-Items), wird eine **Unteraufgabe** an der bestehenden Aufgabe erstellt:

```tsx
// Step: Process task results - add subtask to original task
const taskSystemItems = agendaItemsData?.filter(item => item.system_type === 'tasks') || [];
for (const taskItem of taskSystemItems) {
  if (!taskItem.result_text?.trim()) continue;
  
  try {
    const taskResults = JSON.parse(taskItem.result_text);
    for (const [taskId, resultText] of Object.entries(taskResults)) {
      if (!resultText || !(resultText as string).trim()) continue;
      
      // Find the original task to get the owner
      const originalTask = meetingLinkedTasks.find(t => t.id === taskId);
      if (!originalTask) continue;
      
      const meetingContext = `Aus Besprechung "${meeting.title}" vom ${format(new Date(meeting.meeting_date), 'dd.MM.yyyy', { locale: de })}`;
      
      // Get current max order_index for subtasks
      const { data: maxOrder } = await supabase
        .from('subtasks')
        .select('order_index')
        .eq('task_id', taskId)
        .order('order_index', { ascending: false })
        .limit(1);
      
      const nextOrder = (maxOrder?.[0]?.order_index ?? -1) + 1;
      
      await supabase.from('subtasks').insert({
        task_id: taskId,
        user_id: user.id,
        description: `${meetingContext}: ${resultText}`,
        assigned_to: originalTask.user_id || user.id,
        is_completed: false,
        order_index: nextOrder,
      });
    }
  } catch (e) {
    console.error('Error processing task results:', e);
  }
}
```

#### 5c. Termine: Eine Aufgabe fuer alle Teilnehmer, Sterne als Unteraufgaben

Die bestehende Logik fuer Starred-Appointments (Zeilen 1399-1477) wird umgebaut. Statt separate Tasks pro Teilnehmer wird **eine einzelne Task** erstellt, die allen Teilnehmern zugewiesen ist. Die markierten Termine werden dann als **Unteraufgaben** (ohne individuelle Zuweisung) eingefuegt.

```tsx
// Step: Create single task with subtasks for starred appointments
if (starredAppts && starredAppts.length > 0) {
  // ... fetch appointment details (existing code) ...
  
  // Get all meeting participants
  const { data: participants } = await supabase
    .from('meeting_participants')
    .select('user_id')
    .eq('meeting_id', meeting.id);
  
  const participantIds = participants?.map(p => p.user_id) || [user.id];
  const firstParticipant = participantIds[0] || user.id;
  
  // Build participant names for description
  const participantNames = participantIds.map(id => {
    const profile = profiles.find(p => p.user_id === id);
    return profile?.display_name || 'Unbekannt';
  }).join(', ');
  
  // Create ONE task assigned to first participant
  const { data: apptTask, error: apptTaskError } = await supabase
    .from('tasks')
    .insert({
      user_id: user.id,
      title: `Vorbereitung: Markierte Termine aus ${meeting.title}`,
      description: `Folgende Termine wurden in der Besprechung als wichtig markiert.\n\n**Zustaendige:** ${participantNames}`,
      priority: 'medium',
      category: 'meeting',
      status: 'todo',
      assigned_to: firstParticipant,
      tenant_id: currentTenant?.id || '',
      due_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
    })
    .select()
    .single();
  
  if (apptTask) {
    // Create subtasks for each starred appointment (unassigned)
    const subtasks = allAppointments.map((apt, idx) => ({
      task_id: apptTask.id,
      user_id: user.id,
      description: `${apt.title} (${format(new Date(apt.start_time), 'dd.MM.yyyy HH:mm', { locale: de })})`,
      assigned_to: null,  // niemand speziell zugewiesen
      is_completed: false,
      order_index: idx,
    }));
    
    await supabase.from('subtasks').insert(subtasks);
  }
}
```

Der bestehende Block (Zeilen 1399-1477) wird durch diesen neuen Block ersetzt.

---

## Zusammenfassung der Dateiaenderungen

| Datei | Aenderungen |
|-------|-------------|
| **MeetingsView.tsx** | 1) `Profile`-Interface um `avatar_url` erweitern, 2) `loadProfiles` um `avatar_url` erweitern, 3) `addSystemAgendaItem` um optionalen `parentItem`-Parameter, 4) Plus-Button-Popover um System-Optionen erweitern, 5) Avatar+Name bei Notizen/Aufgaben (Normalansicht), 6) HTML-Fix bei Quick Notes Fallback (Zeile 3929), 7) `archiveMeeting` um drei neue Ergebnis-Bloecke erweitern, 8) `getProfile` Helper-Funktion |
| **FocusModeView.tsx** | 1) `Profile`-Interface um `avatar_url` erweitern, 2) Avatar neben Ersteller-Namen bei Notizen/Aufgaben |
| **SystemAgendaItem.tsx** | 1) Neue `profiles`-Prop, 2) Avatar+Name bei Notizen und Aufgaben, 3) Import von Avatar-Komponenten |
