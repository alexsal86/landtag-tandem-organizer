
# Fix: Header-Editor -- Snapping, Zoom, Lineal und Galerie

## Uebersicht

Vier separate Probleme im Header-Tab des StructuredHeaderEditors werden behoben.

---

## 1. Text-Zentrierung / Snapping falsch

**Problem:** Das TextCanvasElement rendert ohne explizite Breite/Hoehe -- es wird allein durch den Textinhalt dimensioniert. Aber das Snapping rechnet mit den in `getElementDimensions` definierten Dimensionen (70x8mm). Dadurch stimmt die visuelle Mitte nicht mit der berechneten Mitte ueberein.

**Loesung:** Dem TextCanvasElement eine explizite `width` und `height` geben (aus dem Element-Datenmodell), damit die visuelle Darstellung deckungsgleich mit der Snapping-Berechnung ist.

### Aenderung in `src/components/letters/elements/canvasElements.tsx`

Den aeusseren `<div>` des TextCanvasElement um `width` und `height` im Style erweitern:

```text
style={{
  left: `${element.x * scaleX}px`,
  top: `${element.y * scaleY}px`,
  width: `${(element.width || 70) * scaleX}px`,    // NEU
  height: `${(element.height || 8) * scaleY}px`,   // NEU
  fontSize: ...
}}
```

Und die `<textarea>` ebenfalls an die Hoehe anpassen (`h-full` statt keine Angabe), sowie `overflow: hidden` auf den Container setzen, damit der Textbereich innerhalb der definierten Dimensionen bleibt.

---

## 2. Zoom skaliert nur Elemente, nicht den Canvas

**Problem:** Der Zoom wird ueber `transform: scale(zoom)` auf einen inneren Container angewandt (Zeile 1556). Die aeussere Canvas-Grenze bleibt aber unveraendert bei `previewWidth x previewHeight`, sodass hineingezoomte Elemente abgeschnitten werden.

**Loesung:** Statt den inneren Container zu transformieren, die Canvas-Groesse selbst mit dem Zoom-Faktor skalieren -- aehnlich wie im LetterLayoutCanvasDesigner (`SCALE = BASE_SCALE * zoomLevel`).

### Aenderungen in `StructuredHeaderEditor.tsx`

- `previewScaleX` und `previewScaleY` mit `zoom` multiplizieren
- Den aeusseren Canvas-Container (`overflow-auto`) auf die gezoomte Groesse setzen
- Den inneren Transform-Container entfernen -- Elemente werden direkt mit den skalierten Werten positioniert
- Die Pan-Logik bleibt als Scroll-Offset erhalten oder wird vereinfacht

**Konkret:** Die Berechnung aendern von:
```text
const previewScaleX = previewWidth / headerMaxWidth;
```
zu:
```text
const effectiveScaleX = (previewWidth / headerMaxWidth) * zoom;
const effectiveScaleY = (previewHeight / headerMaxHeight) * zoom;
```

Der Canvas-Container bekommt dann `width: headerMaxWidth * effectiveScaleX` und `height: headerMaxHeight * effectiveScaleY`. Der innere `transform: scale(zoom)` Wrapper entfaellt -- alle Elemente nutzen direkt `effectiveScaleX/Y`.

---

## 3. Lineal-Toggle verschiebt den Canvas

**Problem:** Beim Einblenden des Lineals wird `previewWidth` um den `rulerOffset` (28px) verkleinert (Zeile 199), was den Canvas umrechnet und verschiebt.

**Loesung:** Den Platz fuer das Lineal immer reservieren (wie der LetterLayoutCanvasDesigner es macht mit `invisible`-Klasse statt Entfernen). Die `previewWidth`-Berechnung wird unabhaengig vom Lineal-Status.

### Aenderungen in `StructuredHeaderEditor.tsx`

- Zeile 198-199: `rulerOffset` nicht mehr von `clientWidth` abziehen:
  ```text
  const nextWidth = Math.min(780, Math.max(360, Math.floor(previewContainerRef.current.clientWidth - 16)));
  ```
- `showRuler` aus der Dependency-Liste des useEffect entfernen
- Im JSX das `paddingLeft/paddingTop` immer setzen (nicht abhaengig von `showRuler`)
- Die Lineal-Elemente mit `invisible`-Klasse statt `{showRuler && ...}` steuern:
  ```text
  <div className={`absolute top-0 ... ${showRuler ? '' : 'invisible'}`}>
  ```

---

## 4. Bilder-Galerie mit Vorschau und "In Canvas einfuegen"

**Problem:** Die Galerie zeigt Bilder nur als kleine Thumbnails ohne Auswahlzustand. Es fehlt die Canvas-Vorschau und der "In Canvas einfuegen"-Button (wie in den anderen Tabs).

**Loesung:** Das Galerie-Pattern aus `LetterTemplateManager.tsx` (Zeilen 520-572) uebernehmen:

### Aenderungen in `StructuredHeaderEditor.tsx`

**a) Neuer State:**
```text
const [selectedGalleryImage, setSelectedGalleryImage] = useState<GalleryImage | null>(null);
```

**b) Galerie-UI ueberarbeiten:** Bild-Thumbnails aufteilen in:
- Upload-Button (volle Breite)
- Thumbnail-Grid mit Auswahlrahmen (`ring-2 ring-primary` bei Selektion)
- Canvas-Vorschau-Box mit dem ausgewaehlten Bild (groessere Vorschau, Dateiname, gestrichelte Rahmenlinie)
- "In Canvas einfuegen"-Button (wie `<ImageIcon /> In Canvas einfuegen`)

**c) Klick auf Thumbnail** setzt `selectedGalleryImage` statt sofort einzufuegen. Drag-and-Drop bleibt unveraendert.

**d) "In Canvas einfuegen"-Button** ruft die bestehende `addImageFromGallery` auf.

---

## Zusammenfassung der betroffenen Dateien

| Datei | Aenderung |
|---|---|
| `canvasElements.tsx` | Explizite Breite/Hoehe fuer TextCanvasElement |
| `StructuredHeaderEditor.tsx` | Zoom-Logik, Lineal-Layout, Galerie-UI, State |

