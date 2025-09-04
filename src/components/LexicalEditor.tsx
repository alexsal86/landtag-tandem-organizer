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
  // Force cache refresh - v2.0
  const [activeFormats, setActiveFormats] = useState<string[]>([]);
  const [formatCommand, setFormatCommand] = useState<string>('');
  const [collaborationError, setCollaborationError] = useState<string | null>(null);
  
  // Use context directly with null check - this prevents the error
  const collaborationContext = useContext(CollaborationContext);
  
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
  const collaborationAvailable = enableCollaboration && collaborationContext;
  
  // Debug logging
  console.log('Collaboration State:', {
    documentId,
    hasYDoc: !!yDoc,
    hasProvider: !!provider,
    isConnected,
  });
  
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

  // Set up persistence hook - only when we have valid parameters
  const { saveManual, loadDocumentState } = useCollaborationPersistence({
    documentId: documentId || undefined, // Ensure we don't pass empty string
    yDoc,
    enableCollaboration: enableCollaboration && !!documentId, // Only enable if we have documentId
    debounceMs: 2000
  });

  // Initialize collaboration when enabled and available (improved cleanup)
  useEffect(() => {
    if (collaborationAvailable && documentId) {
      console.log('Initializing collaboration for document:', documentId);
      initializeCollaboration(documentId);
      
      return () => {
        console.log('Cleaning up collaboration for document:', documentId);
        // Add a small delay to prevent race conditions
        setTimeout(() => {
          destroyCollaboration();
        }, 100);
      };
    } else {
      // Cleanup if collaboration is disabled or document ID is missing
      console.log('Collaboration not available or missing documentId, cleaning up');
      destroyCollaboration();
    }
  }, [collaborationAvailable, documentId, initializeCollaboration, destroyCollaboration]);

  // Load document state when Y.Doc is ready (improved timing)
  useEffect(() => {
    if (yDoc && documentId && collaborationAvailable && isReady) {
      console.log('Y.Doc ready, loading document state for:', documentId);
      
      // Add a small delay to ensure the collaboration is fully initialized
      const loadTimer = setTimeout(() => {
        loadDocumentState(yDoc).then(() => {
          console.log('Document state loading completed for:', documentId);
        }).catch((error) => {
          console.error('Error during document state loading:', error);
        });
      }, 500);

      return () => {
        clearTimeout(loadTimer);
      };
    }
  }, [yDoc, documentId, collaborationAvailable, isReady, loadDocumentState]);

  // Provider factory for Lexical CollaborationPlugin - simplified to use existing provider
  const providerFactory = useCallback((id: string, yjsDocMap: Map<string, Y.Doc>) => {
    console.log('Provider factory called for neutral ID:', id);
    
    if (provider && yDoc) {
      // Use the neutral ID to map to our actual Y.Doc
      if (!yjsDocMap.has(id)) {
        yjsDocMap.set(id, yDoc);
      }
      return provider as any;
    }
    
    // Safe placeholder provider when not available
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
              id="lexical-editor"
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