

# Fix: Canvas-Text-Groesse, Cursor-Zoom, Textausrichtung, Header-Layout

## Uebersicht

Vier Probleme in den Brief-Template-Editor-Tabs (Canvas und Header).

---

## 1. Textgroesse im Canvas-Tab stimmt nicht

**Problem:** In `LetterLayoutCanvasDesigner.tsx` Zeile 195 wird die Schriftgroesse mit `(fontSize || 11) * (96/72) * scale` berechnet. Das ist falsch: `96/72` konvertiert pt zu CSS-px, aber `scale` (= `CSS_PX_PER_MM * zoom`) wandelt mm in px um. Die Formel muss stattdessen pt erst in mm umrechnen (`25.4/72`), dann mm in px (`* scale`).

**Loesung:** In `renderCanvasElementPreview` (Zeile 195) die fontSize-Formel aendern:

```text
// Vorher:
fontSize: `${(element.fontSize || 11) * (96 / 72) * scale}px`

// Nachher:
fontSize: `${(element.fontSize || 11) * (25.4 / 72) * scale}px`
```

Das ist konsistent mit `canvasElements.tsx`, das bereits `(25.4 / 72) * scaleY` verwendet.

---

## 2. Cursor-zentrierter Zoom funktioniert nicht

**Problem:** In beiden Tabs (Canvas und Header) setzt der Wheel-Handler `container.scrollLeft` und `container.scrollTop` nach dem Zoom per `requestAnimationFrame`. Das Problem: Wenn der Container bei 100% keinen Overflow hat (kein Scrollbalken), kann `scrollLeft/scrollTop` nicht gesetzt werden -- die Werte bleiben bei 0. Der Canvas waechst zwar, aber das Scrollen greift erst ab dem Moment, wo der Canvas groesser als der Container ist.

**Loesung:** Das grundlegende Zoom-Verhalten (Canvas waechst, Scrollbar entsteht) ist korrekt. Damit der Cursor-zentrierte Zoom funktioniert, muss sichergestellt werden, dass die `scrollLeft`/`scrollTop`-Zuweisung nach dem DOM-Update erfolgt. Dafuer in `requestAnimationFrame` ein weiteres `requestAnimationFrame` nesten (double-rAF), da React den State-Update erst im naechsten Frame committed:

```text
requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    const newScale = ...;
    container.scrollLeft = ...;
    container.scrollTop = ...;
  });
});
```

Dies in beiden Tabs (`StructuredHeaderEditor.tsx` und `LetterLayoutCanvasDesigner.tsx`) aendern.

---

## 3. Textausrichtung (links, mittig, rechts)

**Problem:** Text-Elemente haben keine `textAlign`-Eigenschaft. Der Benutzer kann die Ausrichtung nicht aendern.

**Loesung:**

### a) Typ erweitern (`types.ts`)

`TextElement` um `textAlign?: 'left' | 'center' | 'right'` erweitern.

### b) Rendering anpassen (`canvasElements.tsx`)

Im `TextCanvasElement` den `textAlign`-Style hinzufuegen:

```text
textAlign: element.textAlign || 'left',
```

### c) Canvas-Tab Rendering (`LetterLayoutCanvasDesigner.tsx`)

Gleichen Style in `renderCanvasElementPreview` fuer Text-Elemente hinzufuegen.

### d) Sidebar-Controls (`StructuredHeaderEditor.tsx`)

Im Text-Properties-Panel drei Buttons fuer Links/Mitte/Rechts hinzufuegen (neben B/I/U):

```text
<Label className="text-xs">Ausrichtung</Label>
<div className="grid grid-cols-3 gap-1">
  <Button size="sm" className="h-6 text-xs" variant={textAlign === 'left' ? 'default' : 'outline'} onClick={() => updateElement(id, { textAlign: 'left' })}>L</Button>
  <Button size="sm" className="h-6 text-xs" variant={textAlign === 'center' ? 'default' : 'outline'} onClick={() => updateElement(id, { textAlign: 'center' })}>M</Button>
  <Button size="sm" className="h-6 text-xs" variant={textAlign === 'right' ? 'default' : 'outline'} onClick={() => updateElement(id, { textAlign: 'right' })}>R</Button>
</div>
```

---

## 4. Header-Tab: Scrollleiste und ueberbreiter Canvas

**Problem:** Der Header-Canvas-Container hat `overflow-auto` ohne Hoehenbegrenzung, was bei 200% Zoom dazu fuehrt, dass der aeussere Container (Card) mit waechst und eine Scrollleiste entsteht. Der Canvas ist nicht innerhalb eines begrenzten Bereichs eingeschlossen wie im Canvas-Tab.

**Loesung:** Den Container um den Header-Canvas so gestalten wie im Canvas-Tab:

### a) Aeusserer Container mit Begrenzung

```text
<div ref={previewContainerRef} 
     className="border rounded-lg p-4 bg-muted/20 overflow-auto outline-none"
     style={{ maxHeight: 'calc(100vh - 280px)' }}>
```

So hat der Container eine maximale Hoehe relativ zum Viewport, und bei hohen Zoom-Stufen erscheinen Scrollbalken innerhalb des Containers (nicht des gesamten Layouts). Bei 100% passt der Header (45mm hoch, ca. 170px) problemlos ohne Scrollleiste.

### b) Canvas zentrieren

Der innere Canvas-Container behaelt `mx-auto`, damit er bei kleinen Zoom-Stufen mittig steht.

---

## Zusammenfassung der betroffenen Dateien

| Datei | Aenderung |
|---|---|
| `src/components/canvas-engine/types.ts` | `textAlign` Property zu `TextElement` hinzufuegen |
| `src/components/letters/LetterLayoutCanvasDesigner.tsx` | fontSize-Formel korrigieren (25.4/72 statt 96/72), textAlign rendern, Double-rAF fuer Cursor-Zoom |
| `src/components/letters/StructuredHeaderEditor.tsx` | Double-rAF fuer Cursor-Zoom, Container-maxHeight, Textausrichtungs-Buttons in Sidebar |
| `src/components/letters/elements/canvasElements.tsx` | textAlign Style hinzufuegen |

