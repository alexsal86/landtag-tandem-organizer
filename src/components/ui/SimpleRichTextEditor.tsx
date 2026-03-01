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
import {
  $createTextNode,
  $getNodeByKey,
  $getRoot,
  FORMAT_TEXT_COMMAND,
  EditorState,
  LexicalEditor,
  REDO_COMMAND,
  TextNode,
  UNDO_COMMAND,
} from 'lexical';
import { 
  INSERT_ORDERED_LIST_COMMAND, 
  INSERT_UNORDERED_LIST_COMMAND,
} from '@lexical/list';
import { $getSelection, $isRangeSelection } from 'lexical';
import { Bold, Italic, Underline, List, ListOrdered, Mic } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { MentionNode } from '@/components/nodes/MentionNode';
import { MentionsPlugin } from '@/components/plugins/MentionsPlugin';
import { WebSpeechToTextAdapter, type SpeechToTextError, type SpeechToTextState } from '@/lib/speechToTextAdapter';
import { detectSpeechCommand, formatDictatedText } from '@/lib/speechCommandUtils';

interface SimpleRichTextEditorProps {
  initialContent?: string;
  onChange: (html: string) => void;
  placeholder?: string;
  disabled?: boolean;
  minHeight?: string;
  onMentionInsert?: (userId: string, displayName: string) => void;
  onKeyDown?: React.KeyboardEventHandler<HTMLDivElement>;
  showToolbar?: boolean;
}

// Toolbar Component
const Toolbar = () => {
  const [editor] = useLexicalComposerContext();
  const [isBold, setIsBold] = React.useState(false);
  const [isItalic, setIsItalic] = React.useState(false);
  const [isUnderline, setIsUnderline] = React.useState(false);
  const [speechState, setSpeechState] = React.useState<SpeechToTextState>('idle');
  const [speechError, setSpeechError] = React.useState<SpeechToTextError | null>(null);
  const [interimTranscript, setInterimTranscript] = React.useState('');
  const interimNodeKeyRef = React.useRef<string | null>(null);

  const speechAdapter = React.useMemo(() => new WebSpeechToTextAdapter(), []);

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

  React.useEffect(() => {
    const removeInterimNode = () => {
      const interimNodeKey = interimNodeKeyRef.current;
      if (!interimNodeKey) return null;

      const interimNode = $getNodeByKey(interimNodeKey);
      if (interimNode instanceof TextNode) {
        interimNode.remove();
        interimNodeKeyRef.current = null;
        return interimNode;
      }

      interimNodeKeyRef.current = null;
      return null;
    };

    const updateInterimNode = (text: string) => {
      editor.update(() => {
        const interimNodeKey = interimNodeKeyRef.current;
        if (interimNodeKey) {
          const interimNode = $getNodeByKey(interimNodeKey);
          if (interimNode instanceof TextNode) {
            if (!text) {
              interimNode.remove();
              interimNodeKeyRef.current = null;
              return;
            }

            interimNode.setTextContent(text);
            return;
          }

          interimNodeKeyRef.current = null;
        }

        if (!text) return;

        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          const node = $createTextNode(text);
          node.setStyle('opacity: 0.65; font-style: italic;');
          selection.insertNodes([node]);
          interimNodeKeyRef.current = node.getKey();
        }
      });
    };

    speechAdapter.onStateChange = (nextState) => setSpeechState(nextState);
    speechAdapter.onError = (error) => setSpeechError(error);
    speechAdapter.onInterimTranscript = (text) => {
      setInterimTranscript(text);
      updateInterimNode(text);
    };
    speechAdapter.onFinalTranscript = (text) => {
      const command = detectSpeechCommand(text);
      if (command) {
        editor.update(() => {
          removeInterimNode();
        });
        setInterimTranscript('');

        switch (command.type) {
          case 'stop-listening':
            speechAdapter.stop();
            return;
          case 'toggle-format':
            editor.dispatchCommand(FORMAT_TEXT_COMMAND, command.format);
            return;
          case 'insert-list':
            editor.dispatchCommand(
              command.listType === 'unordered' ? INSERT_UNORDERED_LIST_COMMAND : INSERT_ORDERED_LIST_COMMAND,
              undefined,
            );
            return;
          case 'undo':
            editor.dispatchCommand(UNDO_COMMAND, undefined);
            return;
          case 'redo':
            editor.dispatchCommand(REDO_COMMAND, undefined);
            return;
          case 'insert-newline':
            editor.update(() => {
              const selection = $getSelection();
              if ($isRangeSelection(selection)) {
                selection.insertText('\n');
              }
            });
            return;
        }
      }

      const formattedText = formatDictatedText(text);
      setInterimTranscript('');

      editor.update(() => {
        const shouldAddTrailingSpace =
          !!formattedText && !formattedText.endsWith('\n') && !/[,.;:!?]$/.test(formattedText);
        const textToInsert = formattedText
          ? shouldAddTrailingSpace
            ? `${formattedText} `
            : formattedText
          : '';

        const interimNode = removeInterimNode();
        if (interimNode instanceof TextNode) {
          if (textToInsert) {
            interimNode.replace($createTextNode(textToInsert));
          }
          return;
        }

        if (!textToInsert) return;

        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          selection.insertText(textToInsert);
        }
      });
    };

    if (!speechAdapter.supported) {
      setSpeechState('unsupported');
    }

    return () => {
      speechAdapter.destroy();
    };
  }, [editor, speechAdapter]);

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

  const isListening = speechState === 'listening';
  const speechSupported = speechAdapter.supported;

  const toggleSpeechRecognition = () => {
    if (!speechSupported) return;

    if (isListening) {
      speechAdapter.stop();
      return;
    }

    setSpeechError(null);
    speechAdapter.start();
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
      <div className="w-px h-5 bg-border mx-1" />
      <Button
        type="button"
        variant={isListening ? 'default' : 'ghost'}
        size="sm"
        onClick={toggleSpeechRecognition}
        className="h-8 w-8 p-0"
        title={
          !speechSupported
            ? 'Spracherkennung in diesem Browser nicht unterstützt'
            : isListening
              ? 'Spracherkennung beenden'
              : 'Spracherkennung starten'
        }
        disabled={!speechSupported}
      >
        <Mic className="h-4 w-4" />
      </Button>
      {speechError && (
        <span className="text-xs text-destructive pl-1" title={speechError.code}>
          {speechError.message}
        </span>
      )}
      {isListening && interimTranscript && (
        <span className="text-xs text-muted-foreground pl-1 italic" title="Live-Erkennung">
          {interimTranscript}
        </span>
      )}
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
  minHeight = "120px",
  onMentionInsert,
  onKeyDown,
  showToolbar = true,
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
      MentionNode,
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
      "border border-border rounded-lg bg-background",
      disabled && "opacity-50 pointer-events-none"
    )}>
      <LexicalComposer initialConfig={initialConfig}>
        {showToolbar && <Toolbar />}
        <div className="relative">
          <RichTextPlugin
            contentEditable={
              <ContentEditable 
                className="p-3 focus:outline-none prose prose-sm max-w-none"
                style={{ minHeight }}
                onKeyDown={onKeyDown}
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
        <MentionsPlugin onMentionInsert={onMentionInsert} />
        <InitialContentPlugin initialContent={initialContent} />
      </LexicalComposer>
    </div>
  );
};

export default SimpleRichTextEditor;
