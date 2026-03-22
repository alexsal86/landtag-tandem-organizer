

## SVG-Logo nativ einbinden (svg2pdf.js reaktivieren)

### Aktueller Zustand
- `svg2pdf.js` ist in `package.json` vorhanden, wird aber **nicht verwendet**
- Stattdessen wird das SVG per Canvas gerastert (`rasterizeSvg`) und als PNG eingebettet
- Das erzeugt ein unscharfes/pixeliges Logo

### Änderung

In `briefingPdfGenerator.ts`:

1. **`svg2pdf.js` importieren** und `doc.svg()` wieder nutzen
2. **`rasterizeSvg`-Funktion entfernen** (wird nicht mehr gebraucht)
3. **`drawHeader` anpassen**: SVG per `fetch` laden, mit `DOMParser` als `SVGElement` parsen, dann `await doc.svg(svgElement, { x, y, width, height })` aufrufen
4. **Fallback beibehalten**: Falls `doc.svg()` fehlschlägt, Logo überspringen statt PDF-Generierung zu blockieren

### Technisches Detail

```typescript
import { svg2pdf } from 'svg2pdf.js';

// In drawHeader:
const resp = await fetch("/assets/logo_fraktion.svg");
const svgText = await resp.text();
const parser = new DOMParser();
const svgDoc = parser.parseFromString(svgText, "image/svg+xml");
const svgElement = svgDoc.documentElement as unknown as SVGElement;

// Wichtig: SVG muss im DOM sein für svg2pdf.js
document.body.appendChild(svgElement);
svgElement.style.position = 'absolute';
svgElement.style.left = '-9999px';

try {
  await doc.svg(svgElement, { x: logoX, y: logoY, width: logoW, height: logoH });
} finally {
  document.body.removeChild(svgElement);
}
```

### Dateien

| Datei | Änderung |
|---|---|
| `briefingPdfGenerator.ts` | `svg2pdf.js` Import hinzufügen, `rasterizeSvg` entfernen, `drawHeader` auf `doc.svg()` umstellen |

### Ergebnis
- Logo als Vektorgrafik im PDF (perfekt scharf bei jeder Zoomstufe)
- `svg2pdf.js` Dependency wird tatsächlich genutzt
- Minimale Dateigröße

