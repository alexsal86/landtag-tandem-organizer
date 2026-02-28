

# Fix: Brieftext wird nicht gespeichert -- Grundursache und endgueltige Loesung

## Grundursache (Root Cause)

Die bisherigen Fixes (setTimeout, draftInitializedRef-Delay, latestContentRef-Fallbacks) haben alle nur Symptome behandelt. Die eigentliche Ursache ist:

**Der `EnhancedLexicalEditor` hat keine `key`-Prop.** Dadurch bleibt die Komponente beim Briefwechsel gemountet und der interne `ContentPlugin` (der Inhalte nur EINMAL bei Mount laedt) ignoriert neue `contentNodes`-Werte.

Im Vergleich: In `KnowledgeBaseView.tsx` wird korrekt `key={selectedDocument.id}` verwendet -- dort funktioniert der Editor.

### Ablauf des Bugs:

```text
1. Brief A wird geoeffnet, Editor mountet, ContentPlugin laedt Inhalt (hasLoadedRef = true)
2. Brief B wird geoeffnet
3. draftContentNodes wird mit Brief-B-Daten gesetzt
4. EnhancedLexicalEditor BLEIBT gemountet (kein key-Wechsel)
5. ContentPlugin sieht hasLoadedRef === true und ignoriert die neuen Props
6. Editor zeigt weiterhin Brief A (oder leer, wenn es der erste Mount war)
7. onChange feuert mit altem/leerem Content
8. Speichern schreibt den falschen Content in die DB
```

## Loesung

### 1. `key`-Prop auf EnhancedLexicalEditor setzen (Hauptfix)

In `src/components/LetterEditor.tsx` (Zeile 1918):

```typescript
// Vorher:
<EnhancedLexicalEditor
  content={draftContent}
  contentNodes={draftContentNodes}
  ...

// Nachher:
<EnhancedLexicalEditor
  key={letter?.id || 'new'}
  content={draftContent}
  contentNodes={draftContentNodes}
  ...
```

### 2. setTimeout-Workarounds entfernen

Die `setTimeout(() => { draftInitializedRef.current = true; }, 500)` Aufrufe (Zeilen 308-310 und 346-348) werden durch sofortiges Setzen ersetzt:

```typescript
draftInitializedRef.current = true;
```

Da der Editor durch den `key`-Wechsel neu mountet und ContentPlugin die richtigen Daten von Anfang an bekommt, gibt es keine Race Condition mehr.

### 3. ContentPlugin absichern (optional, aber empfohlen)

In `src/components/EnhancedLexicalEditor.tsx`: Die `useEffect`-Dependency im ContentPlugin so aendern, dass bei einem Prop-Wechsel der Content erneut geladen wird. Das ist eine Defense-in-Depth-Massnahme fuer Faelle, wo die Komponente ohne key-Wechsel neue Props bekommt:

```typescript
function ContentPlugin({ content, contentNodes }: { content: string; contentNodes?: string }) {
  const [editor] = useLexicalComposerContext();
  const lastLoadedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!editor) return;
    // Only reload if contentNodes actually changed
    const key = contentNodes || content || '';
    if (lastLoadedRef.current === key) return;
    lastLoadedRef.current = key;

    if (contentNodes && contentNodes.trim()) {
      try {
        const editorState = editor.parseEditorState(contentNodes);
        editor.setEditorState(editorState);
        return;
      } catch (error) {
        console.warn('[ContentPlugin] Failed to parse contentNodes:', error);
      }
    }

    if (content && content.trim()) {
      editor.update(() => {
        const root = $getRoot();
        root.clear();
        const paragraph = $createParagraphNode();
        paragraph.append($createTextNode(content));
        root.append(paragraph);
      });
    }
  }, [editor, contentNodes, content]);

  return null;
}
```

## Betroffene Dateien

| Datei | Aenderung |
|---|---|
| `src/components/LetterEditor.tsx` | `key={letter?.id \|\| 'new'}` auf EnhancedLexicalEditor; setTimeout-Workarounds entfernen |
| `src/components/EnhancedLexicalEditor.tsx` | ContentPlugin: `hasLoadedRef` durch `lastLoadedRef` ersetzen fuer prop-basiertes Nachladen |

## Warum das diesmal funktioniert

- `key`-Wechsel erzwingt voelligen Neuaufbau des Editors inkl. ContentPlugin
- ContentPlugin laedt die richtigen Daten von Anfang an
- Keine Race Conditions mehr zwischen Mount und setTimeout
- Gleicher Ansatz wie in `KnowledgeBaseView.tsx`, wo der Editor korrekt funktioniert

