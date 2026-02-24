

# Fix: Header-Tab Zoom an Canvas-Tab angleichen

## Problem

Der Header-Tab hat drei Zoom-Probleme gegenueber dem Canvas-Tab:

1. **Strg+Mausrad funktioniert nicht**: Der Header nutzt Reacts `onWheel` (passiver Event-Listener), der `preventDefault()` nicht ausfuehren kann. Der Canvas-Tab nutzt stattdessen `addEventListener('wheel', handler, { passive: false })` -- das ist der einzig funktionierende Ansatz.

2. **Zoom-Verhalten unterschiedlich**: Der Header nutzt `useCanvasViewport` mit kontinuierlichem Zoom (0.1er-Schritte) und Pan-Offset-Logik (`zoomAtPoint`). Der Canvas-Tab nutzt diskrete `ZOOM_STEPS` (50%, 75%, 100%, 125%, 150%, 200%) und laesst den Container wachsen -- Scrolling uebernimmt natuerlich das Panning.

3. **Canvas zu klein / Scrollbalken**: Bei 100% sollte der Header-Canvas die volle verfuegbare Hoehe nutzen ohne Scrollbalken. Die aktuelle `maxHeight: 600px`-Beschraenkung erzwingt unnoetige Scrollleisten.

## Loesung

Das Zoom-System des Canvas-Tabs 1:1 uebernehmen:

### Aenderung 1: ZOOM_STEPS und zoomIn/zoomOut statt useCanvasViewport

Den `useCanvasViewport`-Hook entfernen und durch lokale `zoomLevel`-State + `ZOOM_STEPS` ersetzen (wie im Canvas-Tab):

```text
const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const [zoomLevel, setZoomLevel] = useState(1);

const zoomIn = useCallback(() => {
  setZoomLevel((z) => {
    const idx = ZOOM_STEPS.indexOf(z);
    return idx < ZOOM_STEPS.length - 1 ? ZOOM_STEPS[idx + 1] : z;
  });
}, []);

const zoomOut = useCallback(() => {
  setZoomLevel((z) => {
    const idx = ZOOM_STEPS.indexOf(z);
    return idx > 0 ? ZOOM_STEPS[idx - 1] : z;
  });
}, []);
```

### Aenderung 2: Native Wheel-Event-Listener

Den React `onWheel={onPreviewWheel}` ersetzen durch einen nativen `addEventListener` mit `{ passive: false }` auf dem Canvas-Wrapper (wie im Canvas-Tab):

```text
useEffect(() => {
  const el = previewContainerRef.current;
  if (!el) return;
  const handler = (e: WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      if (e.deltaY < 0) zoomIn();
      else zoomOut();
    }
  };
  el.addEventListener('wheel', handler, { passive: false });
  return () => el.removeEventListener('wheel', handler);
}, [zoomIn, zoomOut]);
```

### Aenderung 3: Skalierung vereinfachen

Alle Referenzen auf `zoom` durch `zoomLevel` ersetzen. Die `effectiveScaleX/Y`-Berechnung bleibt gleich, nutzt aber `zoomLevel`:

```text
const effectiveScaleX = previewScaleX * zoomLevel;
const effectiveScaleY = previewScaleY * zoomLevel;
const canvasPixelWidth = previewWidth * zoomLevel;
const canvasPixelHeight = previewHeight * zoomLevel;
```

### Aenderung 4: maxHeight entfernen, Canvas-Container anpassen

Die `maxHeight: 600px`-Beschraenkung vom aeusseren Container entfernen. Der Container bekommt `overflow-auto` nur fuer den Fall, dass bei hohen Zoom-Stufen gescrollt werden muss, aber bei 100% soll kein Scrollbalken sichtbar sein.

### Aenderung 5: Zoom-Buttons anpassen

Die Zoom-Buttons auf diskrete Schritte umstellen (wie im Canvas-Tab):

```text
<Button onClick={zoomOut} disabled={zoomLevel <= ZOOM_STEPS[0]}>-</Button>
<span>{Math.round(zoomLevel * 100)}%</span>
<Button onClick={zoomIn} disabled={zoomLevel >= ZOOM_STEPS[ZOOM_STEPS.length - 1]}>+</Button>
```

Klick auf die Prozentanzeige setzt auf 100% zurueck.

### Aenderung 6: Pan-Logik entfernen

Da der Canvas-Tab kein manuelles Panning nutzt (er nutzt natuerliches Scrolling ueber `overflow-auto`), wird die `pan`/`setPan`/`getCanvasPoint`/`zoomAtPoint`-Logik aus `useCanvasViewport` nicht mehr benoetigt. Alle Referenzen auf `pan` werden entfernt. Die Maus-Koordinaten-Umrechnung erfolgt direkt ueber `getBoundingClientRect()`.

## Zusammenfassung

| Datei | Aenderung |
|---|---|
| `StructuredHeaderEditor.tsx` | useCanvasViewport durch lokalen zoomLevel-State ersetzen, nativer Wheel-Listener, ZOOM_STEPS, maxHeight entfernen, Pan-Logik entfernen |

Keine neuen Dateien noetig. Das Ergebnis ist identisches Zoom-Verhalten wie im Canvas-Tab.

