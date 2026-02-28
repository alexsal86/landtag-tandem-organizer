
# Echte mehrseitige Darstellung im Canvas-Editor

## Uebersicht

Der aktuelle Canvas ist ein einziger `div` mit `minHeight: 297mm`, der unbegrenzt waechst. Seitenumbrueche werden nur als gestrichelte Linien angedeutet. Header, Footer und Paginierung erscheinen nur einmal. Dieses Vorhaben teilt den Canvas in echte, separate A4-Seiten-Container auf, mit automatischem Inhaltsumbruch und reduzierten Wiederholungselementen auf Folgeseiten.

---

## Architektur

```text
+--Scrollbarer Container (bg-muted/50)--+
|                                         |
|  +----- Seite 1 (297mm) -----+         |
|  | Header (45mm)              |         |
|  | Adressfeld + Infoblock     |         |
|  | Betreff + Anrede           |         |
|  | Lexical-Editor (Teil 1)    |         |
|  | Footer + Paginierung       |         |
|  +----------------------------+         |
|                                         |
|  +----- Seite 2 (297mm) -----+         |
|  | Reduzierter Header (15mm)  |         |
|  | Lexical-Editor (Teil 2)    |         |
|  | Footer + Paginierung       |         |
|  +----------------------------+         |
|                                         |
|  +----- Seite N ... ----------+         |
+----------------------------------------+
```

## Technischer Ansatz

### Kernkonzept: Overflow-Messung + Seiten-Rendering

Der Lexical-Editor bleibt ein einzelner Editor (kein Split). Die Seitenaufteilung erfolgt rein visuell durch CSS:

1. Der Editor-Content wird in einem unsichtbaren "Mess-Container" gerendert, um die Gesamthoehe des Inhalts zu ermitteln.
2. Basierend auf der gemessenen Hoehe wird berechnet, wie viele Seiten noetig sind.
3. Der sichtbare Canvas rendert N separate Seiten-Container mit `overflow: hidden` und `clip`, wobei der Editor-Inhalt per negativem `top`-Offset auf jede Seite "verschoben" wird.

### Seitenberechnung

- **Seite 1 verfuegbare Hoehe**: `footerTopMm - editorTopMm` (ca. 272mm - ~110mm = ~162mm)
- **Folgeseiten verfuegbare Hoehe**: `footerTopMm - reducedHeaderHeight - margins.top_followup` (ca. 272mm - 15mm - 10mm = ~247mm)
- **Seitenzahl**: `1 + Math.ceil((contentHeight - page1Available) / followPageAvailable)` (mindestens 1)

### Folgeseiten-Layout

Folgeseiten erhalten:
- Reduzierten Header: Nur Absendername/Logo (15mm statt 45mm)
- Paginierung: "Seite X von Y"
- Footer: Identisch zu Seite 1
- Kein Adressfeld, kein Infoblock, kein Betreff, keine Anrede

---

## Dateien und Aenderungen

### 1. Neue Datei: `src/components/letters/useContentPagination.ts`

Custom Hook der die Seitenaufteilung berechnet:
- Input: `editorTopMm`, `footerTopMm`, `contentHeightMm` (gemessen via ResizeObserver)
- Output: `{ totalPages, page1ContentHeight, followPageContentHeight, pages: Array<{ pageNumber, contentOffsetMm, contentHeightMm }> }`
- Folgeseiten-Header-Hoehe als Konstante (15mm)

### 2. Aenderung: `src/components/letters/LetterEditorCanvas.tsx`

Hauptaenderungen:
- **ResizeObserver** auf den Lexical-Editor-Container, um `contentHeightMm` zu messen
- **`useContentPagination`** Hook einbinden
- Statt einem einzigen `div` mit `minHeight: 297mm` wird eine **Schleife ueber `pages`** gerendert
- Jede Seite ist ein eigener `div` mit exakt `height: 297mm`, `overflow: hidden`, weissem Hintergrund und Schatten
- **Seite 1**: Rendert `DIN5008LetterLayout` (Header, Adressfeld, Infoblock, Betreff, Anrede) + den Editor mit `clip-path` oder `overflow: hidden`
- **Seite 2+**: Rendert reduzierten Header + den Editor-Content mit negativem Offset (`top: -offsetMm`) + Footer/Paginierung
- Der Lexical-Editor bleibt ein einzelnes Element, wird aber per CSS-Clipping auf die jeweilige Seite beschraenkt
- Gestrichelte Seitenumbruch-Markierungen entfallen (da echte Seiten)
- Closing-Block (Grussformel/Unterschrift) wird auf der letzten Seite nach dem Content gerendert

### 3. Aenderung: `src/components/letters/DIN5008LetterLayout.tsx`

- Neuer Prop: `pageNumber?: number` (default 1)
- Neuer Prop: `totalPages?: number` (default 1)
- Wenn `pageNumber > 1`: Nur reduzierten Header (Absendername, ggf. Logo), Footer und Paginierung rendern; Adressfeld, Infoblock, Betreff, Anrede ueberspringen
- Paginierung zeigt "Seite X von Y" statt "Seite 1 von 1"

### 4. Aenderung: `src/utils/letterPDFGenerator.ts`

- PDF-Generierung muss ebenfalls die Mehrseitigkeit beruecksichtigen
- Nutzt dieselbe Berechnungslogik wie `useContentPagination`
- Folgeseiten erhalten reduzierten Header + Footer + Paginierung

---

## Visuelles Ergebnis

- Jede Seite hat einen eigenen weissen Kasten mit Schatten, getrennt durch 16px Abstand
- Der Benutzer scrollt vertikal durch die Seiten
- Zoom wirkt auf alle Seiten gleichmaessig
- Der Lexical-Editor ist weiterhin durchgehend editierbar (kein Split)
- Footer und Paginierung erscheinen auf jeder Seite
- Folgeseiten zeigen einen kompakten Header (nur Absender/Logo)

---

## Umsetzungsreihenfolge

1. `useContentPagination` Hook erstellen (Berechnungslogik)
2. `LetterEditorCanvas.tsx` umbauen (Seiten-Schleife, ResizeObserver, Clipping)
3. `DIN5008LetterLayout.tsx` erweitern (`pageNumber`/`totalPages` Props, Folgeseiten-Modus)
4. `letterPDFGenerator.ts` anpassen (Mehrseitige PDF-Ausgabe)
