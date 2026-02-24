
# Fix: Text-Magnetismus und Ausrichtung im Header-Canvas

## Problem

Die Snap-Funktion `snapToOtherElements` verwendet **falsche Fallback-Dimensionen** fuer Textelemente. Sie rechnet mit `width=50, height=10` statt den korrekten typspezifischen Werten aus `getElementDimensions` (Text: 70x8, Block: 45x18). Dadurch werden Mittelpunkte und Kanten falsch berechnet, und Elemente snappen an die falschen Positionen.

Die Funktion `calculateSmartGuideDistances` (fuer die Abstandsanzeige) nutzt `getElementDimensions` bereits korrekt -- nur `snapToOtherElements` ist fehlerhaft.

## Loesung

In `snapToOtherElements` (Zeile 307-340 in `StructuredHeaderEditor.tsx`) werden die hartkodierten Fallbacks durch `getElementDimensions()` ersetzt:

### Aenderung 1: Dimensionen des bewegten Elements (Zeile 311)

Vorher:
```text
const w = current.width || 50, h = current.height || 10;
```

Nachher:
```text
const { width: w, height: h } = getElementDimensions(current);
```

### Aenderung 2: Dimensionen der Ziel-Elemente (Zeile 314)

Vorher:
```text
const tw = el.width || 50, th = el.height || 10;
```

Nachher:
```text
const { width: tw, height: th } = getElementDimensions(el);
```

Das ist alles -- zwei Zeilen. Die Funktion `getElementDimensions` ist bereits importiert (Zeile 14) und wird an anderen Stellen im selben File korrekt verwendet.
