

## Briefing-PDF reparieren: Logo & Schriftart

### Problem

1. **Logo:** `svg2pdf.js` hängt bei dem komplexen Fraktions-SVG. Der Canvas-Fallback funktioniert ebenfalls nicht zuverlässig. Die PDF-Generierung bleibt komplett stehen.
2. **Schriftart:** jsPDF unterstützt nur TTF — die GrueneTypeNeue liegt aber nur als WOFF/WOFF2 vor. Deshalb wird immer der Fallback (PTSans-Bold) verwendet.

### Lösung

**1. GrueneTypeNeue.ttf einbinden**
- Die hochgeladene `GrueneTypeNeue.ttf` nach `public/fonts/GrueneTypeNeue.ttf` kopieren
- In `HEADER_FONT_SOURCES` die TTF-Datei als **erste** Quelle eintragen (vor WOFF/WOFF2, da jsPDF nur TTF kann)
- WOFF/WOFF2-Einträge können bleiben (werden übersprungen, da TTF zuerst greift)

**2. SVG-Logo zuverlässig einbetten (svg2pdf.js entfernen, Canvas-Rasterisierung)**
- `svg2pdf.js` komplett entfernen (hängt bei komplexen SVGs)
- Stattdessen: SVG per `fetch` laden → als `Image` via Blob-URL rendern → auf Canvas bei 4× Skalierung zeichnen → als komprimiertes PNG per `doc.addImage()` einbetten
- Das SVG bleibt als Quelldatei erhalten (`/assets/logo_fraktion.svg`), wird nur zur Laufzeit gerastert
- Kein Timeout-Hack mehr nötig, da `img.onload` auf Canvas zuverlässig funktioniert

### Dateien

| Datei | Änderung |
|---|---|
| `public/fonts/GrueneTypeNeue.ttf` | Neue Datei (vom User hochgeladen) |
| `briefingPdfGenerator.ts` | TTF als erste Font-Quelle; `svg2pdf.js`-Import entfernen; `loadSvgElement` + `doc.svg()` durch Canvas-Rasterisierung ersetzen |
| `package.json` | `svg2pdf.js` Dependency entfernen |

### Erwartetes Ergebnis
- PDF wird zuverlässig generiert (kein Hängen mehr)
- GrueneTypeNeue wird als Header-Font verwendet
- Logo erscheint scharf (4× Rasterisierung)
- Dateigröße bleibt klein (~50-150 KB)

