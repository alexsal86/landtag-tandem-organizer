

## Kalender-UI Überarbeitung (8 Punkte)

### 1. Uhrzeiten auf der Linie positionieren
Die Uhrzeiten-Labels im Time-Gutter werden per `transform: translateY(-50%)` bereits verschoben. Zusätzlich muss die vertikale Ausrichtung so angepasst werden, dass die Labels exakt auf der Trennlinie sitzen — wie bei Google Kalender. Der `.rbc-label` bekommt `position: relative` und die Timeslot-Gruppe ein korrektes Padding, damit der Text mittig auf der Linie liegt.

### 2. Header-Ebenen korrigieren
Aktuell gibt es doppelte CSS-Definitionen für `.rbc-time-view .rbc-header`, `.rbc-custom-week-header`, etc. (Zeilen 215-254 und 256-295). Die Duplikate werden entfernt. Der allgemeine `.rbc-header` (Zeile 20-26) mit `background: hsl(var(--accent))` überschreibt die Time-View-Header-Styles — dieser muss auf den Month-View beschränkt werden, damit sich die Ebenen nicht vermischen.

### 3. Kalender-Refresh optimieren
`useCalendarData` nutzt `useState` + `useEffect` mit direktem `setLoading(true)` bei jedem Fetch. Beim Tab-Wechsel im Browser triggert der `useEffect` erneut. Lösung: Umstellung auf `useQuery` (React Query) mit `staleTime` von z.B. 5 Minuten, sodass bei Rückkehr zum Tab kein erneuter Fetch nötig ist, solange die Daten frisch sind. `refetchOnWindowFocus: false` verhindert den automatischen Refresh.

### 4. Aktuelle-Zeit-Linie mit Punkt
CSS für `.rbc-current-time-indicator`: Höhe auf 2px belassen, aber ein `::before` Pseudo-Element hinzufügen — ein roter Kreis (8px Durchmesser) am linken Rand. Farbe bleibt `hsl(var(--destructive))`.

### 5. Abstand nach unten verkleinern
In `CalendarView.tsx` hat der Kalender-Container `p-6 pr-0`. Das Padding-Bottom wird auf `pb-2` reduziert.

### 6. Scrollbar ohne Pfeile (Google-Style)
Custom CSS mit `scrollbar-width: thin` und WebKit-Scrollbar-Styles: Pfeile (`scrollbar-button`) auf `display: none`, schmaler Track, halbtransparenter Thumb mit Rundung.

### 7. Toolbar über dem Kalender: Heute + Pfeile + Monat + KW
Die bestehende `CalendarHeader`-Sidebar (links, 320px) wird grundlegend umgebaut. Der Navigationsbereich (Heute-Button, Pfeile, Monatsanzeige, KW) wird aus der Sidebar herausgelöst und als horizontale Toolbar über dem Kalender platziert. Layout:
- Links: "Heute"-Button, dann `<` `>` Pfeile, dann Monatsname in großer Schrift, dann "KW xx"
- Die Sidebar behält nur "Neuer Termin" und "Abstimmungen"

Konkret: In `CalendarView.tsx` wird über der Card eine neue Toolbar-Zeile eingefügt. Die KW-Berechnung nutzt `getISOWeek` aus date-fns.

### 8. Tag/Woche/Monat/Agenda als Dropdown rechts
Statt der 4 Buttons in der Sidebar wird ein `Select` (Radix) oder `DropdownMenu` am rechten Rand der neuen Toolbar platziert. Labels: Tag, Woche, Monat, Agenda.

### Dateien die geändert werden

- **`src/components/CalendarView.tsx`**: Neue Toolbar über dem Kalender (Heute, Pfeile, Monat, KW, View-Dropdown). Sidebar vereinfachen. Padding anpassen.
- **`src/components/calendar/CalendarHeader.tsx`**: Navigation und View-Buttons entfernen, nur Aktions-Buttons behalten.
- **`src/styles/react-big-calendar.css`**: Doppelte Definitionen entfernen, Header-Ebenen fixen, Uhrzeit-Positionierung, Zeitlinie mit Punkt, Scrollbar-Styling.
- **`src/components/calendar/hooks/useCalendarData.ts`**: Umstellung auf React Query mit `staleTime` und `refetchOnWindowFocus: false`.

