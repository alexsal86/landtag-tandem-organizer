import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getSelection, $isRangeSelection, $createParagraphNode, $createTextNode, $isTextNode, $getRoot, TextNode, FORMAT_TEXT_COMMAND, FORMAT_ELEMENT_COMMAND, UNDO_COMMAND, REDO_COMMAND, TextFormatType, ElementFormatType, $insertNodes } from 'lexical';
import {
  $createHeadingNode,
  $createQuoteNode,
  HeadingTagType
} from '@lexical/rich-text';
import { $createCodeNode } from '@lexical/code';
import { $createLinkNode } from '@lexical/link';
import {
  INSERT_UNORDERED_LIST_COMMAND,
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_CHECK_LIST_COMMAND,
} from '@lexical/list';
import { INSERT_HORIZONTAL_RULE_COMMAND } from '@lexical/react/LexicalHorizontalRuleNode';
import { INSERT_TABLE_COMMAND } from '@lexical/table';
import { $setBlocksType } from '@lexical/selection';
import { $createImageNode } from './nodes/ImageNode';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Separator } from '@/components/ui/separator';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Code,
  Quote,
  Link,
  Table,
  CheckSquare,
  AtSign,
  Undo,
  Redo,
  Type,
  List,
  ListOrdered,
  Minus,
  Image,
  Subscript,
  Superscript,
  RemoveFormatting,
  Mic,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { VersionHistoryPlugin } from './plugins/VersionHistoryPlugin';
import FontSizePlugin from './plugins/FontSizePlugin';
import FontFamilyPlugin from './plugins/FontFamilyPlugin';
import { TextColorPlugin } from './plugins/TextColorPlugin';
import { TextAlignmentPlugin } from './plugins/TextAlignmentPlugin';
import { LineHeightPlugin } from './plugins/LineHeightPlugin';
import { ImageUploadDialog } from './plugins/ImagePlugin';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useSpeechDictation } from '@/hooks/useSpeechDictation';

import { SpeechCommandsDialog } from '@/components/SpeechCommandsDialog';
import { SpeechSessionStats } from '@/components/SpeechSessionStats';

interface EnhancedLexicalToolbarProps {
  showFloatingToolbar?: boolean;
  documentId?: string;
  /** Default font size for the FontSizePlugin (e.g. "11pt") */
  defaultFontSize?: string;
  /** Default font family for the FontFamilyPlugin */
  defaultFontFamily?: string;
}

