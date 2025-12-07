import React, { useCallback } from 'react';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { $generateHtmlFromNodes, $generateNodesFromDOM } from '@lexical/html';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { ListNode, ListItemNode } from '@lexical/list';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getRoot, $insertNodes, FORMAT_TEXT_COMMAND, EditorState, LexicalEditor } from 'lexical';
import { 
  INSERT_ORDERED_LIST_COMMAND, 
  INSERT_UNORDERED_LIST_COMMAND,
} from '@lexical/list';
import { $getSelection, $isRangeSelection } from 'lexical';
import { Bold, Italic, Underline, List, ListOrdered } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface SimpleRichTextEditorProps {
  initialContent?: string;
  onChange: (html: string) => void;
  placeholder?: string;
  disabled?: boolean;
  minHeight?: string;
}

// Toolbar Component
const Toolbar = () => {
  const [editor] = useLexicalComposerContext();
  const [isBold, setIsBold] = React.useState(false);
  const [isItalic, setIsItalic] = React.useState(false);
  const [isUnderline, setIsUnderline] = React.useState(false);

  const updateToolbar = useCallback(() => {
    const selection = $getSelection();
    if ($isRangeSelection(selection)) {
      setIsBold(selection.hasFormat('bold'));
      setIsItalic(selection.hasFormat('italic'));
      setIsUnderline(selection.hasFormat('underline'));
    }
  }, []);

  React.useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        updateToolbar();
      });
    });
  }, [editor, updateToolbar]);

  const formatBold = () => {
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold');
  };

  const formatItalic = () => {
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic');
  };

  const formatUnderline = () => {
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'underline');
  };

  const formatBulletList = () => {
    editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
  };

  const formatNumberedList = () => {
    editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined);
  };

  return (
    <div className="flex items-center gap-1 p-2 border-b border-border bg-muted/30">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={formatBold}
        className={cn("h-8 w-8 p-0", isBold && "bg-accent")}
        title="Fett"
      >
        <Bold className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={formatItalic}
        className={cn("h-8 w-8 p-0", isItalic && "bg-accent")}
        title="Kursiv"
      >
        <Italic className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={formatUnderline}
        className={cn("h-8 w-8 p-0", isUnderline && "bg-accent")}
        title="Unterstrichen"
      >
        <Underline className="h-4 w-4" />
      </Button>
      <div className="w-px h-5 bg-border mx-1" />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={formatBulletList}
        className="h-8 w-8 p-0"
        title="Aufzählungsliste"
      >
        <List className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={formatNumberedList}
        className="h-8 w-8 p-0"
        title="Nummerierte Liste"
      >
        <ListOrdered className="h-4 w-4" />
      </Button>
    </div>
  );
};

// Plugin to load initial HTML content
const InitialContentPlugin = ({ initialContent }: { initialContent?: string }) => {
  const [editor] = useLexicalComposerContext();
  const [isInitialized, setIsInitialized] = React.useState(false);

  React.useEffect(() => {
    if (initialContent && !isInitialized) {
      editor.update(() => {
        const parser = new DOMParser();
        const dom = parser.parseFromString(initialContent, 'text/html');
        const nodes = $generateNodesFromDOM(editor, dom);
        const root = $getRoot();
        root.clear();
        root.append(...nodes);
      });
      setIsInitialized(true);
    }
  }, [editor, initialContent, isInitialized]);

  return null;
};

const SimpleRichTextEditor: React.FC<SimpleRichTextEditorProps> = ({
  initialContent = "",
  onChange,
  placeholder = "Text eingeben...",
  disabled = false,
  minHeight = "120px"
}) => {
  const initialConfig = {
    namespace: 'SimpleRichTextEditor',
    editable: !disabled,
    theme: {
      paragraph: 'mb-2',
      text: {
        bold: 'font-bold',
        italic: 'italic',
        underline: 'underline',
      },
      list: {
        ul: 'list-disc ml-6 mb-2',
        ol: 'list-decimal ml-6 mb-2',
        listitem: 'mb-1',
      }
    },
    nodes: [
      ListNode,
      ListItemNode,
    ],
    onError: (error: Error) => {
      console.error('Lexical Error:', error);
    },
  };

  const handleChange = (editorState: EditorState, editor: LexicalEditor) => {
    if (disabled) return;
    
    editorState.read(() => {
      const htmlString = $generateHtmlFromNodes(editor, null);
      onChange(htmlString);
    });
  };

  return (
    <div className={cn(
      "border border-border rounded-lg overflow-hidden bg-background",
      disabled && "opacity-50 pointer-events-none"
    )}>
      <LexicalComposer initialConfig={initialConfig}>
        <Toolbar />
        <div className="relative">
          <RichTextPlugin
            contentEditable={
              <ContentEditable 
                className="p-3 focus:outline-none prose prose-sm max-w-none"
                style={{ minHeight }}
                aria-placeholder={placeholder}
                placeholder={
                  <div 
                    className="absolute top-3 left-3 text-muted-foreground pointer-events-none"
                  >
                    {placeholder}
                  </div>
                }
              />
            }
            ErrorBoundary={LexicalErrorBoundary}
          />
        </div>
        <HistoryPlugin />
        <OnChangePlugin onChange={handleChange} />
        <ListPlugin />
        <InitialContentPlugin initialContent={initialContent} />
      </LexicalComposer>
    </div>
  );
};

export default SimpleRichTextEditor;
