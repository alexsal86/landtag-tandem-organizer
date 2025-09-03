# Lexical Editor mit Yjs Kollaboration

Dieses Projekt nutzt **Lexical Editor** von Meta zusammen mit **Yjs** für Echtzeit-Kollaboration. Die Integration bietet eine vollständige Rich-Text-Editor-Lösung mit konfliktfreier Zusammenführung von Änderungen mehrerer Benutzer.

## 🚀 Features

### ✅ Vollständig implementiert

- **Lexical Core Editor** - Moderner, erweiterbare Rich-Text-Editor
- **Yjs CRDT Integration** - Konfliktfreie Echtzeit-Kollaboration
- **WebSocket Provider** - Echtzeitverbindung zwischen Clients
- **Rich-Text Formatierung** - Bold, Italic, Headlines, Lists, Links, etc.
- **Benutzer-Awareness** - Live-Cursor-Tracking und Online-Status
- **Automatisches Speichern** - Debounced Persistierung nach Supabase
- **Error Handling** - Robuste Fehlerbehandlung und Wiederherstellung
- **TypeScript Support** - Vollständige Typisierung

### 🛠 Technischer Stack

```typescript
// Core Dependencies
"lexical": "^0.34.0"
"@lexical/yjs": "^0.34.0" 
"@lexical/react": "^0.34.0"
"yjs": "^13.6.27"
"y-websocket": "^3.0.0"

// Zusätzliche Lexical Plugins
"@lexical/rich-text": "^0.34.0"
"@lexical/list": "^0.34.0"
"@lexical/link": "^0.34.0"
"@lexical/code": "^0.34.0"
"@lexical/history": "^0.34.0"
// ... und weitere
```

## 📖 Verwendung

### Basis-Implementierung

```tsx
import LexicalEditor from '@/components/LexicalEditor';

function MyComponent() {
  return (
    <LexicalEditor
      documentId="unique-document-id"
      enableCollaboration={true}
      initialContent=""
      placeholder="Beginnen Sie zu schreiben..."
      showToolbar={true}
      onChange={(content) => {
        console.log('Content changed:', content);
      }}
    />
  );
}
```

### Kollaborations-Context

```tsx
import { CollaborationProvider } from '@/contexts/CollaborationContext';

function App() {
  return (
    <CollaborationProvider>
      <MyComponent />
    </CollaborationProvider>
  );
}
```

## 🔧 Komponenten-Architektur

### Hauptkomponenten

1. **`LexicalEditor.tsx`** - Haupteditor-Komponente
   - Lexical Composer Setup
   - Plugin-Konfiguration
   - Kollaborations-Integration
   - Fehlerbehandlung

2. **`CollaborationContext.tsx`** - WebSocket-Provider
   - Yjs Document Management
   - WebSocket Verbindungsmanagement
   - Benutzer-Awareness
   - Verbindungsstatus

3. **`ToolbarPlugin.tsx`** - Formatierungs-Toolbar
   - Rich-Text Formatierungskommandos
   - Status-Tracking von Formatierungen
   - Keyboard-Shortcuts Integration

4. **`useCollaborationPersistence.tsx`** - Persistierung Hook
   - Automatisches Speichern nach Supabase
   - Dokument-Snapshots
   - Debounced Updates

### Plugin-Integration

```typescript
// Konfiguration in LexicalEditor.tsx
const initialConfig = {
  namespace: 'KnowledgeBaseEditor',
  theme,
  onError,
  nodes: [
    HeadingNode,      // H1-H6 Headlines
    QuoteNode,        // Blockquotes  
    ListNode,         // Ordered/Unordered Lists
    ListItemNode,     // List Items
    CodeNode,         // Code Blocks
    LinkNode,         // Links
    AutoLinkNode,     // Auto-detected Links
    // ... weitere Nodes
  ],
};
```

## 🌐 WebSocket-Konfiguration

Die Kollaboration nutzt WebSockets für Echtzeitkommunikation:

```typescript
// In CollaborationContext.tsx
const getWebSocketUrl = () => {
  const isDev = window.location.hostname === 'localhost';
  if (isDev) {
    return 'ws://localhost:54321/functions/v1/yjs-collaboration';
  }
  return 'wss://[your-domain]/functions/v1/yjs-collaboration';
};
```

## 🎨 Styling & Theming

Die Editor-Styles sind in `src/components/lexical/lexical-editor.css` definiert:

- Responsive Design mit Tailwind CSS
- Dark/Light Mode Unterstützung
- Konsistente Typographie
- Kollaborations-Cursor Styling
- Toolbar Animations

## 📋 Demo & Testen

Ein vollständiges Demo ist unter `/lexical-demo` verfügbar:

```bash
npm run dev
# Navigieren zu http://localhost:8080/lexical-demo
```

### Demo-Features

- Verschiedene Dokument-IDs testen
- Kollaboration ein-/ausschalten
- Vordefinierte Demo-Dokumente
- Live-Status-Anzeige
- Feature-Übersicht

## 🔄 Kollaborations-Workflow

1. **Initialisierung**
   ```typescript
   // Yjs Document erstellen
   const yDoc = new Y.Doc();
   
   // WebSocket Provider setup
   const provider = new WebsocketProvider(wsUrl, roomId, yDoc);
   ```

2. **Lexical Integration**
   ```typescript
   // CollaborationPlugin verbindet Lexical mit Yjs
   <CollaborationPlugin
     id={documentId}
     providerFactory={providerFactory}
     shouldBootstrap={true}
   />
   ```

3. **Benutzer-Awareness**
   ```typescript
   // Lokaler Benutzer-State
   provider.awareness.setLocalStateField('user', {
     name: user.name,
     color: user.color,
     avatar: user.avatar
   });
   ```

4. **Persistierung**
   ```typescript
   // Auto-save nach Supabase
   yDoc.on('update', debounceUpdate => {
     saveToSupabase(Y.encodeStateAsUpdate(yDoc));
   });
   ```

## 🚧 Erweiterte Features

### Zusätzliche Plugins integrieren

```typescript
// Beispiel: Tabellen-Support hinzufügen
import { TablePlugin } from '@lexical/table';

// In nodes array:
nodes: [...existingNodes, TableNode, TableRowNode, TableCellNode]

// Als Plugin:
<TablePlugin />
```

### Custom Toolbar-Actions

```typescript
// In ToolbarPlugin.tsx erweitern
case 'custom-action':
  editor.update(() => {
    // Custom Lexical Commands
  });
  break;
```

### Erweiterte Persistierung

```typescript
// Manuelle Snapshots
const { saveManual } = useCollaborationPersistence({
  documentId,
  yDoc,
  enableCollaboration: true
});

// Button für manuelles Speichern
<button onClick={saveManual}>Snapshot erstellen</button>
```

## 🔍 Debugging

```typescript
// Kollaborations-Status debuggen
console.log('Collaboration State:', {
  hasYDoc: !!yDoc,
  hasProvider: !!provider,
  isConnected,
  userCount: users.length,
  documentId
});
```

## 📚 Weitere Ressourcen

- [Lexical Documentation](https://lexical.dev/)
- [Yjs Documentation](https://docs.yjs.dev/)
- [Lexical Playground](https://playground.lexical.dev/)
- [Y-WebSocket Provider](https://github.com/yjs/y-websocket)

---

Die Integration ist **produktionsreif** und wird bereits im KnowledgeBaseView verwendet. Für weitere Fragen oder Erweiterungen siehe die Demo-Seite unter `/lexical-demo`.