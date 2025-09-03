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

  // Show warning if collaboration is enabled but context is not available or no user
  const collaborationAvailable = enableCollaboration && collaborationContext && isReady && currentUser;
  
  // Stabilize collaborationAvailable to prevent re-initialization loops
  const [isInitialized, setIsInitialized] = useState(false);
  
  useEffect(() => {
    if (enableCollaboration && !collaborationContext) {
      setCollaborationError('Kollaboration nicht verfügbar - Editor läuft im Standalone-Modus');
    } else if (enableCollaboration && collaborationContext && !currentUser) {
      setCollaborationError('Benutzer-Anmeldung erforderlich - Editor läuft im Standalone-Modus');
    } else {
      setCollaborationError(null);
    }
  }, [enableCollaboration, collaborationContext, currentUser]);

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

  // Initialize collaboration ONCE when enabled and available
  useEffect(() => {
    if (collaborationAvailable && documentId && !isInitialized) {
      console.log('Initializing collaboration for document:', documentId);
      initializeCollaboration(documentId);
      setIsInitialized(true);
      
      return () => {
        console.log('Cleaning up collaboration');
        destroyCollaboration();
        setIsInitialized(false);
      };
    }
  }, [collaborationAvailable, documentId, isInitialized, initializeCollaboration, destroyCollaboration]);

  // Load document state when Y.Doc is ready and initialized
  useEffect(() => {
    if (yDoc && documentId && isInitialized) {
      loadDocumentState(yDoc).then(() => {
        console.log('Document state loaded');
      });
    }
  }, [yDoc, documentId, isInitialized, loadDocumentState]);

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
        
        {/* Enhanced Collaboration Status with Better UX */}
        {collaborationError && (
          <div className="p-4 border-b border-amber-200 bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="font-medium text-amber-800 dark:text-amber-200 mb-1">
                  Editor im Standalone-Modus
                </div>
                <div className="text-sm text-amber-700 dark:text-amber-300 mb-2">
                  Für die volle Funktionalität mit Echtzeit-Kollaboration und automatischem Speichern melden Sie sich an.
                </div>
                <div className="text-xs text-amber-600 dark:text-amber-400">
                  <strong>Verfügbare Features:</strong> Rich-Text-Formatierung, lokale Bearbeitung
                  <br />
                  <strong>Erfordert Anmeldung:</strong> Kollaboration, automatisches Speichern, Dokumentenverwaltung
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Enhanced Collaboration Status with Better Design */}
        {collaborationAvailable && documentId && (
          <div className="p-4 border-b border-green-200 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-sm font-medium text-green-800 dark:text-green-200">
                    Kollaboration aktiv
                  </span>
                </div>
                <CollaborationStatus
                  isConnected={isConnected}
                  users={collaborationUsers}
                  currentUser={currentUser || undefined}
                />
                {!isConnected && (
                  <div className="text-sm text-amber-600 dark:text-amber-400">
                    Verbindung wird hergestellt...
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={saveManual}
                  className="px-3 py-1.5 text-sm bg-green-600 hover:bg-green-700 text-white rounded-md transition-colors disabled:opacity-50"
                  disabled={!yDoc}
                  title="Manueller Snapshot"
                >
                  💾 Speichern
                </button>
                <div className="text-xs text-green-600 dark:text-green-400 font-medium">
                  {isConnected ? '🟢 Verbunden' : '🟡 Verbindet...'}
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