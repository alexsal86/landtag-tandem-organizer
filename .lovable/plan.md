

# 1. Anlagen unter die Unterschrift + pretext-Bewertung

## Zu Frage 2: pretext hilft euch hier nicht

**pretext** ist eine reine Text-Mess-Library: sie berechnet, wie hoch ein Plaintext-Block bei gegebener Breite wird — ohne DOM-Layout. Das ist nutzlich fur Canvas-Rendering oder Virtualisierung.

Euer Problem ist aber ein anderes: Ihr habt **Rich-HTML-Content** (Lexical-Editor-Output mit `<p>`, `<strong>`, Listen etc.) und musst diesen auf DIN-A4-Seiten umbrechen. pretext kann:
- Kein HTML/Rich-Text messen
- Keine Bilder, Listen, Tabellen berucksichtigen
- Keinen mehrseitigen Umbruch berechnen

Eure aktuelle Losung (ResizeObserver + Block-Break-Offsets + Viewport/Translate-Pagination) ist tatsachlich der richtige Ansatz fur HTML-basierte Briefvorschau. Das ist kein Bug, sondern die Standard-Technik (auch Google Docs macht es ahnlich mit virtuellen Seiten).

**Fazit: pretext ist fur euren Anwendungsfall nicht geeignet.** Eure bestehende Pagination-Engine ist konzeptionell korrekt. Das Problem liegt nur in der Anlagen-Positionierung.

---

## Zu Frage 1: Anlagen unter die Unterschrift verschieben

### Ist-Zustand
- `LetterEditorCanvas.tsx` rendert Closing + Attachments bereits korrekt **im Content-Flow** (Zeile 431-440: `renderContentFlow` = Content → Closing → Attachments)
- Die Pagination sieht die Anlagen als Teil des Flows → sie werden korrekt auf Folgeseiten umgebrochen
- **ABER**: Der `EditableCanvasOverlay` fur Anlagen (Zeile 690-715) ist mit `top={layout.attachments?.top ?? 230}` fest auf Seite 1 positioniert — das ist die **Edit-Overlay-Position**, nicht die Render-Position

Das heisst: Die **Vorschau** rendert Anlagen bereits im Flow (unter der Unterschrift). Aber das **Edit-Overlay** (der gruner Stift zum Bearbeiten der Anlagenamen) sitzt fest bei 230mm.

### Problem im DIN5008LetterLayout (reine Vorschau ohne Editor)
In `DIN5008LetterLayout.tsx` gibt es zwei Modi:
1. **Integrated mode** (Zeile 580-648): Anlagen sind im Content-Flow → korrekt unter Unterschrift ✓
2. **Legacy mode** (Zeile 703-719): Anlagen werden mit `position: absolute` und festem Top-Wert positioniert → Problem

### Umsetzungsplan

**Schritt 1: EditableCanvasOverlay fur Anlagen entfernen**
- `src/components/letters/LetterEditorCanvas.tsx` Zeile 690-715: Den gesamten `EditableCanvasOverlay` fur Anlagen entfernen
- Die Bearbeitungsfunktion ist bereits uber den Popover im `renderAttachments()` (Zeile 347-421) abgedeckt — der grune Stift erscheint inline bei Hover uber die Anlagen im Flow
- Das doppelte Edit-UI (Overlay + Inline-Popover) ist redundant

**Schritt 2: Legacy-Mode Anlagen ebenfalls in den Flow verschieben**
- `src/components/letters/DIN5008LetterLayout.tsx` Zeile 703-719: Den absolut positionierten Legacy-Anlagen-Block entfernen
- Stattdessen die Anlagen auch im Legacy-Mode nach dem Content-`div` als Flow-Element rendern (gleich wie im Integrated-Mode)

**Schritt 3: `attachments.top` aus Layout-Settings als deprecated behandeln**
- `src/components/letters/LayoutSettingsEditor.tsx`: Das Feld "Anlagen von oben (mm)" ausblenden oder entfernen, da die Position jetzt dynamisch ist
- `src/components/letters/LetterLayoutCanvasDesigner.tsx`: Den Anlagen-Block aus der Canvas-Designer-Ansicht entfernen (kein Drag auf feste Position mehr)

### Ergebnis
- Anlagen folgen immer direkt nach der Unterschrift
- Der Abstand wird uber `LetterAttachmentList` gesteuert: 4.5mm mit Unterschrift, 13.5mm ohne
- Bei mehrseitigen Briefen werden Anlagen korrekt auf die nachste Seite umgebrochen, wenn sie nicht mehr auf die aktuelle passen

