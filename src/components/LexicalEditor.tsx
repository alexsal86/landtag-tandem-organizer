import React, { useEffect, useState } from 'react';
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
import LexicalToolbar from './LexicalToolbar';
import CollaborationStatus from './CollaborationStatus';
import './LexicalEditor.css';
import { useCollaborationEditor } from '@/hooks/useCollaborationEditor';
import {
  loadSnapshots,
  saveSnapshot,
  decodeUpdateFromBase64,
  encodeStateAsBase64,
  type SnapshotMeta,
} from '../utils/yjsPersistence';

/**
 * Lexical editor with Yjs collaboration integration via CollaborationContext
 * Features: Rich text editing, real-time collaboration, user awareness, persistence, snapshots
 */

interface CollaborationUser {
  id: string;
  name?: string;
  color?: string;
  avatar?: string;
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
  console.error('Lexical Editor Error:', error);
}

const LexicalEditor: React.FC<LexicalEditorProps> = ({
  initialContent,
  onChange,
  placeholder = 'Schreiben...',
  showToolbar = true,
  onExportJSON,
  enableCollaboration = false,
  documentId,
}) => {
  // State for snapshots functionality
  const [snapshots, setSnapshots] = useState<SnapshotMeta[]>([]);
  const [restoringSnapshotId, setRestoringSnapshotId] = useState<string | null>(null);

  // Use collaboration hook for integration with CollaborationContext
  const {
    yDoc,
    provider,
    isConnected,
    users,
    currentUser,
    isReady
  } = useCollaborationEditor({
    documentId,
    enableCollaboration
  });

  const collabActive = enableCollaboration && !!documentId && !!yDoc && !!provider;

  // Load snapshots when collaboration is active
  useEffect(() => {
    if (collabActive && documentId) {
      setSnapshots(loadSnapshots(documentId));
    } else {
      setSnapshots([]);
    }
  }, [collabActive, documentId]);

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
        connected: isConnected,
        ready: isReady,
        snapshots: snapshots.length,
        version: '2.0',
      },
      null,
      2
    );
    onExportJSON(jsonData);
  };

  function createSnapshot(note?: string) {
    if (!collabActive || !yDoc || !documentId) return;
    const meta: SnapshotMeta = saveSnapshot(documentId, encodeStateAsBase64(yDoc), note);
    setSnapshots((prev) => [meta, ...prev]);
  }

  function restoreSnapshot(id: string) {
    if (!collabActive || !yDoc || !documentId) return;
    const snap = snapshots.find((s) => s.id === id);
    if (!snap) return;
    setRestoringSnapshotId(id);
    try {
      const update = decodeUpdateFromBase64(snap.updateBase64);
      // Apply snapshot to the Y.Doc using Y.js methods
      yDoc.transact(() => {
        // Create a temporary doc with the snapshot state
        const temp = new Y.Doc();
        Y.applyUpdate(temp, update);
        // Get the full state and apply it to current doc
        const fullUpdate = Y.encodeStateAsUpdate(temp);
        Y.applyUpdate(yDoc, fullUpdate);
      });
    } catch (error) {
      console.error('Error restoring snapshot:', error);
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
            
            {/* Collaboration Status */}
            {collabActive && (
              <CollaborationStatus
                isConnected={isConnected}
                users={users}
                currentUser={currentUser}
              />
            )}
            
            {/* Snapshots Controls */}
            {collabActive && (
              <>
                <div className="toolbar-divider"></div>
                <button
                  type="button"
                  className="toolbar-button"
                  onClick={() => createSnapshot()}
                  title="Snapshot speichern"
                  disabled={!isReady}
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
                    disabled={!isReady}
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
            
            {/* Export Controls */}
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
        
        {/* Initial Content Plugin */}
        <InitialContentPlugin initialContent={initialContent} />

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

        {/* OnChange Plugin for non-collaborative mode */}
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

        {/* Status Messages */}
        {collabActive && !isReady && (
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
