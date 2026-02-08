
# Plan: 7 Verbesserungen fuer Mentions, Wiedervorlagen, Aufgaben-Sortierung und Filter

## Uebersicht

| Nr | Problem | Loesung |
|----|---------|---------|
| 1 | Mention-Benachrichtigungen werden nicht erzeugt | RPC-Aufruf `create_notification` mit `data_param` als JSON-String statt Objekt senden; Fehlerbehandlung pruefen |
| 2 | Mentions in Quick Notes und Aufgaben ohne Farbe/Erkennung | `RichTextDisplay` erweitern, um `data-lexical-mention`-Spans mit ihren Inline-Styles korrekt zu erhalten |
| 3 | Wiedervorlagen bei Notizen koennen uebersehen werden | Fällige Wiedervorlagen als Benachrichtigung ausloesen und im Dashboard/MyWork prominent mit Badge anzeigen |
| 4 | Meeting-Aufgaben erscheinen bei "Von mir erstellt" statt "Mir zugewiesen" | Filterlogik in MyWorkTasksTab anpassen: Meeting-Aufgaben (Kategorie 'meeting'), die dem Benutzer zugewiesen sind, muessen in "Mir zugewiesen" erscheinen |
| 5 | Erledigte Aufgaben in MyWork Planungen nicht nach unten sortiert | Sortierung in MyWorkPlanningsTab: `is_completed` Planungen ans Ende |
| 6 | Erledigte Planungen auf der Veranstaltungsplanung-Seite nicht nach unten sortiert | Sortierung in EventPlanningView: `is_completed` Planungen ans Ende |
| 7 | Statusfilter bei Aufgaben fehlt | Status-Filter in MyWorkTasksTab hinzufuegen, der `task_statuses` laedt |

---

## Technische Details

### 1. Mention-Benachrichtigungen reparieren

**Dateien:** `src/components/press/PressReleaseEditor.tsx`, `src/components/LetterEditor.tsx`

Das Problem: Der `create_notification` RPC erwartet `data_param` als `jsonb`, aber das Objekt wird moeglicherweise nicht korrekt serialisiert. Zusaetzlich fehlt ein `priority_param`. Die Loesung:

```tsx
await supabase.rpc('create_notification', {
  user_id_param: mentionedUserId,
  type_name: 'document_mention',
  title_param: 'Erwaehnung in Pressemitteilung',
  message_param: `Sie wurden in der Pressemitteilung "${title}" erwaehnt`,
  data_param: JSON.stringify({ documentId: pressRelease.id, documentType: 'press_release' }),
  priority_param: 'medium',
});
```

Ausserdem muss geprueft werden, dass der `priority_param` immer uebergeben wird (Standardwert 'medium'), da die DB-Funktion ihn mit `DEFAULT 'medium'` definiert hat, aber der RPC-Client ihn moeglicherweise nicht als optional behandelt.

### 2. Mentions in RichTextDisplay sichtbar machen

**Datei:** `src/components/ui/RichTextDisplay.tsx`

Das Problem: Der HTML-Sanitizer entfernt die `style`-Attribute der Mention-Spans. Der `exportDOM()` des MentionNode setzt Inline-Styles wie `background-color: #3b82f633; color: #3b82f6; font-weight: 600; padding: 1px 4px; border-radius: 4px;` -- diese werden aber vom `sanitizeHtml` nicht explizit entfernt, **aber** die Spans haben keine `data-lexical-mention`-Attribut-basierte CSS-Klasse.

Die Loesung: Globales CSS in `index.css` hinzufuegen, das `[data-lexical-mention]`-Spans styled, und sicherstellen, dass der Sanitizer die `data-lexical-mention`-Attribute und `style`-Attribute auf Spans nicht entfernt. Alternativ: CSS-Regel fuer `.mention`-Klasse und `[data-lexical-mention]`-Selektor.

```css
/* Mention styling in RichTextDisplay */
[data-lexical-mention] {
  font-weight: 600;
  padding: 1px 4px;
  border-radius: 4px;
}
```

Da die Inline-Styles bereits in `exportDOM()` korrekt gesetzt werden und der Sanitizer `style`-Attribute nicht explizit entfernt, sollten die Mentions eigentlich sichtbar sein. Das eigentliche Problem: Der Sanitizer entfernt moeglicherweise `data-*`-Attribute oder der Content wird ueber `$generateHtmlFromNodes` ohne MentionNode generiert (weil der SimpleRichTextEditor den Content als HTML-String exportiert, aber beim erneuten Laden den MentionNode nicht erkennt).

