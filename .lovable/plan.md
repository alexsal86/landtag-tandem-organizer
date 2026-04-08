

## Revidierter Plan: Notion-like Block Editor mit offiziellen Lexical-Plugins

### Was sich ändert gegenüber dem alten Plan
Statt Custom-Plugins nutzen wir die **offiziellen Lexical-Bausteine**, die auch das Playground verwendet:

- `DraggableBlockPlugin_EXPERIMENTAL` aus `@lexical/react` (bereits installiert in v0.40.0)
- `LexicalTypeaheadMenuPlugin` aus `@lexical/react` als Basis für Slash-Commands

---

### Neue Dateien

**1. `src/components/plugins/ComponentPickerPlugin.tsx`**
- Adaptiert vom [offiziellen Playground-Code](https://github.com/facebook/lexical/blob/main/packages/lexical-playground/src/plugins/ComponentPickerPlugin/index.tsx)
- Nutzt `LexicalTypeaheadMenuPlugin` + `useBasicTypeaheadTriggerMatch` aus `@lexical/react`
- Trigger: `/` am Zeilenanfang
- Block-Optionen: Heading 1–3, Bullet List, Numbered List, Checklist, Quote, Code Block, Horizontal Rule
- Filterbar durch Tippen nach `/`

**2. `src/components/plugins/DraggableBlockPlugin.tsx`**
- Wrapper um `DraggableBlockPlugin_EXPERIMENTAL` aus `@lexical/react/LexicalDraggableBlockPlugin`
- Eigenes UI: Drag-Handle (Grip-Icon) + Plus-Button der den ComponentPicker öffnet
- Target-Line beim Drag als visueller Indikator

**3. `src/components/dossier-editor/DossierBlockEditor.tsx`**
- Neue Editor-Wrapper-Komponente mit:
  - `RichTextPlugin`, `HistoryPlugin`, `ListPlugin`, `CheckListPlugin`, `LinkPlugin`, `HorizontalRulePlugin`, `MarkdownShortcutPlugin`, `TabIndentationPlugin`
  - `FloatingTextFormatToolbar` (bestehend)
  - `ComponentPickerPlugin` (neu)
  - `DraggableBlockPlugin` (neu)
- Keine feste Toolbar — alles über Slash-Commands + Floating-Toolbar
- Props: `initialContent`, `contentVersion`, `onChange`, `placeholder`, `minHeight`

---

### Geänderte Dateien

**`src/features/dossiers/components/DossierSummaryTab.tsx`**
- `SimpleRichTextEditor` ersetzen durch `DossierBlockEditor`
- Auto-Save-Logik bleibt identisch

**`src/styles/lexical-editor.css`**
- Styles für Slash-Command-Dropdown (Popover, Items, selected-State)
- Drag-Handle Styling (Opacity-Transition, Positionierung)
- Target-Line beim Drag (farbiger Balken)

---

### Technische Details

| Offizielles Package | Verwendung |
|---|---|
| `@lexical/react/LexicalDraggableBlockPlugin` | `DraggableBlockPlugin_EXPERIMENTAL` — Drag & Drop von Blöcken |
| `@lexical/react/LexicalTypeaheadMenuPlugin` | `LexicalTypeaheadMenuPlugin` + `useBasicTypeaheadTriggerMatch` — Slash-Command-Menü |
| `@lexical/react/LexicalHorizontalRulePlugin` | Bereits verwendet |
| `@lexical/list` | `ListPlugin`, `CheckListPlugin` — Listen-Support |
| `@lexical/code` | `$createCodeNode` — Code-Blöcke via Slash-Command |

Alle Packages sind bereits in v0.40.0 installiert — keine neuen Dependencies nötig.

