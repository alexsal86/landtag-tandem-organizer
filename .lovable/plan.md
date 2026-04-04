
# Tageskontext wieder hover-basiert und stabil machen

## Ursache
Das Flackern kommt sehr wahrscheinlich daher, dass der Tageskontext aktuell **inline im Karten-Layout** gerendert wird (`MyWorkDecisionCard.tsx`, um Zeile 273 ff.). Sobald er sichtbar wird, wechselt die Beschreibung in ein `lg:grid-cols-2`-Layout. Dadurch verändert sich die Fläche unter dem Mauszeiger, das Hover geht verloren, der Kontext verschwindet wieder, und der Zyklus beginnt erneut.

Zusätzlich ist der frühere Hover-State derzeit faktisch deaktiviert:
- `openScheduleHover` / `closeScheduleHover` sind leer
- `isSchedulePinnedOpen` existiert, wird aber fürs Anzeigen nicht verwendet
- `shouldShowTimeline` ist dauerhaft aktiv statt hover-gesteuert

## Ziel
Der Tageskontext soll:
- **nur beim Hover über das Info-Icon** erscheinen
- **stabil geöffnet bleiben**, solange Maus über Icon oder Kontext ist
- **das Kartenlayout nicht verschieben**

## Umsetzung

### 1. Hover-State sauber zurückbringen
In `src/components/my-work/decisions/MyWorkDecisionCard.tsx`:
- neuen echten Hover-State ergänzen, z. B. `isScheduleHoverOpen`
- `openScheduleHover` / `closeScheduleHover` wieder mit kurzer Verzögerung per `useRef`-Timeout implementieren
- `isSchedulePinnedOpen` optional weiter für Klick-Pinning nutzen oder entfernen, falls nicht gewünscht

Anzeige-Logik dann:
- `shouldRenderTimeline = isAppointmentRequest && isRequestedStartValid && (isScheduleHoverOpen || isSchedulePinnedOpen)`

### 2. Tageskontext aus dem Inline-Flow nehmen
Statt den Tageskontext innerhalb des Beschreibungslayouts als zweite Grid-Spalte zu rendern:
- den Inhalt in eine `HoverCard` oder absolut positionierte Floating-Card auslagern
- Trigger ist das bestehende `Info`-Icon
- Inhalt wird als Overlay/Popover angezeigt, nicht als Teil des normalen Text-Layouts

Damit bleibt die Karte geometrisch stabil und Hover bricht nicht mehr weg.

### 3. Bestehende HoverCard-Komponente nutzen
Projektweit gibt es bereits `src/components/ui/hover-card.tsx`.
Diese eignet sich gut für genau diesen Fall:
- `HoverCard`
- `HoverCardTrigger asChild` um das Info-Icon
- `HoverCardContent align="end"` oder `side="left"/"bottom"` je nach Platz

Der Tageskontext wird in diese Content-Fläche verschoben.

### 4. Datenladen vom Sichtbarkeitsstatus entkoppelt lassen
Das ist wichtig und passt zur vorhandenen Architektur-Memory:
- Timeline-Daten weiter **vorab laden**, sobald der Termin relevant ist
- den geladenen State **nicht leeren**, nur weil der Hover schließt
- bei Fehlern möglichst nicht aggressiv auf leere Liste zurücksetzen, falls schon Daten da sind

So bleibt der Hover schnell und ohne erneutes Nachladen.

### 5. Kleine Performance-Glättung
Falls im Tageskontext irgendwo `backdrop-blur` genutzt wird, entfernen und durch normales `bg-background` plus ggf. `shadow` oder `text-shadow` ersetzen. In der gezeigten Karte sehe ich aktuell vor allem `bg-background/95`, das ist unkritisch. Hauptproblem ist hier eher das Layout-Umschalten, nicht Blur.

## Betroffene Datei
- `src/components/my-work/decisions/MyWorkDecisionCard.tsx`

## Kurzfolge der Änderungen
1. echten Hover-State wieder einbauen  
2. Tageskontext nicht mehr inline als `lg:grid-cols-2`, sondern als Hover-Overlay rendern  
3. Datenladung beibehalten, aber Anzeige nur an Hover/Pin koppeln  
4. optional Klick-Pinning erhalten oder vereinfachen

## Ergebnis
Danach öffnet sich der Tageskontext wieder nur beim Hover über das Icon, bleibt stabil offen, solange man sich im Overlay bewegt, und verursacht kein Flackern mehr, weil das Kartenlayout nicht mehr springt.
