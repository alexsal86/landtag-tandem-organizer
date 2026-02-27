
# Plan: Build-Fix, Footer-Verbesserungen, Canvas-Korrekturen und diverse Fixes

## Uebersicht

Sechs Aenderungen plus ein kritischer Build-Fix:

0. Build-Error in `FooterBlockLineEditor.tsx` beheben
1. Footer-Standard-Template basierend auf dem Bild + Fett/Farbe-Support
2. Footer-Vorschau im Tab Footer verbessern
3. Footer im Canvas korrekt anzeigen
4. "DIN 5008 zuruecksetzen" nur Positionen zuruecksetzen, Inhalte beibehalten
5. Inhaltsbereich auf 98.64mm aendern + Text-Styling-Fixes im Canvas
6. Betreff als Text anzeigen statt Variable, Standard-Betreff definieren

---

## 0. Build-Error beheben

**Problem:** `resolveBlockWidthMm` erwartet 3 Argumente `(widthUnit, widthValue, availableWidthMm)`, wird aber in `FooterBlockLineEditor.tsx` mit 2 Argumenten aufgerufen `(block, availableWidthMm)`.

**Loesung:** Die Aufrufe in Zeile 27 und 91 aendern zu `resolveBlockWidthMm(block.widthUnit, block.widthValue, availableWidthMm)`.

**Datei:** `src/components/letters/FooterBlockLineEditor.tsx` (Zeile 27, 91)

---

## 1. Footer-Standard-Template und Fett/Farbe-Support

**Problem:** Zu viele leere Bloecke als Standard. Das Bild des Nutzers zeigt 4 Bloecke:
- Block 1: "Alexander Salomon MdL" (fett, gruen), "Fraktion GRUENE im Landtag von Baden-Wuerttemberg"
- Block 2: "Fuer Sie im Landtag" (fett), Adresse, Telefon
- Block 3: "Fuer Sie in Karlsruhe" (fett), Adresse, Telefon
- Block 4: "Politik direkt" (fett), Webseite, E-Mail

**Loesung:**
- `BlockLine` Interface erweitern um `color?: string` (Textfarbe)
- `BlockLineEditor` anpassen: Fett-Toggle und Farb-Picker pro Zeile hinzufuegen
- Standard-Footer-Template als DIN5008-Vorlage im Footer-Editor definieren
- `DIN5008LetterLayout.tsx`: `color` und `fontWeight`/`bold` beim Rendern der Footer-Zeilen beruecksichtigen

**Dateien:**
- `src/components/letters/BlockLineEditor.tsx` - `color` zu BlockLine, Fett-Toggle + Farb-Input in der UI
- `src/components/letters/DIN5008LetterLayout.tsx` - `color` und `labelBold`/`valueBold` beim Footer-Rendering beachten

---

## 2. Footer-Vorschau im Tab verbessern

**Problem:** Die Vorschau im Footer-Tab zeigt die Bloecke nicht wie im fertigen Brief (nebeneinander als Spalten).

**Loesung:** Die Vorschau im `BlockLineEditor` fuer `blockType="footer"` als horizontale Spalten-Darstellung rendern. Die Block-Start/Block-Ende-Zeilen werden als visuelle Spalten-Container dargestellt, wobei jeder Block seine konfigurierte Breite bekommt.

**Datei:** `src/components/letters/BlockLineEditor.tsx` - Preview-Bereich fuer Footer anpassen

---

## 3. Footer im Canvas korrekt anzeigen

**Problem:** Im Canvas-Tab wird der Footer-Block nicht mit den konfigurierten Spalten angezeigt.

**Loesung:** Im `LetterLayoutCanvasDesigner.tsx` beim Rendering des Footer-Blocks die `blockContent.footer`-Daten lesen und die Bloecke als Spalten nebeneinander anzeigen (aehnlich wie in `DIN5008LetterLayout.tsx`). Die Bloecke werden aus den Block-Start/Block-Ende-Markierungen in den Zeilen extrahiert.

**Datei:** `src/components/letters/LetterLayoutCanvasDesigner.tsx` - Footer-Block Rendering

---

## 4. "DIN 5008 zuruecksetzen" nur Positionen

**Problem:** Der Reset-Button (Zeile 474-484) setzt `cloneLayout(DEFAULT_DIN5008_LAYOUT)` als neuen Zustand, was auch `blockContent`, `closing`, `salutation` etc. ueberschreibt.

**Loesung:** Beim Reset nur die Positionsfelder aus `DEFAULT_DIN5008_LAYOUT` uebernehmen (`margins`, `header`, `addressField`, `infoBlock`, `subject.top`/`marginBottom`, `content.top`/`maxHeight`, `footer.top`/`height`, `attachments.top`, `pagination.top`), aber `blockContent`, `closing`, `salutation`, `subject.prefixShape`, `subject.fontSize`, `disabledBlocks`, `lockedBlocks` etc. aus dem aktuellen Layout beibehalten.

**Datei:** `src/components/letters/LetterLayoutCanvasDesigner.tsx` (Zeile 474-484)

---

## 5. Inhaltsbereich auf 98.64mm + Text-Styling-Fixes

**Problem:**
- Der Inhaltsbereich beginnt bei 101.46mm statt 98.64mm
- Betreff-Text im Canvas ist grau (`text-gray-700`) statt schwarz
- Anrede und Abschlussformel sind kursiv (`italic`) und grau statt normal und schwarz

**Loesung:**
- `DEFAULT_DIN5008_LAYOUT` aendern: `subject.top` von 101.46 auf 98.64, `content.top` von 109.46 auf 106.64
- Canvas-Designer: `text-gray-700` entfernen beim Betreff, `text-gray-500 italic` entfernen bei Anrede und Abschlussformel, stattdessen `text-black` verwenden
- `DIN5008LetterLayout.tsx`: Hartcodierte 101.46mm-Fallbacks ebenfalls auf 98.64mm aendern

**Dateien:**
- `src/types/letterLayout.ts` (DEFAULT_DIN5008_LAYOUT)
- `src/components/letters/LetterLayoutCanvasDesigner.tsx` (CSS-Klassen)
- `src/components/letters/DIN5008LetterLayout.tsx` (Fallback-Werte)

---

## 6. Betreff als Text statt Variable + Standard-Betreff

**Problem:** Im Canvas-Designer wird der Betreff als `{{betreff}}` angezeigt wenn kein `subjectLine` konfiguriert ist. Es sollte ein Standard-Betreff-Text angezeigt werden.

**Loesung:**
- Im `DEFAULT_DIN5008_LAYOUT` einen Standard-subjectLine definieren mit dem Text "Betreff" als Platzhalter
- Im Canvas-Designer den Fallback von `'{{betreff}}'` auf den konfigurierten Betreff-Text aendern
- Sicherstellen, dass der Betreff als resolverter Text dargestellt wird, nicht als Variable

**Dateien:**
- `src/components/letters/LetterLayoutCanvasDesigner.tsx` (Fallback-Text)

---

## Reihenfolge der Implementierung

1. Build-Fix in `FooterBlockLineEditor.tsx`
2. `BlockLine` um `color` erweitern + UI in `BlockLineEditor.tsx`
3. `letterLayout.ts` - Default-Werte anpassen (98.64mm)
4. `LetterLayoutCanvasDesigner.tsx` - Reset-Logik, Footer-Rendering, Text-Styling, Betreff-Fallback
5. `DIN5008LetterLayout.tsx` - Footer-Farbe/Fett, Fallback-Werte
