
# Tageskontext-Flackern gezielt beheben

## Wahrscheinliche eigentliche Ursache

Das Problem sitzt sehr wahrscheinlich nicht primär im Hover selbst, sondern im Daten-/Render-Zyklus:

- In `useDecisionCardDerivedData.ts` wird `requestedStart` aktuell direkt mit `new Date(requestedStartIso)` erzeugt
- Dadurch entsteht bei jedem Render ein neues `Date`-Objekt
- `MyWorkDecisionCard.tsx` hat einen `useEffect` für den Tageskontext, der von `requestedStart` abhängt
- Ergebnis: Der Effect läuft unnötig oft neu, setzt `isTimelineLoading` immer wieder und lädt die Timeline erneut
- Während das Hover-Overlay offen ist, wechselt der Inhalt dadurch ständig zwischen Laden/Inhalt/leer und wirkt wie extremes Flackern

Zusätzlich wird bei Fehlern aktuell destruktiv auf `setDayTimelineItems([])` zurückgesetzt, was das instabile Verhalten weiter verstärken kann.

## Was ich ändern würde

### 1. `requestedStart` stabil machen
In `src/components/my-work/decisions/hooks/useDecisionCardDerivedData.ts`:
- `requestedStart` per `useMemo` aus `requestedStartIso` ableiten
- damit bleibt die Referenz stabil, solange sich der ISO-Wert nicht ändert

Beispielhaft logisch:
- `const requestedStart = useMemo(() => requestedStartIso ? new Date(requestedStartIso) : null, [requestedStartIso])`

### 2. Timeline-Load gegen unnötige Reloads absichern
In `src/components/my-work/decisions/MyWorkDecisionCard.tsx`:
- den Lade-Effect mit einem Request-Guard absichern
- nur das neueste Ergebnis übernehmen
- bei erneutem Render nicht jedes Mal wieder aggressiv `isTimelineLoading(true)` setzen, wenn dieselbe Anfrage schon geladen wurde
- optional einen Schlüssel wie `tenantId + requestedStartIso + requestedTitle + decision.id` merken und gleiche Requests überspringen

### 3. Vorhandene Daten nicht bei transienten Fehlern wegwerfen
Ebenfalls in `MyWorkDecisionCard.tsx`:
- im `catch` nicht mehr blind `setDayTimelineItems([])` ausführen
- bestehende Timeline-Daten stehen lassen, wenn ein Reload fehlschlägt
- das folgt auch dem vorhandenen Projektmuster zur Flicker-Vermeidung

### 4. HoverCard als UI behalten
Die Overlay-Idee ist grundsätzlich richtig:
- `HoverCard` kann bleiben
- das Problem ist sehr wahrscheinlich der instabile Inhalt, nicht die Komponente selbst
- nur falls danach noch leichtes Zucken bleibt, würde ich als Feinschliff `sideOffset`, Breite oder Trigger-Button minimal anpassen

## Betroffene Dateien

- `src/components/my-work/decisions/hooks/useDecisionCardDerivedData.ts`
- `src/components/my-work/decisions/MyWorkDecisionCard.tsx`

## Erwartetes Ergebnis

Danach sollte der Tageskontext:
- nur beim Hover erscheinen
- offen stabil bleiben
- nicht ständig neu laden
- nicht mehr zwischen Ladezustand und Inhalt flackern
- auch bei kurzzeitigen Query-Problemen ruhig bleiben
