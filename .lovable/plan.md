

# Fix: Header-Editor Text-Anzeige, Zoom-Verhalten, Layout und Text-Breite

## Uebersicht

Vier Probleme im Brief-Template-Editor, die Header- und Canvas-Tabs betreffen.

---

## 1. Text auf dem Canvas-Tab nicht sichtbar

**Problem:** Im `LetterLayoutCanvasDesigner` (Canvas-Tab) werden Header-Elemente mit der CSS-Klasse `text-foreground/80` gerendert (Zeile 410). Im Dark-Mode ist `text-foreground` weiss/hell -- auf dem weissen Canvas-Hintergrund ergibt das weissen Text auf weissem Grund = unsichtbar. Formen (Layout-Bloecke) sind sichtbar, weil sie eigene Farbklassen (`block.color`) haben.

**Loesung:** Die Header-Element-Vorschau im Canvas-Tab muss eine feste dunkle Textfarbe verwenden, da der Canvas immer weiss ist:

### Aenderung in `LetterLayoutCanvasDesigner.tsx`

Zeile 410 aendern:
```text
// Vorher:
className="absolute text-[10px] text-foreground/80 pointer-events-none"

// Nachher:
className="absolute text-[10px] text-gray-700 pointer-events-none"
```

Zusaetzlich: Fuer Text-Elemente die tatsaechliche `color`-Eigenschaft verwenden, falls vorhanden:
```text
style={{
  ...existingStyles,
  color: element.type === 'text' && element.color ? element.color : undefined,
}}
```

---

## 2. Zoom folgt dem Mauszeiger (wie canva.com)

**Problem:** Beim Zoomen mit Strg+Mausrad wird immer gleichmaessig gezoomt. Der Zoom sollte auf die Position des Mauszeigers zentriert sein -- wo der Cursor steht, bleibt fixiert, und der Rest skaliert darum herum.

**Loesung:** Beim Wheel-Event die Mausposition relativ zum Scroll-Container merken und nach dem Zoom den Scroll-Offset so anpassen, dass der Punkt unter dem Cursor an derselben Stelle bleibt.

### Aenderung in `StructuredHeaderEditor.tsx`

Den nativen Wheel-Handler erweitern:
```text
const handler = (e: WheelEvent) => {
  if (!e.ctrlKey && !e.metaKey) return;
  e.preventDefault();

  const container = previewContainerRef.current;
  if (!container) return;

  // Cursor-Position relativ zum Scroll-Container
  const rect = container.getBoundingClientRect();
  const cursorX = e.clientX - rect.left + container.scrollLeft;
  const cursorY = e.clientY - rect.top + container.scrollTop;

  // Position in mm-Koordinaten (unabhaengig vom Zoom)
  const currentScale = previewScaleXRef.current * zoomLevelRef.current;
  const mmX = (cursorX - RULER_SIZE) / currentScale;
  const mmY = (cursorY - RULER_SIZE) / currentScale;

  // Zoom aendern
  const nextZoom = e.deltaY < 0 ? zoomInStep(zoomLevelRef.current) : zoomOutStep(zoomLevelRef.current);
  setZoomLevel(nextZoom);

  // Nach dem Zoom: Scroll so anpassen, dass mmX/mmY wieder unter dem Cursor liegt
  requestAnimationFrame(() => {
    const newScale = previewScaleXRef.current * nextZoom;
    const newCursorX = mmX * newScale + RULER_SIZE;
    const newCursorY = mmY * newScale + RULER_SIZE;
    container.scrollLeft = newCursorX - (e.clientX - rect.left);
    container.scrollTop = newCursorY - (e.clientY - rect.top);
  });
};
```

Da `zoomLevel` ein State ist und im Closure nicht aktuell waere, wird ein `useRef` als Mirror benoetigt:
```text
const zoomLevelRef = useRef(zoomLevel);
useEffect(() => { zoomLevelRef.current = zoomLevel; }, [zoomLevel]);
const previewScaleXRef = useRef(previewScaleX);
useEffect(() => { previewScaleXRef.current = previewScaleX; }, [previewScaleX]);
```

Gleiches Prinzip auch fuer den Canvas-Tab (`LetterLayoutCanvasDesigner.tsx`) implementieren, damit beide Tabs identisches Zoom-Verhalten haben.

---

## 3. Canvas im Header-Tab mittig ausrichten, Scrollleiste entfernen

**Problem:** Der Canvas ist links ausgerichtet und hat eine vertikale Scrollleiste auch bei 100% Zoom. Der Canvas-Tab verwendet `mx-auto` (Zeile 398) fuer zentrierte Darstellung.

**Loesung:**

### Aenderung in `StructuredHeaderEditor.tsx`

