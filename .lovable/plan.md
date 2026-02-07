
# Plan: Vier Verbesserungen fuer Meine Arbeit und Meetings

## Uebersicht

| # | Anforderung | Loesung |
|---|-------------|---------|
| 1 | Jour Fixe Tab: oeffentliche und Teilnehmer-Meetings anzeigen | `loadMeetings` in `MyWorkJourFixeTab` erweitern um Teilnehmer-Meetings und oeffentliche Meetings |
| 2 | Notizen in Agenda fuer alle berechtigten Teilnehmer sichtbar | RLS-Policy fuer `quick_notes` um Meeting-basierte Sichtbarkeit erweitern |
| 3 | Jour Fixe Icon-Faerbung bei Aufgaben unter Meine Arbeit | `meeting_id` und `pending_for_jour_fixe` im Task-Interface verfuegbar machen und `hasMeetingLink`-Prop an `TaskActionIcons` uebergeben |
| 4 | Korrekte Aufteilung: Links eigene, rechts zugewiesene Aufgaben | Filterlogik in `MyWorkTasksTab` ueberarbeiten |

---

## 1. Jour Fixe Tab: oeffentliche Meetings und Teilnehmer-Meetings anzeigen

### Problem
In `MyWorkJourFixeTab.tsx` werden Meetings nur per `.eq("user_id", user.id)` geladen (Zeile 101). Das bedeutet, nur selbst erstellte Meetings werden angezeigt. Meetings, an denen man als Teilnehmer eingetragen ist oder die als oeffentlich markiert sind, fehlen komplett.

### Loesung (MyWorkJourFixeTab.tsx)

Die `loadMeetings`-Funktion wird analog zur `loadMeetings` in `MeetingsView.tsx` erweitert:

1. Eigene Meetings laden (bestehend)
2. Teilnehmer-Meetings laden (via `meeting_participants`)
3. Oeffentliche Meetings laden (via `is_public = true`)
4. Ergebnisse zusammenfuehren und deduplizieren

```tsx
const loadMeetings = async () => {
  if (!user) return;
  try {
    const now = new Date().toISOString();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // 1. Own meetings (creator)
    const { data: ownUpcoming } = await supabase
      .from("meetings")
      .select("id, title, meeting_date, meeting_time, status, description")
      .eq("user_id", user.id)
      .neq("status", "archived")
      .gte("meeting_date", now)
      .order("meeting_date", { ascending: true })
      .limit(20);

    const { data: ownPast } = await supabase
      .from("meetings")
      .select("id, title, meeting_date, meeting_time, status, description")
      .eq("user_id", user.id)
      .neq("status", "archived")
      .lt("meeting_date", now)
      .gte("meeting_date", thirtyDaysAgo.toISOString())
      .order("meeting_date", { ascending: false })
      .limit(10);

    // 2. Participant meetings
    const { data: participantData } = await supabase
      .from("meeting_participants")
      .select("meeting_id, meetings(id, title, meeting_date, meeting_time, status, description)")
      .eq("user_id", user.id);

    // 3. Public meetings in tenant
    const { data: publicMeetings } = await supabase
      .from("meetings")
      .select("id, title, meeting_date, meeting_time, status, description")
      .eq("is_public", true)
      .neq("status", "archived")
      .gte("meeting_date", thirtyDaysAgo.toISOString());

    // Combine and deduplicate
    const ownIds = new Set([
      ...(ownUpcoming || []).map(m => m.id),
      ...(ownPast || []).map(m => m.id)
    ]);
    
    const participantMeetings = (participantData || [])
      .filter(p => p.meetings && !ownIds.has(p.meetings.id) && p.meetings.status !== 'archived')
      .map(p => p.meetings);
    
    const allIds = new Set([...ownIds, ...participantMeetings.map(m => m.id)]);
    const publicExtra = (publicMeetings || []).filter(m => !allIds.has(m.id));
    
    const allMeetings = [
      ...(ownUpcoming || []),
      ...(ownPast || []),
      ...participantMeetings,
      ...publicExtra
    ];

    // Split into upcoming/past
    const upcoming = allMeetings
      .filter(m => new Date(m.meeting_date) >= new Date(now))
      .sort((a, b) => new Date(a.meeting_date).getTime() - new Date(b.meeting_date).getTime())
      .slice(0, 20);

    const past = allMeetings
      .filter(m => new Date(m.meeting_date) < new Date(now))
      .sort((a, b) => new Date(b.meeting_date).getTime() - new Date(a.meeting_date).getTime())
      .slice(0, 10);

    setUpcomingMeetings(upcoming);
    setPastMeetings(past);
  } catch (error) {
    console.error("Error loading meetings:", error);
  } finally {
    setLoading(false);
  }
};
```

