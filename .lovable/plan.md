
# Brief-Editor mit integrierter Briefansicht

## Konzept

Statt zwischen einem einfachen Texteditor und einer separaten DIN-5008-Vorschau umzuschalten, wird der Hauptbereich des Brief-Editors so umgestaltet, dass der Benutzer **direkt in einem Brief schreibt** -- visuell wie ein echtes DIN-5008-Blatt mit Header, Adressfeld, Info-Block, Betreff, Anrede und Footer sichtbar im Hintergrund.

## Layout-Ansatz

```text
+----------------------------------------------------------+
| Toolbar: Speichern | Korrekturlesen | Zoom | ...         |
+-------------+--------------------------------------------+
|             |                                            |
| Sidebar     |   +----------------------------------+    |
| (Briefde-   |   |  [Header / Logo]                 |    |
|  tails,     |   |                                   |    |
|  Adressat,  |   |  Rücksendeadresse                 |    |
|  Basis-     |   |  Empfängeradresse      Info-Block |    |
|  infos,     |   |                                   |    |
|  Absender,  |   |  Betreff (fett)                   |    |
|  Anlagen)   |   |                                   |    |
|             |   |  Anrede                            |    |
|             |   |  +------------------------------+  |    |
|             |   |  | Lexical-Editor (editierbar)  |  |    |
|             |   |  | direkt im Briefkörper        |  |    |
|             |   |  +------------------------------+  |    |
|             |   |                                   |    |
|             |   |  Grussformel + Unterschrift       |    |
|             |   |  Anlagen                          |    |
|             |   |  [Footer]                         |    |
|             |   +----------------------------------+    |
|             |                                            |
+-------------+--------------------------------------------+
```

## Funktionsweise

1. **Immer Brief-Ansicht**: Der bisherige "Vorschau Brief"-Toggle entfaellt. Der Hauptbereich zeigt **immer** ein A4-Blatt (zentriert, mit Schatten), basierend auf der DIN5008LetterLayout-Komponente.

2. **Editierbarer Inhaltsbereich**: Innerhalb des Briefblatts wird der Textbereich durch den bestehenden EnhancedLexicalEditor ersetzt. Er wird direkt an der Position des Inhaltsbereichs platziert (nach Betreff + Anrede, vor Grussformel).

3. **Zoom-Steuerung**: Zoom-Controls bleiben in der Toolbar erhalten, damit der Benutzer das Blatt vergroessern/verkleinern kann.

4. **Sidebar bleibt**: Die bestehende einklappbare Sidebar mit Briefdetails, Adressat, Absender etc. bleibt unveraendert.

## Technische Umsetzung

### Neue Komponente: `LetterEditorCanvas`

Eine neue Wrapper-Komponente, die das A4-Blatt rendert und den Lexical-Editor an der richtigen Stelle einbettet:

- Nutzt die Layout-Settings aus dem Template (`layoutSettings`) fuer alle Positionen
- Rendert Header, Adressfeld, Info-Block, Betreff und Anrede als **read-only** (aus Template/Sidebar-Daten)
- Platziert den `EnhancedLexicalEditor` im Inhaltsbereich
- Rendert Grussformel, Unterschrift, Anlagen und Footer als read-only darunter

### Aenderungen in `LetterEditor.tsx`

- Entfernung des `showDINPreview`-Toggles und der Umschaltlogik
- Der bisherige "Regular Editor"-Bereich (Input + Lexical) wird durch `LetterEditorCanvas` ersetzt
- Zoom-Controls wandern in die Haupttoolbar
- Der "Vorschau Brief"-Button wird zu einem "Druckvorschau"-Button, der die reine DIN5008LetterLayout-Komponente in einem Modal oeffnet (fuer die exakte Druckansicht ohne Editor-UI)

### Dateien

| Datei | Aenderung |
|---|---|
| `src/components/letters/LetterEditorCanvas.tsx` | **Neu** -- A4-Canvas mit eingebettetem Lexical-Editor |
| `src/components/LetterEditor.tsx` | Hauptbereich umstellen auf LetterEditorCanvas, Toggle-Logik vereinfachen |

### Styling

- A4-Blatt: weisser Hintergrund, leichter Schatten, zentriert im scrollbaren Container mit grauem Hintergrund (wie der Canvas-Designer)
- Skalierung ueber `transform: scale(zoom)` mit `transformOrigin: top center`
- Der Lexical-Editor bekommt transparenten Hintergrund und keinen sichtbaren Rahmen, damit er nahtlos im Brief sitzt
- Beim Hover/Fokus des Editors: dezenter blauer Rand, damit der editierbare Bereich erkennbar ist
