

## Problem

Bei mehrseitigen Briefen werden Textzeilen an Seitenumbrüchen abgeschnitten (halb sichtbar). Die aktuelle Logik berechnet die Zeilenhöhe rein theoretisch (`contentFontSizePt * 0.3528 * 1.2`), berücksichtigt aber nicht:
- Absatzabstände (`<p>` mit 4.5mm margin-bottom)
- Unterschiedliche Schriftgrößen innerhalb des Inhalts
- Closing-Blöcke, Anlagen-Listen mit abweichenden Abständen

Das `snapToLine`-Rounding passt daher nicht zum tatsächlich gerenderten Inhalt.

## Lösung: Measurement-basierte Seitenumbrüche

Statt einer berechneten `lineHeightMm` die tatsächliche Renderhöhe verwenden, um saubere Umbruchpunkte zu finden.

### Ansatz

1. **Hidden Measurement-Container erweitern**: Der bereits vorhandene `flowMeasureRef` wird genutzt, um nach dem Rendern die tatsächlichen Y-Positionen aller Block-Elemente (Absätze, Closing, Anlagen) auszulesen.

2. **`snapToLine` durch `snapToBlock` ersetzen**: Statt auf eine fixe Zeilenhöhe zu runden, wird die Body-Höhe auf die nächste Blockgrenze (Unterkante eines `<p>`, `<div>`, etc.) abgerundet, die noch vollständig hineinpasst.

3. **Offset-Berechnung pro Seite**: Jede Seite bekommt einen individuell berechneten Offset basierend auf den tatsächlichen Blockgrenzen, statt eines fixen `page1BodyMm + (pageIndex - 1) * pageNBodyMm`.

### Umsetzung in `LetterEditorCanvas.tsx`

- **Neuer State**: `blockBreaks: number[]` — Array der Y-Positionen (in mm) aller Blockunterkanten im Flow.
- **Messung im `useEffect`**: Nach dem Flow-Rendern alle Kind-Elemente von `flowMeasureRef` durchlaufen und deren `offsetTop + offsetHeight` in mm umrechnen.
- **Neue Funktion `computePageBreaks(blockBreaks, page1BodyMm, pageNBodyMm)`**: Iteriert über die Blockgrenzen und bestimmt für jede Seite, wie viel Inhalt passt (letzter Block, der noch vollständig in die verfügbare Höhe passt).
- **`totalPages` und `offsetMm` pro Seite** werden aus den berechneten Seitenumbrüchen abgeleitet statt aus der Snap-Formel.
- **Fallback**: Wenn keine Blockgrenzen gemessen werden können (z.B. leerer Inhalt), bleibt die bisherige Logik als Fallback aktiv.

### Dateien
- `src/components/letters/LetterEditorCanvas.tsx` — Hauptänderung: Messung + neue Pagination-Logik

