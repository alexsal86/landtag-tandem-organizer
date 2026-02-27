

# PageLayout-System integrieren

## Uebersicht

Integration des vom Nutzer bereitgestellten PageLayout-Systems in den bestehenden Brief-Editor. Das System simuliert Seitenumbrueche im Lexical-Editor mittels ResizeObserver und DecoratorNodes.

## Neue Dateien erstellen

### 1. `src/components/nodes/PageBreakNode.ts`
- Uebernahme der hochgeladenen Datei
- DecoratorNode mit visueller gestrichelter Linie und "Seite X"-Label
- Nicht editierbar, nicht selektierbar

### 2. `src/components/plugins/PageLayoutPlugin.tsx`
- Uebernahme der hochgeladenen Datei
- Kleine Korrektur: `afterKey`-Logik anpassen, sodass der Break VOR dem Node eingefuegt wird, der die Grenze ueberschreitet (nicht danach), damit der Node auf die naechste Seite rutscht
- Guard gegen Endlosschleifen verstaerken: im UpdateListener pruefen ob nur PageBreakNode-Aenderungen vorliegen und dann skippen

## Bestehende Dateien aendern

### 3. `src/components/EnhancedLexicalEditor.tsx`
- `PageBreakNode` importieren und in `nodes[]` registrieren
- Neue Props: `enablePagination`, `onPageCountChange`, `pageContentHeightMm`
- `PageLayoutPlugin` als Plugin einbinden (nach TrackChangesPlugin)

### 4. `src/components/letters/LetterEditorCanvas.tsx`
- `computeContentAreaHeightMm()` Hilfsfunktion hinzufuegen (berechnet nutzbaren Bereich aus Layout-Settings und editorTopMm)
- `enablePagination={true}` und `pageContentHeightMm={contentAreaHeightMm}` an EnhancedLexicalEditor uebergeben
- Bestehende hardcoded Seitenlinien (`[1,2,3].map(...)`) entfernen (werden jetzt vom Plugin gerendert)
- CSS erweitern: `overflow: visible` fuer editor-input, PageBreak-Bleeding-Styles
- Optional: `onPageCountChange` Callback nutzen um Seitenzahl im UI anzuzeigen

## Reihenfolge

1. PageBreakNode erstellen
2. PageLayoutPlugin erstellen (mit afterKey-Fix)
3. EnhancedLexicalEditor erweitern (Node + Plugin + Props)
4. LetterEditorCanvas anpassen (Props durchreichen, CSS, alte Seitenlinien entfernen)

## Technische Hinweise

- Der PageBreakNode wird beim Speichern im JSON mitgespeichert, aber beim Laden sofort vom Plugin neu berechnet -- das ist korrekt
- Seite 1 und Seite 2+ haben unterschiedlich viel Platz; aktuell wird pragmatisch der gleiche Wert verwendet
- Bilder/Tabellen auf Seitengrenzen werden nicht gesplittet (ganzes Element rutscht auf die naechste Seite) -- akzeptabel fuer Briefverkehr

