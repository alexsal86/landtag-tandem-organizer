
# Plan: Vier Verbesserungen fuer Systempunkte im Meeting

## Uebersicht

| # | Anforderung | Loesung |
|---|-------------|---------|
| 1 | Sterne bei Terminen wiederherstellen + optionale Notiz pro Termin | Stern-Funktionalitaet (Star-Button + starred_appointments DB) zurueckbringen; Ergebnis-Textarea nur bei Bedarf einblendbar machen |
| 2 | Bei Aufgaben und Notizen den Ersteller anzeigen | `user_id` bei Quick Notes und Tasks mit-laden, gegen `profiles` aufloesen und im Rendering anzeigen |
| 3 | Enter bei Systempunkten soll zum ersten Unterpunkt springen | Enter-Handler im Fokus-Modus erweitern: auch System-Kinder (isSystemSubItem) als "Sub-Items" behandeln |
| 4 | Farbige Raender bei Systempunkten in der Normalansicht entfernen | `border-l-blue-500`, `border-l-amber-500`, `border-l-green-500` Klassen in der Normalansicht (laufendes Meeting) entfernen |

---

## 1. Sterne bei Terminen wiederherstellen + optionale Notiz

### Problem
Die vorherige Version nutzte `UpcomingAppointmentsSection` mit Star-Funktionalitaet (starred_appointments-Tabelle). Nach dem Refactoring auf Einzel-Sub-Items fehlen die Sterne. Stattdessen gibt es jetzt ein immer sichtbares Ergebnis-Textarea, was uebertrieben ist.

### Loesung

**MeetingsView.tsx:**
- Starred-Appointments laden (neuer State `starredAppointmentIds` + `loadStarredAppointments` + `toggleStarAppointment` analog zu `UpcomingAppointmentsSection`)
- Bei jedem Termin-Sub-Item in der Normalansicht (Zeilen 3211-3237 und 3434-3460):
  - Star-Button hinzufuegen (links vor dem Titel)
  - Ergebnis-Textarea nur anzeigen wenn ein kleiner "Notiz hinzufuegen"-Button geklickt wird (collapsible), oder wenn bereits Text vorhanden ist
- `starredAppointmentIds` und `toggleStarAppointment` als Props an FocusModeView uebergeben

**FocusModeView.tsx:**
- Neue Props: `starredAppointmentIds: Set<string>`, `onToggleStar: (appt: any) => void`
- Bei Termin-Sub-Items (Zeile 507-511): Star-Button und optionales Notiz-Textarea hinzufuegen
- Ergebnis-Textarea bei Terminen nur anzeigen, wenn der User es oeffnet oder bereits Text vorhanden ist

### Konkretes UI-Design pro Termin:
```text
[Star] [CalendarDays] Fraktionssitzung
       Do 12.02. 10:00 - 12:00 | Saal 3
       [+ Notiz]  <-- kleiner Button, nur sichtbar wenn noch keine Notiz
       [Textarea]  <-- nur sichtbar wenn Button geklickt oder bereits Text vorhanden
```

---

## 2. Ersteller bei Aufgaben und Notizen anzeigen

### Problem
Notizen (`quick_notes.user_id`) und Aufgaben (`tasks.user_id`) haben ein `user_id`-Feld fuer den Ersteller, aber dieses wird in den Queries nicht mit Profildaten aufgeloest.

### Loesung

**MeetingsView.tsx:**
- `loadLinkedQuickNotes` (Zeile 1048): Query aendern von `select('*')` zu `select('*, profiles:user_id(display_name)')` oder alternativ den `user_id` mit den vorhandenen `profiles` abgleichen
- `loadMeetingLinkedTasks` (Zeile 1068): Query aendern zu `select('id, title, description, due_date, priority, status, user_id')` und `user_id` hinzufuegen

**Rendering in Normalansicht (MeetingsView.tsx):**
- Bei Notizen (Zeilen 3250-3268): Unter dem Notiz-Titel den Ersteller anzeigen
- Bei Aufgaben (Zeilen 3283-3312): Unter dem Aufgaben-Titel den Ersteller anzeigen

```tsx
// Beispiel Notiz:
<span className="text-xs text-muted-foreground">
  von {getDisplayName(note.user_id)}
</span>
```

**Rendering im Fokus-Modus (FocusModeView.tsx):**
- Bei `sourceType === 'quick_note'` (Zeile 502-506): Ersteller anzeigen
- Bei `sourceType === 'task'` (Zeile 513-530): Ersteller anzeigen

Da FocusModeView bereits `profiles` als Prop hat, kann `getDisplayName(sourceData.user_id)` direkt verwendet werden.

---

## 3. Enter bei Systempunkten springt zum ersten Unterpunkt

### Problem
Im Enter-Handler (FocusModeView.tsx Zeile 334-355) werden nur regulaere Sub-Items (ohne `system_type`) geprueft:
```tsx
const subItems = agendaItems.filter(sub => 
  (sub.parent_id === currentItem.id || sub.parentLocalKey === currentItem.id) &&
  !sub.system_type  // <-- System-Items werden ausgeschlossen
);
```

