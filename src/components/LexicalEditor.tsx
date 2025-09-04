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

/**
 * Fresh minimal Lexical editor with OPTIONAL Yjs collaboration.
 * - If enableCollaboration && documentId are provided, a Y.Doc + WebsocketProvider are created.
 * - Falls back to single-user mode otherwise.
 * - Keeps previous lightweight behavior (initialContent, onChange, JSON export).
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
  /** Enable realtime collaboration (Yjs) */
  enableCollaboration?: boolean;
  /** Shared document identifier (room) */
  documentId?: string;
  /** Local user metadata for awareness */
  user?: CollaborationUser;
  /** Custom websocket URL (optional override) */
  websocketUrl?: string;
}

// Very small placeholder component
const Placeholder: React.FC<{ text: string }> = ({ text }) => (
  <div className="lexical-placeholder">{text}</div>
);

// Plugin to set initial content exactly once after mount (if editor is empty)
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
  // Minimal surfacing
  // eslint-disable-next-line no-console
  console.error(error);
}

// Default WS URL logic (mirrors docs pattern)
function getDefaultWebSocketUrl() {
  if (typeof window === 'undefined') return '';
  const isDev = window.location.hostname === 'localhost';
  return isDev
    ? 'ws://localhost:54321/functions/v1/yjs-collaboration'
    : 'wss://YOUR-PROD-DOMAIN/functions/v1/yjs-collaboration';
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

  // Yjs refs
  const yDocRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<WebsocketProvider | null>(null);

  const collabActive = enableCollaboration && !!documentId;

  // Setup / teardown of collaboration
  useEffect(() => {
    if (!collabActive) {
      // Cleanup if previously active
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
      return;
    }

    // Create Y.Doc & Provider
    const ydoc = new Y.Doc();
    yDocRef.current = ydoc;

    const url = websocketUrl || getDefaultWebSocketUrl();
    const provider = new WebsocketProvider(url, documentId!, ydoc, { connect: true });
    providerRef.current = provider;

    // Awareness (local user)
    provider.awareness.setLocalStateField('user', {
      name: user?.name || 'Anonymous',
      color: user?.color || '#558b2f',
      avatar: user?.avatarUrl || null,
    });

    const statusHandler = (event: { status: string }) => {
      setIsConnected(event.status === 'connected');
    };
    provider.on('status', statusHandler);

    // y-websocket sets synced flag when initial state exchange done
    provider.once('sync', () => setHasSynced(true));

    return () => {
      provider.off('status', statusHandler);
      // small delay avoids race if immediately remounting with new documentId
      setTimeout(() => {
        provider.destroy();
        ydoc.destroy();
        providerRef.current = null;
        yDocRef.current = null;
      }, 100);
    };
  }, [collabActive, documentId, user, websocketUrl]);

  const initialConfig = {
    namespace: 'FreshLexicalEditor',
    theme: {}, // keep minimal styling
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
        contentNote: 'For real content serialization integrate $generateJSONFromEditor (not included in this minimal setup).',
        version: '1.1',
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
                {collabActive ? (isConnected ? '🔌 Online' : '⚠ Offline') : null}
              </span>
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

        {collabActive && providerRef.current ? (
          <CollaborationPlugin
            id={documentId!}
            providerFactory={() => providerRef.current as WebsocketProvider}
            shouldBootstrap={true}
          />
        ) : (
          <InitialContentPlugin initialContent={initialContent} />
        )}

        {/* OnChange only in non-collab mode OR if caller explicitly wants plain text (we keep it simple here) */}
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
      </div>
    </LexicalComposer>
  );
};

export default LexicalEditor;