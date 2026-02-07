
# Plan: System-Unterpunkte als autonome navigierbare Items im Fokus-Modus

## Problem

Wenn "Meine Notizen" und "Kommende Termine" als **Unterpunkte** eines uebergeordneten Punktes (z.B. "Aktuelles aus dem Landtag") konfiguriert sind, werden sie im Fokus-Modus komplett ignoriert. Das liegt an zwei Ursachen:

1. **Filterung:** In `FocusModeView.tsx` (Zeile 131-134) werden Sub-Items mit `system_type` explizit ausgefiltert (`!sub.system_type`). Die nachfolgende Logik (Zeile 147-209) injiziert System-Sub-Items nur fuer **Hauptpunkte** (`mainItem.system_type === ...`), nicht fuer Sub-Items mit system_type.

2. **Fehlende Daten:** `upcomingAppointments` wird nie an FocusModeView uebergeben (Zeile 2555-2566 in MeetingsView). Es gibt auch keinen State dafuer in MeetingsView.

## Loesung

### Konzept fuer effiziente Besprechung

Jeder Systempunkt (Notizen, Termine, Aufgaben) wird als eigenstaendiger navigierbarer Punkt behandelt - unabhaengig davon ob er Hauptpunkt oder Unterpunkt eines uebergeordneten Items ist. Unter jedem Systempunkt werden die einzelnen Eintraege (jede Notiz, jeder Termin, jede Aufgabe) als autonome Sub-Items eingefuegt.

```text
Beispiel: "Aktuelles aus dem Landtag" (Hauptpunkt)
  |-- Kommende Termine (System-Unterpunkt, navigierbar)
  |     |-- Fraktionssitzung 12.02. (Sub-Item, navigierbar + Ergebnis)
  |     |-- Ausschuss Bildung 14.02. (Sub-Item, navigierbar + Ergebnis)
  |-- Meine Notizen (System-Unterpunkt, navigierbar)
  |     |-- Notiz "Haushalt 2026" (Sub-Item, navigierbar + Ergebnis)
  |     |-- Notiz "Anfrage SPD" (Sub-Item, navigierbar + Ergebnis)
```

Fuer Termine gilt besonders:
- Jeder Termin zeigt Datum, Uhrzeit und Ort
- Sterne (Star) koennen direkt im Sub-Item gesetzt werden
- Ein Ergebnisfeld ermoeglicht Notizen zu jedem einzelnen Termin (z.B. "Teilnahme nicht noetig" oder "Vorbereitung: Antrag mitbringen")
- Ergebnisse werden als JSON im `result_text` des System-Agenda-Items gespeichert (gleiches Muster wie bei Aufgaben)

---

## Technische Aenderungen

### 1. MeetingsView.tsx - Termine laden und uebergeben

**Neuer State + Ladefunktion:**

```tsx
const [meetingUpcomingAppointments, setMeetingUpcomingAppointments] = useState<any[]>([]);

const loadMeetingUpcomingAppointments = async (meetingId: string, meetingDate: string | Date) => {
  if (!currentTenant?.id) return;
  try {
    const baseDate = typeof meetingDate === 'string' ? new Date(meetingDate) : meetingDate;
    const startDate = startOfDay(baseDate);
    const endDate = endOfDay(addDays(baseDate, 14));

    // Interne Termine
    const { data: internalData } = await supabase
      .from('appointments')
      .select('id, title, start_time, end_time, location, category, status')
      .eq('tenant_id', currentTenant.id)
      .gte('start_time', startDate.toISOString())
      .lte('start_time', endDate.toISOString())
      .order('start_time', { ascending: true });

    // Externe Termine
    const { data: externalData } = await supabase
      .from('external_events')
      .select('id, title, start_time, end_time, location, external_calendars!inner(name, color, tenant_id)')
      .eq('external_calendars.tenant_id', currentTenant.id)
      .gte('start_time', startDate.toISOString())
      .lte('start_time', endDate.toISOString());

    const all = [
      ...(internalData || []).map(a => ({ ...a, isExternal: false })),
      ...(externalData || []).map((e: any) => ({
        id: e.id, title: e.title, start_time: e.start_time, end_time: e.end_time,
        location: e.location, isExternal: true,
        calendarName: e.external_calendars?.name, calendarColor: e.external_calendars?.color
      }))
    ].sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

    setMeetingUpcomingAppointments(all);
  } catch (error) {
    console.error('Error loading upcoming appointments:', error);
    setMeetingUpcomingAppointments([]);
  }
};
```

**Aufrufe:** An allen Stellen wo `loadLinkedQuickNotes` und `loadMeetingLinkedTasks` aufgerufen werden, auch `loadMeetingUpcomingAppointments` aufrufen (ca. 5 Stellen).

**FocusModeView-Aufruf ergaenzen:**