Eigentliche Ursache: Im `SimpleRichTextEditor` wird `$generateHtmlFromNodes` aufgerufen, was `exportDOM()` nutzt -- das setzt Inline-Styles. Diese werden ueber `onChange(html)` nach aussen gegeben und in der DB gespeichert. Beim Anzeigen via `RichTextDisplay` wird der HTML-String mit `dangerouslySetInnerHTML` gerendert. Der Sanitizer entfernt `style`-Attribute nicht, also sollte es funktionieren.

Moegliches Problem: Der `sanitizeHtml`-Regex `sanitized.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '')` koennte auch Attribute wie `style` matchen, wenn ein Style-Wert `on` enthaelt. Allerdings ist `style` kein `on*`-Attribut. Wahrscheinlicher: Der Inline-Style wird korrekt beibehalten, aber die Farbe passt nicht zum Hintergrund (z.B. im Dark Mode).

Zur Sicherheit fuege ich CSS hinzu, das `data-lexical-mention`-Spans explizit styled, falls die Inline-Styles verloren gehen:

```css
span[data-lexical-mention="true"] {
  font-weight: 600;
  padding: 1px 4px;
  border-radius: 4px;
}
```

### 3. Wiedervorlagen: Faellige Notizen als Benachrichtigung

Aktuell: Wiedervorlagen werden nur angezeigt, wenn der Benutzer aktiv den Tab "Faellige Wiedervorlagen" oeffnet. Wenn das Datum erreicht ist, gibt es keine aktive Benachrichtigung.

**Loesung:**

1. **Notification-Typ registrieren:** Ein neuer Typ `note_follow_up` in `notification_types` wird per Migration eingefuegt.

2. **Pruefung beim Laden der Quick Notes:** Wenn faellige Wiedervorlagen erkannt werden, wird fuer jede eine Benachrichtigung erzeugt (mit Deduplizierungsschutz durch `create_notification` -- verhindert Duplikate innerhalb 1 Minute).

3. **Sichtbarkeit in MyWork:** Faellige Wiedervorlagen werden im Quick Notes-Tab prominent oben angezeigt (das passiert bereits). Zusaetzlich wird ein Badge auf dem "Quick Notes"-Tab angezeigt, wenn faellige Wiedervorlagen existieren.

4. **Implementierung in `QuickNotesList`:** Nach dem Laden der Notizen wird fuer jede faellige Wiedervorlage `create_notification` aufgerufen (nur einmal pro Session, gesteuert durch ein `useRef`).

```tsx
// In QuickNotesList, nach loadNotes:
const notifiedRef = useRef(false);
useEffect(() => {
  if (followUpNotes.length > 0 && user && !notifiedRef.current) {
    notifiedRef.current = true;
    followUpNotes.forEach(note => {
      supabase.rpc('create_notification', {
        user_id_param: user.id,
        type_name: 'note_follow_up',
        title_param: 'Faellige Wiedervorlage',
        message_param: `Notiz "${note.title || 'Ohne Titel'}" hat eine faellige Wiedervorlage`,
        data_param: JSON.stringify({ noteId: note.id }),
        priority_param: 'high',
      });
    });
  }
}, [followUpNotes, user]);
```

### 4. Meeting-Aufgaben bei "Mir zugewiesen" anzeigen

**Datei:** `src/components/my-work/MyWorkTasksTab.tsx`

Das Problem: Zeile 1296 in MeetingsView zeigt, dass Meeting-Aufgaben mit `user_id: user.id` (dem aktuell angemeldeten Benutzer = Meeting-Ersteller) erstellt werden. Wenn der Meeting-Ersteller auch der zugewiesene Benutzer ist, erscheint die Aufgabe in "Von mir erstellt", weil `user_id === user.id`.

Loesung: Die Filterlogik in `loadTasks()` anpassen. Aufgaben mit `category: 'meeting'` und `assigned_to` sollen als "zugewiesen" behandelt werden, auch wenn `user_id === user.id`:

