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
import { Awareness } from 'y-protocols/awareness';
import { useNativeYjsCollaboration } from '@/hooks/useNativeYjsCollaboration';
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
  
  // Use native Yjs collaboration instead of the context-based approach
  console.log('🔄 LexicalEditor: Creating native collaboration hook with:', {
    documentId: documentId || '',
    enabled: enableCollaboration && !!documentId,
    enableCollaboration,
    hasDocumentId: !!documentId
  });
  
  const collaboration = useNativeYjsCollaboration({
    documentId: documentId || '',
    enabled: enableCollaboration && !!documentId
  });

  const { yDoc, isConnected, users } = collaboration;
  
  // Debug logging
  console.log('🎯 Native Collaboration State:', {
    documentId,
    hasYDoc: !!yDoc,
    isConnected,
    enableCollaboration,
    users: users.length
  });

  const handleFormatText = (format: string) => {
    setFormatCommand(format);
    setTimeout(() => setFormatCommand(''), 10);
  };

  // Simple provider factory for native Yjs
  const providerFactory = useCallback((id: string, yjsDocMap: Map<string, Y.Doc>) => {
    console.log('Provider factory called for:', id);
    
    if (yDoc) {
      // Map the neutral ID to our Y.Doc
      if (!yjsDocMap.has(id)) {
        yjsDocMap.set(id, yDoc);
      }
      
      // Return a minimal provider interface for Lexical
      return {
        connect: () => {},
        disconnect: () => {},
        awareness: new Awareness(yDoc),
        on: () => {},
        off: () => {},
        destroy: () => {}
      } as any;
    }
    
    return null;
  }, [yDoc]);

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
        
        {/* Collaboration Status */}
        {enableCollaboration && documentId && (
          <div className="p-3 border-b border-border bg-muted/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <CollaborationStatus
                  isConnected={isConnected}
                  users={users}
                  currentUser={undefined}
                />
                {!isConnected && (
                  <div className="text-sm text-muted-foreground">
                    Verbindung wird hergestellt...
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <div className="text-xs text-muted-foreground">
                  {yDoc ? 'Native Kollaboration aktiv' : 'Wird geladen...'}
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
          {enableCollaboration && documentId && yDoc && (
            <CollaborationPlugin
              id="native-yjs-editor"
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