```tsx
<FocusModeView
  meeting={activeMeeting}
  agendaItems={agendaItems}
  profiles={profiles}
  linkedQuickNotes={linkedQuickNotes}
  linkedTasks={meetingLinkedTasks}
  upcomingAppointments={meetingUpcomingAppointments}  // NEU
  onClose={() => setIsFocusMode(false)}
  onUpdateItem={updateAgendaItem}
  onUpdateResult={updateAgendaItemResult}
  onUpdateNoteResult={updateQuickNoteResult}
  onArchive={() => archiveMeeting(activeMeeting)}
/>
```

**Imports hinzufuegen:** `startOfDay`, `endOfDay`, `addDays` aus `date-fns`.

---

### 2. FocusModeView.tsx - allNavigableItems erweitern

Die zentrale Aenderung: Sub-Items mit `system_type` muessen ebenfalls verarbeitet werden. Die Logik wird wie folgt angepasst:

**Helper-Funktion zum Injizieren von System-Kindern:**

```tsx
const injectSystemChildren = (
  systemItem: AgendaItem, 
  parentForChildren: AgendaItem,
  globalIdx: number
) => {
  if (systemItem.system_type === 'quick_notes' && linkedQuickNotes.length > 0) {
    linkedQuickNotes.forEach((note, i) => {
      result.push({
        item: { id: `note-${note.id}`, title: note.title || `Notiz ${i+1}`, 
                is_completed: false, order_index: systemItem.order_index + i + 1, 
                system_type: 'quick_note_item' } as AgendaItem,
        isSubItem: true, parentItem: parentForChildren,
        globalIndex: -1, isSystemSubItem: true,
        sourceId: note.id, sourceType: 'quick_note', sourceData: note
      });
    });
  }
  if (systemItem.system_type === 'upcoming_appointments' && upcomingAppointments.length > 0) {
    upcomingAppointments.forEach((appt, i) => {
      result.push({
        item: { id: `appt-${appt.id}`, title: appt.title || `Termin ${i+1}`,
                is_completed: false, order_index: systemItem.order_index + i + 1,
                system_type: 'appointment_item' } as AgendaItem,
        isSubItem: true, parentItem: parentForChildren,
        globalIndex: -1, isSystemSubItem: true,
        sourceId: appt.id, sourceType: 'appointment', sourceData: appt
      });
    });
  }
  if (systemItem.system_type === 'tasks' && linkedTasks.length > 0) {
    linkedTasks.forEach((task, i) => {
      result.push({
        item: { id: `task-${task.id}`, title: task.title || `Aufgabe ${i+1}`,
                is_completed: false, order_index: systemItem.order_index + i + 1,
                system_type: 'task_item' } as AgendaItem,
        isSubItem: true, parentItem: parentForChildren,
        globalIndex: -1, isSystemSubItem: true,
        sourceId: task.id, sourceType: 'task', sourceData: task
      });
    });
  }
};
```

**Geaenderte Hauptlogik in `allNavigableItems`:**

```tsx
mainItems.forEach((mainItem) => {
  const globalIndex = agendaItems.findIndex(i => i.id === mainItem.id);
  result.push({ item: mainItem, isSubItem: false, parentItem: null, globalIndex, isSystemSubItem: false });

  // Alle Sub-Items holen (INKL. system_type)
  const allSubItems = agendaItems.filter(sub =>
    sub.parent_id === mainItem.id || sub.parentLocalKey === mainItem.id
  ).sort((a, b) => a.order_index - b.order_index);

  allSubItems.forEach(subItem => {
    const subGlobalIndex = agendaItems.findIndex(i => i.id === subItem.id);

    if (subItem.system_type) {
      // System-Sub-Item: als navigierbaren Punkt einfuegen
      result.push({
        item: subItem, isSubItem: true, parentItem: mainItem,
        globalIndex: subGlobalIndex, isSystemSubItem: false
      });
      // Dann seine Kinder (Notizen/Termine/Aufgaben) injizieren
      injectSystemChildren(subItem, subItem, subGlobalIndex);
    } else {
      // Regulaerer Unterpunkt
      result.push({
        item: subItem, isSubItem: true, parentItem: mainItem,
        globalIndex: subGlobalIndex, isSystemSubItem: false
      });
    }
  });

  // Wenn der Hauptpunkt selbst ein System-Typ ist, Kinder injizieren
  if (mainItem.system_type) {
    injectSystemChildren(mainItem, mainItem, globalIndex);
  }
});
```

---

### 3. FocusModeView.tsx - Ergebnis-Handling fuer Termine

Termine bekommen dasselbe JSON-Ergebnis-Muster wie Aufgaben:

**Im `renderNavigableItem`, Abschnitt fuer System-Sub-Items:**

```tsx
const getSubItemResult = () => {
  if (sourceType === 'quick_note') return sourceData.meeting_result || '';
  if (sourceType === 'appointment' && parentItem) {
    try {
      const results = JSON.parse(parentItem.result_text || '{}');
      return results[sourceData.id] || '';
    } catch { return ''; }
  }
  if (sourceType === 'task' && parentItem) {
    try {
      const results = JSON.parse(parentItem.result_text || '{}');
      return results[sourceData.id] || '';
    } catch { return ''; }
  }
  return '';
};

const updateSubItemResult = (value: string) => {
  if (sourceType === 'quick_note' && onUpdateNoteResult) {
    onUpdateNoteResult(sourceData.id, value);
  } else if ((sourceType === 'task' || sourceType === 'appointment') && parentItem?.id) {
    try {
      const results = JSON.parse(parentItem.result_text || '{}');
      results[sourceData.id] = value;
      onUpdateResult(parentItem.id, 'result_text', JSON.stringify(results));
    } catch {
      onUpdateResult(parentItem.id, 'result_text', JSON.stringify({ [sourceData.id]: value }));
    }
  }
};
```

