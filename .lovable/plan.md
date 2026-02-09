
# Plan: Jour Fixe Korrekturen, Geburtstags-System und Benachrichtigungs-Groesse

## Uebersicht der 7 Punkte

| Nr | Problem | Root Cause | Loesung |
|----|---------|-----------|---------|
| 1 | Ergebnisse aus zugewiesenen Punkten werden nach Archivierung nicht als Aufgabe mit Inhalt angezeigt | Filter `item.result_text?.trim() && !item.task_id` in Step 3 schliesst Punkte aus die result_text haben aber task_id gesetzt haben, da das Ergebnis nicht in die Beschreibung uebernommen wird | Logik in Step 3 korrigieren: Auch Punkte mit task_id muessen ihr Ergebnis in die Aufgabe schreiben |
| 2 | Markierte Termine werden nur als Aufgabe fuer den ersten Teilnehmer erstellt | Step 5d erstellt nur EINE Aufgabe mit `assigned_to: firstParticipant` | Fuer JEDEN Teilnehmer eine eigene Aufgabe mit Unteraufgaben erstellen |
| 3 | Ergebnis bei fremden Notizen in der Besprechung kann nicht gespeichert werden | RLS-Policy auf `quick_notes`: UPDATE erfordert `user_id = auth.uid()`. Meeting-Teilnehmer duerfen `meeting_result` nicht aendern wenn sie nicht der Notiz-Eigentuemer sind | Neue RLS-Policy: Meeting-Teilnehmer duerfen `meeting_result` aktualisieren |
| 4 | Tastatur-Navigation im Fokus-Modus: Kein Shortcut fuer Stern-Markierung bei Terminen | Kein `'s'`-Key-Handler im FocusModeView | Shortcut `s` hinzufuegen: Stern toggeln beim aktuellen Item, wenn es ein Termin ist. Auch `n`/`p` fuer naechsten/vorherigen Termin |
| 5 | Nachbereitung aus Meetings erscheint bei "von mir erstellt" statt "mir zugewiesen" | Follow-up-Task (Step 4) hat `category: 'personal'` und kein `assigned_to`. Die Filterlogik in MyWorkTasksTab verschiebt nur `category: 'meeting'` Tasks nach rechts | `category: 'meeting'` und `assigned_to: user.id` setzen |
| 6 | Neuer Systempunkt "Geburtstage" | Feature existiert nicht | Neuen system_type `birthdays` implementieren mit Kontakt-Geburtstagen der naechsten 14 Tage |
| 7 | Toast-Groesse Normal vs. Gross identisch | Sonner's `toastOptions.classNames.toast` ueberschreibt `toastOptions.className`. Die Klasse `toast-large` wird nie angewendet | `toast-large` in `classNames.toast` statt in `className` integrieren |

---

## Technische Details

### 1. Archivierung: Ergebnisse korrekt in Aufgaben uebernehmen

**Problem im Detail:** In `MeetingsView.tsx` Zeile 1264-1265 filtert Step 3:
```
item.assigned_to && item.result_text?.trim() && !item.task_id
```
Das `!item.task_id` schliesst Punkte aus, die bereits eine verknuepfte Aufgabe haben. Aber selbst wenn der Punkt eine task_id hat, sollte das Ergebnis als Ergaenzung in diese bestehende Aufgabe geschrieben werden.

Gleichzeitig werden in Step 5 (Zeile 1342-1398) Punkte MIT task_id und result_text behandelt (Zeile 1368-1389), aber NUR wenn sie vorher nicht schon in Step 3 verarbeitet wurden. Das Problem: Step 3 ueberspringt Punkte mit task_id, und Step 5 ueberspringt Punkte die assigned_to haben (Zeile 1347: `if (item.task_id || (item.assigned_to && item.result_text?.trim())) continue`).

**Loesung:**
- Step 3: Auch Punkte mit `task_id` verarbeiten - wenn `assigned_to` UND `result_text` vorhanden, das Ergebnis an die bestehende Aufgabe anhaengen (statt neue zu erstellen)
- Step 5: Deduplizierung beibehalten

**Datei:** `src/components/MeetingsView.tsx` (archiveMeeting, ca. Zeile 1263-1315)

### 2. Markierte Termine: Aufgabe fuer ALLE Teilnehmer

**Problem:** Step 5d (Zeile 1503-1517) erstellt nur eine Aufgabe mit `assigned_to: firstParticipant`.

**Loesung:** Fuer jeden Teilnehmer eine eigene Aufgabe mit den gleichen Unteraufgaben erstellen:
```
for (const participantId of participantIds) {
  const task = await supabase.from('tasks').insert({
    user_id: user.id,
    title: `Termine aus Besprechung "${meeting.title}"`,
    category: 'meeting',
    assigned_to: participantId,
    ...
  });
  // Subtasks fuer jeden Termin
  await supabase.from('subtasks').insert(subtasks);
}
```