Wenn ein System-Item (z.B. "Meine Notizen") als Hauptpunkt steht, hat es keine regulaeren Sub-Items, aber System-Kinder (die injizierten note-xxx Items). Der Enter-Handler springt daher nicht zum ersten Kind, sondern markiert den Systempunkt direkt als erledigt.

### Loesung

**FocusModeView.tsx - Enter-Handler (Zeile 334-372):**

Die Logik erweitern, sodass fuer jeden Punkt geprueft wird, ob er navigierbare Kinder in `allNavigableItems` hat:

```tsx
case 'Enter':
  e.preventDefault();
  if (currentNavigable && currentGlobalIndex !== -1) {
    // Pruefen ob der aktuelle Punkt Kinder hat (regulaer ODER System-Sub-Items)
    const currentNavIndex = flatFocusIndex;
    const hasChildren = allNavigableItems.some((n, idx) => 
      idx > currentNavIndex && n.parentItem?.id === currentItem.id
    );
    
    if (hasChildren) {
      // Zum ersten unerledigten Kind navigieren
      const firstUncompletedChild = allNavigableItems.find((n, idx) => 
        idx > currentNavIndex && 
        n.parentItem?.id === currentItem.id && 
        !n.item.is_completed
      );
      if (firstUncompletedChild) {
        const childIdx = allNavigableItems.indexOf(firstUncompletedChild);
        setFlatFocusIndex(childIdx);
        return;
      }
    }
    
    // Kein Kind oder alle erledigt: Standard-Verhalten
    ...
  }
```

Zusaetzlich muss `handleItemComplete` angepasst werden: Wenn ein System-Sub-Item (z.B. eine einzelne Notiz) als erledigt markiert wird und alle Geschwister fertig sind, soll der Eltern-Systempunkt ebenfalls als erledigt markiert werden. Da System-Sub-Items aber synthetisch sind (keine echten agendaItems), muss die Logik die `allNavigableItems`-Liste pruefen statt `agendaItems`.

Da System-Sub-Items keinen `globalIndex` haben (globalIndex === -1), koennen sie nicht direkt ueber `onUpdateItem` aktualisiert werden. Fuer die Checkbox-Funktionalitaet der System-Sub-Items wird ein lokaler State `completedSystemSubItems` eingefuehrt:

```tsx
const [completedSystemSubItems, setCompletedSystemSubItems] = useState<Set<string>>(new Set());
```

Dieser trackt die IDs der erledigten System-Sub-Items (z.B. `note-abc123`). Wenn alle System-Kinder eines Systempunkts abgehakt sind, wird der Eltern-Systempunkt automatisch als erledigt markiert.

---

## 4. Farbige Raender in der Normalansicht entfernen

### Problem
In der laufenden Meeting-Ansicht (Normalansicht) haben die Sub-Items der Systempunkte farbige linke Raender (`border-l-blue-500`, `border-l-amber-500`, `border-l-green-500`). Diese sollen entfernt werden - nur die Icons sollen farbig bleiben.

### Betroffene Stellen in MeetingsView.tsx:

1. **Hauptpunkt-Rendering** (Zeilen 3212, 3250, 3284):
   - `border-l-blue-500` bei Terminen
   - `border-l-amber-500` bei Notizen
   - `border-l-green-500` bei Aufgaben
   - Aendern zu: `border-muted` (neutraler Rand)

2. **Sub-Item-Rendering** (Zeilen 3409-3417):
   - Die farbige `border-l` Logik fuer system_type-Sub-Items
   - Aendern zu: immer `border-muted` verwenden

3. **Innere Sub-Items bei Sub-Item-Systempunkten** (Zeilen 3435, 3478, 3516):
   - Gleiche Aenderung: `border-l-[color]` zu `border-muted`

**Im Fokus-Modus bleiben die Farben erhalten**, da sie dort zur Navigation helfen.

---

## Zusammenfassung der Dateiaenderungen

| Datei | Aenderungen |
|-------|-------------|
| **MeetingsView.tsx** | 1) `starredAppointmentIds` State + `loadStarredAppointments()` + `toggleStarAppointment()`, 2) Star-Buttons bei Terminen, 3) Ergebnis-Textarea nur bei Bedarf, 4) `user_id` in Queries fuer Notes/Tasks, 5) Ersteller-Anzeige bei Notes/Tasks, 6) Farbige Raender entfernen (border-muted statt border-l-[color]), 7) Stern-Props an FocusModeView |
| **FocusModeView.tsx** | 1) Neue Props fuer Stars, 2) Star-Button bei Termin-Sub-Items, 3) Optionales Notiz-Textarea fuer Termine, 4) Ersteller bei Notes/Tasks, 5) Enter-Handler fuer System-Kinder, 6) `completedSystemSubItems` State fuer Checkbox-Tracking, 7) Auto-Complete Elternpunkt wenn alle System-Kinder fertig |