**Ergebnis-Textarea auch fuer `appointment` anzeigen:**

Zeile 557 aendern von:
```tsx
{isFocused && (sourceType === 'quick_note' || sourceType === 'task') && (
```
zu:
```tsx
{isFocused && (sourceType === 'quick_note' || sourceType === 'task' || sourceType === 'appointment') && (
```

---

### 4. FocusModeView.tsx - FocusModeUpcomingAppointments entfernen

Die bisherige Darstellung ueber `FocusModeUpcomingAppointments` (Zeilen 649-658) wird ersetzt durch eine Zusammenfassung (wie bei Notizen/Aufgaben):

```tsx
{item.system_type === 'upcoming_appointments' && upcomingAppointments.length > 0 && (
  <div className="mt-3 text-sm text-muted-foreground">
    {upcomingAppointments.length} {upcomingAppointments.length === 1 ? 'Termin' : 'Termine'} — einzeln navigierbar
  </div>
)}
```

Die Imports fuer `FocusModeUpcomingAppointments` und die zugehoerigen State-Variablen (`focusedAppointmentIndex`, `appointmentsCount`, `upcomingApptsRef`) sowie die Keyboard-Handler fuer `n`, `p`, `s` werden entfernt bzw. angepasst, da die interne Termin-Navigation nicht mehr benoetigt wird.

---

### 5. MeetingsView.tsx - Termine als autonome Sub-Items in Normalansicht

Aktuell zeigt die Normalansicht bei `upcoming_appointments` die komplette `UpcomingAppointmentsSection`. Fuer Konsistenz mit dem Fokus-Modus werden Termine auch hier als einzelne Sub-Items mit Ergebnisfeldern dargestellt.

**Hauptpunkt-Rendering (Zeile ~3160-3169):**

```tsx
{item.system_type === 'upcoming_appointments' && (
  <div className="ml-12 mb-4 space-y-3">
    {meetingUpcomingAppointments.length > 0 ? (
      (() => {
        const apptResults = (() => {
          try { return JSON.parse(item.result_text || '{}'); } catch { return {}; }
        })();
        return meetingUpcomingAppointments.map((appt, apptIdx) => (
          <div key={appt.id} className="pl-4 border-l-2 border-l-blue-500 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">
                {String.fromCharCode(97 + apptIdx)})
              </span>
              <CalendarDays className="h-3.5 w-3.5 text-blue-500" />
              <span className="text-sm font-medium">{appt.title}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {format(new Date(appt.start_time), "EEE dd.MM. HH:mm", { locale: de })}
              {appt.end_time && ` - ${format(new Date(appt.end_time), "HH:mm")}`}
              {appt.location && ` | ${appt.location}`}
            </p>
            <div>
              <label className="text-xs font-medium mb-1 block text-muted-foreground">Ergebnis</label>
              <Textarea
                value={apptResults[appt.id] || ''}
                onChange={(e) => {
                  const newResults = { ...apptResults, [appt.id]: e.target.value };
                  updateAgendaItemResult(item.id!, 'result_text', JSON.stringify(newResults));
                }}
                placeholder="Notizen zu diesem Termin..."
                className="min-h-[60px] text-xs"
              />
            </div>
          </div>
        ));
      })()
    ) : (
      <p className="text-sm text-muted-foreground pl-4">Keine Termine in den naechsten 2 Wochen.</p>
    )}
  </div>
)}
```

Gleiche Aenderung fuer das Sub-Item-Rendering (Zeile ~3346-3362), wo `UpcomingAppointmentsSection` durch die gleiche Einzelansicht ersetzt wird.

---

## Zusammenfassung der Dateiaenderungen

| Datei | Aenderungen |
|-------|-------------|
| **MeetingsView.tsx** | 1) `meetingUpcomingAppointments` State + `loadMeetingUpcomingAppointments()` Funktion, 2) Aufrufe an allen Lade-Stellen, 3) Prop an FocusModeView uebergeben, 4) Termine-Rendering als Einzel-Sub-Items mit Ergebnis (Haupt + Sub), 5) `startOfDay`/`endOfDay`/`addDays` Import |
| **FocusModeView.tsx** | 1) `allNavigableItems` erweitert: Sub-Items mit system_type werden navigierbar + deren Kinder injiziert, 2) Ergebnis-Handling fuer Termine (JSON in result_text), 3) Ergebnis-Textarea auch fuer Termine, 4) `FocusModeUpcomingAppointments` durch Zusammenfassung ersetzt, 5) Alte n/p/s Keyboard-Handler und zugehoerige States entfernt |
