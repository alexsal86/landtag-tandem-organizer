

# Fix: Textuberlauf und fehlender Speichern-Button im Split-Screen

## Problem 1: Text lauft uber die Seite hinaus
Der Content-Container in `DIN5008LetterLayout.tsx` (Zeile 692-786) hat zwar `maxHeight` und `overflow: hidden`, aber die `contentMaxHeightMm` wird falsch berechnet -- sie berucksichtigt nur den Platz bis zur Paginierung auf Seite 1 (ca. 165mm). Content der langer ist, wird einfach abgeschnitten statt auf Seite 2 zu fliessen.

**Ursache**: `DIN5008LetterLayout` ist eine Single-Page-Komponente. Sie hat kein Multi-Page-Rendering. Im WYSIWYG-Modus (Lexical direkt auf Canvas) funktioniert Multi-Page, weil `LetterEditorCanvas` mehrere Seiten-Container und CSS-Clipping verwaltet. Im Split-Screen-Preview-Modus wird aber nur `DIN5008LetterLayout` verwendet, die den Content mit `overflow: hidden` abschneidet.

## Problem 2: Speichern-Button nicht sichtbar
Der "Speichern"-Button existiert (Zeile 1639-1646 in `LetterEditor.tsx`), ist aber im oberen Header-Bereich. Im Split-Screen-Modus mit der linken Editor-Pane und der rechten Canvas-Pane kann der Header je nach Layout uberscrollt oder verdeckt sein.

## Losung

### 1. Multi-Page Preview in LetterEditorCanvas (Hauptfix)
Statt `DIN5008LetterLayout` fur Multi-Page zu erweitern, wird die Logik in `LetterEditorCanvas.tsx` verbessert:

- Den Content-Container in `DIN5008LetterLayout` von `overflow: hidden` auf `overflow: visible` umstellen, wenn im Preview-Modus (`hideClosing=true` oder neues Prop `allowOverflow`)
- **Alternativ (einfacher und robuster)**: In `LetterEditorCanvas.tsx` den `previewContentRef` auf den Content innerhalb von `DIN5008LetterLayout` zeigen lassen, und die bestehende Seitenumbruch-Logik (Footer-Clips auf Zeile 634-648, Page-Break-Indikatoren auf Zeile 650-677) nutzen. Dafur muss:
  - `DIN5008LetterLayout` das `overflow: hidden` entfernen (Zeile 703), damit der Content frei uber die Seitengrenzen fliessen kann
  - Die Footer-Clip-Divs (weisse Overlays bei `footerTopMm` pro Seite) verdecken den Ubergangsbereich korrekt
  - Die `totalPages`-Berechnung und `canvasHeightMm` wachsen bereits dynamisch mit -- das funktioniert schon

Konkret in `DIN5008LetterLayout.tsx`:
- Zeile 703: `overflow: 'hidden'` entfernen, wenn ein neues Prop `allowContentOverflow={true}` gesetzt ist
- `LetterEditorCanvas` ubergibt dieses Prop, wenn `enableInlineContentEditing=false` (Preview-Modus)

Konkret in `LetterEditorCanvas.tsx`:
- Die `measuredEditorHeightMm`-Messung (Zeile 209-216) funktioniert bereits fur den Preview-Content, muss aber den richtigen DOM-Knoten messen. Da `previewContentRef` nicht mehr im Overlay ist, wird ein neuer Ref auf den Content-Bereich innerhalb von `DIN5008LetterLayout` benotigt. Dafur wird `DIN5008LetterLayout` einen `contentRef`-Callback-Prop erhalten.

### 2. Speichern-Button sichtbar machen
In `LetterEditor.tsx` einen zusatzlichen "Speichern"-Button in die Split-Editor-Pane einfugen (neben dem "X"-Schliessen-Button in der Kopfzeile des Editors, Zeile 1859-1867), damit der Nutzer direkt aus dem Split-Editor speichern kann.

## Betroffene Dateien
- `src/components/letters/DIN5008LetterLayout.tsx` -- `allowContentOverflow` Prop + `contentRef` Prop
- `src/components/letters/LetterEditorCanvas.tsx` -- Prop weiterreichen + Content-Messung anpassen
- `src/components/LetterEditor.tsx` -- Speichern-Button in Split-Editor-Pane

## Technische Details

```text
DIN5008LetterLayout (vorher):
+--Content-Container--+
| maxHeight: 165mm    |
| overflow: hidden    |  <-- Text wird abgeschnitten!
+---------------------+

DIN5008LetterLayout (nachher, mit allowContentOverflow=true):
+--Content-Container--+
| overflow: visible   |  <-- Text fliesst uber Seitenrand
| ...                 |
+---------------------+

LetterEditorCanvas verdeckt den Footer-Bereich pro Seite:
+--Seite 1 (297mm)----+
| Header, Adresse...  |
| Content (Teil 1)    |
| [Footer-Clip: weiss]|  <-- Verdeckt Content im Footer-Bereich
+--Seitenumbruch------+
+--Seite 2 (297mm)----+
| Content (Teil 2)    |
| [Footer-Clip: weiss]|
+---------------------+
```

Split-Editor-Pane bekommt einen eigenen Speichern-Button:
```text
+--Editor-Pane-Header----+
| Brieftext [Live] [Save] [X] |
+-------------------------+
```
