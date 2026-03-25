import '@/styles/lexical-editor.css';
import React, { useCallback, useEffect, useRef } from 'react';
import { debugConsole } from '@/utils/debugConsole';
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
  $getRoot,
  $getSelection,
  $isRangeSelection,
  FORMAT_TEXT_COMMAND,
  EditorState,
  LexicalEditor,
  REDO_COMMAND,
  UNDO_COMMAND,
} from 'lexical';
import { 
  INSERT_ORDERED_LIST_COMMAND, 
  INSERT_UNORDERED_LIST_COMMAND,
} from '@lexical/list';
import { Bold, Italic, Underline, List, ListOrdered, Mic } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { MentionNode } from '@/components/nodes/MentionNode';
import { MentionsPlugin } from '@/components/plugins/MentionsPlugin';
import { useSpeechDictation } from '@/hooks/useSpeechDictation';
import { toast } from 'sonner';
import { SpeechCommandsDialog } from '@/components/SpeechCommandsDialog';
import { SpeechSessionStats } from '@/components/SpeechSessionStats';

interface SimpleRichTextEditorProps {
  /**
   * Initial HTML loaded into the editor.
   * This value is only re-applied when the computed rehydrate key changes.
   */
  initialContent?: string;
  /**
   * Optional explicit version key for rehydration.
   * Rehydration happens when this value changes. If omitted, a hash of `initialContent` is used.
   */
  contentVersion?: string | number;
  onChange: (html: string) => void;
  placeholder?: string;
  disabled?: boolean;
  minHeight?: string;
  maxHeight?: string;
  scrollable?: boolean;
  onMentionInsert?: (userId: string, displayName: string) => void;
  onKeyDown?: React.KeyboardEventHandler<HTMLDivElement>;
  showToolbar?: boolean;
  autoFocus?: boolean;
}

const hashContent = (content: string): string => {
  let hash = 5381;
  for (let i = 0; i < content.length; i += 1) {
    hash = (hash * 33) ^ content.charCodeAt(i);
  }
  return `h${hash >>> 0}`;
};

// AutoFocus Plugin
const AutoFocusPlugin = () => {
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    editor.focus();
  }, [editor]);
  return null;
};


