import React, { useState, useCallback, useEffect } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getSelection, $isRangeSelection, $createParagraphNode, $createTextNode } from 'lexical';
import {
  $createHeadingNode,
  $createQuoteNode,
  HeadingTagType
} from '@lexical/rich-text';
import { $createCodeNode } from '@lexical/code';
import { $createTableNode, $createTableRowNode, $createTableCellNode } from '@lexical/table';
import { $createLinkNode } from '@lexical/link';
import {
  FORMAT_TEXT_COMMAND,
  UNDO_COMMAND,
  REDO_COMMAND,
  TextFormatType,
  $isElementNode,
} from 'lexical';
import {
  INSERT_UNORDERED_LIST_COMMAND,
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_CHECK_LIST_COMMAND,
} from '@lexical/list';
import { $setBlocksType } from '@lexical/selection';
import { Button } from '@/components/ui/button';
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
  Hash,
  Undo,
  Redo,
  Type,
  MessageCircle,
  History,
  List,
  ListOrdered,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { CommentPlugin } from './plugins/CommentPlugin';
import { VersionHistoryPlugin } from './plugins/VersionHistoryPlugin';
import FontSizePlugin from './plugins/FontSizePlugin';
import FontFamilyPlugin from './plugins/FontFamilyPlugin';

interface EnhancedLexicalToolbarProps {
  showFloatingToolbar?: boolean;
  documentId?: string;
}

export const EnhancedLexicalToolbar: React.FC<EnhancedLexicalToolbarProps> = ({
  showFloatingToolbar = false,
  documentId
}) => {
  const [editor] = useLexicalComposerContext();
  const [activeFormats, setActiveFormats] = useState<string[]>([]);

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
        }
        setActiveFormats(formats);
      });
    });
  }, [editor]);

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

  const insertBulletList = useCallback(() => {
    editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
  }, [editor]);

  const insertNumberedList = useCallback(() => {
    editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined);
  }, [editor]);

  const insertCheckList = useCallback(() => {
    editor.dispatchCommand(INSERT_CHECK_LIST_COMMAND, undefined);
  }, [editor]);

  const insertTable = useCallback((rows: number = 3, cols: number = 3) => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        const tableNode = $createTableNode();
        for (let i = 0; i < rows; i++) {
          const rowNode = $createTableRowNode();
          for (let j = 0; j < cols; j++) {
            const cellNode = $createTableCellNode(0);
            cellNode.append($createParagraphNode());
            rowNode.append(cellNode);
          }
          tableNode.append(rowNode);
        }
        selection.insertNodes([tableNode]);
      }
    });
  }, [editor]);

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

  const insertMention = useCallback(() => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        selection.insertText('@');
      }
    });
  }, [editor]);

  const insertHashtag = useCallback(() => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        selection.insertText('#');
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
    <div className="flex flex-wrap gap-1 p-2 border-b bg-background">
      {/* History */}
      <div className="flex gap-1 items-center">
        <Button variant="ghost" size="sm" onClick={() => editor.dispatchCommand(UNDO_COMMAND, undefined)} className="h-8" title="Rückgängig"><Undo className="h-4 w-4" /></Button>
        <Button variant="ghost" size="sm" onClick={() => editor.dispatchCommand(REDO_COMMAND, undefined)} className="h-8" title="Wiederholen"><Redo className="h-4 w-4" /></Button>
      </div>

      <Separator orientation="vertical" className="h-6 mx-1" />

      {/* Font controls */}
      <div className="flex gap-1 items-center">
        <FontFamilyPlugin />
        <FontSizePlugin />
      </div>

      <Separator orientation="vertical" className="h-6 mx-1" />

      {/* Text formatting */}
      <div className="flex gap-1 items-center">
        <Button variant={activeFormats.includes('bold') ? "default" : "ghost"} size="sm" onClick={() => formatText('bold')} className="h-8" title="Fett"><Bold className="h-4 w-4" /></Button>
        <Button variant={activeFormats.includes('italic') ? "default" : "ghost"} size="sm" onClick={() => formatText('italic')} className="h-8" title="Kursiv"><Italic className="h-4 w-4" /></Button>
        <Button variant={activeFormats.includes('underline') ? "default" : "ghost"} size="sm" onClick={() => formatText('underline')} className="h-8" title="Unterstrichen"><Underline className="h-4 w-4" /></Button>
        <Button variant={activeFormats.includes('strikethrough') ? "default" : "ghost"} size="sm" onClick={() => formatText('strikethrough')} className="h-8" title="Durchgestrichen"><Strikethrough className="h-4 w-4" /></Button>
        <Button variant={activeFormats.includes('code') ? "default" : "ghost"} size="sm" onClick={() => formatText('code')} className="h-8" title="Code"><Code className="h-4 w-4" /></Button>
      </div>

      <Separator orientation="vertical" className="h-6 mx-1" />

      {/* Block formatting */}
      <div className="flex gap-1 items-center">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8">
              <Type className="h-4 w-4 mr-1" />
              Überschriften
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={formatParagraph}>Normal</DropdownMenuItem>
            <DropdownMenuItem onClick={() => formatHeading('h1')}>Überschrift 1</DropdownMenuItem>
            <DropdownMenuItem onClick={() => formatHeading('h2')}>Überschrift 2</DropdownMenuItem>
            <DropdownMenuItem onClick={() => formatHeading('h3')}>Überschrift 3</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button variant="ghost" size="sm" onClick={formatQuote} className="h-8" title="Zitat"><Quote className="h-4 w-4" /></Button>
        <Button variant="ghost" size="sm" onClick={formatCode} className="h-8" title="Code-Block"><Code className="h-4 w-4" /></Button>
      </div>

      <Separator orientation="vertical" className="h-6 mx-1" />

      {/* Lists */}
      <div className="flex gap-1 items-center">
        <Button variant="ghost" size="sm" onClick={insertBulletList} className="h-8" title="Aufzählung"><List className="h-4 w-4" /></Button>
        <Button variant="ghost" size="sm" onClick={insertNumberedList} className="h-8" title="Nummerierte Liste"><ListOrdered className="h-4 w-4" /></Button>
        <Button variant="ghost" size="sm" onClick={insertCheckList} className="h-8" title="Checkliste"><CheckSquare className="h-4 w-4" /></Button>
      </div>

      <Separator orientation="vertical" className="h-6 mx-1" />

      {/* Insert */}
      <div className="flex gap-1 items-center">
        <Button variant="ghost" size="sm" onClick={() => insertTable()} className="h-8" title="Tabelle"><Table className="h-4 w-4" /></Button>
        <Button variant="ghost" size="sm" onClick={insertLink} className="h-8" title="Link"><Link className="h-4 w-4" /></Button>
        <Button variant="ghost" size="sm" onClick={insertMention} className="h-8" title="Erwähnung"><AtSign className="h-4 w-4" /></Button>
        <Button variant="ghost" size="sm" onClick={insertHashtag} className="h-8" title="Hashtag"><Hash className="h-4 w-4" /></Button>
      </div>

      <Separator orientation="vertical" className="h-6 mx-1" />

      {/* Collaboration features */}
      <div className="flex gap-1 items-center">
        {documentId && <CommentPlugin documentId={documentId} />}
        {documentId && <VersionHistoryPlugin documentId={documentId} />}
      </div>
    </div>
  );
};
