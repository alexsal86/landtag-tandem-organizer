
# Fix: Textüberlauf in der Briefvorschau (Split-Screen)

## Problem
Im Split-Screen-Modus wird der Brieftext in einem Overlay-Element ohne Höhenbegrenzung gerendert. Der Text laeuft über den Footer und die Seitengrenzen hinaus, statt auf Seite 2 umzubrechen.

**Ursache**: Wenn `enableInlineContentEditing=false` ist (Preview-Modus), wird leerer Content an die `DIN5008LetterLayout`-Komponente übergeben, und der eigentliche Text wird in einem `<button>`-Overlay ohne `maxHeight` oder `overflow: hidden` dargestellt.

## Lösung

### 1. Content direkt an DIN5008LetterLayout übergeben

In `LetterEditorCanvas.tsx` (Zeile 327):
- Statt `content={enableInlineContentEditing ? previewContentHtml : ''}` wird der Content **immer** übergeben: `content={previewContentHtml}`
- Die `DIN5008LetterLayout`-Komponente hat bereits eingebaute Höhenbegrenzung (`maxHeight` + `overflow: hidden`)

### 2. Overlay-Button vereinfachen

Das Overlay (Zeilen 571-601) wird zu einem reinen Klick-Target ohne eigene Content-Darstellung:
- `dangerouslySetInnerHTML` und die Content-Vorschau im Overlay entfernen
- Button bleibt als transparente, klickbare Fläche über dem Inhaltsbereich
- Der Text wird stattdessen von `DIN5008LetterLayout` korrekt gerendert (mit Clipping)

### 3. Mehrseitige Darstellung

Für Content der über eine Seite hinausgeht:
- Die `canvasHeightMm`-Berechnung (Zeile 225-226) basiert bereits auf `totalPages` und `estimatedContentBottomMm`
- Die Seitenumbruch-Indikatoren (Zeilen 663-690) und Footer-Clips (Zeilen 647-661) existieren bereits
- Die `DIN5008LetterLayout`-Komponente muss den Content über mehrere "virtuelle Seiten" verteilen, statt ihn mit `overflow: hidden` abzuschneiden

Konkret wird in `DIN5008LetterLayout.tsx`:
- Der Content-Container bekommt **kein** `overflow: hidden` mehr wenn `hideClosing=false` (Preview-Modus)
- Stattdessen wird ein CSS-basiertes Paginierungssystem eingeführt: Der Content fließt frei, und die Footer/Header-Overlays in `LetterEditorCanvas` verdecken die Übergangsbereiche zwischen den Seiten korrekt
- Alternativ (einfacher): Der Content wird in `LetterEditorCanvas` gemessen und bei Überlauf werden separate Seiten-Container mit CSS-Clipping gerendert

### 4. Messung und Seitenberechnung verbessern

In `LetterEditorCanvas.tsx`:
- Die bestehende `measuredEditorHeightMm`-Logik (ResizeObserver) wird für den Preview-Content-Bereich genutzt
- `totalPages` wird korrekt aus der gemessenen Content-Höhe berechnet
- Jede Seite > 1 bekommt einen reduzierten Header und die Content-Fortsetzung wird mit CSS `clip-path` / `overflow` korrekt positioniert

## Betroffene Dateien
- `src/components/letters/LetterEditorCanvas.tsx` - Content-Weitergabe und Overlay-Vereinfachung
- `src/components/letters/DIN5008LetterLayout.tsx` - Overflow-Verhalten anpassen

## Technische Details

```text
Vorher (Split-Screen Preview):
+--DIN5008LetterLayout-----------+
|  Header, Adresse, Info         |
|  Subject, Salutation           |
|  content="" (leer!)            |
+--------------------------------+
+--Overlay-Button (z-index:10)---+
|  previewContentHtml            |
|  (KEIN maxHeight!)             |  <-- Text laeuft über!
|  ...überlappt Footer...        |
+--------------------------------+

Nachher:
+--DIN5008LetterLayout-----------+
|  Header, Adresse, Info         |
|  Subject, Salutation           |
|  content=previewContentHtml    |  <-- DIN5008 rendert mit Clipping
|  maxHeight + overflow:hidden   |
+--------------------------------+
+--Overlay-Button (transparent)--+
|  (nur Klick-Target, kein Text) |
+--------------------------------+
Bei Überlauf: Seite 2+ mit reduziertem Header
```
