
Problemursache der Monatsansicht ist sehr wahrscheinlich nicht die Datenabfrage, sondern das Zusammenspiel aus React-Big-Calendar-Markup und den aktuellen CSS-Anpassungen:

1. `useCalendarData` liefert auch für die Monatsansicht Termine.
2. `ProperReactBigCalendar` übergibt diese korrekt an React Big Calendar.
3. Die CSS-Datei behandelt aber `.rbc-date-cell` wie eine komplette Tageszelle und gibt ihr `min-height: 100px`. In React Big Calendar ist `.rbc-date-cell` nur der Datums-Header innerhalb der Monatszelle. Dadurch wird das Layout der Monatsreihen verzogen und der eigentliche Event-Bereich kann unsichtbar bzw. falsch zusammengedrückt werden.
4. Zusätzlich fehlt der Monatsansicht ein eigenes, robustes Event-Rendering. Aktuell wird nur global über `.rbc-month-view .rbc-event` gestylt; bei hellen Farben wie `--accent` oder Kategorienfarben kann der Termin optisch nahezu verschwinden.

Geplanter Fix:

1. Monats-CSS korrigieren
- `src/styles/react-big-calendar.css` bereinigen, damit:
  - `.rbc-date-cell` keine künstliche Zellhöhe mehr erzwingt
  - die eigentliche Monatsreihe (`.rbc-month-row`) die Höhe steuert
  - `.rbc-row-content`, `.rbc-row-bg` und Event-Segmente sauber sichtbar bleiben
  - Off-range-Tage und “show more” weiterhin funktionieren

2. Monats-Event-Darstellung stabil machen
- In `src/components/calendar/ProperReactBigCalendar.tsx` ein eigenes `components.month.event` einführen.
- Termine in der Monatsansicht