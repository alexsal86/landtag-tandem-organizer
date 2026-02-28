
# Fix: Editor-Text leer und Vorschau reagiert nicht auf Eingaben

## Ursache

Im letzten Fix wurde `draftInitializedRef.current = false` beim Laden eines neuen Briefes gesetzt (Zeile 288). Das allein reicht aber nicht, weil:

1. Der `useEffect` bei Zeile 174, der die Draft-States initialisiert, hat als Dependency nur `[showTextSplitEditor]`
2. `showTextSplitEditor` ist bereits `true` und aendert sich nicht beim Briefwechsel
3. Der Effect feuert daher nie erneut -- die Draft-States (`draftContent`, `draftContentNodes`, `draftContentHtml`) bleiben leer
4. Der Lexical-Editor (Zeile 1883) bekommt leere Props
5. Die Live-Sync (Zeile 200) prueft `draftInitializedRef.current` -- das ist `false`, also werden Aenderungen im Editor nicht zur Vorschau synchronisiert

## Loesung

In `src/components/LetterEditor.tsx` an der Stelle, wo der Brief geladen wird (Zeile 286-294): Die Draft-States direkt mit den neuen Briefdaten initialisieren und `draftInitializedRef.current = true` setzen, damit die Live-Sync sofort funktioniert.

### Aenderung in `src/components/LetterEditor.tsx` (Zeile 286-294)

Aus:
```
draftInitializedRef.current = false;

setEditedLetter({
  ...letter,
  content_html: letter.content_html || '',
  content_nodes: letter.content_nodes || null
});
```

Wird:
```
// Reset and immediately re-initialize draft states from new letter
draftInitializedRef.current = false;

setEditedLetter({
  ...letter,
  content_html: letter.content_html || '',
  content_nodes: letter.content_nodes || null
});

// Directly initialize draft states so the editor gets content
setDraftContent(letter.content || '');
setDraftContentNodes(letter.content_nodes || null);
setDraftContentHtml(letter.content_html || null);
draftInitializedRef.current = true;
```

Das stellt sicher, dass:
- Der Editor sofort den Briefinhalt erhaelt
- Die Live-Sync (`draftInitializedRef.current === true`) funktioniert
- Aenderungen im Editor wieder zur Vorschau synchronisiert werden

## Zusaetzlich: Neuer Brief (else-Zweig, Zeile 310-327)

Gleiche Logik fuer neue Briefe anwenden -- Draft-States zuruecksetzen:
```
setDraftContent('');
setDraftContentNodes(null);
setDraftContentHtml(null);
draftInitializedRef.current = true;
```
