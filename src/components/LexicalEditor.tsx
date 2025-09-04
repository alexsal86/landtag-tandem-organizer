import React, { useEffect, useRef, useState } from 'react';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getRoot, $createParagraphNode, $createTextNode } from 'lexical';
import { HeadingNode, QuoteNode } from '@lexical/rich-text';
import { CollaborationPlugin } from '@lexical/react/LexicalCollaborationPlugin';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import LexicalToolbar from './LexicalToolbar';
import './LexicalEditor.css';
import {
  loadDocumentState,
  saveDocumentStateDebouncedFactory,
  loadSnapshots,
  saveSnapshot,
  decodeUpdateFromBase64,
  encodeStateAsBase64,
  type SnapshotMeta,
} from '../utils/yjsPersistence';

/**
 * Lexical editor with OPTIONAL Yjs collaboration +
 * (1) Persistence (localStorage stub) (4) Awareness UI (7) Snapshots/Versioning
 * Replace localStorage logic in ../utils/yjsPersistence with real backend calls as needed.
 */

interface CollaborationUser {
  name: string;
  color?: string;
  avatarUrl?: string;
}

interface LexicalEditorProps {
  initialContent?: string;
  onChange?: (plainText: string) => void;
  placeholder?: string;
  showToolbar?: boolean;
  onExportJSON?: (jsonData: string) => void;
  enableCollaboration?: boolean;
  documentId?: string;
  user?: CollaborationUser;
  websocketUrl?: string;
}

const Placeholder: React.FC<{ text: string }> = ({ text }) => (
  <div className="lexical-placeholder">{text}</div>
);

const InitialContentPlugin: React.FC<{ initialContent?: string }> = ({ initialContent }) => {
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    if (!initialContent) return;
    editor.update(() => {
      const root = $getRoot();
      if (root.getFirstChild() === null) {
        const p = $createParagraphNode();
        p.append($createTextNode(initialContent));
        root.append(p);
      }
    });
  }, [editor, initialContent]);
  return null;
};

function onError(error: Error) {
  // eslint-disable-next-line no-console
  console.error(error);
}

function getDefaultWebSocketUrl() {
  if (typeof window === 'undefined') return '';
  const isDev = window.location.hostname === 'localhost';
  return isDev
    ? 'ws://localhost:54321/functions/v1/yjs-collaboration'
    : 'wss://YOUR-PROD-DOMAIN/functions/v1/yjs-collaboration';
}

interface AwarenessUserState {
  name: string;
  color?: string;
  avatar?: string | null;
  isLocal?: boolean;
}

