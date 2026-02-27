
# Mehrseitige Brief-Darstellung mit echtem Seitenumbruch

## Problem

Der Lexical-Editor waechst unbegrenzt nach unten und ueberlaeuft den Footer, die Paginierung und den Seitenrand. Es fehlt eine echte seitenbasierte Darstellung wie in Word.

## Loesung

Den Canvas von einem einzigen wachsenden DIV in eine **mehrseitige Darstellung** umbauen, bei der jede Seite ein eigenes A4-Blatt ist. Der Lexical-Editor bleibt ein einzelner Editor, aber sein Inhalt wird per **CSS-Clipping** auf die einzelnen Seiten verteilt.

### Kernprinzip

1. Ein `ResizeObserver` misst die tatsaechliche Hoehe des Editor-Inhalts
2. Daraus wird berechnet, wie viele Seiten benoetigt werden
3. Fuer jede Seite wird ein eigenes A4-Blatt gerendert
4. Der Editor-Inhalt wird per `clip-path` und negativem `top`-Offset so verschoben, dass auf jeder Seite nur der passende Ausschnitt sichtbar ist
5. Seite 1 hat Header, Adressfeld, Info-Block, Betreff, Anrede + Inhalt bis zum Seitenende
6. Folgeseiten haben nur Seitenraender + fortlaufenden Inhalt
7. Der Closing-Block (Grussformel/Unterschrift) wird auf der letzten Seite nach dem Inhalt angezeigt
8. Footer und Seitenzahlen erscheinen auf jeder Seite

### Seitenlayout (in mm)

```text
Seite 1:
  - Verfuegbare Inhaltshoehe: footerTop (272mm) - editorTopMm (~106mm) = ~166mm
  - Inhalt wird bei 272mm abgeschnitten

Seite 2+:
  - Inhalt beginnt bei top-Margin (25mm)
  - Verfuegbare Inhaltshoehe: 272mm - 25mm = 247mm
  - Gleicher Footer/Paginierung wie Seite 1
```

## Technische Umsetzung

### Datei: `src/components/letters/LetterEditorCanvas.tsx`

**Aenderungen:**

1. **State hinzufuegen**: `editorContentHeight` (number) und `editorRef` (RefObject)
2. **ResizeObserver**: Beobachtet die tatsaechliche Hoehe des `.editor-input` Elements
3. **Seitenberechnung**:
   - `page1ContentHeight = footerTopMm - editorTopMm` (verfuegbarer Platz auf Seite 1)
   - `followupPageHeight = footerTopMm - 25` (verfuegbarer Platz auf Folgeseiten)
   - `totalPages = 1 + ceil((editorContentHeight - page1ContentHeight) / followupPageHeight)` (wenn > 1 Seite noetig)
4. **Rendering-Struktur umbauen**:
   - Statt einem einzelnen 210x297mm-DIV werden `totalPages` A4-Blaetter gerendert
   - Seite 1: Enthaelt `DIN5008LetterLayout` (Header, Adressfeld, etc.) + Editor-Inhalt (geclippt auf page1ContentHeight)
   - Seite 2+: Enthaelt nur Editor-Inhalt (geclippt auf den jeweiligen Seitenausschnitt) + Footer
   - Der Editor wird nur einmal auf Seite 1 gerendert, mit `overflow: hidden` und `maxHeight: page1ContentHeight`
   - Fuer Folgeseiten: Ein readonly-Klon (oder CSS `clip-path` Technik) zeigt den uebergelaufenen Inhalt
5. **Closing-Block**: Wird auf der letzten Seite nach dem letzten Inhalts-Ausschnitt positioniert
6. **Editable Overlays**: Bleiben nur auf Seite 1

**Praktischer Ansatz (einfacher als CSS-Clipping):**

Da CSS-Clipping mit einem interaktiven Editor komplex ist, wird stattdessen ein einfacherer Ansatz verwendet:
- Der Editor bleibt ein einzelnes, frei wachsendes Element auf Seite 1
- Wenn der Inhalt die Seite 1 ueberlaeuft, wird die Canvas-Hoehe auf `totalPages * 297mm` erweitert
- Zwischen den Seiten werden visuelle Seitentrenner (weisser Balken + Schatten) eingefuegt, die den Eindruck separater Blaetter erzeugen
- Footer und Seitenzahl werden auf jeder "Seite" wiederholt (absolute Positionierung bei `pageIndex * 297 + 272mm`)
- Der Closing-Block folgt dynamisch dem Editor-Inhalt (per ResizeObserver gemessene Hoehe)

### Konkrete Schritte

1. `useRef` und `ResizeObserver` fuer den Editor-Container hinzufuegen
2. `editorContentHeight` State tracken
3. `totalPages` berechnen basierend auf Inhaltshoehe vs. verfuegbarem Platz
4. Canvas-Container auf `totalPages * 297mm` Hoehe setzen
5. Fuer jede Seite > 1: Seitentrenner-Element rendern (horizontaler weisser Balken mit Schatten, der den Eindruck eines neuen Blattes erzeugt)
6. Footer + Seitenzahl auf jeder Seite wiederholen
7. Closing-Block-Position per `editorTopMm + gemesseneHoehe + 9mm` berechnen statt hardcoded `+60mm`
8. Sicherstellen, dass der Closing-Block nicht in den Footer-Bereich ragt (ggf. auf naechste Seite verschieben)

### Datei: `src/components/letters/DIN5008LetterLayout.tsx`

Keine grossen Aenderungen noetig - die Komponente rendert bereits nur Seite-1-Elemente.

## Reihenfolge

1. ResizeObserver + editorContentHeight State hinzufuegen
2. Closing-Block dynamisch positionieren (statt hardcoded +60mm)
3. Seitenberechnung implementieren
4. Canvas-Hoehe dynamisch setzen
5. Seitentrenner und wiederholte Footer/Seitenzahlen rendern
