## Ziel
L-Konnektor zwischen Parent- und Child-Aufgaben so verschieben, dass die vertikale Linie **erst unterhalb der Parent-Card** beginnt – nicht mehr in Höhe der Parent-Checkbox.

## Aktueller Zustand (`src/components/tasks/TaskCard.tsx`)
- Vertikale Linie startet bei `connectorParentLineStartTop = 16` (Mitte der Parent-Checkbox), läuft also durch den gesamten Body der Parent-Card.
- L-Linie zum Child startet bei `top: 0` der Child-Container und biegt bei `connectorChildTargetTop = 16` (Child-Checkbox-Mitte) horizontal ein.
- Parent-Linienhöhe wird via ResizeObserver aus `lastChild.top - container.top - lineStart` berechnet.

## Änderungen

### 1. Vertikale Linie unterhalb der Parent-Card starten
- Neue Ref `cardRef` auf das innere `div.border.rounded-lg.bg-card` (Parent-Card-Body).
- In `measure()` zusätzlich die Bottom-Y der Parent-Card relativ zum Container ermitteln (`cardRect.bottom - containerTop`) und einen kleinen Abstand addieren (z. B. +4 px Padding zwischen Card-Unterkante und Linienstart).
- Daraus dynamisch `lineStart` berechnen statt `connectorParentLineStartTop` zu nutzen. `parentLineHeight = lastChildRect.top - containerTop - lineStart`.
- Style des vertikalen Linien-Divs: `top: ${dynamicLineStart}px` statt `connectorParentLineStartTop`.
- Effekt-Dependencies: `cardRef.current` mit aufnehmen, ResizeObserver auch auf Parent-Card hängen, damit Höhenänderungen (Beschreibung, Edit-Modus) die Linie nachziehen.

### 2. Child-L-Stub beibehalten, aber sauber anschließen
- Der horizontale L-Bogen am Child bleibt bei `top: 0 … connectorChildTargetTop = 16`.
- Da die vertikale Parent-Linie jetzt erst nach der Card beginnt, schließt sie genau am ersten Child-Container an – die L-Kurve trifft passend.
- Falls nötig: `mt`-Abstand der Children-Liste leicht anpassen, damit zwischen Card-Unterkante und erstem Child genug Platz für die L-Kurve (~16 px) bleibt. Bestehender Abstand (`space-y-2 mt-2`) prüfen, bei Bedarf auf `mt-3` heben.

### 3. Props vereinfachen
- `connectorParentLineStartTop` wird nicht mehr für die Position genutzt → Prop kann auf interne Konstante reduziert oder als optionaler Override beibehalten werden. Bevorzugt: Prop entfernen aus `MyWorkTasksBoard.tsx` und Default streichen, `connectorChildTargetTop` bleibt.

## Edge-Cases
- Tief verschachtelte Childs (rekursiv): Logik gilt pro Ebene, jeder Parent misst seine eigene Card-Bottom – funktioniert ohne Sondercode.
- Sehr kurze Parent-Cards (nur Titel ohne Beschreibung): Linie startet trotzdem unter der Card, also weiter oben als bisher visuell „korrekt".
- Resize/Edit/Beschreibung aufklappen: ResizeObserver auf Card + Children sorgt für Neuberechnung.

## QA
Nach dem Edit `/meine-arbeit` Tab Aufgaben besuchen, Eltern mit 1, mehreren und verschachtelten Children prüfen; Title bearbeiten und Höhe ändern, Linie soll mitziehen.
