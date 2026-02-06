

# Plan: Bugfixes und Verbesserungen fuer Jour Fixe System-Agenda-Items

## Uebersicht der Probleme und Loesungen

| # | Problem | Ursache | Loesung |
|---|---------|---------|---------|
| 1 | "Aufgaben" ist falsch eingerueckt im Vergleich zu Notizen/Termine | Fehlendes `ml-6` / kein Child-Check: Der `Aufgaben`-Punkt wird immer eingerueckt, als waere er ein Unterpunkt | Gleiche Einrueckungslogik wie bei den anderen System-Items |
| 2 | Systempunkte-Card hat keinen Papierkorb-Button | Der Delete-Button liegt ausserhalb der Card statt innerhalb | Delete-Button in die Card-Darstellung der SystemAgendaItem integrieren |
| 3 | Systempunkte haben zu viel Innenabstand oben/unten | CardHeader und CardContent der SystemAgendaItem nutzen zu viel Padding | Padding reduzieren: `py-2 px-3` statt Standard p-6 |
| 4 | "Aufgaben"-Systempunkt wird weder im Normal- noch im Fokus-Modus angezeigt | `system_type === 'tasks'` wird nicht gerendert; `linkedTasks` State existiert nicht; `SystemAgendaItem` wird mit Cast auf nur 2 Typen aufgerufen | `linkedTasks` State + Lade-Funktion hinzufuegen; Rendering fuer `tasks` in Normal- und Fokus-Modus ergaenzen |
| 5 | Systempunkte werden als Bestandteil des uebergeordneten Punktes behandelt statt eigenstaendig | In der Normalansicht werden System-Items als verschachtelte Unterpunkte gerendert statt als gleichwertige Haupt-Items | System-Items, die als Haupt-Agenda-Punkte stehen, muessen als eigenstaendige Punkte behandelt werden |
| 6 | HTML wird in Beschreibungen von Unterpunkten angezeigt | Beschreibung nutzt `<p>` statt `RichTextDisplay` | `RichTextDisplay` fuer Beschreibungen verwenden |
| 7 | Oeffentliche/Teilnehmer-Meetings nicht in MeetingNoteSelector sichtbar | Query filtert nur auf `user_id === user.id` | Query erweitern um Teilnehmer-Check und oeffentliche Meetings |
| 8 | "Aufgaben"-Systempunkt nicht in Meine Arbeit > Jour fixe angezeigt | `getSystemItemIcon` kennt nur `quick_notes` und `upcoming_appointments` | `tasks`-Icon (ListTodo) hinzufuegen |

---

## 1. Einrueckung des "Aufgaben"-Systempunkts korrigieren

### MeetingsView.tsx (Agenda-Editor, Zeile ~3656-3688)

Das Problem liegt in der Bedingung fuer `ml-6` bei System-Items. Die Einrueckungslogik muss korrekt sein: Nur wenn ein Item ein `parent_id` oder `parentLocalKey` hat, soll es eingerueckt werden. Derzeit wird `ml-6` fuer alle Items mit `parentLocalKey || parent_id` gesetzt, was korrekt aussieht. Das Problem koennte sein, dass der "Aufgaben"-Punkt falsch als Child gespeichert wird.

Zudem: In der SystemAgendaItem-Rendering-Zeile wird der `systemType` nur als `'upcoming_appointments' | 'quick_notes'` gecastet (Zeile 3674). Der Typ `tasks` wird ignoriert.

**Loesung:** Den Cast auf `'upcoming_appointments' | 'quick_notes' | 'tasks'` erweitern.

```tsx
// Zeile 3674
systemType={item.system_type as 'upcoming_appointments' | 'quick_notes' | 'tasks'}
```

---

## 2. Papierkorb-Button in die System-Card integrieren

### SystemAgendaItem.tsx

Derzeit liegt der Delete-Button ausserhalb der SystemAgendaItem-Card im MeetingsView. Stattdessen soll der Delete-Callback als Prop an SystemAgendaItem uebergeben werden, und der Button soll innerhalb des Card-Headers neben dem "System"-Badge angezeigt werden.

**Neue Props:**
```tsx
interface SystemAgendaItemProps {
  // ... bestehende Props
  onDelete?: () => void; // NEU
}
```

