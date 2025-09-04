# LexicalEditor Collaboration Refactoring

## Overview

This document describes the refactoring of the LexicalEditor component to re-enable and improve the Lexical collaboration plugin integration.

## Key Changes

### 1. Re-enabled CollaborationPlugin

**Before:**
```tsx
{/* Collaboration temporarily disabled due to type issues */}
<InitialContentPlugin initialContent={initialContent} />
```

**After:**
```tsx
{/* Collaboration Plugin - Re-enabled with proper integration */}
{collabActive && yDoc && provider && (
  <CollaborationPlugin
    id={`collaboration-${documentId}`}
    providerFactory={(id, yjsDocMap) => {
      const doc = yjsDocMap.get(id);
      if (doc !== yDoc) {
        yjsDocMap.set(id, yDoc);
      }
      return provider;
    }}
    shouldBootstrap={true}
  />
)}
```

### 2. New Custom Hook: `useCollaborationEditor`

Created a dedicated hook to integrate the LexicalEditor with the existing CollaborationContext:

```tsx
export const useCollaborationEditor = ({
  documentId,
  enableCollaboration = false
}: UseCollaborationEditorProps): UseCollaborationEditorReturn => {
  const context = useContext(CollaborationContext);
  
  // Set up persistence
  useCollaborationPersistence({
    documentId,
    yDoc,
    enableCollaboration,
    debounceMs: 3000
  });

  // Initialize collaboration when documentId and enableCollaboration are set
  useEffect(() => {
    if (enableCollaboration && documentId) {
      initializeCollaboration(documentId);
      
      return () => {
        // Add delay to prevent race conditions
        setTimeout(() => {
          destroyCollaboration();
        }, 100);
      };
    } else {
      // Cleanup if collaboration not available
      destroyCollaboration();
    }
  }, [enableCollaboration, documentId, initializeCollaboration, destroyCollaboration]);

  return {
    yDoc,
    provider,
    isConnected,
    users,
    currentUser,
    isReady,
    initializeCollaboration,
    destroyCollaboration
  };
};
```

### 3. Simplified Component Logic

**Removed:**
- Manual Y.Doc and WebsocketProvider setup
- Custom WebSocket URL management
- Manual awareness handling
- Direct event listener management
- `websocketUrl` prop (now handled by context)

**Improved:**
- Better TypeScript types (no more `any` types)
- Separation of concerns
- Cleaner state management
- Integration with CollaborationStatus component

### 4. Enhanced User Interface

**Before:**
```tsx
<span className="toolbar-status" title={isConnected ? 'Verbunden' : 'Offline'}>
  {isConnected ? '🔌 Online' : '⚠ Offline'}
</span>
<div className="toolbar-awareness">
  {awarenessUsers.map((u) => (
    <div key={u.name + (u.isLocal ? '-local' : '')} className="awareness-user">
      {/* Manual user display */}
    </div>
  ))}
</div>
```

**After:**
```tsx
<CollaborationStatus
  isConnected={isConnected}
  users={users}
  currentUser={currentUser}
/>
```

### 5. Improved Error Handling

- Better error boundaries for collaboration features
- More robust snapshot restoration
- Enhanced connection state management

## Benefits

### ✅ **Primary Goal Achieved**
- **Collaboration is now properly enabled** using the official CollaborationPlugin

### ✅ **Architecture Improvements**
- Better separation of concerns with context-based architecture
- Improved maintainability through custom hooks
- Consistent with React patterns and best practices

### ✅ **Code Quality**
- Improved TypeScript types and removed `any` types
- Cleaner component logic with less manual setup
- Better error handling and cleanup

### ✅ **User Experience**
- Leverages existing CollaborationContext improvements
- More robust connection handling
- Enhanced user awareness display

## Testing

The refactored component includes comprehensive tests covering:

1. **Basic functionality** (rendering, placeholders, toolbar)
2. **Collaboration features** (status display, snapshot controls)
3. **State management** (collaboration enabled/disabled states)
4. **User interactions** (onChange behavior based on collaboration state)
5. **Export functionality** (updated JSON schema)

## Integration Points

### CollaborationContext
- Uses existing context for Y.Doc and WebSocket provider management
- Leverages improved cleanup mechanisms and connection pooling
- Benefits from anonymous user management

### CollaborationPersistence
- Integrates with `useCollaborationPersistence` hook
- Automatic document state saving to database
- Debounced updates for performance

### CollaborationStatus Component
- Displays connection status and online users
- Shows user avatars and colors
- Provides better visual feedback

## Migration Guide

### For Existing Usage

No breaking changes for basic usage:
```tsx
<LexicalEditor
  initialContent="Hello world"
  placeholder="Type here..."
  showToolbar={true}
  onChange={(text) => console.log(text)}
/>
```

### For Collaboration Usage

Remove `websocketUrl` prop (now managed by context):
```tsx
// Before
<LexicalEditor
  enableCollaboration={true}
  documentId="doc-123"
  websocketUrl="ws://localhost:54321/functions/v1/yjs-collaboration"
  user={{ name: "John", color: "#ff0000" }}
/>

// After
<LexicalEditor
  enableCollaboration={true}
  documentId="doc-123"
  // user info now comes from CollaborationContext
/>
```

### Required Setup

Ensure CollaborationProvider is wrapped around your app (already done):
```tsx
<CollaborationProvider>
  <App />
</CollaborationProvider>
```

## Future Improvements

1. **Enhanced Snapshot Management**: More sophisticated snapshot merging and conflict resolution
2. **Performance Optimization**: Further optimize Y.js updates and rendering
3. **Real-time Cursors**: Add cursor position sharing between users
4. **Presence Indicators**: Show user activity and typing indicators
5. **Permission System**: Add document-level permissions for collaboration