

# Fix: Editor verliert Fokus beim Tippen

## Ursache

Die letzte Aenderung am `ContentPlugin` hat einen Feedback-Loop erzeugt:

```text
1. User tippt -> Lexical feuert onChange
2. onChange setzt draftContentNodes (neuer JSON-String)
3. draftContentNodes wird als contentNodes-Prop zurueck an ContentPlugin gegeben
4. ContentPlugin erkennt: "contentNodes hat sich geaendert!" (lastLoadedRef !== neuer Wert)
5. ContentPlugin ruft editor.setEditorState() auf
6. setEditorState() setzt den gesamten Editor-State zurueck -> Cursor und Fokus gehen verloren
7. Zurueck zu Schritt 1...
```

## Loesung

`ContentPlugin` darf NUR beim ersten Mount den Inhalt laden. Da `key={letter?.id || 'new'}` bereits einen kompletten Neuaufbau bei Briefwechsel erzwingt, ist reaktives Nachladen nicht noetig.

### Aenderung in `src/components/EnhancedLexicalEditor.tsx`

ContentPlugin zurueck auf "load once on mount"-Logik mit `hasLoadedRef`:

```typescript
function ContentPlugin({ content, contentNodes }: { content: string; contentNodes?: string }) {
  const [editor] = useLexicalComposerContext();
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    if (!editor || hasLoadedRef.current) return;
    hasLoadedRef.current = true;

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

### Betroffene Datei
- `src/components/EnhancedLexicalEditor.tsx` (nur ContentPlugin, ca. 10 Zeilen)

### Warum sicher
- `key={letter?.id || 'new'}` auf dem Editor erzwingt bei Briefwechsel einen voelligen Neuaufbau inkl. ContentPlugin
- ContentPlugin laedt beim Mount die richtigen Daten
- Kein Feedback-Loop mehr, da Prop-Aenderungen durch onChange ignoriert werden
