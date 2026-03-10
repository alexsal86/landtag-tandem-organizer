

## Kalenderansicht: Google Calendar Layout-Anpassung

### Analyse

Aktuell gibt es drei Probleme:
1. Die `.rbc-time-gutter` hat sichtbare Borders (Hintergrundfarbe + border-bottom auf timeslot-groups)
2. Eine JS-injizierte `.rbc-time-separator-column` zwischen Gutter und Day-Columns
3. Die horizontalen Zeitlinien enden an der Grenze der Day-Columns, statt wie bei Google Calendar leicht nach links überzustehen

### Google Calendar Referenz

Im Screenshot sieht man: Die Zeitlabels stehen rechts-bündig, danach beginnen die Tages-Spalten. Die horizontalen Stundenlinien reichen ca. 8px über den linken Rand der Tages-Spalten hinaus (sie "überlappen" den Bereich zwischen Gutter und Spalten). Der Gutter selbst hat keinen Hintergrund und keine Borders.

### Plan

**1. Time Gutter: Borders und Hintergrund entfernen** (CSS)
- `.rbc-time-gutter`: `background` entfernen (auf transparent setzen)
- `.rbc-time-gutter .rbc-timeslot-group`: `border-bottom: none`
- `.rbc-time-gutter .rbc-time-slot`: `border-top: none` (bereits vorhanden, bestätigen)

**2. Separator Column komplett entfernen**
- **JS** (`ProperReactBigCalendar.tsx`): Den gesamten `useEffect` mit `insertSeparatorColumn` und dem `MutationObserver` entfernen (Zeilen 103-140)
- **CSS**: Alle `.rbc-time-separator-column`-Regeln entfernen (Zeilen 213-256)

**3. Day-Columns-Wrapper mit 8px Überhang nach links** (CSS-only Ansatz)
- Da wir die DOM-Struktur von react-big-calendar nicht direkt ändern können, nutzen wir einen CSS-Trick: Die `.rbc-time-content` bekommt `position: relative`, und die Day-Slot-Columns (`.rbc-day-slot.rbc-time-column`) bekommen einen negativen `margin-left` oder wir nutzen ein `::before`-Pseudo-Element auf der ersten Day-Column, das 8px nach links ragt.
- Konkret: `.rbc-time-content` bekommt keinen speziellen Wrapper, aber die horizontalen Linien der `.rbc-timeslot-group` in den Day-Columns werden via `box-shadow` oder `::before` um 8px nach links verlängert. Alternativ: Die `.rbc-day-slot:first-of-type` bekommt `margin-left: -8px; padding-left: 8px;` damit die Linien in den Überhang hineinreichen.
- Bevorzugter Ansatz: Auf `.rbc-time-content` einen `padding-left: 8px` setzen und `.rbc-time-gutter` `margin-right: -8px` geben, sodass die Day-Columns natürlich 8px weiter links starten und ihre Gridlines dort sichtbar sind.

### Technische Details

Dateien die geändert werden:

1. **`src/components/calendar/ProperReactBigCalendar.tsx`**: `useEffect` (Zeilen 103-140) komplett entfernen inkl. `calendarContainerRef` usage im Observer. Der `ref` auf dem Container-div kann bleiben falls anderweitig genutzt.

2. **`src/styles/react-big-calendar.css`**:
   - Zeile 207-211: `.rbc-time-gutter` — background entfernen, `min-width` beibehalten
   - Zeile 213-256: `.rbc-time-separator-column` und zugehörige `::before`/`::after` komplett entfernen
   - Zeile 280-290: Gutter-spezifische Borders anpassen
   - Neue Regel: `.rbc-time-content` bekommt den 8px-Überhang via CSS so dass die Gridlines der Day-Columns leicht in den Gutter-Bereich hineinragen