**Aenderung im Card-Header jedes System-Typs:**
```tsx
<div className="flex items-center justify-between">
  <CardTitle className="text-base flex items-center gap-2">
    {getIcon()}
    {getTitle()}
  </CardTitle>
  <div className="flex items-center gap-1">
    <Badge variant="outline" className={cn("text-xs", getBadgeColors())}>
      ...System...
    </Badge>
    {onDelete && (
      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive"
        onClick={onDelete} aria-label="Punkt loeschen">
        <Trash className="h-3.5 w-3.5" />
      </Button>
    )}
  </div>
</div>
```

### MeetingsView.tsx (Agenda-Editor)

Den externen Delete-Button entfernen und stattdessen `onDelete` an SystemAgendaItem uebergeben:

```tsx
<SystemAgendaItem 
  systemType={item.system_type as 'upcoming_appointments' | 'quick_notes' | 'tasks'}
  meetingDate={selectedMeeting?.meeting_date}
  meetingId={selectedMeeting?.id}
  allowStarring={true}
  linkedQuickNotes={linkedQuickNotes}
  linkedTasks={meetingLinkedTasks}
  isEmbedded={true}
  defaultCollapsed={item.system_type === 'upcoming_appointments'}
  onDelete={hasEditPermission ? () => deleteAgendaItem(item, index) : undefined}
/>
```

---

## 3. Kompakteres Padding fuer Systempunkte

### SystemAgendaItem.tsx

Fuer alle drei System-Typen:

```tsx
<CardHeader className="py-2 px-3 pb-1">  {/* statt pb-2 und Standard p-6 */}
<CardContent className="px-3 pb-2 pt-0">  {/* statt Standard p-6 pt-0 */}
```

---

## 4. "Aufgaben"-Systempunkt laden und anzeigen

### 4.1 MeetingsView.tsx - Neuer State und Lade-Funktion

```tsx
// Neuer State
const [meetingLinkedTasks, setMeetingLinkedTasks] = useState<any[]>([]);

// Neue Lade-Funktion
const loadMeetingLinkedTasks = async (meetingId: string) => {
  try {
    const { data, error } = await supabase
      .from('tasks')
      .select('id, title, description, due_date, priority, status')
      .eq('meeting_id', meetingId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    setMeetingLinkedTasks(data || []);
  } catch (error) {
    console.error('Error loading meeting linked tasks:', error);
    setMeetingLinkedTasks([]);
  }
};

// Aufrufe neben loadLinkedQuickNotes einfuegen (ueberall wo loadLinkedQuickNotes aufgerufen wird)
```

### 4.2 MeetingsView.tsx - Rendering im Normalmodus (Zeile ~3132-3154)

Neuen Block fuer `tasks` hinzufuegen:
```tsx
{item.system_type === 'tasks' && (
  <div className="ml-12 mb-4">
    <SystemAgendaItem 
      systemType="tasks"
      linkedTasks={meetingLinkedTasks}
      isEmbedded={true}
    />
  </div>
)}
```

### 4.3 MeetingsView.tsx - Rendering als Unterpunkt (Zeile ~3244-3286)

Neuen Else-If-Zweig fuer `tasks` hinzufuegen:
```tsx
: subItem.system_type === 'tasks' ? (
  <div className="space-y-2">
    <div className="flex items-center gap-2 mb-2">
      <span className="text-xs font-medium text-muted-foreground">
        {index + 1}.{subIndex + 1}
      </span>
      <ListTodo className="h-4 w-4 text-green-500" />
      <span className="text-sm font-medium">Aufgaben</span>
    </div>
    <SystemAgendaItem 
      systemType="tasks"
      linkedTasks={meetingLinkedTasks}
      isEmbedded={true}
    />
  </div>
)
```

### 4.4 MeetingsView.tsx - Farbe fuer tasks bei Unterpunkt-Rand (Zeile ~3244-3251)

```tsx
subItem.system_type === 'tasks'
  ? "border-l-green-500"
  : "border-muted"
```

### 4.5 FocusModeView.tsx - linkedTasks an den Aufruf uebergeben

```tsx
<FocusModeView
  meeting={activeMeeting}
  agendaItems={agendaItems}
  profiles={profiles}
  linkedQuickNotes={linkedQuickNotes}
  linkedTasks={meetingLinkedTasks}
  onClose={() => setIsFocusMode(false)}
  ...
/>
```

### 4.6 FocusModeView.tsx - Tasks im Fokus-Modus rendern (Zeile ~604-625)

