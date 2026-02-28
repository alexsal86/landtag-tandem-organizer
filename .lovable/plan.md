

# Fix: Mehrseitige Vorschau, Inhaltsbereich Seite 2ff, und Build-Fehler

## Ubersicht
Drei zusammenhangende Probleme werden gelost:
1. **Build-Fehler** in `LetterTemplateManager.tsx` (fehlende `mobileLabel`-Property)
2. **Seite 2+ zeigt falscherweise Header/Footer** -- soll nur den Inhaltsbereich zeigen
3. **Zeilen werden zerschnitten** durch das Viewport/Offset-Modell, weil `translateY` pixelgenau verschiebt und Zeilen auf der Grenze liegen konnen
4. **Fehlende Template-Einstellungen** fur den Inhaltsbereich auf Folgeseiten (Beginn/Ende)

## Betroffene Dateien

### 1. `src/types/letterLayout.ts` -- Neue Felder fur Seite 2+
Neue optionale Felder im `LetterLayoutSettings`-Interface:
- `content.page2TopMm` (number, default: `margins.top`) -- wo der Inhaltsbereich auf Seite 2ff beginnt
- `content.page2BottomMm` (number, default: `footer.top`) -- wo der Inhaltsbereich auf Seite 2ff endet

### 2. `src/components/letters/LayoutSettingsEditor.tsx` -- UI fur die neuen Felder
Im Abschnitt "Inhalt" zwei neue Eingabefelder hinzufugen:
- "Seite 2+ Beginn (mm)" -- fur `content.page2TopMm`
- "Seite 2+ Ende (mm)" -- fur `content.page2BottomMm`

### 3. `src/components/letters/LetterEditorCanvas.tsx` -- Kernlogik-Anpassungen

**a) Seite 2+ ohne Header/Footer rendern:**
- Im `renderPage(pageIndex)` fur `pageIndex > 0`: Keinen `DIN5008LetterLayout` mehr rendern (kein Header, kein Footer, keine Adresszonen)
- Nur den Body-Viewport und ggf. Paginierung anzeigen

**b) Neue Layout-Felder berucksichtigen:**
- `page2TopMm` aus `layout.content.page2TopMm ?? layout.margins?.top ?? 25` lesen
- `contentBottomMm` fur Seite 2+ aus `layout.content.page2BottomMm ?? footerTopMm` lesen (kein Footer = mehr Platz)
- `pageNBodyMm` entsprechend neu berechnen

**c) Zeilen-Zerschneidung vermeiden:**
Das Problem entsteht, weil `translateY(-offsetMm)` den Content pixelgenau verschiebt und eine Textzeile genau auf der oberen Kante des Viewports liegen kann. Losung:
- Die Zeilenhohe in mm berechnen: `lineHeightMm = contentFontSizePt * 0.3528 * 1.2` (pt zu mm, mal line-height 1.2)
- Den Offset pro Seite auf ein Vielfaches der Zeilenhohe abrunden: `offsetMm = Math.floor(rawOffset / lineHeightMm) * lineHeightMm`
- Dadurch beginnt jede Seite immer am Anfang einer Zeile
- Die `page1BodyMm` und `pageNBodyMm` werden ebenfalls auf Vielfache der Zeilenhohe abgerundet, damit die Fensterhohen konsistent bleiben

**d) Paginierung im Inhaltsbereich beachten:**
- Wenn Paginierung aktiv: `contentBottomMm` bereits korrekt berechnet (min von footerTop und paginationTop minus Gap)
- Fur Seite 2+: Paginierung reduziert ebenfalls den verfugbaren Raum, also `page2BottomMm` wird gegen `paginationTopMm - paginationGapMm` geclampt

### 4. `src/components/LetterTemplateManager.tsx` -- Build-Fehler beheben
Zeile 582-592: `mobileLabel` fehlt bei einigen Tab-Definitionen. Fix: `mobileLabel` als optionales Feld in der Nutzung behandeln. Die drei Stellen (Zeile 603, 607, 614) nutzen `tab.mobileLabel`, obwohl nicht alle Tabs dieses Feld haben.
- Option: `(tab as any).mobileLabel ?? tab.label` oder besser: den Typ der `tabDefinitions` anpassen, sodass alle Eintraege `mobileLabel?: string` haben.
- Einfachster Fix: Das Array mit explizitem Typ annotieren statt `as const`, oder alle Eintraege mit `mobileLabel` versehen.

## Technische Details

```text
Seite 1 (wie bisher):
+--Header, Adresse, Info--+
| Betreff, Anrede         |
| Inhalt (Fenster 1)      |
| Paginierung             |
| Footer                  |
+--------------------------+

Seite 2+ (NEU -- kein Header/Footer):
+--------------------------+
| (page2TopMm)             |
| Inhalt (Fenster N)       |
| Paginierung (wenn aktiv) |
| (page2BottomMm)          |
+--------------------------+

Zeilen-Alignment:
rawOffset = page1BodyMm + (i-1) * pageNBodyMm
alignedOffset = floor(rawOffset / lineHeightMm) * lineHeightMm
--> Keine halben Zeilen am oberen Rand
```

## Reihenfolge
1. Build-Fehler in `LetterTemplateManager.tsx` beheben
2. Neue Felder in `letterLayout.ts` + Defaults
3. UI-Felder in `LayoutSettingsEditor.tsx`
4. Renderlogik in `LetterEditorCanvas.tsx` anpassen (kein Header/Footer auf Seite 2+, Zeilen-Alignment, neue Layout-Felder)

