

## Problem

Aus den Screenshots sind zwei Probleme sichtbar:

1. **Keine Farben / winzige Events**: Die meisten Termine in der Monatsansicht erscheinen als winzige, kaum erkennbare Elemente ohne sichtbare Hintergrundfarbe oder lesbaren Text. Nur vereinzelte Events (z.B. Geburtstage, Ganztags-Termine) sind farbig sichtbar.

2. **Letzte Zeile abgeschnitten**: Die unterste Wochenreihe der Monatsansicht wird am unteren Rand abgeschnitten.

### Ursache

- Die CSS-Klassen `.rbc-event.event-*` (Zeilen 39-47) setzen `background` per CSS-Shorthand. Da CSS `background` eine Shorthand-Property ist, die auch `background-color` zurücksetzt, kann es zu Konflikten mit dem inline `backgroundColor` aus `eventPropGetter` kommen — je nach Browser-Rendering-Reihenfolge und Spezifität.
- Die Monats-Events haben `font-size: 0.7rem` und minimale Padding-Werte, was sie auf kleinen Bildschirmen nahezu unsichtbar macht.
- Der Kalender-Container hat `min-height: calc(100vh - 260px)`, was bei einem Viewport von 592px nur ~332px ergibt — zu wenig für 5-6 Monatsreihen à 120px.

## Lösung

### 1. CSS: Event-Farben reparieren (`src/styles/react-big-calendar.css`)

- Die `.rbc-event.event-*` Klassen (Zeilen 39-47) entfernen oder auf `background-color` statt `background` ändern, damit die inline-Styles aus `eventPropGetter` nicht überschrieben werden.
- Monats-Events größer/sichtbarer machen: `min-height: 18px`, `font-size: 0.75rem`, Padding erhöhen.

### 2. CSS: Letzte Zeile sichtbar (`src/styles/react-big-calendar.css`)

- `.rbc-month-view` mit `overflow: visible` und ausreichend Höhe versehen.
- Dem Kalender-Container `min-height` auf einen höheren Wert setzen oder `overflow-y: auto` hinzufügen, damit alle Reihen scrollbar sind.

### 3. Inline-Styles absichern (`src/components/calendar/ProperReactBigCalendar.tsx`)

- Im `eventPropGetter` auch `background` (nicht nur `backgroundColor`) setzen und `!important`-Werte vermeiden, stattdessen die CSS-Klassen-Konflikte durch Entfernen der kollidierenden CSS-Regeln lösen.

## Dateien

1. `src/styles/react-big-calendar.css` — Event-Typ-Farbklassen entfernen/korrigieren, Monats-Event-Größe erhöhen, Monatsansicht-Höhe fixieren
2. `src/components/calendar/ProperReactBigCalendar.tsx` — `eventPropGetter` absichern (style.background statt nur backgroundColor)