Das `Meeting`-Interface wird um `is_public` erweitert, und in der `MeetingItem`-Darstellung wird ein Globe-Icon fuer oeffentliche Meetings angezeigt (analog zu MeetingsView).

---

## 2. Notizen in Meeting-Agenda fuer alle berechtigten Teilnehmer sichtbar

### Problem
Die `quick_notes` RLS-Policies erlauben SELECT nur fuer:
- Eigene Notizen (`user_id = auth.uid()`)
- Geteilte Notizen (via `quick_note_shares` oder globale Freigabe)

Wenn ein Teilnehmer die Meeting-Agenda oeffnet und der System-Punkt "Meine Notizen" angezeigt wird, sieht jeder Teilnehmer nur seine eigenen Notizen. Notizen anderer Meeting-Teilnehmer sind nicht sichtbar, auch wenn sie zum selben Meeting verknuepft sind.

### Loesung

Eine neue RLS-Policy auf der `quick_notes`-Tabelle hinzufuegen, die SELECT erlaubt, wenn die Notiz mit einem Meeting verknuepft ist, an dem der aktuelle Benutzer teilnimmt oder das oeffentlich ist:

```sql
CREATE POLICY "Meeting participants can view linked notes"
ON quick_notes
FOR SELECT
USING (
  meeting_id IS NOT NULL
  AND (
    EXISTS (
      SELECT 1 FROM meeting_participants
      WHERE meeting_participants.meeting_id = quick_notes.meeting_id
      AND meeting_participants.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM meetings
      WHERE meetings.id = quick_notes.meeting_id
      AND (meetings.is_public = true OR meetings.user_id = auth.uid())
    )
  )
);
```

Dadurch werden alle Notizen, die zu einem Meeting gehoeren, fuer alle Teilnehmer, den Ersteller und bei oeffentlichen Meetings fuer alle Mandantenmitglieder sichtbar.

Keine Codeaenderungen noetig - die Query `loadLinkedQuickNotes` in `MeetingsView.tsx` (Zeile 1055) laed bereits alle Notizen per `meeting_id`, die RLS-Policy blockiert nur den Zugriff.

---

## 3. Jour Fixe Icon-Faerbung bei Aufgaben

### Problem
In `QuickNotesList.tsx` wird das CalendarDays-Icon eingefaerbt (`text-emerald-600`), wenn eine Notiz eine `meeting_id` hat (Zeile 1597). Bei Aufgaben in `MyWorkTasksTab` fehlt diese Faerbung. Die `TaskActionIcons`-Komponente hat bereits eine `hasMeetingLink`-Prop (Zeile 30), die das Icon lila faerbt (`text-purple-600`), aber sie wird nie mit `true` uebergeben.

### Loesung

**MyWorkTasksTab.tsx:**

1. Das `Task`-Interface um `meeting_id` und `pending_for_jour_fixe` erweitern:
```tsx
interface Task {
  // ...bestehende Felder...
  meeting_id?: string | null;
  pending_for_jour_fixe?: boolean | null;
}
```

2. Beim Rendern von `TaskCard` die `hasMeetingLink`-Prop uebergeben. Da `TaskCard` diese Prop noch nicht hat, muss sie dort ergaenzt werden.

**TaskCard.tsx:**