**Datei:** `src/components/MeetingsView.tsx` (archiveMeeting, ca. Zeile 1460-1537)

### 3. RLS-Policy: Meeting-Teilnehmer duerfen Notiz-Ergebnis aendern

**Problem:** Die UPDATE-Policy auf `quick_notes` erlaubt nur Eigentuemern (`user_id = auth.uid()`) und Nutzern mit Edit-Freigabe das Aktualisieren. Meeting-Teilnehmer koennen aber `meeting_result` nicht setzen fuer Notizen anderer.

**Loesung:** Neue RLS-Policy die es Meeting-Teilnehmern erlaubt, das `meeting_result`-Feld zu aktualisieren:

```sql
CREATE POLICY "Meeting participants can update note results"
  ON public.quick_notes FOR UPDATE
  USING (
    meeting_id IS NOT NULL
    AND (
      EXISTS (
        SELECT 1 FROM meeting_participants mp
        WHERE mp.meeting_id = quick_notes.meeting_id
        AND mp.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM meetings m
        WHERE m.id = quick_notes.meeting_id
        AND m.user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    meeting_id IS NOT NULL
    AND (
      EXISTS (
        SELECT 1 FROM meeting_participants mp
        WHERE mp.meeting_id = quick_notes.meeting_id
        AND mp.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM meetings m
        WHERE m.id = quick_notes.meeting_id
        AND m.user_id = auth.uid()
      )
    )
  );
```

**Datei:** Neue DB-Migration

### 4. Fokus-Modus: Tastatur-Shortcuts fuer Termine

**Problem:** Im `handleKeyDown` in `FocusModeView.tsx` gibt es keinen Handler fuer das Markieren von Terminen mit Sternen via Tastatur.

**Loesung:** Neue Shortcuts hinzufuegen:
- `s` -- Stern toggeln (wenn das aktuelle Item ein Termin/appointment ist)
- `n` -- Zum naechsten Termin springen (nur ueber Termine navigieren)
- `p` -- Zum vorherigen Termin springen

Im `handleKeyDown` Switch-Block:
```typescript
case 's':
  e.preventDefault();
  if (currentNavigable?.sourceType === 'appointment' && onToggleStar) {
    onToggleStar(currentNavigable.sourceData);
  }
  break;
case 'n':
  e.preventDefault();
  // Zum naechsten Termin springen
  const nextAppt = allNavigableItems.findIndex(
    (n, i) => i > flatFocusIndex && n.sourceType === 'appointment'
  );
  if (nextAppt !== -1) setFlatFocusIndex(nextAppt);
  break;
case 'p':
  e.preventDefault();
  // Zum vorherigen Termin springen
  for (let i = flatFocusIndex - 1; i >= 0; i--) {
    if (allNavigableItems[i].sourceType === 'appointment') {
      setFlatFocusIndex(i);
      break;
    }
  }
  break;
```

In der Tastenkuerzel-Legende die neuen Shortcuts dokumentieren.

**Datei:** `src/components/meetings/FocusModeView.tsx`

### 5. Nachbereitung: Kategorie auf 'meeting' aendern

**Problem:** Die Nachbereitungs-Aufgabe (Step 4, Zeile 1327) hat `category: 'personal'` und kein `assigned_to`. Die Filterlogik in `MyWorkTasksTab.tsx` (Zeile 147-155) verschiebt nur Tasks mit `category: 'meeting'` in die rechte Spalte.

**Loesung:** In Step 4 aendern:
```typescript
const { data: createdTask } = await supabase
  .from('tasks')
  .insert({
    user_id: user.id,
    title: `Nachbereitung ${meeting.title}...`,
    category: 'meeting',        // statt 'personal'
    assigned_to: user.id,        // NEU: sich selbst zuweisen
    ...
  });
```

**Datei:** `src/components/MeetingsView.tsx` (archiveMeeting, Zeile 1320-1333)

### 6. Neuer Systempunkt: Geburtstage

**Konzept:** Ein neuer `system_type = 'birthdays'` fuer Meeting-Agendapunkte. Zeigt Kontakte mit Geburtstag in den naechsten 14 Tagen an. In der Besprechung kann man fuer jeden Geburtstag eine Aktion waehlen (Karte, Mail, Anruf, Geschenk). Die gewaehlte Aktion wird als Notiz beim Kontakt hinterlegt.

**Implementierung:**

