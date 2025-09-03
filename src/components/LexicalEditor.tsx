import React, { useState, useEffect, useCallback, useContext } from 'react';
import { $getRoot } from 'lexical';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin';
import { CollaborationPlugin } from '@lexical/react/LexicalCollaborationPlugin';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $createParagraphNode, $createTextNode } from 'lexical';
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
import { AlertTriangle } from 'lucide-react';

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

function MyOnChangePlugin({ onChange }: { onChange?: (content: string) => void }) {
  const [editor] = useLexicalComposerContext();
  return (
    <OnChangePlugin
      onChange={(editorState) => {
        editorState.read(() => {
          const root = $getRoot();
          const content = root.getTextContent();
          onChange?.(content);
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
  enableCollaboration = false
}) => {
  console.log('🔥 LexicalEditor: Starting render - NEW VERSION');
  const [activeFormats, setActiveFormats] = useState<string[]>([]);
  const [formatCommand, setFormatCommand] = useState<string>('');
  const [collaborationError, setCollaborationError] = useState<string | null>(null);
  
  console.log('🔥 LexicalEditor: About to call useContext');
  // Use context directly with null check - this prevents the error
  const collaborationContext = useContext(CollaborationContext);
  console.log('🔥 LexicalEditor: Got collaborationContext:', !!collaborationContext);
  
  // Default fallback values when context is not available
  const {
    yDoc = null,
    provider = null,
    isConnected = false,
    users: collaborationUsers = [],
    currentUser = null,
    initializeCollaboration = () => {},
    destroyCollaboration = () => {},
    isReady = false
  } = collaborationContext || {};

  // Show warning if collaboration is enabled but context is not available
  const collaborationAvailable = enableCollaboration && collaborationContext && isReady;
  
  useEffect(() => {
    if (enableCollaboration && !collaborationContext) {
      setCollaborationError('Kollaboration nicht verfügbar - Editor läuft im Standalone-Modus');
    } else {
      setCollaborationError(null);
    }
  }, [enableCollaboration, collaborationContext]);

  const handleFormatText = (format: string) => {
    setFormatCommand(format);
    setTimeout(() => setFormatCommand(''), 10);
  };

  // Set up persistence hook
  const { saveManual, loadDocumentState } = useCollaborationPersistence({
    documentId,
    yDoc,
    enableCollaboration,
    debounceMs: 2000
  });

  // Initialize collaboration when enabled and available
  useEffect(() => {
    if (collaborationAvailable && documentId) {
      console.log('Initializing collaboration for document:', documentId);
      initializeCollaboration(documentId);
      
      return () => {
        console.log('Cleaning up collaboration');
        destroyCollaboration();
      };
    }
  }, [collaborationAvailable, documentId]); // Use collaborationAvailable instead

  // Load document state when Y.Doc is ready
  useEffect(() => {
    if (yDoc && documentId && collaborationAvailable) {
      loadDocumentState(yDoc).then(() => {
        console.log('Document state loaded');
      });
    }
  }, [yDoc, documentId, collaborationAvailable]); // Use collaborationAvailable instead

  // Provider factory for Lexical CollaborationPlugin
  const providerFactory = useCallback((id: string, yjsDocMap: Map<string, Y.Doc>) => {
    console.log('Provider factory called for:', id);
    
    if (provider && yDoc) {
      if (!yjsDocMap.has(id)) {
        yjsDocMap.set(id, yDoc);
      }
      return provider as any;
    }
    
    // Safe placeholder provider
    return {
      disconnect: () => {},
      awareness: null,
      ws: null,
      on: () => {},
      off: () => {},
      destroy: () => {}
    } as any;
  }, [provider, yDoc]);

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
        
        {/* Collaboration Error Warning */}
        {collaborationError && (
          <div className="p-3 border-b border-warning/20 bg-warning/10">
            <div className="flex items-center gap-2 text-warning">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm">{collaborationError}</span>
            </div>
          </div>
        )}
        
        {/* Collaboration Status */}
        {collaborationAvailable && documentId && (
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
                  {yDoc ? 'Kollaboration aktiv' : 'Wird geladen...'}
                </div>
              </div>
            </div>
          </div>
        )}
        
        <div className="editor-inner">
          <RichTextPlugin
            contentEditable={
              <ContentEditable className="editor-input" />
            }
            placeholder={
              <div className="editor-placeholder">{placeholder}</div>
            }
            ErrorBoundary={({ children }) => <div>{children}</div>}
          />
          {!enableCollaboration && <HistoryPlugin />}
          <ListPlugin />
          <LinkPlugin />
          {collaborationAvailable && documentId && provider && yDoc && (
            <CollaborationPlugin
              id={`knowledge-doc-${documentId}`}
              providerFactory={providerFactory}
              shouldBootstrap={true}
            />
          )}
          <ToolbarPlugin 
            onFormatChange={setActiveFormats}
            formatCommand={formatCommand}
          />
          <MyOnChangePlugin onChange={onChange} />
        </div>
      </div>
    </LexicalComposer>
  );
};

export default LexicalEditor;