import React, { useState, useEffect, useCallback, useContext, useMemo } from 'react';
import { $getRoot, $createParagraphNode, $createTextNode } from 'lexical';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin';
import { CollaborationPlugin } from '@lexical/react/LexicalCollaborationPlugin';
import { HeadingNode, QuoteNode } from '@lexical/rich-text';
import { ListNode, ListItemNode } from '@lexical/list';
import { CodeNode, CodeHighlightNode } from '@lexical/code';
import { LinkNode, AutoLinkNode } from '@lexical/link';
import * as Y from 'yjs';
import { CollaborationContext } from '@/contexts/CollaborationContext';
import { useCollaborationPersistence } from '@/hooks/useCollaborationPersistence';
import ToolbarPlugin from './lexical/ToolbarPlugin';
import FloatingTextToolbar from './FloatingTextToolbar';
import CollaborationStatus from './CollaborationStatus';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { debounce } from '@/utils/debounce';

const theme = {
  ltr: 'ltr',
  rtl: 'rtl',
  placeholder: 'editor-placeholder',
  paragraph: 'editor-paragraph',
};

function onError(error: Error) {
  console.error(error);
}

interface LexicalEditorProps {
  initialContent?: string;
  onChange?: (content: string) => void;
  placeholder?: string;
  showToolbar?: boolean;
  documentId?: string;
  enableCollaboration?: boolean;
}

function DebouncedOnChangePlugin({ onChange }: { onChange?: (content: string) => void }) {
  const debounced = useMemo(
    () =>
      debounce((content: string) => {
        onChange?.(content);
      }, 300),
    [onChange]
  );

  return (
    <OnChangePlugin
      onChange={(editorState) => {
        if (!onChange) return;
        editorState.read(() => {
          const root = $getRoot();
          const content = root.getTextContent();
            debounced(content);
        });
      }}
    />
  );
}

const LexicalEditor: React.FC<LexicalEditorProps> = ({
  initialContent = '',
  onChange,
  placeholder = 'Beginnen Sie zu schreiben...',
  showToolbar = true,
  documentId,
  enableCollaboration = false,
}) => {
  const [activeFormats, setActiveFormats] = useState<string[]>([]);
  const [formatCommand, setFormatCommand] = useState<string>('');

  const collaborationContext = useContext(CollaborationContext);

  const {
    yDoc = null,
    provider = null,
    isConnected = false,
    users: collaborationUsers = [],
    currentUser = null,
    initializeCollaboration = () => {},
    destroyCollaboration = () => {},
    isReady = false,
  } = collaborationContext || {};

  const collaborationAvailable = enableCollaboration && !!collaborationContext && !!documentId;

  useEffect(() => {
    if (enableCollaboration && !collaborationContext) {
      console.warn('Kollaboration nicht verfügbar – Fallback auf Single-User-Modus.');
    }
  }, [enableCollaboration, collaborationContext]);

  const handleFormatText = (format: string) => {
    setFormatCommand(format);
    setTimeout(() => setFormatCommand(''), 10);
  };

  const { saveManual, loadDocumentState } = useCollaborationPersistence({
    documentId: documentId || undefined,
    yDoc,
    enableCollaboration: collaborationAvailable,
    debounceMs: 2000,
  });

  useEffect(() => {
    if (collaborationAvailable && documentId) {
      initializeCollaboration(documentId);
      const timeout = setTimeout(() => {
        if (!isConnected) {
          console.warn('[LexicalEditor] Noch keine Verbindung nach 10s – arbeite weiter (degraded).');
        }
      }, 10000);
      return () => {
        clearTimeout(timeout);
        destroyCollaboration();
      };
    } else {
      destroyCollaboration();
    }
  }, [
    collaborationAvailable,
    documentId,
    initializeCollaboration,
    destroyCollaboration,
    isConnected,
  ]);

  useEffect(() => {
    if (yDoc && documentId && collaborationAvailable && isReady) {
      loadDocumentState(yDoc).catch((err) =>
        console.error('Fehler beim Laden des Dokumentzustands:', err)
      );
    }
  }, [yDoc, documentId, collaborationAvailable, isReady, loadDocumentState]);

  const providerFactory = useCallback(
    (id: string, yjsDocMap: Map<string, Y.Doc>) => {
      if (provider && yDoc) {
        if (!yjsDocMap.has(id)) {
          yjsDocMap.set(id, yDoc);
        }
        return provider;
      }
      return {
        disconnect: () => {},
        awareness: null,
        ws: null,
        on: () => {},
        off: () => {},
        destroy: () => {},
      };
    },
    [provider, yDoc]
  );

  const initialConfig = {
    namespace: 'KnowledgeBaseEditor',
    theme,
    onError,
    nodes: [
      HeadingNode,
      QuoteNode,
      ListNode,
      ListItemNode,
      CodeNode,
      CodeHighlightNode,
      LinkNode,
      AutoLinkNode,
    ],
    editorState: () => {
      const root = $getRoot();
      if (root.getFirstChild() === null && initialContent) {
        const paragraph = $createParagraphNode();
        paragraph.append($createTextNode(initialContent));
        root.append(paragraph);
      }
    },
  };

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <div className="editor-container">
        {showToolbar && (
          <FloatingTextToolbar
            onFormatText={handleFormatText}
            activeFormats={activeFormats}
          />
        )}

        {collaborationAvailable && (
          <div className="p-3 border-b border-border bg-muted/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <CollaborationStatus
                  isConnected={isConnected}
                  users={collaborationUsers}
                  currentUser={currentUser || undefined}
                />
                {!isConnected && (
                  <div className="text-sm text-muted-foreground">
                    Verbindung wird hergestellt...
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={saveManual}
                  className="px-3 py-1 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90"
                  disabled={!yDoc}
                >
                  Snapshot speichern
                </button>
                <div className="text-xs text-muted-foreground">
                  {yDoc
                    ? isConnected
                      ? 'Kollaboration aktiv'
                      : 'Warten auf Verbindung...'
                    : 'Lade...'}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="editor-inner">
          <RichTextPlugin
            contentEditable={<ContentEditable className="editor-input" />}
            placeholder={<div className="editor-placeholder">{placeholder}</div>}
            ErrorBoundary={LexicalErrorBoundary}
          />
          <ListPlugin />
            <LinkPlugin />
            {collaborationAvailable && provider && yDoc && (
              <CollaborationPlugin
                id="lexical-editor"
                providerFactory={providerFactory}
                shouldBootstrap={true}
              />
            )}
            {!collaborationAvailable && <HistoryPlugin />}
            <ToolbarPlugin
              onFormatChange={setActiveFormats}
              formatCommand={formatCommand}
            />
            <DebouncedOnChangePlugin onChange={onChange} />
          </div>
        </div>
      </LexicalComposer>
  );
};

export default LexicalEditor;