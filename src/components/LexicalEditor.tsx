import React, { useCallback, useEffect, useRef, useState } from 'react';
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
 * Lexical editor with OPTIONAL Yjs collaboration.
 * Variant B: Uses providerFactory + CollaborationPlugin (no external custom hook needed).
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

  // Cleanup helper
  function cleanupProvider() {
    if (providerRef.current) {
      try { providerRef.current.destroy(); } catch {}
      providerRef.current = null;
    }
    if (yDocRef.current) {
      try { yDocRef.current.destroy(); } catch {}
      yDocRef.current = null;
    }
    setIsConnected(false);
    setHasSynced(false);
    setAwarenessUsers([]);
  }

  // Provider Factory (Variant B)
  const providerFactory = useCallback(
    (id: string, yjsDocMap: Map<string, Y.Doc>) => {
      let doc = yjsDocMap.get(id);
      if (!doc) {
        doc = new Y.Doc();
        yjsDocMap.set(id, doc);
        // Apply persisted state if present
        try {
          const persisted = loadDocumentState(id);
          if (persisted) {
            const update = decodeUpdateFromBase64(persisted);
            Y.applyUpdate(doc, update);
          }
        } catch (e) {
          // eslint-disable-next-line no-console
            console.warn('Persisted state load failed', e);
        }
      }

      const url = websocketUrl || getDefaultWebSocketUrl();
      const provider = new WebsocketProvider(url, id, doc, { connect: true });

      provider.awareness.setLocalStateField('user', {
        name: user?.name || 'Anonymous',
        color: user?.color || '#558b2f',
        avatar: user?.avatarUrl || null,
        isLocal: true,
      });

      providerRef.current = provider;
      yDocRef.current = doc;

      const saveDebounced = saveDocumentStateDebouncedFactory(id, () => {
        if (!yDocRef.current) return null;
        return encodeStateAsBase64(yDocRef.current);
      });
      const updateHandler = () => saveDebounced();
      doc.on('update', updateHandler);

      provider.once('destroy', () => {
        try { doc.off('update', updateHandler); } catch {}
      });

      if (snapshots.length === 0) {
        setSnapshots(loadSnapshots(id));
      }

      return provider;
    },
    [websocketUrl, user?.name, user?.color, user?.avatarUrl, snapshots.length]
  );

  // Effect for awareness + status reflecting providerRef after plugin mount
  useEffect(() => {
    if (!collabActive || !documentId) {
      cleanupProvider();
      return;
    }
    const provider = providerRef.current;
    if (!provider) return; // Will run again after provider is set

    const statusHandler = (event: { status: string }) => setIsConnected(event.status === 'connected');
    const syncHandler = () => setHasSynced(true);
    const awarenessHandler = () => {
      const states: AwarenessUserState[] = [];
      provider.awareness.getStates().forEach((val: any) => {
        if (val.user) states.push(val.user as AwarenessUserState);
      });
      states.sort((a, b) => a.name.localeCompare(b.name));
      setAwarenessUsers(states);
    };

    provider.on('status', statusHandler);
    provider.once('sync', syncHandler);
    provider.awareness.on('change', awarenessHandler);
    awarenessHandler();

    return () => {
      try {
        provider.awareness.off('change', awarenessHandler);
        provider.off('status', statusHandler);
      } catch {}
    };
  }, [collabActive, documentId]);

  // Snapshot create
  function createSnapshot(note?: string) {
    if (!collabActive || !yDocRef.current || !documentId) return;
    const meta: SnapshotMeta = saveSnapshot(documentId, encodeStateAsBase64(yDocRef.current), note);
    setSnapshots((prev) => [meta, ...prev]);
  }

  // Snapshot restore
  function restoreSnapshot(id: string) {
    if (!collabActive || !yDocRef.current || !documentId) return;
    const snap = snapshots.find((s) => s.id === id);
    if (!snap) return;
    setRestoringSnapshotId(id);
    try {
      const update = decodeUpdateFromBase64(snap.updateBase64);
      const ydoc = yDocRef.current;
      ydoc?.transact(() => {
        const temp = new Y.Doc();
        Y.applyUpdate(temp, update);
        const fullUpdate = Y.encodeStateAsUpdate(temp);
        if (ydoc) {
          Y.applyUpdate(ydoc, fullUpdate);
        }
      });
    } finally {
      setTimeout(() => setRestoringSnapshotId(null), 300);
    }
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
        version: '1.3',
      },
      null,
      2
    );
    onExportJSON(jsonData);
  };

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

        {!collabActive && <InitialContentPlugin initialContent={initialContent} />}

        {collabActive && documentId && (
          <CollaborationPlugin
            id={documentId}
            providerFactory={providerFactory}
            shouldBootstrap={true}
            username={user?.name || 'Anonymous'}
          />
        )}

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