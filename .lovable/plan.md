
Zielbild: Links bleibt der Lexical-Editor (Eingabe), rechts wird rein aus HTML gerendert (kein Lexical), und der Text fließt zuverlässig auf Seite 2+ statt auf Seite 1 „hängen zu bleiben“.

## Was aktuell schief läuft (aus dem Code)
1. In `LetterEditorCanvas.tsx` wird die Seitenlogik über `splitHtmlIntoPages(...)` gebaut.
2. Diese Funktion splittet nur nach **Top-Level-DOM-Nodes**.
3. Wenn der Inhalt als ein großer `<p>...</p>` mit vielen `<br>` kommt (typisch aus Editor-HTML), ist das nur **ein Node**:
   - Der Node ist größer als Seite 1.
   - Wegen der aktuellen Bedingung (`sliceNodes.length > 0`) wird trotzdem keine neue Seite angelegt.
   - Ergebnis: `pages.length` bleibt oft 1.
4. Zusätzlich blockiert der Build aktuell bei:
   - `src/components/letters/LetterEditorCanvas.tsx(272,22): TS2554`
   - Ursache: `useRef<ReturnType<typeof setTimeout>>()` ohne Initialwert (React-19-Typing erwartet 1 Argument).

## Umsetzungsstrategie (robust und dauerhaft)
Statt fragiler Node-Splitting-Logik wird auf ein **Viewport/Offset-Pagination-Modell** umgestellt:

- Der komplette Brief-Flow (Inhalt + Grußformel + Signatur + Anlagen) wird als **ein durchgehender HTML-Stream** betrachtet.
- Jede Seite zeigt nur ein „Fenster“ auf diesen Stream:
  - Seite 1 zeigt Offset `0`
  - Seite 2 zeigt Offset `page1BodyMm`
  - Seite 3 zeigt Offset `page1BodyMm + pageNBodyMm`, usw.
- Rendering pro Seite:
  - Container hat feste Höhe des Body-Bereichs und `overflow: hidden`
  - Innerer Flow wird per `transform: translateY(-offsetMm)` verschoben
- Vorteil:
  - Funktioniert bei einem einzigen großen `<p>` genauso wie bei vielen Blöcken
  - Kein inhaltliches Zerlegen von HTML nötig
  - Rechts bleibt vollständig non-Lexical

## Konkrete Änderungen pro Datei

### 1) `src/components/letters/LetterEditorCanvas.tsx`
- Build-Fix:
  - `const splitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);`
- Pagination-Refactor:
  - `splitHtmlIntoPages`/`pages[]`-Erzeugung entfernen oder stilllegen.
  - Neue States/Refs:
    - `flowMeasureRef` für die Messung der echten Gesamthöhe des Flows
    - `flowHeightMm` (aus `ResizeObserver`)
  - `totalPages` neu berechnen:
    - wenn `flowHeightMm <= page1BodyMm` → 1
    - sonst `1 + Math.ceil((flowHeightMm - page1BodyMm) / pageNBodyMm)`
  - In `renderPage(pageIndex)`:
    - Body-Viewport bleibt `height = bodyHeightMm`, `overflow: hidden`
    - Inneren Flow mit `translateY` um den passenden Offset verschieben
    - So wird auf jeder Seite der richtige Abschnitt sichtbar
  - Closing/Anlagen in denselben Flow integrieren (nicht separat pro Seite duplizieren), damit sie automatisch am richtigen Seitenende landen.
- Optional/UX:
  - Klick-Overlay (`Brieftext bearbeiten`) nur über den sichtbaren Body-Bereich belassen.

### 2) `src/components/letters/DIN5008LetterLayout.tsx`
- Keine Lexical-Abhängigkeit einführen; rechts bleibt HTML-Preview.
- Falls weiterhin als „Page-Chrome“ genutzt:
  - `content=""` beibehalten (weil Content im Canvas-Flow gerendert wird)
  - `allowContentOverflow={false}` kann so bleiben, da die eigentliche Content-Paginierung im Canvas passiert.
- Nur falls nötig: kleine Stilangleichungen, damit Header/Footer auf Folgeseiten konsistent bleiben.

### 3) `src/components/LetterEditor.tsx`
- Split-Screen-Workflow bleibt:
  - links Editor, rechts gerenderte Seiten.
- Sichtbarkeit Speichern absichern:
  - vorhandenen Save-Button im linken Pane-Header beibehalten,
  - zusätzlich einen klaren Fallback (z. B. rechter Toolbar-Button) falls linkes Pane geschlossen ist, damit Speichern immer erreichbar bleibt.

## Reihenfolge der Implementierung
1. TS-Fehler in `LetterEditorCanvas` (useRef-Initialwert) beheben.
2. Alte `splitHtmlIntoPages`-Seitenbildung durch Viewport/Offset-Pagination ersetzen.
3. Höhenmessung (`ResizeObserver`) auf den gesamten Flow verdrahten.
4. `totalPages` aus gemessener Flow-Höhe berechnen.
5. Rendering jeder Seite auf „gefensterte Darstellung“ umstellen.
6. Save-Button-Fallback in `LetterEditor` ergänzen.
7. Manuelle Prüfung:
   - langer Fließtext ohne Absätze
   - viele `<br>`
   - Listen/Formatierungen
   - mit/ohne Grußformel + Signatur + Anlagen
   - Split-Editor zu/auf und Speichern erreichbar

## Risiken und Gegenmaßnahmen
- Risiko: leichte Abweichung zwischen gemessener Höhe und sichtbarer Höhe durch Fonts/Zoom.
  - Gegenmaßnahme: Messcontainer mit exakt gleicher Breite/Font/Line-Height wie Body-Flow; Zoom nie in die Messung einrechnen.
- Risiko: Performance bei sehr langem HTML.
  - Gegenmaßnahme: `ResizeObserver` + leichtes Debounce (100–150ms), keine teuren DOM-Neuberechnungen pro Keystroke.

## Erwartetes Ergebnis
- Rechts wird weiterhin ohne Lexical gerendert.
- Lange Inhalte erzeugen korrekt Seite 2, 3, …
- Kein Abschneiden nach Seite 1.
- Speichern bleibt im Split-Screen jederzeit auffindbar.
- Build-Fehler TS2554 ist beseitigt.