```tsx
// Links: Selbst erstellte Aufgaben (user_id = eigene ID), ABER Meeting-Aufgaben ausschliessen, die einem zugewiesen sind
const createdByMe = allCreated.filter(t => 
  !(t.category === 'meeting' && t.assigned_to && (t.assigned_to === user.id || t.assigned_to.includes(user.id)))
);

// Rechts: Von ANDEREN erstellte + Meeting-Aufgaben, die mir zugewiesen sind
const meetingTasksAssignedToMe = allCreated.filter(t => 
  t.category === 'meeting' && t.assigned_to && (t.assigned_to === user.id || t.assigned_to.includes(user.id))
);
const assignedByOthers = [...allAssigned.filter(t => t.user_id !== user.id), ...meetingTasksAssignedToMe];
```

### 5. Erledigte Aufgaben in MyWork Planungen nach unten sortieren

**Datei:** `src/components/my-work/MyWorkPlanningsTab.tsx`

Zeile 157: `setPlannings(Array.from(allPlannings.values()))` -- keine Sortierung nach `is_completed`.

Loesung: Vor dem Setzen sortieren:

```tsx
const sorted = Array.from(allPlannings.values()).sort((a, b) => {
  // Erledigte nach unten
  if (a.is_completed !== b.is_completed) return a.is_completed ? 1 : -1;
  // Sonst nach Datum
  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
});
setPlannings(sorted);
```

### 6. Erledigte Planungen auf der Veranstaltungsplanung-Seite nach unten

**Datei:** `src/components/EventPlanningView.tsx`

Zeile 412: `.order("created_at", { ascending: false })` -- keine Sortierung nach `is_completed`.

Da Supabase kein `.order("is_completed")` vor `.order("created_at")` unterstuetzt (ohne Index), wird die Sortierung client-seitig gemacht:

```tsx
// Nach dem Fetch in fetchPlannings:
const sortedData = (data || []).sort((a: any, b: any) => {
  if ((a.is_completed || false) !== (b.is_completed || false)) {
    return (a.is_completed ? 1 : -1);
  }
  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
});
setPlannings(sortedData);
```

### 7. Statusfilter bei Aufgaben hinzufuegen

**Datei:** `src/components/my-work/MyWorkTasksTab.tsx`

Aenderungen:
1. Lade `task_statuses` aus der DB (wie in TasksView)
2. Fuege ein `Select`-Dropdown neben dem View-Toggle hinzu
3. Filtere beide Aufgabenlisten (`createdTasks`, `assignedTasks`) nach dem gewaehlten Status
4. Standardmaessig: "Alle" (kein Filter)

```tsx
const [statusFilter, setStatusFilter] = useState<string>('all');
const [taskStatuses, setTaskStatuses] = useState<{name: string, label: string}[]>([]);

// In loadTasks oder separatem useEffect:
const { data: statuses } = await supabase
  .from('task_statuses')
  .select('name, label')
  .eq('is_active', true)
  .order('order_index');
setTaskStatuses(statuses || []);

// Beim Rendern:
const filteredCreatedTasks = statusFilter === 'all' 
  ? createdTasks 
  : createdTasks.filter(t => t.status === statusFilter);
```

---

## Betroffene Dateien

| Aktion | Datei |
|--------|-------|
| Bearbeiten | `src/components/press/PressReleaseEditor.tsx` (Notification-Fix) |
| Bearbeiten | `src/components/LetterEditor.tsx` (Notification-Fix) |
| Bearbeiten | `src/components/ui/RichTextDisplay.tsx` (Mention-Styling) |
| Bearbeiten | `src/index.css` (Mention-CSS fuer RichTextDisplay) |
| Bearbeiten | `src/components/shared/QuickNotesList.tsx` (Wiedervorlage-Benachrichtigungen) |
| Bearbeiten | `src/components/my-work/MyWorkTasksTab.tsx` (Meeting-Aufgaben-Filter, Status-Filter) |
| Bearbeiten | `src/components/my-work/MyWorkPlanningsTab.tsx` (Sortierung erledigter Planungen) |
| Bearbeiten | `src/components/EventPlanningView.tsx` (Sortierung erledigter Planungen) |
| DB-Migration | `note_follow_up` Notification-Typ registrieren |

---

## Reihenfolge

1. DB-Migration: `note_follow_up` Notification-Typ
2. Mention-Benachrichtigungen reparieren (PressReleaseEditor + LetterEditor)
3. Mention-Styling in RichTextDisplay + CSS
4. Wiedervorlage-Benachrichtigungen in QuickNotesList
5. Meeting-Aufgaben Filterlogik in MyWorkTasksTab
6. Sortierung in MyWorkPlanningsTab
7. Sortierung in EventPlanningView
8. Status-Filter in MyWorkTasksTab
