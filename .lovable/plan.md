

# Plan: Kalender-Sidebar an Google Calendar angleichen

## Änderungen

### 1. `src/components/calendar/CalendarHeader.tsx` — classNames anpassen

- **month_caption**: Navigation-Pfeile und Monat/Jahr in eine Zeile bringen (bereits `flex-row justify-between`, aber die `nav` muss inline bleiben)
- **Kompaktere Zellen**: Von `h-9 w-9` auf `h-7 w-7` für Tage, Wochennummern und Buttons
- **week_number**: Durchgehend dunkler hinterlegt mit `bg-muted` und abgerundeten Ecken nur oben/unten für Spalten-Effekt
- **week_number_header**: Gleiche Breite, ebenfalls `bg-muted` für durchgehende Spalte

### 2. `src/components/ui/calendar.tsx` — Default-Styles kompakter

Die überschriebenen classNames aus CalendarHeader greifen bereits, aber einige Defaults (day, day_button, weekday, week spacing) müssen für den kompakteren Look angepasst werden. Die CalendarHeader-classNames überschreiben diese per Spread, daher passe ich dort die relevanten Klassen an:

- `day` / `day_button`: `h-7 w-7` statt `h-9 w-9`
- `weekday`: `w-7` statt `w-9`
- `week`: `mt-0` statt `mt-2` für engere Zeilen
- `month_grid`: `space-y-0` statt `space-y-1`
- Navigation-Buttons kleiner: `h-6 w-6`

Alle Änderungen nur über die classNames-Prop in CalendarHeader, nicht am globalen Calendar-Component (damit andere Nutzungen unberührt bleiben).

