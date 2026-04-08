

## Plan: Toolbar + verbessertes Drag-Handle für DossierBlockEditor

### Änderungen

**1. `src/components/dossier-editor/DossierBlockEditor.tsx`**
- `EnhancedLexicalToolbar` importieren und als feste Toolbar oberhalb des Editors einbinden (innerhalb des `LexicalComposer`, vor dem ContentEditable-Bereich)
- Die Toolbar bekommt keine `showFloatingToolbar`-Prop (Standard = false → volle Toolbar)
- Kein `documentId`, `defaultFontSize`, `defaultFontFamily` — nur Basis-Toolbar
- `FloatingTextFormatToolbar` entfernen (redundant mit fester Toolbar)
- Zusätzliche Nodes registrieren, die die Toolbar benötigt: `TableNode`, `TableCellNode`, `TableRowNode`, `CodeHighlightNode`, `HashtagNode`, `ImageNode`, `MentionNode`
- `TablePlugin`, `LinkPlugin`, `AutoLinkPlugin` hinzufügen
- Container-Klasse anpassen: `border rounded-lg overflow-hidden` für korrektes Toolbar-Layout

**2. `src/components/plugins/DraggableBlockPlugin.tsx`**
- Umbauen nach dem offiziellen Playground-Vorbild:
  - `onElementChanged`-Callback nutzen, um das aktuell gehoverte Element zu tracken
  - Plus-Button (⊕) neben dem Grip-Handle hinzufügen, der den ComponentPicker als Popover öffnet
  - ComponentPicker-Popover: Suchfeld + Block-Optionen, positioniert neben dem Menü
  - Einfügen eines neuen Blocks vor/nach dem gehoverten Element (Alt/Ctrl-Klick → davor)
  - Keyboard-Navigation (Arrow Up/Down, Enter, Escape) im Picker
  - Click-Outside schließt den Picker

**3. `src/styles/lexical-editor.css`**
- Drag-Handle: `will-change: transform, opacity` für flüssige Transitions (wie Playground)
- Target-Line: `will-change: transform`, `background: deepskyblue`, `height: 4px` — exakt wie Playground
- Plus-Button Styling neben dem Grip-Icon
- Component-Picker-Popover im Drag-Kontext (`draggable-block-component-picker`)

**4. `src/components/plugins/ComponentPickerPlugin.tsx`**
- Exports ergänzen: `getBaseOptions`, `ComponentPickerOption`, `ComponentPickerMenuItem` als named exports, damit der DraggableBlockPlugin sie wiederverwenden kann (wie im Playground)

### Betroffene Dateien

| Datei | Änderung |
|---|---|
| `src/components/dossier-editor/DossierBlockEditor.tsx` | Toolbar einbinden, FloatingToolbar entfernen, Nodes erweitern |
| `src/components/plugins/DraggableBlockPlugin.tsx` | Playground-getreuer Umbau mit Plus-Button + Picker |
| `src/components/plugins/ComponentPickerPlugin.tsx` | Named Exports für Wiederverwendung |
| `src/styles/lexical-editor.css` | Target-Line + Plus-Button Styles |

