

# Fix: Seitenumbruch mit Spacer-Injection

## Problem

Der Editor ist ein einziges, durchgehendes Lexical-Element. Die Seitentrenner sind nur visuelle Overlays (z-index 25), aber der Text (z-index 10) fließt ununterbrochen darunter hindurch. Es fehlt ein Mechanismus, der den Text an Seitenumbruch-Stellen ueber die "tote Zone" (Footer + Seitenrand der Folgeseite) hinweg schiebt.

## Loesung: PageBreak-Spacer im Editor

Anstatt den Text per CSS-Clipping auf mehrere Viewports zu verteilen (was mit einem interaktiven Editor extrem komplex ist), wird ein **Spacer-basierter Ansatz** verwendet:

1. Ein neues **Lexical DecoratorNode** (`PageBreakSpacerNode`) wird erstellt, das als unsichtbarer Platzhalter mit exakter Hoehe gerendert wird
2. Ein neues **Lexical Plugin** (`PageBreakPlugin`) misst laufend die Positionen der Editor-Inhalte und fuegt Spacer-Nodes an den richtigen Stellen ein
3. Die Spacer-Hoehe entspricht genau der "toten Zone": `(PAGE_HEIGHT - footerTop) + FOLLOWUP_TOP_MARGIN = (297 - 272) + 25 = 50mm`
4. Dadurch wird nachfolgender Text automatisch auf die naechste Seite geschoben

### Wie es funktioniert

```text
Ohne Spacer:                    Mit Spacer:
┌─────────────┐                 ┌─────────────┐
│ Seite 1     │                 │ Seite 1     │
│ Text...     │                 │ Text...     │
│ Text...     │                 │ Text...     │
│ Footer      │ <- Text laeuft  │ Footer      │ <- kein Text hier
├─────────────┤    drueber      ├─────────────┤
│ Seite 2     │                 │ [SPACER]    │ <- 50mm unsichtbar
│ Text...     │ <- versetzt     │ Seite 2     │
│             │                 │ Text...     │ <- korrekt positioniert
└─────────────┘                 └─────────────┘
```

## Technische Umsetzung

### 1. Neues DecoratorNode: `PageBreakSpacerNode`

**Datei:** `src/components/nodes/PageBreakSpacerNode.tsx`

- Erweitert `DecoratorNode` von Lexical
- Rendert ein leeres `div` mit dynamischer Hoehe (in mm)
- Ist nicht editierbar, nicht selektierbar (wird vom Benutzer nicht bemerkt)
- Serialisiert sich als `{ type: 'page-break-spacer', height: number }`
- Wird beim PDF-Export herausgefiltert (soll nicht im PDF erscheinen)

### 2. Neues Plugin: `PageBreakPlugin`

**Datei:** `src/components/plugins/PageBreakPlugin.tsx`

- Empfaengt Props: `editorTopMm`, `footerTopMm`, `pageHeightMm`, `followupTopMarginMm`
- Berechnet verfuegbaren Platz pro Seite:
  - Seite 1: `footerTopMm - editorTopMm` (ca. 166mm)
  - Seite 2+: `footerTopMm - followupTopMarginMm` (ca. 247mm)
- Berechnet "tote Zone" Hoehe: `(pageHeightMm - footerTopMm) + followupTopMarginMm` (ca. 50mm)
- Verwendet einen `MutationListener` auf dem Editor, um bei Aenderungen die Positionen der Absaetze zu pruefen
- Wenn ein Absatz die Seitengrenze ueberschreiten wuerde, wird **vor** diesem Absatz ein `PageBreakSpacerNode` eingefuegt
- Wenn sich der Inhalt verkuerzt und ein Spacer ueberfluessig wird, wird er wieder entfernt
- Debounced (200ms), um Performance zu schuetzen

**Algorithmus:**
1. Alle Top-Level-Nodes im Editor durchgehen
2. Ihre kumulierte Hoehe tracken (via `getBoundingClientRect` der DOM-Elemente)
3. Wenn die kumulierte Hoehe die Seitengrenze ueberschreitet, vor dem aktuellen Node einen Spacer einfuegen
4. Nach dem Spacer die kumulierte Hoehe auf den Beginn der naechsten Seite zuruecksetzen

### 3. Integration in EnhancedLexicalEditor

**Datei:** `src/components/EnhancedLexicalEditor.tsx`

- `PageBreakSpacerNode` zur Node-Liste hinzufuegen
- `PageBreakPlugin` als optionales Plugin einbinden
- Neue Props: `enablePageBreaks?: boolean`, `pageBreakConfig?: { editorTopMm, footerTopMm, pageHeightMm, followupTopMarginMm }`

### 4. Integration in LetterEditorCanvas

**Datei:** `src/components/letters/LetterEditorCanvas.tsx`

- Die berechneten Werte (`editorTopMm`, `footerTopMm`, `PAGE_HEIGHT_MM`, `FOLLOWUP_TOP_MARGIN_MM`) an den `EnhancedLexicalEditor` als `pageBreakConfig` weitergeben
- `enablePageBreaks={true}` setzen
- Die Seitentrenner-Overlays bleiben wie sie sind (sie markieren jetzt korrekt die Stellen, an denen die Spacer den Inhalt umbrechen)

### 5. PDF-Export-Anpassung

**Datei:** `src/utils/letterPDFGenerator.ts`

- Beim Generieren des PDFs muessen `PageBreakSpacerNode`-Elemente aus dem HTML gefiltert werden
- Stattdessen wird ein `doc.addPage()` an diesen Stellen ausgefuehrt

## Dateien-Uebersicht

| Datei | Aktion |
|---|---|
| `src/components/nodes/PageBreakSpacerNode.tsx` | Neu erstellen |
| `src/components/plugins/PageBreakPlugin.tsx` | Neu erstellen |
| `src/components/EnhancedLexicalEditor.tsx` | Erweitern (Node + Plugin + Props) |
| `src/components/letters/LetterEditorCanvas.tsx` | pageBreakConfig Props durchreichen |
| `src/utils/letterPDFGenerator.ts` | Spacer-Nodes beim Export filtern |

## Reihenfolge

1. `PageBreakSpacerNode` erstellen (DecoratorNode mit dynamischer Hoehe)
2. `PageBreakPlugin` erstellen (Mess-Logik + Spacer-Injection)
3. In `EnhancedLexicalEditor` integrieren (Node registrieren, Plugin einbinden)
4. In `LetterEditorCanvas` die Config-Werte uebergeben
5. PDF-Generator anpassen (Spacer filtern, Seitenumbruch einfuegen)
