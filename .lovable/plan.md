

# Fix: Header-Canvas Zoom und Groesse an Canvas-Tab angleichen

## Problem

Im Canvas-Tab skaliert der Zoom den gesamten Canvas (Hintergrund, Lineal, Elemente) -- der Container waechst und man kann scrollen. Im Header-Tab bleibt der Canvas bei fester Groesse (`previewWidth x previewHeight`), nur die Elemente werden mit `zoom` multipliziert. Dadurch laufen Elemente ueber den Canvas hinaus, aber der weisse Hintergrund bleibt gleich gross.

Zusaetzlich ist der Canvas bei 100% zu klein -- er nutzt den verfuegbaren Platz nicht optimal.

## Referenz: So funktioniert es im Canvas-Tab

```text
SCALE = BASE_SCALE * zoomLevel;          // z.B. 3.2 * 1.5 = 4.8
pagePx = { w: pageWidth * SCALE, h: pageHeight * SCALE };
Container: width = pagePx.w + RULER_SIZE, height = pagePx.h + RULER_SIZE
```

Der aeussere Wrapper hat `overflow-auto`, sodass bei Zoom > 100% Scrollbars erscheinen. Lineale werden ebenfalls mit SCALE berechnet. Alles skaliert einheitlich.

## Loesung fuer den Header-Tab

Gleichen Ansatz uebernehmen: Der Zoom veraendert die Canvas-Container-Groesse, nicht nur die Element-Positionen.

### Aenderung 1: Zoom in die Canvas-Groesse integrieren

Statt den Zoom nur bei Element-Positionen zu multiplizieren, wird er in die Basis-Skalierung eingerechnet:

```text
// Vorher:
const previewScaleX = previewWidth / headerMaxWidth;
// Element-Positionen: element.x * previewScaleX * zoom

// Nachher:
const baseScaleX = previewWidth / headerMaxWidth;  // Basis-Skalierung bei 100%
const effectiveScaleX = baseScaleX * zoom;
const effectiveScaleY = baseScaleY * zoom;
const canvasPixelWidth = headerMaxWidth * effectiveScaleX;  // waechst mit Zoom
const canvasPixelHeight = headerMaxHeight * effectiveScaleY;
```

### Aenderung 2: Canvas-Container skaliert mit Zoom

Der aeussere Container (`overflow-auto`) bekommt feste Hoehe/Max-Breite. Der innere Canvas-Container (weisser Hintergrund) waechst mit dem Zoom:

```text
// Aeusserer Wrapper: feste Groesse, overflow-auto
<div style={{ maxHeight: '600px' }} className="overflow-auto">
  // Innerer Canvas + Lineale
  <div style={{ 
    width: canvasPixelWidth + RULER_SIZE, 
    height: canvasPixelHeight + RULER_SIZE 
  }}>
    // Lineale mit effectiveScale
    // Canvas mit canvasPixelWidth x canvasPixelHeight
  </div>
</div>
```

### Aenderung 3: Lineale mitskalieren

Die Lineal-Tics und -Labels werden mit `effectiveScaleX/Y` statt `previewScaleX/Y` berechnet, damit sie synchron zum Canvas wachsen:

```text
// Horizontal-Lineal Ticks:
const x = (i * canvasPixelWidth) / 210;

// Vertikal-Lineal Ticks:
const y = (i * canvasPixelHeight) / 45;
```

Die Canvas-Elemente (`horizontalRulerRef`, `verticalRulerRef`) bekommen die gezoomte Groesse als `width`/`height`.

### Aenderung 4: Element-Positionen vereinfachen

Da `effectiveScaleX/Y` bereits den Zoom enthaelt, entfaellt die separate `* zoom`-Multiplikation:

```text
// Vorher:
const scaleX = previewScaleX * zoom;

// Nachher:
const scaleX = effectiveScaleX;  // enthaelt bereits zoom
const scaleY = effectiveScaleY;
```

Ebenso fuer Snap-Lines, Smart-Guides, Dot-Grid und alle anderen visuellen Elemente.

### Aenderung 5: Canvas standardmaessig groesser

Die `previewWidth`-Berechnung entfernt die `-28` fuer den Ruler-Offset (der Platz wird ja bereits permanent reserviert) und erhoet ggf. das Maximum:

```text
// Vorher:
const nextWidth = Math.min(780, Math.max(360, Math.floor(clientWidth - 16 - 28)));

// Nachher:  
const nextWidth = Math.min(960, Math.max(360, Math.floor(clientWidth - 16 - 28)));
```

### Aenderung 6: Dot-Grid mit Zoom skalieren

Das Background-Pattern des Canvas waechst ebenfalls:

```text
backgroundSize: `${10 * effectiveScaleX}px ${10 * effectiveScaleY}px`
```

### Aenderung 7: useCanvasViewport Pan-Logik vereinfachen

Da der Zoom jetzt ueber Container-Groesse + Scrolling funktioniert (wie im Canvas-Tab), kann die Pan-Logik aus `useCanvasViewport` vereinfacht oder der manuelle Pan durch nativen Scroll ersetzt werden.

## Zusammenfassung der Aenderungen

| Datei | Aenderung |
|---|---|
| `StructuredHeaderEditor.tsx` | Canvas-Groesse mit Zoom skalieren, Lineale mitskalieren, previewWidth-Limit erhoehen, Element-Skalierung vereinfachen, Dot-Grid anpassen |

Keine neuen Dateien noetig. Das Verhalten wird 1:1 an den Canvas-Tab angeglichen.

