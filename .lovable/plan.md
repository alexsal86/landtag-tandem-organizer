

# Fix: Canvas-Formen, Block-Dimensionen, Variablen-System, Header-Text

## Uebersicht

Vier Probleme im Brief-Template-Editor muessen behoben werden.

---

## 1. Loewe und Sonnenblume werden im Canvas-Tab als Emoji statt SVG dargestellt

**Problem:** In `LetterLayoutCanvasDesigner.tsx` (Zeilen 115-134) werden Sonnenblume und Loewe als Unicode-Emoji (🌻 und 🦁) gerendert, waehrend der Header-Tab die korrekten SVG-Komponenten (`SunflowerSVG`, `LionSVG`) verwendet.

**Loesung:** Die SVG-Komponenten aus `StructuredHeaderEditor.tsx` in eigene Dateien extrahieren (oder inline in `LetterLayoutCanvasDesigner.tsx` importieren) und die Emoji-Darstellung durch die echten SVGs ersetzen.

Konkret:
- Neue Datei `src/components/letters/elements/shapeSVGs.tsx` mit den Komponenten `SunflowerSVG`, `LionSVG`, `WappenSVG` erstellen
- In `LetterLayoutCanvasDesigner.tsx` importieren und in `renderCanvasElementPreview` verwenden
- In `StructuredHeaderEditor.tsx` die lokalen Kopien durch Imports aus der neuen Datei ersetzen

---

## 2. Block-Canvas-Dimensionen und Lineal sind fehlerhaft

**Problem:** Der `StructuredHeaderEditor` hat das vertikale Lineal auf 45mm fest verdrahtet (Zeile 287: `i <= 45`, Zeile 1594: `Array.from({ length: 5 })`). Wenn der Editor fuer andere Bloecke (Adressfeld=40mm, Betreff=12mm, Footer=25mm, Anlagen=20mm) wiederverwendet wird, stimmen Lineal und Tick-Labels nicht mit der tatsaechlichen Canvas-Hoehe ueberein.

**Loesung:** Das Lineal dynamisch an `canvasMaxHeight` anpassen:
- Vertikale Ruler-Ticks: `for (let i = 0; i <= canvasMaxHeight; i += 1)` mit `y = (i * canvasPixelHeight) / canvasMaxHeight`
- Vertikale Labels: Anzahl dynamisch berechnen basierend auf `canvasMaxHeight`, z.B. `Math.ceil(canvasMaxHeight / 10) + 1` Labels
- Horizontale Labels: Analog fuer `canvasMaxWidth` (aktuell auf 210mm/21 Labels hardcoded, was fuer nicht-volle-Seitenbreite-Bloecke falsch ist)

---

## 3. Variablen-System fuer Adressfeld, Ruecksende, Info-Block, Betreff und Anlagen

**Problem:** Es gibt kein Variablen-System. Der Benutzer kann im Template-Editor nicht definieren, wo dynamische Inhalte (z.B. Empfaengeradresse, Betreff-Text) eingefuegt werden sollen. Bei der spaeteren Brieferstellung muessen diese Platzhalter durch reale Daten ersetzt werden.

**Loesung:** Ein Drag-and-Drop-Variablen-System implementieren:

### a) Variablen-Definitionen

Eine vordefinierte Liste von Platzhalter-Variablen pro Block-Typ:

```text
Adressfeld:     {{empfaenger_name}}, {{empfaenger_strasse}}, {{empfaenger_plz}}, {{empfaenger_ort}}, {{empfaenger_land}}
Ruecksende:     {{absender_name}}, {{absender_organisation}}, {{absender_strasse}}, {{absender_plz_ort}}
Info-Block:     {{datum}}, {{aktenzeichen}}, {{bearbeiter}}, {{telefon}}, {{email}}, {{unser_zeichen}}
Betreff:        {{betreff}}
Anlagen:        {{anlagen_liste}}
Header:         {{absender_name}}, {{absender_organisation}}
```

### b) UI: Variablen-Panel in der Sidebar

Im `StructuredHeaderEditor` ein neues Card-Panel "Variablen" unterhalb der Tools einfuegen. Die Variablen werden als ziehbare Elemente (draggable) dargestellt, die auf den Canvas gezogen werden koennen.

### c) Variablen als Text-Elemente mit `isVariable`-Flag

Die `TextElement`-Type um `isVariable?: boolean` erweitern. Wenn ein Variablen-Platzhalter auf den Canvas gezogen wird, entsteht ein Text-Element mit:
- `content: '{{empfaenger_name}}'`
- `isVariable: true`
- Visuelles Styling: orangefarbener/Amber-Hintergrund mit Blitz-Icon

### d) Drop-Handler erweitern

Den `onPreviewDrop`-Handler in `StructuredHeaderEditor.tsx` erweitern, um Variablen-Drops zu erkennen (Format `application/x-variable` oder Text mit `{{...}}`-Muster).

### e) Rendering auf Canvas

Variable Text-Elemente bekommen ein spezielles Styling (Amber-Hintergrund, abgerundete Ecken, Blitz-Icon) sowohl im Header-Tab als auch im Canvas-Tab.

### f) Variablen-Set pro Block-Tab

In `LetterTemplateManager.tsx` wird `renderSharedElementsEditor` so erweitert, dass der jeweilige Block-Key an den `StructuredHeaderEditor` uebergeben wird. Dieser bestimmt dann, welche Variablen in der Sidebar angeboten werden.

---

## 4. "Alexander Salomon MdL" Text im Header

**Problem:** Der Text "Alexander Salomon MdL" ist ein tatsaechliches Text-Element, das in den `header_text_elements` des Templates "Abgeordnetenbrief" in der Datenbank gespeichert ist (zusammen mit dem Wappen). Es handelt sich nicht um einen Bug, sondern um vom Benutzer erstellten Inhalt.

**Erlaeuterung:** Das Element wird korrekt im Header-Tab und als Vorschau im Canvas-Tab (als Teil der Header-Block-Vorschau) angezeigt. Falls der Benutzer diesen Text nicht moechte, kann er ihn im Header-Tab auswaehlen und loeschen. -- Es ist kein Code-Fix noetig, nur eine Erklaerung.

---

## Zusammenfassung der betroffenen Dateien

| Datei | Aenderung |
|---|---|
| `src/components/letters/elements/shapeSVGs.tsx` | Neu: Shared SVG-Komponenten (Sunflower, Lion, Wappen) |
| `src/components/canvas-engine/types.ts` | `isVariable?: boolean` zu `TextElement` hinzufuegen |
| `src/components/letters/LetterLayoutCanvasDesigner.tsx` | SVG-Import statt Emoji fuer Loewe/Sonnenblume; Variablen-Rendering |
| `src/components/letters/StructuredHeaderEditor.tsx` | Dynamisches Lineal; Variablen-Panel und Drop-Handler; SVG-Import |
| `src/components/letters/elements/canvasElements.tsx` | Variablen-Styling (Amber-Hintergrund) |
| `src/components/LetterTemplateManager.tsx` | Block-Key an StructuredHeaderEditor uebergeben fuer Variablen-Auswahl |

---

## Technische Reihenfolge

1. SVG-Komponenten extrahieren (shapeSVGs.tsx) -- keine Abhaengigkeiten
2. Lineal dynamisch machen -- unabhaengig
3. Types erweitern (isVariable) -- Grundlage fuer Variablen
4. Variablen-Panel und Drop-Handler implementieren
5. Variablen-Rendering auf Canvas
6. Block-Key-Weiterleitung in LetterTemplateManager

