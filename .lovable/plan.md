

## Fix: Abgeschnittene Zeilen an Seitengrenzen

### Problem
Die Viewport-Pagination nutzt `snapToLine` mit `Math.floor` für die Body-Höhe und den Offset. Wenn der Offset (`page1BodyMm + (pageIndex - 1) * pageNBodyMm`) berechnet wird, entstehen durch Rundungsfehler Situationen, in denen eine Textzeile teilweise sichtbar ist und dann durch `overflow: hidden` abgeschnitten wird.

### Ursache (Zeile 400-404)
```
rawOffset = page1BodyMm + (pageIndex - 1) * pageNBodyMm;
offsetMm = snapToLine(rawOffset);
```
`page1BodyMm` und `pageNBodyMm` sind bereits line-snapped, sodass `rawOffset` theoretisch exakt sein sollte. Aber durch Floating-Point-Ungenauigkeiten (z.B. `4.2336 * 37 = 156.6431999...` statt `156.6432`) kann `Math.floor(x / lineHeight) * lineHeight` eine Zeile zu wenig ergeben.

### Lösung
In `src/components/letters/LetterEditorCanvas.tsx`:

1. **`snapToLine` toleranter machen**: Statt `Math.floor` ein `Math.round` mit kleiner Epsilon-Toleranz verwenden, damit Floating-Point-Ungenauigkeiten keine Zeile verschlucken:
   ```typescript
   const snapToLine = (mm: number) => {
     if (lineHeightMm <= 0) return mm;
     const lines = mm / lineHeightMm;
     const rounded = Math.round(lines);
     // Use rounded if very close, otherwise floor
     const snapped = Math.abs(lines - rounded) < 0.01 ? rounded : Math.floor(lines);
     return snapped * lineHeightMm;
   };
   ```

2. **Offset direkt aus snapped Werten berechnen** (ohne erneutes Snapping), da `page1BodyMm` und `pageNBodyMm` bereits line-snapped sind:
   ```typescript
   const offsetMm = isFirst ? 0 : page1BodyMm + (pageIndex - 1) * pageNBodyMm;
   ```
   Das eliminiert die doppelte Snap-Rundung komplett.

### Dateien
- `src/components/letters/LetterEditorCanvas.tsx` — snapToLine-Funktion anpassen und Offset-Berechnung vereinfachen

