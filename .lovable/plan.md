

# Zwei Fixes: Build-Fehler (Chat) und Bilder in Briefvorlagen

## Problem 1: Build-Fehler blockiert die App

In `src/components/task-decisions/TaskDecisionDetails.tsx` Zeile 584 wird der Typ `DecisionComment` referenziert, den es nicht gibt. Die alte `renderDecisionComment`-Funktion ist toter Code -- sie wird nicht mehr aufgerufen, da die Kommentare jetzt ueber die `CommentThread`-Komponente gerendert werden (Zeile 914-922). Der Build-Fehler verhindert aber, dass die App korrekt laeuft.

**Loesung:** Die gesamte `renderDecisionComment`-Funktion (Zeilen 584-629) entfernen. Sie wird nirgends mehr verwendet.

---

## Problem 2: Bilder in Briefvorlagen brechen nach Neuladen

**Ursache:** Beim Einfuegen eines Bildes wird eine temporaere `blobUrl` (via `URL.createObjectURL()`) erzeugt und im Element gespeichert. Diese URL lebt nur so lange wie die aktuelle Browser-Session. Beim Rendering wird `element.blobUrl || element.imageUrl` verwendet (Zeile 718) -- die `blobUrl` hat also Prioritaet. Beim Neuladen ist die `blobUrl` aber tot, und da sie als String im JSON gespeichert wurde (z.B. `"blob:https://..."`) ist sie nicht leer, sondern ein toter Link. Das Bild bricht.

**Loesung (simpel):**

1. **Beim Speichern `blobUrl` entfernen**: In `LetterTemplateManager.tsx` vor dem Speichern in die Datenbank die `blobUrl`-Property aus allen `header_elements` herausfiltern. `blobUrl` ist nur ein Laufzeit-Cache und darf nicht persistiert werden.

2. **Rendering-Prioritaet umkehren**: In `StructuredHeaderEditor.tsx` Zeile 718 die Prioritaet aendern auf `element.imageUrl || element.blobUrl`. Die `imageUrl` (die echte Supabase-Public-URL) ist die zuverlaessige Quelle und sollte immer bevorzugt werden. Die `blobUrl` dient nur als schneller Fallback direkt nach dem Upload, bevor die `imageUrl` geladen ist.

3. **Gleiche Bereinigung fuer `footer_blocks` und `layout_settings`**, falls dort ebenfalls Bild-Elemente mit `blobUrl` gespeichert werden.

---

## Technische Details

### Datei 1: `src/components/task-decisions/TaskDecisionDetails.tsx`
- Zeilen 584-629 (`renderDecisionComment` Funktion) komplett entfernen

### Datei 2: `src/components/letters/StructuredHeaderEditor.tsx`
- Zeile 718: `element.blobUrl || element.imageUrl` aendern zu `element.imageUrl || element.blobUrl`

### Datei 3: `src/components/LetterTemplateManager.tsx`
- Vor dem Speichern (Insert und Update, ca. Zeilen 280-310): Eine Hilfsfunktion einbauen, die `blobUrl` aus allen Elementen in `header_elements`, `footer_blocks` und `layout_settings` entfernt:

```typescript
const stripBlobUrls = (elements: any[]) =>
  elements.map(({ blobUrl, ...rest }) => rest);
```

- Diese auf `formData.header_elements`, `formData.footer_blocks` und die Bild-Elemente in `formData.layout_settings` anwenden, bevor die Daten an Supabase gesendet werden.