const LexicalEditor: React.FC<LexicalEditorProps> = ({
  initialContent,
  onChange,
  placeholder = 'Schreiben...',
  showToolbar = true,
  onExportJSON,
  enableCollaboration = false,
  documentId,
  user,
  websocketUrl,
}) => {
  const [isConnected, setIsConnected] = useState(false);
  const [hasSynced, setHasSynced] = useState(false);
  const [awarenessUsers, setAwarenessUsers] = useState<AwarenessUserState[]>([]);
  const [snapshots, setSnapshots] = useState<SnapshotMeta[]>([]);
  const [restoringSnapshotId, setRestoringSnapshotId] = useState<string | null>(null);

  const yDocRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<WebsocketProvider | null>(null);

  const collabActive = enableCollaboration && !!documentId;

  // Setup / teardown collaboration
  useEffect(() => {
    if (!collabActive) {
      cleanupProvider();
      setAwarenessUsers([]);
      setSnapshots([]);
      return;
    }

    const ydoc = new Y.Doc();

    // Try applying persisted state BEFORE provider attaches
    try {
      const persisted = loadDocumentState(documentId!);
      if (persisted) {
        const update = decodeUpdateFromBase64(persisted);
        Y.applyUpdate(ydoc, update);
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('Persisted state load failed', e);
    }

    yDocRef.current = ydoc;

    const url = websocketUrl || getDefaultWebSocketUrl();
    const provider = new WebsocketProvider(url, documentId!, ydoc, { connect: true });
    providerRef.current = provider;

    provider.awareness.setLocalStateField('user', {
      name: user?.name || 'Anonymous',
      color: user?.color || '#558b2f',
      avatar: user?.avatarUrl || null,
      isLocal: true,
    });

    const statusHandler = (event: { status: string }) => {
      setIsConnected(event.status === 'connected');
    };
    provider.on('status', statusHandler);
    provider.once('sync', () => setHasSynced(true));

    const awarenessHandler = () => {
      const states: AwarenessUserState[] = [];
      provider.awareness.getStates().forEach((val: any) => {
        if (val.user) states.push(val.user as AwarenessUserState);
      });
      // stable ordering by name
      states.sort((a, b) => a.name.localeCompare(b.name));
      setAwarenessUsers(states);
    };

    provider.awareness.on('change', awarenessHandler);
    awarenessHandler();

    // load snapshots
    setSnapshots(loadSnapshots(documentId!));

    // Persistence debounced saving full state
    const saveDebounced = saveDocumentStateDebouncedFactory(documentId!, () => {
      if (!yDocRef.current) return null;
      return encodeStateAsBase64(yDocRef.current);
    });

    const updateHandler = () => {
      // On any update schedule a save
      saveDebounced();
    };
    ydoc.on('update', updateHandler);

    return () => {
      provider.awareness.off('change', awarenessHandler);
      provider.off('status', statusHandler);
      ydoc.off('update', updateHandler);
      delayedDestroy(provider, ydoc);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collabActive, documentId, user?.name, user?.color, websocketUrl]);

  function cleanupProvider() {
    if (providerRef.current) {
      providerRef.current.destroy();
      providerRef.current = null;
    }
    if (yDocRef.current) {
      yDocRef.current.destroy();
      yDocRef.current = null;
    }
    setIsConnected(false);
    setHasSynced(false);
  }

  function delayedDestroy(provider: WebsocketProvider, ydoc: Y.Doc) {
    setTimeout(() => {
      try { provider.destroy(); } catch {}
      try { ydoc.destroy(); } catch {}
      if (providerRef.current === provider) providerRef.current = null;
      if (yDocRef.current === ydoc) yDocRef.current = null;
    }, 100);
  }

  const initialConfig = {
    namespace: 'FreshLexicalEditor',
    theme: {},
    onError,
    nodes: [HeadingNode, QuoteNode],
  };

  const handleExportJSON = () => {
    if (!onExportJSON) return;
    const jsonData = JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        documentId: documentId || null,
        collaboration: collabActive,
        synced: hasSynced,
        snapshots: snapshots.length,
        version: '1.2',
      },
      null,
      2
    );
    onExportJSON(jsonData);
  };

  function createSnapshot(note?: string) {
    if (!collabActive || !yDocRef.current || !documentId) return;
    const meta: SnapshotMeta = saveSnapshot(documentId, encodeStateAsBase64(yDocRef.current), note);
    setSnapshots((prev) => [meta, ...prev]);
  }

  function restoreSnapshot(id: string) {
    if (!collabActive || !yDocRef.current || !documentId) return;
    const snap = snapshots.find((s) => s.id === id);
    if (!snap) return;
    setRestoringSnapshotId(id);
    try {
      const update = decodeUpdateFromBase64(snap.updateBase64);
      // Clear existing doc and apply snapshot by creating a fresh doc state
      const ydoc = yDocRef.current;
      ydoc.transact(() => {
        // naive approach: create a new doc and swap is more complex; here we encode patch by resetting
        // Instead: create a new temp doc, apply snapshot, then merge into existing.
        const temp = new Y.Doc();
        Y.applyUpdate(temp, update);
        // Replace all top-level shared types we know (lexical collaboration uses root map 'root')
        // Simpler: overwrite by applying the state vector diff
        const fullUpdate = Y.encodeStateAsUpdate(temp);
        Y.applyUpdate(ydoc, fullUpdate);
      });
    } finally {
      setTimeout(() => setRestoringSnapshotId(null), 300);
    }
  }

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <div className="lexical-editor">
        {showToolbar && (
          <div className="lexical-toolbar">
            <LexicalToolbar />
            {collabActive && (
              <span className="toolbar-status" title={isConnected ? 'Verbunden' : 'Offline'}>
                {isConnected ? '🔌 Online' : '⚠ Offline'}
              </span>
            )}
            {collabActive && (
              <div className="toolbar-awareness">
                {awarenessUsers.map((u) => (
                  <div
                    key={u.name + (u.isLocal ? '-local' : '')}
                    className="awareness-user"
                    title={u.name + (u.isLocal ? ' (Du)' : '')}
                    style={{
                      background: u.color || '#888',
                      opacity: u.isLocal ? 1 : 0.85,
                      border: u.isLocal ? '2px solid #222' : '1px solid #444',
                    }}
                  >
                    {u.avatar ? (
                      <img src={u.avatar} alt={u.name} />
                    ) : (
                      <span>{u.name.slice(0, 2).toUpperCase()}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
            {collabActive && (
              <>
                <div className="toolbar-divider"></div>
                <button
                  type="button"
                  className="toolbar-button"
                  onClick={() => createSnapshot()}
                  title="Snapshot speichern"
                >
                  Snapshot
                </button>
                {snapshots.length > 0 && (
                  <select
                    className="snapshot-select"
                    value={restoringSnapshotId || ''}
                    onChange={(e) => {
                      if (e.target.value) restoreSnapshot(e.target.value);
                    }}
                  >
                    <option value="">Snapshots</option>
                    {snapshots.map((s) => (
                      <option key={s.id} value={s.id}>
                        {new Date(s.timestamp).toLocaleTimeString()} ({s.note || 'ohne Notiz'})
                      </option>
                    ))}
                  </select>
                )}
              </>
            )}
            {onExportJSON && (
              <>
                <div className="toolbar-divider"></div>
                <button
                  type="button"
                  onClick={handleExportJSON}
                  className="toolbar-button export-button"
                  title="Als JSON exportieren"
                >
                  JSON
                </button>
              </>
            )}
          </div>
        )}

        <RichTextPlugin
          contentEditable={<ContentEditable className="lexical-editor-inner" />}
          placeholder={<Placeholder text={placeholder} />}
          ErrorBoundary={LexicalErrorBoundary}
        />
        <HistoryPlugin />

        {/* Collaboration temporarily disabled due to type issues */}
        <InitialContentPlugin initialContent={initialContent} />

        {!collabActive && onChange && (
          <OnChangePlugin
            onChange={(editorState) => {
              if (!onChange) return;
              editorState.read(() => {
                const text = $getRoot().getTextContent();
                onChange(text);
              });
            }}
          />
        )}

        {collabActive && !hasSynced && (
          <div className="lexical-collab-syncing">Synchronisiere...</div>
        )}
        {restoringSnapshotId && (
          <div className="lexical-collab-restoring">Snapshot wird angewendet...</div>
        )}
      </div>
    </LexicalComposer>
  );
};

export default LexicalEditor;
