import React, { useState, useCallback, useEffect } from 'react';
import {
  $getSelection,
  $isRangeSelection,
  FORMAT_TEXT_COMMAND,
  TextFormatType,
  EditorState,
  $createParagraphNode,
  $getRoot,
} from 'lexical';
import { $isHeadingNode, $createHeadingNode, HeadingTagType } from '@lexical/rich-text';
import {
  INSERT_UNORDERED_LIST_COMMAND,
  INSERT_ORDERED_LIST_COMMAND,
  $isListNode,
  ListNode,
} from '@lexical/list';
import { 
  LexicalComposer,
  InitialConfigType
} from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { AutoFocusPlugin } from '@lexical/react/LexicalAutoFocusPlugin';
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { MarkdownShortcutPlugin } from '@lexical/react/LexicalMarkdownShortcutPlugin';
import { CollaborationPlugin } from '@lexical/react/LexicalCollaborationPlugin';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';

import { HeadingNode } from '@lexical/rich-text';
import { ListItemNode, ListNode as LexicalListNode } from '@lexical/list';
import { LinkNode } from '@lexical/link';
import { CodeNode } from '@lexical/code';

import { Button } from '@/components/ui/button';
import { 
  Undo, 
  Redo, 
  Bold, 
  Italic, 
  Underline,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Users,
  Minus
} from 'lucide-react';
import { useYjsCollaboration } from '@/hooks/useYjsCollaboration';
import './CleanLexicalEditor.css';

// Define our editor theme
const editorTheme = {
  paragraph: 'mb-2',
  heading: {
    h1: 'text-3xl font-bold mb-4 mt-6',
    h2: 'text-2xl font-semibold mb-3 mt-5',
    h3: 'text-xl font-medium mb-2 mt-4',
  },
  list: {
    nested: {
      listitem: 'list-none',
    },
    ol: 'list-decimal list-inside mb-2',
    ul: 'list-disc list-inside mb-2',
    listitem: 'mb-1',
  },
  text: {
    bold: 'font-bold',
    italic: 'italic',
    underline: 'underline',
  },
  collaboration: {
    cursor: 'Collaboration__cursor',
    selection: 'Collaboration__selection'
  }
};

// Editor configuration
const editorConfig: InitialConfigType = {
  namespace: 'CleanLexicalEditor',
  nodes: [HeadingNode, LinkNode, LexicalListNode, ListItemNode, CodeNode],
  onError: (error: Error) => {
    console.error('Lexical Editor Error:', error);
  },
  theme: editorTheme,
};

interface CleanLexicalEditorProps {
  documentId: string;
  placeholder?: string;
  readOnly?: boolean;
  autoFocus?: boolean;
}

// Toolbar Component
function EditorToolbar() {
  const [editor] = useLexicalComposerContext();
  const [activeFormats, setActiveFormats] = useState<Set<string>>(new Set());

  const updateFormats = useCallback(() => {
    const selection = $getSelection();
    if ($isRangeSelection(selection)) {
      const formats = new Set<string>();
      if (selection.hasFormat('bold')) formats.add('bold');
      if (selection.hasFormat('italic')) formats.add('italic');
      if (selection.hasFormat('underline')) formats.add('underline');
      setActiveFormats(formats);
    }
  }, []);

  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        updateFormats();
      });
    });
  }, [editor, updateFormats]);

  const formatText = (format: TextFormatType) => {
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, format);
  };

  const formatHeading = (headingSize: HeadingTagType) => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        const anchorNode = selection.anchor.getNode();
        if ($isHeadingNode(anchorNode)) {
          anchorNode.replace($createHeadingNode(headingSize));
        } else {
          selection.insertNodes([$createHeadingNode(headingSize)]);
        }
      }
    });
  };

  const insertList = (listType: 'bullet' | 'number') => {
    if (listType === 'bullet') {
      editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
    } else {
      editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-1 p-2 bg-muted/20">
      {/* Undo/Redo */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => editor.dispatchCommand('UNDO_COMMAND' as any, undefined)}
        className="h-8 w-8 p-0"
        title="Rückgängig"
      >
        <Undo className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => editor.dispatchCommand('REDO_COMMAND' as any, undefined)}
        className="h-8 w-8 p-0"
        title="Wiederholen"
      >
        <Redo className="h-4 w-4" />
      </Button>
      
      <div className="w-px h-6 bg-border mx-1" />
      
      {/* Text Formatting */}
      <Button
        variant={activeFormats.has('bold') ? 'default' : 'ghost'}
        size="sm"
        onClick={() => formatText('bold')}
        className="h-8 w-8 p-0"
        title="Fett"
      >
        <Bold className="h-4 w-4" />
      </Button>
      <Button
        variant={activeFormats.has('italic') ? 'default' : 'ghost'}
        size="sm"
        onClick={() => formatText('italic')}
        className="h-8 w-8 p-0"
        title="Kursiv"
      >
        <Italic className="h-4 w-4" />
      </Button>
      <Button
        variant={activeFormats.has('underline') ? 'default' : 'ghost'}
        size="sm"
        onClick={() => formatText('underline')}
        className="h-8 w-8 p-0"
        title="Unterstrichen"
      >
        <Underline className="h-4 w-4" />
      </Button>
      
      <div className="w-px h-6 bg-border mx-1" />
      
      {/* Headings */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => formatHeading('h1')}
        className="h-8 w-8 p-0"
        title="Überschrift 1"
      >
        <Heading1 className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => formatHeading('h2')}
        className="h-8 w-8 p-0"
        title="Überschrift 2"
      >
        <Heading2 className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => formatHeading('h3')}
        className="h-8 w-8 p-0"
        title="Überschrift 3"
      >
        <Heading3 className="h-4 w-4" />
      </Button>
      
      <div className="w-px h-6 bg-border mx-1" />
      
      {/* Lists */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => insertList('bullet')}
        className="h-8 w-8 p-0"
        title="Aufzählung"
      >
        <List className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => insertList('number')}
        className="h-8 w-8 p-0"
        title="Nummerierte Liste"
      >
        <ListOrdered className="h-4 w-4" />
      </Button>
    </div>
  );
}