```tsx
{/* System content: Tasks */}
{item.system_type === 'tasks' && (
  <div className="mt-4">
    <SystemAgendaItem 
      systemType="tasks"
      linkedTasks={linkedTasks}
      isEmbedded={true}
    />
  </div>
)}
```

### 4.7 FocusModeView.tsx - Tasks bei System-Sub-Items rendern (Zeile ~644-671)

Fehlenden `tasks`-Zweig hinzufuegen:
```tsx
: sub.system_type === 'tasks' ? (
  <SystemAgendaItem 
    systemType="tasks"
    linkedTasks={linkedTasks}
    isEmbedded={true}
  />
) : null
```

---

## 5. Systempunkte als eigenstaendige Hauptpunkte behandeln

In der aktuellen Implementierung werden System-Items wie "Meine Notizen" und "Kommende Termine", wenn sie direkte Hauptpunkte der Agenda sind (`parent_id === null`), bereits korrekt als eigenstaendige Punkte gerendert (Zeile 3132-3154). Wenn sie als Unterpunkte eines uebergeordneten Punktes stehen, werden sie als eingebettete Elemente innerhalb des uebergeordneten Punktes angezeigt (Zeile 3244-3286).

Das Problem zeigt sich in der Fokus-Mode-Ansicht (Screenshot 2 und 3): System-Items, die als eigenstaendige Haupt-Agenda-Punkte stehen, werden dort trotzdem wie Unterpunkte des vorherigen Punktes angezeigt. Die Navigation in der allNavigableItems-Liste behandelt sie aber bereits korrekt als eigenstaendige Punkte.

Das Problem liegt wahrscheinlich darin, dass in der Normal-Ansicht (aktiviertes Meeting) die System-Items innerhalb ihres uebergeordneten Punktes gerendert werden, selbst wenn sie als eigenstaendige Hauptpunkte konfiguriert sind. Die Zeilen 3132-3154 bestaetigen, dass es korrekt implementiert ist - das Rendering als eigenstaendiger Punkt funktioniert.

Das tatsaechliche Problem scheint das Rendering im Fokus-Modus zu sein: Wenn ein System-Item ein Hauptpunkt ist (kein `parent_id`), wird es zwar in der Navigation als eigenstaendiger Punkt gefuehrt, aber das Rendering zeigt die SystemAgendaItem-Card noch innerhalb des vorherigen Kontexts an.

**Loesung:** Das Rendering im Fokus-Modus ist bereits ueber `allNavigableItems` korrekt implementiert - jedes Haupt-Item (inkl. System-Items) wird einzeln navigiert. Die einzige Korrektur ist, dass die Nummerierung und das visuelle Erscheinungsbild als eigenstaendiger Punkt erkennbar sein muss (Nummer-Badge + Checkbox).

---

## 6. HTML in Beschreibungen von Unterpunkten

### MeetingsView.tsx (Zeile ~3316-3319)

```tsx
// Vorher:
{subItem.description && (
  <div className="mb-2 bg-muted/20 p-2 rounded border-l-2 border-primary/20">
    <p className="text-sm text-foreground whitespace-pre-wrap">{subItem.description}</p>
  </div>
)}

// Nachher:
{subItem.description && (
  <div className="mb-2 bg-muted/20 p-2 rounded border-l-2 border-primary/20">
    <RichTextDisplay content={subItem.description} className="text-sm text-foreground" />
  </div>
)}
```

Dasselbe fuer die Beschreibung bei Hauptpunkten (Zeile ~3128-3130):
```tsx
// Vorher:
{item.description && (
  <p className="text-muted-foreground mb-3 ml-12">{item.description}</p>
)}

// Nachher:
{item.description && (
  <div className="mb-3 ml-12">
    <RichTextDisplay content={item.description} className="text-muted-foreground" />
  </div>
)}
```

Und im FocusModeView (Zeile ~588-590):
```tsx
// Vorher:
{item.description && (
  <p className="text-muted-foreground mt-2">{item.description}</p>
)}

// Nachher:
{item.description && (
  <div className="mt-2">
    <RichTextDisplay content={item.description} className="text-muted-foreground" />
  </div>
)}
```

---

## 7. MeetingNoteSelector zeigt keine oeffentlichen/Teilnehmer-Meetings

### MeetingNoteSelector.tsx (Zeile ~43-63)

Die aktuelle Query:
```tsx
.eq('user_id', user.id)
```