**a) Canvas zentrieren:** Dem inneren Container `mx-auto` hinzufuegen (wie im Canvas-Tab):

```text
// Vorher (Zeile 1526):
<div className="relative inline-block" style={{ ... }}>

// Nachher:
<div className="relative mx-auto" style={{ ... }}>
```

**b) Scrollleiste nur bei Bedarf:** Den aeusseren Container von `overflow-auto` auf `overflow-auto` belassen, aber sicherstellen, dass bei 100% Zoom die Canvas-Hoehe in den Container passt. Die feste Hoehe des Canvas (`canvasPixelHeight`) bei 100% Zoom muss kleiner sein als der verfuegbare Platz.

Voraussetzung: `previewWidth` wird korrekt berechnet, sodass bei 100% die Proportionen stimmen. Da der Header nur 45mm hoch ist (vs 210mm breit), ist das Seitenverhaeltnis sehr flach -- bei 100% Zoom passt das normalerweise ohne vertikalen Scroll.

**c) Container-Overflow anpassen:**
```text
// aeusserer Wrapper
<div ref={previewContainerRef} className="w-full overflow-auto">
```
Kein `maxHeight` setzen -- der natuerliche Platz der Card reicht. Bei hohen Zoom-Stufen entsteht Scrollbedarf automatisch.

---

## 4. Text-DIV passt sich dem Textinhalt an, ist aber manuell vergroesser-/verkleinerbar

**Problem:** Aktuell hat jedes Text-Element eine feste Breite (Default 70mm) und Hoehe (Default 8mm), mit `overflow: hidden`. Der Text wird abgeschnitten. Der Benutzer wuenscht:
- Ohne manuelle Aenderung: DIV ist so breit wie der Text (auto-fit)
- Mit manueller Aenderung: Breite ueber Resize-Handles anpassbar
- Hoehe passt sich dem Inhalt an

**Loesung:**

### Aenderung in `canvasElements.tsx` (TextCanvasElement)

Die `width` und `height` im Style nur setzen, wenn der Benutzer sie explizit geaendert hat. Dafuer ein Flag oder die Dimension `undefined` pruefen:

```text
// Wenn width explizit gesetzt: feste Breite + overflow hidden
// Wenn width nicht gesetzt: auto-fit (whiteSpace: nowrap, width: auto)
const hasExplicitWidth = element.width !== undefined && element.width !== null;
const hasExplicitHeight = element.height !== undefined && element.height !== null;

style={{
  left: ...,
  top: ...,
  width: hasExplicitWidth ? `${element.width * scaleX}px` : 'auto',
  height: hasExplicitHeight ? `${element.height * scaleY}px` : 'auto',
  whiteSpace: hasExplicitWidth ? 'normal' : 'nowrap',
  overflow: hasExplicitWidth ? 'hidden' : 'visible',
  ...fontStyles
}}
```

Die fontSize muss mit dem Scale-Faktor skaliert werden, damit sie im Canvas proportional korrekt ist:
```text
// Vorher:
fontSize: `${(element.fontSize || 12) * (96 / 72)}px`

// Nachher -- pt zu mm, dann mm zu px via scale:
fontSize: `${(element.fontSize || 12) * (25.4 / 72) * scaleY}px`
```

### Aenderung in `StructuredHeaderEditor.tsx`

**a) Neues Text-Element ohne explizite Breite erstellen:**
```text
// addTextElement (Zeile 438):
const el = { ..., width: undefined, height: undefined };
```

**b) Resize-Handles fuer Text-Elemente aktivieren:** Derzeit haben nur Image-Elemente `renderResizeHandles`. Text-Elemente brauchen zumindest horizontale Resize-Handles (e, w), damit der Benutzer die Breite manuell setzen kann.

Im TextCanvasElement eine optionale `renderResizeHandles`-Prop hinzufuegen und im Container rendern.

**c) Sidebar: Breite/Hoehe-Felder fuer Text:** Im Element-Properties-Panel (Zeile 1431-1458) Felder fuer Breite und Hoehe hinzufuegen, damit der Benutzer die Dimension auch numerisch eingeben kann. Ein "Auto"-Button setzt width/height zurueck auf `undefined`.

---

## Zusammenfassung der betroffenen Dateien

| Datei | Aenderung |
|---|---|
| `LetterLayoutCanvasDesigner.tsx` | Text-Farbe auf dunkle Farbe aendern, Cursor-Zoom |
| `StructuredHeaderEditor.tsx` | Cursor-Zoom, Canvas zentrieren, Scrollleiste, Text-Element ohne feste Breite, Resize-Handles fuer Text, fontSize-Skalierung |
| `canvasElements.tsx` | Auto-Width fuer Text, fontSize mit Scale skalieren, optionale Resize-Handles |

