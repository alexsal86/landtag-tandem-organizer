
# Fix: Snap-Linien, Variablen-Vorschau, Template-Brief-Integration

## 1. Snap-Linien zeigen dreifach und rasten nicht korrekt ein

**Problem:** In `snapToOtherElements` wird `guides.x` / `guides.y` bei jedem passenden Snap-Target ueberschrieben. Wenn mehrere Targets nah beieinander liegen (z.B. Elementkante + Canvas-Mitte + Canvas-Rand), wird die Position mehrfach gesetzt. Das Element springt zum ersten Match, aber die Snap-Linie zeigt den letzten Match. Ausserdem wird `sx` sequentiell mutiert -- ein frueheres Snap auf die linke Kante verschiebt das Element, dann prueft die naechste Bedingung die rechte Kante mit dem bereits verschobenen Wert.

**Loesung:**
- **Prioritaet:** Nur den naechsten Snap-Target pro Achse (x/y) verwenden. Statt blind zu ueberschreiben, den besten (kleinsten Abstand) merken.
- **Einmal snappen:** Pro Achse nur einen Snap ausfuehren. Sobald der beste Match gefunden ist, wird `sx`/`sy` genau einmal angepasst.
- **Guide-Position = Element-Position:** Die Guide-Line zeigt genau dort, wo das Element tatsaechlich einrastet.

Aenderung in `StructuredHeaderEditor.tsx`, Funktion `snapToOtherElements`:

```text
Vorher:  Schleife ueber Targets, jedes if-Statement setzt sx/sy UND guides
Nachher: Schleife sammelt besten Match (kleinstes delta) pro Achse,
         dann einmalig sx/sy setzen
```

Konkreter Algorithmus:
1. Alle Snap-Targets sammeln (andere Elemente + Achsen-Targets)
2. Fuer jedes Target 3 Checks: linke/obere Kante, Mitte, rechte/untere Kante
3. Den Check mit dem kleinsten Abstand pro Achse merken (bestX, bestY)
4. Am Ende einmal `sx = bestX.snappedPos` und `guides.x = bestX.guidePos` setzen

---

## 2. Variablen mit Vorschautext und Formatierung (Betreff als Startpunkt)

**Problem:** Variablen wie `{{betreff}}` zeigen nur den Platzhalter-Text. Man kann Schriftgroesse und Position nicht beurteilen, weil der angezeigte Text viel kuerzer ist als der reale Text.

**Loesung:** Jede Variable bekommt einen `previewText` -- einen Beispieltext, der im Editor angezeigt wird. Der gespeicherte `content` bleibt `{{betreff}}`, aber die Anzeige zeigt den Vorschautext.

### a) Variablen-Definition erweitern

In `BLOCK_VARIABLES` einen `previewText` pro Variable hinzufuegen:

```text
subject: [
  { label: 'Betreff', value: '{{betreff}}', previewText: 'Ihr Schreiben vom 15. Januar 2026 - Stellungnahme' },
]
addressField: [
  { label: 'Empfaenger Name', value: '{{empfaenger_name}}', previewText: 'Max Mustermann' },
  { label: 'Strasse', value: '{{empfaenger_strasse}}', previewText: 'Musterstrasse 12' },
  ...
]
```

### b) TextElement-Type erweitern

In `types.ts` bei `TextElement`:
- `variablePreviewText?: string` -- Vorschautext fuer die Darstellung

### c) Rendering anpassen

In `canvasElements.tsx` und `LetterLayoutCanvasDesigner.tsx`:
- Wenn `isVariable` und `variablePreviewText` vorhanden: Den Vorschautext anzeigen statt `{{...}}`
- Das Amber-Styling und Blitz-Icon beibehalten, damit klar ist, dass es eine Variable ist
- Die Breite des Elements passt sich dem Vorschautext an

### d) Drop-Handler anpassen

Beim Erstellen eines Variablen-Elements den `previewText` aus `BLOCK_VARIABLES` mitgeben:
```text
{
  content: '{{betreff}}',
  isVariable: true,
  variablePreviewText: 'Ihr Schreiben vom 15. Januar 2026 - Stellungnahme',
}
```

### e) Formatierung

Da das Variablen-Element ein normales TextElement ist, funktionieren alle bestehenden Formatierungsoptionen (Schriftgroesse, Schriftart, Fett, Ausrichtung) automatisch. Der Benutzer kann den Betreff-Platzhalter formatieren und sieht am Vorschautext, wie es aussehen wird.

---

## 3. Template-Variablen in Brieferstellung integrieren