1. Neue Prop `hasMeetingLink` hinzufuegen:
```tsx
interface TaskCardProps {
  // ...bestehende Props...
  hasMeetingLink?: boolean;
}
```

2. An `TaskActionIcons` weiterreichen:
```tsx
<TaskActionIcons
  taskId={task.id}
  hasMeetingLink={hasMeetingLink}
  // ...restliche Props...
/>
```

**MyWorkTasksTab.tsx - renderTaskList:**

Beim Rendern der TaskCard:
```tsx
<TaskCard
  key={task.id}
  task={task}
  hasMeetingLink={!!(task.meeting_id || task.pending_for_jour_fixe)}
  // ...restliche Props...
/>
```

**TaskListRow.tsx:**

Gleiche Erweiterung wie bei TaskCard (Prop hinzufuegen und an TaskActionIcons weiterreichen).

---

## 4. Korrekte Aufteilung: Links eigene Aufgaben, rechts zugewiesene

### Problem
In `MyWorkTasksTab.tsx` (Zeile 126-131) funktioniert die Aufteilung wie folgt:
- "Mir zugewiesen" (rechts): Alle Aufgaben, bei denen `assigned_to` die User-ID enthaelt
- "Von mir erstellt" (links): Alle Aufgaben, bei denen `user_id` dem aktuellen User entspricht, AUSSER wenn sie schon in "Mir zugewiesen" sind

Das Problem: Wenn ein Benutzer eine Aufgabe selbst erstellt UND sich selbst zuweist, landet sie ausschliesslich rechts ("Mir zugewiesen"), weil die Logik alle assigned Tasks von den created Tasks abzieht. Die erwartete Aufteilung ist:
- **Links**: Aufgaben, die der Benutzer selbst originaer erstellt hat (user_id = eigene ID)
- **Rechts**: Aufgaben, die von **anderen** Personen oder dem System zugewiesen wurden (assigned_to enthaelt eigene ID, aber user_id ist NICHT die eigene ID)

### Loesung (MyWorkTasksTab.tsx)

Die Filterlogik anpassen:

```tsx
const allAssigned = assigned || [];
const allCreated = created || [];

// Links: Tasks, die der User selbst erstellt hat (user_id = eigene ID)
// Auch wenn der User sich selbst zugewiesen hat, bleiben sie links
const createdByMe = allCreated; // Alle selbst erstellten Aufgaben

// Rechts: Tasks, die zugewiesen wurden, aber NICHT vom User selbst erstellt
const assignedByOthers = allAssigned.filter(t => t.user_id !== user.id);

setCreatedTasks(createdByMe);
setAssignedTasks(assignedByOthers);
```

Dadurch erscheinen:
- Selbst erstellte und sich selbst zugewiesene Aufgaben: Links ("Von mir erstellt")
- Von anderen erstellte und mir zugewiesene Aufgaben: Rechts ("Mir zugewiesen")
- Selbst erstellte, jemandem anderem zugewiesene Aufgaben: Links ("Von mir erstellt")

---

## Zusammenfassung der Dateiaenderungen

| Datei | Aenderungen |
|-------|-------------|
| **MyWorkJourFixeTab.tsx** | `loadMeetings` erweitern um Teilnehmer- und oeffentliche Meetings, `Meeting`-Interface um `is_public` erweitern, Globe-Icon fuer oeffentliche Meetings |
| **MyWorkTasksTab.tsx** | 1) `Task`-Interface um `meeting_id` und `pending_for_jour_fixe`, 2) `hasMeetingLink`-Prop an TaskCard uebergeben, 3) Filterlogik fuer Links/Rechts-Aufteilung korrigieren |
| **TaskCard.tsx** | Neue Prop `hasMeetingLink`, Weiterleitung an `TaskActionIcons` |
| **TaskListRow.tsx** | Gleiche `hasMeetingLink`-Prop-Erweiterung |
| **Supabase Migration** | Neue RLS-Policy auf `quick_notes` fuer Meeting-basierte Sichtbarkeit |