export const EnhancedLexicalToolbar: React.FC<EnhancedLexicalToolbarProps> = ({
  showFloatingToolbar = false,
  documentId,
  defaultFontSize,
  defaultFontFamily,
}) => {
  const [editor] = useLexicalComposerContext();
  const [activeFormats, setActiveFormats] = useState<string[]>([]);
  const [showImageDialog, setShowImageDialog] = useState(false);
  const [showTableDialog, setShowTableDialog] = useState(false);
  const [tableRows, setTableRows] = useState('3');
  const [tableCols, setTableCols] = useState('3');
  const tableButtonRef = useRef<HTMLButtonElement>(null);
  const tableRowsInputRef = useRef<HTMLInputElement>(null);
  const {
    speechState,
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
          editor.update(() => {
            const selection = $getSelection();
            if ($isRangeSelection(selection)) {
              selection.insertText('\n');
            }
          });
          break;
        case 'delete-last-word':
          editor.update(() => {
            const selection = $getSelection();
            if ($isRangeSelection(selection)) {
              const node = selection.anchor.getNode();
              if ($isTextNode(node)) {
                const text = node.getTextContent().trimEnd();
                const lastSpace = text.lastIndexOf(' ');
                node.setTextContent(lastSpace >= 0 ? text.slice(0, lastSpace + 1) : '');
              }
            }
          });
          break;
        case 'delete-last-sentence':
          editor.update(() => {
            const selection = $getSelection();
            if ($isRangeSelection(selection)) {
              const node = selection.anchor.getNode();
              if ($isTextNode(node)) {
                const text = node.getTextContent();
                const lastEnd = Math.max(text.lastIndexOf('. '), text.lastIndexOf('! '), text.lastIndexOf('? '));
                node.setTextContent(lastEnd >= 0 ? text.slice(0, lastEnd + 2) : '');
              }
            }
          });
          break;
        case 'select-all':
          editor.update(() => {
            const root = $getRoot();
            root.select(0, root.getChildrenSize());
          });
          break;
        case 'insert-heading':
          editor.update(() => {
            const selection = $getSelection();
            if ($isRangeSelection(selection)) {
              $setBlocksType(selection, () => $createHeadingNode(`h${command.level}` as HeadingTagType));
            }
          });
          break;
        case 'insert-quote':
          editor.update(() => {
            const selection = $getSelection();
            if ($isRangeSelection(selection)) {
              $setBlocksType(selection, () => $createQuoteNode());
            }
          });
          break;
        case 'replace-text':
          editor.update(() => {
            const selection = $getSelection();
            if ($isRangeSelection(selection)) {
              const node = selection.anchor.getNode();
              if ($isTextNode(node)) {
                const text = node.getTextContent();
                const idx = text.toLowerCase().indexOf(command.search.toLowerCase());
                if (idx >= 0) {
                  node.setTextContent(text.slice(0, idx) + command.replacement + text.slice(idx + command.search.length));
                }
              }
            }
          });
          break;
        case 'stop-listening':
          break;
      }
    }, [editor]),
  });

  // Track active formats
  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const selection = $getSelection();
        const formats: string[] = [];
        if ($isRangeSelection(selection)) {
          if (selection.hasFormat('bold')) formats.push('bold');
          if (selection.hasFormat('italic')) formats.push('italic');
          if (selection.hasFormat('underline')) formats.push('underline');
          if (selection.hasFormat('strikethrough')) formats.push('strikethrough');
          if (selection.hasFormat('code')) formats.push('code');
          if (selection.hasFormat('subscript')) formats.push('subscript');
          if (selection.hasFormat('superscript')) formats.push('superscript');
        }
        setActiveFormats(formats);
      });
    });
  }, [editor]);


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

  const formatText = useCallback((format: TextFormatType) => {
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, format);
  }, [editor]);

  const formatHeading = useCallback((headingSize: HeadingTagType) => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        $setBlocksType(selection, () => $createHeadingNode(headingSize));
      }
    });
  }, [editor]);

  const formatQuote = useCallback(() => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        $setBlocksType(selection, () => $createQuoteNode());
      }
    });
  }, [editor]);

  const formatCode = useCallback(() => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        $setBlocksType(selection, () => $createCodeNode());
      }
    });
  }, [editor]);

  const formatParagraph = useCallback(() => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        $setBlocksType(selection, () => $createParagraphNode());
      }
    });
  }, [editor]);

  const clearFormatting = useCallback(() => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        const anchor = selection.anchor;
        const focus = selection.focus;
        const nodes = selection.getNodes();

        if (anchor.key === focus.key && anchor.offset === focus.offset) {
          return;
        }

        nodes.forEach((node) => {
          if ($isTextNode(node)) {
            const formats: Array<'bold' | 'italic' | 'underline' | 'strikethrough' | 'code' | 'subscript' | 'superscript'> = 
              ['bold', 'italic', 'underline', 'strikethrough', 'code', 'subscript', 'superscript'];
            formats.forEach((format) => {
              if (node.hasFormat(format)) {
                node.toggleFormat(format);
              }
            });
            node.setStyle('');
          }
        });

        $setBlocksType(selection, () => $createParagraphNode());
      }
    });
  }, [editor]);

  const insertTable = useCallback(() => {
    const rows = parseInt(tableRows) || 3;
    const cols = parseInt(tableCols) || 3;
    editor.dispatchCommand(INSERT_TABLE_COMMAND, {
      columns: String(cols),
      rows: String(rows),
      includeHeaders: true,
    });
    setShowTableDialog(false);
  }, [editor, tableRows, tableCols]);

  const insertLink = useCallback(() => {
    const url = prompt('URL eingeben:');
    if (url) {
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          const linkNode = $createLinkNode(url);
          const text = selection.getTextContent() || url;
          linkNode.append($createTextNode(text));
          selection.insertNodes([linkNode]);
        }
      });
    }
  }, [editor]);

  const insertHorizontalRule = useCallback(() => {
    editor.dispatchCommand(INSERT_HORIZONTAL_RULE_COMMAND, undefined);
  }, [editor]);

  const insertMention = useCallback(() => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        selection.insertText('@');
      }
    });
  }, [editor]);
  if (showFloatingToolbar) {
    return (
      <div className="bg-background border rounded-lg shadow-lg p-1 flex gap-1">
        <Button variant={activeFormats.includes('bold') ? "default" : "ghost"} size="sm" onClick={() => formatText('bold')} className="h-8 w-8 p-0"><Bold className="h-4 w-4" /></Button>
        <Button variant={activeFormats.includes('italic') ? "default" : "ghost"} size="sm" onClick={() => formatText('italic')} className="h-8 w-8 p-0"><Italic className="h-4 w-4" /></Button>
        <Button variant={activeFormats.includes('underline') ? "default" : "ghost"} size="sm" onClick={() => formatText('underline')} className="h-8 w-8 p-0"><Underline className="h-4 w-4" /></Button>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-wrap gap-1 p-2 border-b bg-background items-center">
        {/* History */}
        <div className="flex gap-0.5 items-center">
          <Button variant="ghost" size="sm" onClick={() => editor.dispatchCommand(UNDO_COMMAND, undefined)} className="h-8 w-8 p-0" title="Rückgängig"><Undo className="h-4 w-4" /></Button>
          <Button variant="ghost" size="sm" onClick={() => editor.dispatchCommand(REDO_COMMAND, undefined)} className="h-8 w-8 p-0" title="Wiederholen"><Redo className="h-4 w-4" /></Button>
        </div>

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Block type */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 gap-1 px-2">
              <Type className="h-4 w-4" />
              <span className="text-xs">Block</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={formatParagraph}>Normal</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => formatHeading('h1')}>Überschrift 1</DropdownMenuItem>
            <DropdownMenuItem onClick={() => formatHeading('h2')}>Überschrift 2</DropdownMenuItem>
            <DropdownMenuItem onClick={() => formatHeading('h3')}>Überschrift 3</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={formatQuote}>Zitat</DropdownMenuItem>
            <DropdownMenuItem onClick={formatCode}>Code-Block</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Font controls */}
        <FontFamilyPlugin defaultFontFamily={defaultFontFamily} />
        <FontSizePlugin defaultFontSize={defaultFontSize} />

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Text formatting */}
        <div className="flex gap-0.5 items-center">
          <Button variant={activeFormats.includes('bold') ? "default" : "ghost"} size="sm" onClick={() => formatText('bold')} className="h-8 w-8 p-0" title="Fett (Ctrl+B)"><Bold className="h-4 w-4" /></Button>
          <Button variant={activeFormats.includes('italic') ? "default" : "ghost"} size="sm" onClick={() => formatText('italic')} className="h-8 w-8 p-0" title="Kursiv (Ctrl+I)"><Italic className="h-4 w-4" /></Button>
          <Button variant={activeFormats.includes('underline') ? "default" : "ghost"} size="sm" onClick={() => formatText('underline')} className="h-8 w-8 p-0" title="Unterstrichen (Ctrl+U)"><Underline className="h-4 w-4" /></Button>
          <Button variant={activeFormats.includes('strikethrough') ? "default" : "ghost"} size="sm" onClick={() => formatText('strikethrough')} className="h-8 w-8 p-0" title="Durchgestrichen"><Strikethrough className="h-4 w-4" /></Button>
          <Button variant={activeFormats.includes('code') ? "default" : "ghost"} size="sm" onClick={() => formatText('code')} className="h-8 w-8 p-0" title="Inline-Code"><Code className="h-4 w-4" /></Button>
          <Button variant={activeFormats.includes('subscript') ? "default" : "ghost"} size="sm" onClick={() => formatText('subscript')} className="h-8 w-8 p-0" title="Tiefgestellt"><Subscript className="h-4 w-4" /></Button>
          <Button variant={activeFormats.includes('superscript') ? "default" : "ghost"} size="sm" onClick={() => formatText('superscript')} className="h-8 w-8 p-0" title="Hochgestellt"><Superscript className="h-4 w-4" /></Button>
        </div>

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Colors */}
        <TextColorPlugin />

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Alignment */}
        <TextAlignmentPlugin />

        {/* Line height */}
        <LineHeightPlugin />

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Lists */}
        <div className="flex gap-0.5 items-center">
          <Button variant="ghost" size="sm" onClick={() => editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined)} className="h-8 w-8 p-0" title="Aufzählung"><List className="h-4 w-4" /></Button>
          <Button variant="ghost" size="sm" onClick={() => editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined)} className="h-8 w-8 p-0" title="Nummerierte Liste"><ListOrdered className="h-4 w-4" /></Button>
          <Button variant="ghost" size="sm" onClick={() => editor.dispatchCommand(INSERT_CHECK_LIST_COMMAND, undefined)} className="h-8 w-8 p-0" title="Checkliste"><CheckSquare className="h-4 w-4" /></Button>
        </div>

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Insert */}
        <div className="flex gap-0.5 items-center">
          <Dialog open={showTableDialog} onOpenChange={setShowTableDialog}>
            <DialogTrigger asChild>
              <Button
                ref={tableButtonRef}
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                title="Tabelle"
              >
                <Table className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent
              className="w-64"
              onOpenAutoFocus={(event) => {
                event.preventDefault();
                tableRowsInputRef.current?.focus();
              }}
              onCloseAutoFocus={(event) => {
                event.preventDefault();
                tableButtonRef.current?.focus();
              }}
            >
              <DialogHeader>
                <DialogTitle className="text-sm">Tabelle einfügen</DialogTitle>
                <DialogDescription>
                  Wähle die Anzahl der Zeilen und Spalten für die neue Tabelle.
                </DialogDescription>
              </DialogHeader>
              <div className="flex gap-2 items-center">
                <div className="flex-1">
                  <label className="text-xs text-muted-foreground">Zeilen</label>
                  <Input
                    ref={tableRowsInputRef}
                    type="number"
                    value={tableRows}
                    onChange={(e) => setTableRows(e.target.value)}
                    min="1"
                    max="20"
                    className="h-8"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-muted-foreground">Spalten</label>
                  <Input
                    type="number"
                    value={tableCols}
                    onChange={(e) => setTableCols(e.target.value)}
                    min="1"
                    max="10"
                    className="h-8"
                  />
                </div>
              </div>
              <DialogFooter className="gap-2 sm:justify-start sm:space-x-0">
                <Button size="sm" onClick={insertTable}>Einfügen</Button>
                <Button size="sm" variant="outline" onClick={() => setShowTableDialog(false)}>Abbrechen</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button variant="ghost" size="sm" onClick={insertLink} className="h-8 w-8 p-0" title="Link"><Link className="h-4 w-4" /></Button>
          <Button variant="ghost" size="sm" onClick={insertHorizontalRule} className="h-8 w-8 p-0" title="Horizontale Linie"><Minus className="h-4 w-4" /></Button>
          <Button variant="ghost" size="sm" onClick={() => setShowImageDialog(true)} className="h-8 w-8 p-0" title="Bild einfügen"><Image className="h-4 w-4" /></Button>
          <Button variant="ghost" size="sm" onClick={insertMention} className="h-8 w-8 p-0" title="Erwähnung"><AtSign className="h-4 w-4" /></Button>
        </div>

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Speech-to-text (Web Speech API) */}
        <Button
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
          className="h-8 w-8 p-0"
          title={
            !speechSupported
              ? 'Spracherkennung in diesem Browser nicht unterstützt'
              : isListening
                ? "Push-to-talk aktiv – loslassen zum Beenden. Sprachkommando: ‘Stopp’"
                : "Push-to-talk: Taste halten zum Sprechen (Strg+Shift+M)"
          }
          disabled={!speechSupported}
        >
          <Mic className="h-4 w-4" />
        </Button>

        <SpeechCommandsDialog />

        {lastRecognizedCommand && (
          <span className="text-xs font-medium text-primary bg-primary/10 rounded px-1.5 py-0.5 animate-in fade-in-0 zoom-in-95">
            ✓ {lastRecognizedCommand}
          </span>
        )}

        {speechState === 'listening' && (
          <span className="text-xs text-primary">Aufnahme läuft…</span>
        )}

        <SpeechSessionStats sessionStartTime={sessionStartTime} wordCount={sessionWordCount} isListening={isListening} />

        {speechState === 'listening' && interimTranscript && (
          <span className="text-xs text-muted-foreground italic" title="Live-Erkennung">
            {interimTranscript}
          </span>
        )}

        {speechError && (
          <span className="text-xs text-destructive" title={speechError.code}>
            {speechError.message}
          </span>
        )}

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Clear formatting */}
        <Button variant="ghost" size="sm" onClick={clearFormatting} className="h-8 w-8 p-0" title="Formatierung entfernen"><RemoveFormatting className="h-4 w-4" /></Button>

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Document features */}
        <div className="flex gap-0.5 items-center">
          {documentId && <VersionHistoryPlugin documentId={documentId} />}
        </div>
      </div>

      {/* Image insert dialog */}
      {showImageDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <ImageUploadDialog
            onInsert={(payload) => {
              editor.update(() => {
                const imageNode = $createImageNode(payload);
                $insertNodes([imageNode]);
              });
              setShowImageDialog(false);
            }}
            onCancel={() => setShowImageDialog(false)}
          />
        </div>
      )}
    </>
  );
};