**a) SystemAgendaItem.tsx erweitern:**
- Neuer Case `birthdays` mit rosa/pink Farbschema
- Laedt Kontakte mit `birthday` in den naechsten 14 Tagen
- Zeigt Name, Geburtstag, Alter an
- Aktions-Buttons: Karte, Mail, Anruf, Geschenk (als Toggle-Buttons)

**b) FocusModeView.tsx erweitern:**
- Neuen `sourceType: 'birthday'` behandeln
- Geburtstage als navigierbare Sub-Items einfuegen (analog zu appointments/notes/tasks)
- Auswahloptionen (Karte/Mail/Anruf/Geschenk) als Buttons im fokussierten Item

**c) MeetingsView.tsx erweitern:**
- `addSystemAgendaItem` um `'birthdays'` erweitern
- System-Button im Popover hinzufuegen (mit Cake-Icon und rosa Farbe)
- Geburtstags-Daten laden: Query auf `contacts` WHERE `birthday` im 14-Tage-Fenster
- Archivierung: Wenn Geburtstag-Aktionen gewaehlt wurden, diese als Notiz/Interaktion zum Kontakt speichern

**d) Administration.tsx:**
- `birthdays` als System-Type in Template-Verwaltung aufnehmen
- Analoger Button wie bei Termine/Notizen/Aufgaben

**e) handle_meeting_insert Trigger:**
- Bereits generisch -- liest `system_type` aus `template_items`. Keine Aenderung noetig.

**Datenstruktur fuer Aktionen:**
Die Geburtstags-Aktionen werden im `result_text` des Agenda-Items als JSON gespeichert:
```json
{
  "contact-uuid-1": { "action": "card", "note": "Karte geschickt" },
  "contact-uuid-2": { "action": "call", "note": "" }
}
```

Bei Archivierung: Fuer jeden Kontakt mit gewaehlter Aktion wird ein Eintrag in `contact_interactions` (oder alternativ als Notiz/Tag am Kontakt) erstellt.

**Dateien:**
- `src/components/meetings/SystemAgendaItem.tsx` (birthdays-Fall hinzufuegen)
- `src/components/meetings/FocusModeView.tsx` (birthday sourceType)
- `src/components/MeetingsView.tsx` (birthdays laden, System-Button, Archivierung)
- `src/pages/Administration.tsx` (Template-Verwaltung)

### 7. Toast-Groesse endlich fixen

**Root Cause:** In `sonner.tsx` wird sowohl `className` als auch `classNames.toast` gesetzt:
```tsx
toastOptions={{
  className: isLarge ? 'toast-large' : '',         // ← wird ignoriert
  classNames: {
    toast: "group toast group-[.toaster]:bg-...",   // ← ueberschreibt className
  }
}}
```

Sonner verwendet `classNames.toast` mit hoeherer Prioritaet als `className`. Daher wird `toast-large` nie angewendet.

**Loesung:** `toast-large` direkt in `classNames.toast` integrieren:
```tsx
toastOptions={{
  classNames: {
    toast: `group toast group-[.toaster]:bg-background ... ${isLarge ? 'toast-large' : ''}`,
    ...
  }
}}
```

Die `className` Prop wird entfernt. Die CSS-Regeln in `index.css` (Zeile 776-800) bleiben unveraendert -- sie greifen, sobald die Klasse korrekt angewendet wird.

**Datei:** `src/components/ui/sonner.tsx`

---

## Betroffene Dateien

| Aktion | Datei |
|--------|-------|
| DB-Migration | RLS-Policy fuer `quick_notes` UPDATE durch Meeting-Teilnehmer |
| Bearbeiten | `src/components/MeetingsView.tsx` (Archivierung Steps 3-5d korrigieren, Geburtstage laden und System-Button, `category: 'meeting'` fuer Nachbereitung) |
| Bearbeiten | `src/components/meetings/FocusModeView.tsx` (Shortcuts `s`/`n`/`p`, birthday sourceType) |
| Bearbeiten | `src/components/meetings/SystemAgendaItem.tsx` (birthdays-Rendering) |
| Bearbeiten | `src/pages/Administration.tsx` (birthdays in Template-Verwaltung) |
| Bearbeiten | `src/components/ui/sonner.tsx` (Toast-Groesse Fix) |

## Reihenfolge

1. **Toast-Groesse fixen** (schnellster Fix, 1 Zeile)
2. **RLS-Policy fuer Notiz-Ergebnisse** (DB-Migration)
3. **Archivierung korrigieren** (Steps 3, 4, 5d in MeetingsView)
4. **Fokus-Modus Tastatur-Shortcuts** (FocusModeView)
5. **Geburtstags-Systempunkt** (SystemAgendaItem, FocusModeView, MeetingsView, Administration)