// Toolbar Component
const Toolbar = () => {
  const [editor] = useLexicalComposerContext();
  const [isBold, setIsBold] = React.useState(false);
  const [isItalic, setIsItalic] = React.useState(false);
  const [isUnderline, setIsUnderline] = React.useState(false);
  const {
    speechError,
    interimTranscript,
    isListening,
    speechSupported,
    lastRecognizedCommand,
    sessionStartTime,
    sessionWordCount,
    toggleSpeechRecognition,
    startSpeechRecognition,
    stopSpeechRecognition,
  } = useSpeechDictation({
    editor,
    insertText: useCallback((text: string) => {
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          selection.insertText(text);
        }
      });
    }, [editor]),
    dispatchCommand: useCallback((command) => {
      switch (command.type) {
        case 'toggle-format':
          editor.dispatchCommand(FORMAT_TEXT_COMMAND, command.format);
          break;
        case 'insert-list':
          editor.dispatchCommand(
            command.listType === 'unordered' ? INSERT_UNORDERED_LIST_COMMAND : INSERT_ORDERED_LIST_COMMAND,
            undefined,
          );
          break;
        case 'undo':
          editor.dispatchCommand(UNDO_COMMAND, undefined);
          break;
        case 'redo':
          editor.dispatchCommand(REDO_COMMAND, undefined);
          break;
        case 'insert-newline':
        case 'delete-last-word':
        case 'delete-last-sentence':
        case 'select-all':
        case 'insert-heading':
        case 'insert-quote':
        case 'replace-text':
          // SimpleRichTextEditor does not support these advanced commands
          break;
        case 'stop-listening':
          break;
      }
    }, [editor]),
  });

  // Show toast on speech errors
  useEffect(() => {
    if (speechError) {
      toast.error(speechError.message);
    }
  }, [speechError]);

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

  const shortcutActiveRef = useRef(false);

  useEffect(() => {
    const isSupportedShortcut = (event: KeyboardEvent) =>
      event.code === 'KeyM' && event.ctrlKey && event.shiftKey && !event.altKey && !event.metaKey;

    const isEditorFocused = () => {
      const rootElement = editor.getRootElement();
      const activeElement = document.activeElement;
      return !!rootElement && !!activeElement && rootElement.contains(activeElement);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (!speechSupported || !isEditorFocused() || !isSupportedShortcut(event)) return;
      if (shortcutActiveRef.current) return;

      shortcutActiveRef.current = true;
      event.preventDefault();
      startSpeechRecognition();
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (!shortcutActiveRef.current || event.code !== 'KeyM') return;
      shortcutActiveRef.current = false;
      stopSpeechRecognition();
    };

    const onVisibilityOrBlur = () => {
      if (!shortcutActiveRef.current) return;
      shortcutActiveRef.current = false;
      stopSpeechRecognition();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onVisibilityOrBlur);
    document.addEventListener('visibilitychange', onVisibilityOrBlur);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onVisibilityOrBlur);
      document.removeEventListener('visibilitychange', onVisibilityOrBlur);
    };
  }, [editor, speechSupported, startSpeechRecognition, stopSpeechRecognition]);

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
      <div className="w-px h-5 bg-border mx-1" />
      <Button
        type="button"
        variant={isListening ? 'default' : 'ghost'}
        size="sm"
        onClick={() => {
          if (!speechSupported) {
            toast.error('Spracherkennung wird in diesem Browser nicht unterstützt. Bitte verwende Chrome oder Edge.');
            return;
          }
          toggleSpeechRecognition();
        }}
        onMouseDown={(e) => e.preventDefault()}
        className={cn("h-8 w-8 p-0 relative", isListening && "bg-destructive text-destructive-foreground hover:bg-destructive/90")}
        title={
          !speechSupported
            ? 'Spracherkennung in diesem Browser nicht unterstützt'
            : isListening
              ? "Aufnahme aktiv – klicken zum Beenden. Sprachkommando: 'Stopp'"
              : "Diktat: Klicken zum Starten (Strg+Shift+M)"
        }
      >
        <Mic className="h-4 w-4" />
        {isListening && (
          <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-destructive border-2 border-background animate-pulse" />
        )}
      </Button>
      <SpeechCommandsDialog />
      {lastRecognizedCommand && (
        <span className="text-xs font-medium text-primary bg-primary/10 rounded px-1.5 py-0.5 animate-in fade-in-0 zoom-in-95">
          ✓ {lastRecognizedCommand}
        </span>
      )}
      {isListening && (
        <span className="text-xs text-destructive font-medium pl-1 animate-pulse">
          Aufnahme läuft…
        </span>
      )}
      <SpeechSessionStats sessionStartTime={sessionStartTime} wordCount={sessionWordCount} isListening={isListening} />
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
const InitialContentPlugin = ({
  initialContent = '',
  rehydrateKey,
}: {
  initialContent?: string;
  rehydrateKey: string;
}) => {
  const [editor] = useLexicalComposerContext();
  const lastAppliedRehydrateKey = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (lastAppliedRehydrateKey.current === rehydrateKey) return;

    let currentHtml = '';
    editor.getEditorState().read(() => {
      currentHtml = $generateHtmlFromNodes(editor, null);
    });

    if (currentHtml === initialContent) {
      lastAppliedRehydrateKey.current = rehydrateKey;
      return;
    }

    editor.update(() => {
      const parser = new DOMParser();
      const dom = parser.parseFromString(initialContent, 'text/html');
      const nodes = $generateNodesFromDOM(editor, dom);
      const root = $getRoot();
      root.clear();
      root.append(...nodes);
    });

    lastAppliedRehydrateKey.current = rehydrateKey;
  }, [editor, initialContent, rehydrateKey]);

  return null;
};

const SimpleRichTextEditor: React.FC<SimpleRichTextEditorProps> = ({
  initialContent = "",
  contentVersion,
  onChange,
  placeholder = "Text eingeben...",
  disabled = false,
  minHeight = "120px",
  maxHeight,
  scrollable = false,
  onMentionInsert,
  onKeyDown,
  showToolbar = true,
  autoFocus = false,
}) => {
  const rehydrateKey = React.useMemo(
    () => String(contentVersion ?? hashContent(initialContent)),
    [contentVersion, initialContent],
  );

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
      debugConsole.error('Lexical Error:', error);
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
                className={cn(
                  "p-3 focus:outline-none prose prose-sm max-w-none",
                  scrollable && "overflow-y-auto"
                )}
                style={{ minHeight, maxHeight }}
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
        <InitialContentPlugin initialContent={initialContent} rehydrateKey={rehydrateKey} />
        {autoFocus && <AutoFocusPlugin />}
      </LexicalComposer>
    </div>
  );
};

export default SimpleRichTextEditor;
