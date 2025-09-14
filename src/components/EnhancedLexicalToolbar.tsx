import React, { useState, useCallback } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getSelection, $isRangeSelection, $createParagraphNode } from 'lexical';
import { 
  $createHeadingNode, 
  $createQuoteNode, 
  HeadingTagType 
} from '@lexical/rich-text';
import { $createCodeNode } from '@lexical/code';
import { $createTableNode, $createTableRowNode, $createTableCellNode } from '@lexical/table';
import { $createLinkNode } from '@lexical/link';
import { FORMAT_TEXT_COMMAND, UNDO_COMMAND, REDO_COMMAND, TextFormatType } from 'lexical';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { 
  Bold, 
  Italic, 
  Underline, 
  Strikethrough, 
  Code,
  Heading1,
  Heading2, 
  Heading3,
  Quote,
  List,
  ListOrdered,
  Link,
  Image,
  Table,
  CheckSquare,
  AtSign,
  Hash,
  Undo,
  Redo,
  Type,
  MessageCircle,
  History,
  Palette,
  HighlighterIcon
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { FileAttachmentPlugin } from './plugins/FileAttachmentPlugin';
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

  const formatText = useCallback((format: TextFormatType) => {
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, format);
  }, [editor]);

  const formatHeading = useCallback((headingSize: HeadingTagType) => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        const headingNode = $createHeadingNode(headingSize);
        selection.insertNodes([headingNode]);
      }
    });
  }, [editor]);

  const formatQuote = useCallback(() => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        const quoteNode = $createQuoteNode();
        selection.insertNodes([quoteNode]);
      }
    });
  }, [editor]);

  const formatCode = useCallback(() => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        const codeNode = $createCodeNode();
        selection.insertNodes([codeNode]);
      }
    });
  }, [editor]);

  const insertTable = useCallback((rows: number = 3, cols: number = 3) => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        const tableNode = $createTableNode();
        
        for (let i = 0; i < rows; i++) {
          const rowNode = $createTableRowNode();
          for (let j = 0; j < cols; j++) {
            const cellNode = $createTableCellNode();
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
          selection.insertNodes([linkNode]);
        }
      });
    }
  }, [editor]);

  const insertCheckbox = useCallback(() => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        selection.insertText('☐ ');
      }
    });
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

  const toolbarGroups = [
    {
      name: 'history',
      buttons: [
        {
          icon: Undo,
          label: 'Rückgängig',
          command: () => editor.dispatchCommand(UNDO_COMMAND, undefined)
        },
        {
          icon: Redo,
          label: 'Wiederholen',
          command: () => editor.dispatchCommand(REDO_COMMAND, undefined)
        }
      ]
    },
    {
      name: 'font',
      components: [
        {
          component: FontFamilyPlugin,
          label: 'Schriftart'
        },
        {
          component: FontSizePlugin,
          label: 'Schriftgröße'
        }
      ]
    },
    {
      name: 'text',
      buttons: [
        {
          icon: Bold,
          label: 'Fett',
          command: () => formatText('bold'),
          isActive: activeFormats.includes('bold')
        },
        {
          icon: Italic,
          label: 'Kursiv',
          command: () => formatText('italic'),
          isActive: activeFormats.includes('italic')
        },
        {
          icon: Underline,
          label: 'Unterstrichen',
          command: () => formatText('underline'),
          isActive: activeFormats.includes('underline')
        },
        {
          icon: Strikethrough,
          label: 'Durchgestrichen',
          command: () => formatText('strikethrough'),
          isActive: activeFormats.includes('strikethrough')
        },
        {
          icon: Code,
          label: 'Code',
          command: () => formatText('code'),
          isActive: activeFormats.includes('code')
        }
      ]
    },
    {
      name: 'blocks',
      buttons: [
        {
          icon: Type,
          label: 'Überschriften',
          dropdown: [
            { label: 'Überschrift 1', command: () => formatHeading('h1') },
            { label: 'Überschrift 2', command: () => formatHeading('h2') },
            { label: 'Überschrift 3', command: () => formatHeading('h3') }
          ]
        },
        {
          icon: Quote,
          label: 'Zitat',
          command: formatQuote
        },
        {
          icon: Code,
          label: 'Code-Block',
          command: formatCode
        }
      ]
    },
    {
      name: 'insert',
      buttons: [
        {
          icon: Table,
          label: 'Tabelle',
          command: () => insertTable()
        },
        {
          icon: Link,
          label: 'Link',
          command: insertLink
        },
        {
          icon: CheckSquare,
          label: 'Checkbox',
          command: insertCheckbox
        },
        {
          icon: AtSign,
          label: 'Erwähnung',
          command: insertMention
        },
        {
          icon: Hash,
          label: 'Hashtag',
          command: insertHashtag
        }
      ]
    },
    {
      name: 'collaboration',
      buttons: [
        {
          icon: MessageCircle,
          label: 'Kommentar',
          component: documentId ? () => <CommentPlugin documentId={documentId} /> : undefined
        },
        {
          icon: History,
          label: 'Versionen',
          component: documentId ? () => <VersionHistoryPlugin documentId={documentId} /> : undefined
        }
      ]
    }
  ];

  if (showFloatingToolbar) {
    return (
      <div className="bg-background border rounded-lg shadow-lg p-1 flex gap-1">
        {toolbarGroups.map((group, groupIndex) => (
          <React.Fragment key={group.name}>
            {group.buttons.slice(0, 3).map((button, index) => (
              <Button
                key={index}
                variant={button.isActive ? "default" : "ghost"}
                size="sm"
                onClick={button.command}
                className="h-8 w-8 p-0"
              >
                <button.icon className="h-4 w-4" />
              </Button>
            ))}
            {groupIndex < toolbarGroups.length - 1 && (
              <Separator orientation="vertical" className="h-6" />
            )}
          </React.Fragment>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-1 p-2 border-b bg-background">
      {toolbarGroups.map((group, groupIndex) => (
        <React.Fragment key={group.name}>
          <div className="flex gap-1 items-center">
            {group.components && group.components.map((comp, index) => (
              <comp.component key={index} />
            ))}
            {group.buttons && group.buttons.map((button, index) => (
              <React.Fragment key={index}>
                {button.dropdown ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8"
                      >
                        <button.icon className="h-4 w-4 mr-1" />
                        {button.label}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      {button.dropdown.map((item, dropIndex) => (
                        <DropdownMenuItem
                          key={dropIndex}
                          onClick={item.command}
                        >
                          {item.label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : button.component ? (
                  <button.component />
                ) : (
                  <Button
                    variant={button.isActive ? "default" : "ghost"}
                    size="sm"
                    onClick={button.command}
                    className="h-8"
                    title={button.label}
                  >
                    <button.icon className="h-4 w-4" />
                  </Button>
                )}
              </React.Fragment>
            ))}
          </div>
          {groupIndex < toolbarGroups.length - 1 && (
            <Separator orientation="vertical" className="h-6 mx-1" />
          )}
        </React.Fragment>
      ))}
    </div>
  );
};