**Problem:** Die Canvas-Block-Elemente (Adressfeld, Betreff, Footer etc.) mit ihren Variablen-Platzhaltern werden beim Brief schreiben nicht verwendet. Die `DIN5008LetterLayout` rendert ihre Bereiche mit fest kodierten Formatierungen, ohne die Template-Canvas-Daten zu beruecksichtigen.

**Loesung:** Eine Variablen-Substitutions-Pipeline, die Template-Canvas-Elemente mit echten Daten fuellt und als fertige Bloecke in der Brief-Vorschau darstellt.

### a) Variablen-Map aufbauen

Neue Utility-Datei `src/lib/letterVariables.ts`:

```text
Funktion: buildVariableMap(letter, senderInfo, contact, infoBlock) => Record<string, string>

Beispiel-Ergebnis:
{
  '{{empfaenger_name}}': 'Max Mustermann',
  '{{empfaenger_strasse}}': 'Hauptstr. 1',
  '{{betreff}}': 'Ihr Schreiben vom ...',
  '{{datum}}': '24.02.2026',
  '{{absender_name}}': 'Alexander Salomon',
  ...
}
```

### b) Template-Canvas-Elemente substituieren

Funktion: `substituteVariables(elements: HeaderElement[], variableMap: Record<string, string>) => HeaderElement[]`

- Iteriert ueber alle Elemente
- Wenn `isVariable === true`: Ersetzt `content` durch den Wert aus der Map
- Behaelt Position, Schriftgroesse, Ausrichtung etc. bei

### c) DIN5008LetterLayout erweitern

Neue optionale Props:
- `addressFieldElements?: HeaderElement[]` (substituierte Elemente aus dem Adressfeld-Canvas)
- `subjectElements?: HeaderElement[]`
- `infoBlockElements?: HeaderElement[]`
- `returnAddressElements?: HeaderElement[]`
- `attachmentElements?: HeaderElement[]`
- `footerElements?: HeaderElement[]`

Wenn Canvas-Elemente vorhanden sind, werden diese statt der bisherigen hartkodierten Bloecke gerendert. Die Elemente werden mit ihren mm-Koordinaten absolut positioniert (wie im Header).

### d) LetterEditor integrieren

Im `LetterEditor`:
1. Template laden (bereits vorhanden)
2. Block-Elemente aus Template lesen (z.B. `template.address_field_elements`, `template.subject_elements`)
3. `buildVariableMap` aufrufen mit den aktuellen Brief-Daten
4. `substituteVariables` aufrufen pro Block
5. Die substituierten Elemente an `DIN5008LetterLayout` uebergeben

### e) Fehlende Felder im Template

Die Block-Elemente werden aktuell im `LetterTemplateManager` gespeichert als:
- `address_field_elements` 
- `return_address_elements`
- `info_block_elements`
- `subject_elements`
- `attachment_elements`
- `footer_text_elements`

Diese Felder muessen in der Datenbank existieren (pruefen und ggf. Migration erstellen).

### f) Fallback

Wenn ein Block keine Canvas-Elemente hat, wird der bisherige hartcodierte Rendering-Pfad beibehalten. So bleiben bestehende Briefe und Templates ohne Canvas-Elemente kompatibel.

---

## Zusammenfassung der betroffenen Dateien

| Datei | Aenderung |
|---|---|
| `src/components/letters/StructuredHeaderEditor.tsx` | Snap-Logik: beste-Match-Algorithmus statt sequentielles Ueberschreiben |
| `src/components/canvas-engine/types.ts` | `variablePreviewText?: string` zu TextElement |
| `src/components/letters/elements/canvasElements.tsx` | Vorschautext-Rendering fuer Variablen |
| `src/components/letters/LetterLayoutCanvasDesigner.tsx` | Vorschautext-Rendering fuer Variablen |
| `src/lib/letterVariables.ts` | Neu: buildVariableMap + substituteVariables |
| `src/components/letters/DIN5008LetterLayout.tsx` | Canvas-Element-Rendering fuer alle Bloecke |
| `src/components/LetterEditor.tsx` | Variable-Substitution und Element-Weitergabe |

## Technische Reihenfolge

1. Snap-Logik fixen (unabhaengig)
2. `variablePreviewText` in Types + BLOCK_VARIABLES + Rendering
3. `letterVariables.ts` erstellen
4. DIN5008LetterLayout um Canvas-Element-Rendering erweitern
5. LetterEditor: Substitution integrieren
6. DB-Migration pruefen fuer Block-Element-Felder