// Collaboration Awareness Display Component
function CollaborationAwareness({ awareness }: { awareness: any }) {
  const [users, setUsers] = useState<any[]>([]);
  
  useEffect(() => {
    if (!awareness) return;
    
    const updateUsers = () => {
      const states = awareness.getStates();
      const userList = Array.from(states.entries()).map(([clientId, state]: [number, any]) => ({
        clientId,
        name: state.user?.name || 'Anonymous',
        color: state.user?.color || '#000000'
      }));
      setUsers(userList);
    };
    
    awareness.on('change', updateUsers);
    updateUsers();
    
    return () => {
      awareness.off('change', updateUsers);
    };
  }, [awareness]);
  
  return (
    <div className="flex items-center gap-2 px-2">
      <Users className="h-4 w-4 text-muted-foreground" />
      <span className="text-sm text-muted-foreground">
        {users.length > 1 ? `${users.length} online` : 'Solo'}
      </span>
      {users.length > 1 && (
        <div className="flex -space-x-1">
          {users.slice(0, 3).map((user) => (
            <div
              key={user.clientId}
              className="w-6 h-6 rounded-full border-2 border-background flex items-center justify-center text-xs text-white font-medium"
              style={{ backgroundColor: user.color }}
              title={user.name}
            >
              {user.name.charAt(0).toUpperCase()}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function CleanLexicalEditor({ 
  documentId,
  placeholder = "Beginnen Sie zu schreiben...", 
  readOnly = false,
  autoFocus = false 
}: CleanLexicalEditorProps) {
  const { yjsDoc, awareness, isInitialized } = useYjsCollaboration({ documentId });

  if (!isInitialized || !yjsDoc || !awareness) {
    return (
      <div className="relative border border-border rounded-lg bg-background min-h-[400px] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto mb-2"></div>
          <div className="text-sm text-muted-foreground">Collaboration wird initialisiert...</div>
        </div>
      </div>
    );
  }

  return (
    <LexicalComposer initialConfig={editorConfig}>
      <div className="relative border border-border rounded-lg bg-background">
        {!readOnly && (
          <div className="flex items-center justify-between border-b border-border p-2">
            <EditorToolbar />
            <CollaborationAwareness awareness={awareness} />
          </div>
        )}
        <div className="relative">
          <RichTextPlugin
            contentEditable={
              <ContentEditable 
                className="min-h-[400px] p-4 outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 resize-none text-foreground"
                style={{ caretColor: 'currentColor' }}
                spellCheck={false}
                readOnly={readOnly}
              />
            }
            placeholder={
              <div className="absolute top-4 left-4 text-muted-foreground pointer-events-none select-none">
                {placeholder}
              </div>
            }
            ErrorBoundary={LexicalErrorBoundary}
          />
        </div>
      </div>
      
      {/* Basic History Plugin for now - removed MarkdownShortcutPlugin to fix HorizontalRule dependency */}
      <HistoryPlugin />
      {autoFocus && <AutoFocusPlugin />}
      <LinkPlugin />
      <ListPlugin />
    </LexicalComposer>
  );
}