**Neue Query-Logik:**
```tsx
const loadMeetings = async () => {
  if (!user) return;
  
  setLoading(true);
  try {
    // 1. Eigene Meetings laden
    const { data: ownMeetings, error: ownError } = await supabase
      .from('meetings')
      .select('id, title, meeting_date, status')
      .eq('user_id', user.id)
      .neq('status', 'archived')
      .gte('meeting_date', new Date().toISOString().split('T')[0])
      .order('meeting_date', { ascending: true })
      .limit(20);

    if (ownError) throw ownError;

    // 2. Meetings laden, bei denen der User Teilnehmer ist
    const { data: participantEntries } = await supabase
      .from('meeting_participants')
      .select('meeting_id')
      .eq('user_id', user.id);
    
    let participantMeetings: any[] = [];
    if (participantEntries && participantEntries.length > 0) {
      const meetingIds = participantEntries.map(p => p.meeting_id);
      const { data: partMeetings } = await supabase
        .from('meetings')
        .select('id, title, meeting_date, status')
        .in('id', meetingIds)
        .neq('status', 'archived')
        .neq('user_id', user.id) // Nicht doppelt laden
        .gte('meeting_date', new Date().toISOString().split('T')[0])
        .order('meeting_date', { ascending: true });
      
      participantMeetings = partMeetings || [];
    }

    // 3. Oeffentliche Meetings laden
    const { data: publicMeetings } = await supabase
      .from('meetings')
      .select('id, title, meeting_date, status')
      .eq('is_public', true)
      .neq('status', 'archived')
      .neq('user_id', user.id)
      .gte('meeting_date', new Date().toISOString().split('T')[0])
      .order('meeting_date', { ascending: true })
      .limit(20);

    // Alle zusammenfuegen und Duplikate entfernen
    const allMeetings = [...(ownMeetings || [])];
    const existingIds = new Set(allMeetings.map(m => m.id));
    
    for (const m of [...participantMeetings, ...(publicMeetings || [])]) {
      if (!existingIds.has(m.id)) {
        allMeetings.push(m);
        existingIds.add(m.id);
      }
    }

    // Nach Datum sortieren
    allMeetings.sort((a, b) => new Date(a.meeting_date).getTime() - new Date(b.meeting_date).getTime());

    setMeetings(allMeetings);
  } catch (error) {
    console.error('Error loading meetings:', error);
  } finally {
    setLoading(false);
  }
};
```

---

## 8. "Aufgaben"-Icon in MyWorkJourFixeTab

### MyWorkJourFixeTab.tsx (Zeile 201-205)

```tsx
// Vorher:
const getSystemItemIcon = (systemType: string | null | undefined) => {
  if (systemType === 'quick_notes') return <StickyNote className="h-3 w-3 text-amber-500" />;
  if (systemType === 'upcoming_appointments') return <Calendar className="h-3 w-3 text-blue-500" />;
  return null;
};

// Nachher:
const getSystemItemIcon = (systemType: string | null | undefined) => {
  if (systemType === 'quick_notes') return <StickyNote className="h-3 w-3 text-amber-500" />;
  if (systemType === 'upcoming_appointments') return <Calendar className="h-3 w-3 text-blue-500" />;
  if (systemType === 'tasks') return <ListTodo className="h-3 w-3 text-green-500" />;
  return null;
};
```

`ListTodo` muss zum Import hinzugefuegt werden (Zeile 8).

---

## Zusammenfassung der Dateiänderungen

| Datei | Aenderungen |
|-------|-------------|
| **`SystemAgendaItem.tsx`** | 1) `onDelete` Prop, 2) Delete-Button im Header, 3) Kompakteres Padding, 4) Trash-Import |
| **`MeetingsView.tsx`** | 1) `meetingLinkedTasks` State + Ladefunktion, 2) Tasks-Rendering (Normal + Sub + Editor), 3) Cast fuer system_type erweitern, 4) RichTextDisplay fuer Beschreibungen, 5) Delete ueber onDelete-Prop, 6) linkedTasks an FocusModeView uebergeben |
| **`FocusModeView.tsx`** | 1) Tasks-Rendering als System-Content, 2) Tasks bei Sub-Items, 3) RichTextDisplay fuer Beschreibungen |
| **`MeetingNoteSelector.tsx`** | Query erweitert um Teilnehmer- und oeffentliche Meetings |
| **`MyWorkJourFixeTab.tsx`** | Tasks-Icon + ListTodo-Import |

