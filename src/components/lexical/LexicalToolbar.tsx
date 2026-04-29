import React, { useCallback, useEffect, useState } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { 
  $getSelection, 
  $isRangeSelection,
  FORMAT_TEXT_COMMAND,
  SELECTION_CHANGE_COMMAND,
  COMMAND_PRIORITY_CRITICAL,
  TextFormatType
} from 'lexical';
import { 
  $isHeadingNode,
  $createHeadingNode,
  HeadingTagType
} from '@lexical/rich-text';
import { 
  INSERT_UNORDERED_LIST_COMMAND, 
  INSERT_ORDERED_LIST_COMMAND,
  REMOVE_LIST_COMMAND,
  $isListNode
} from '@lexical/list';
import { $createQuoteNode, $isQuoteNode } from '@lexical/rich-text';
import { $createCodeNode, $isCodeNode } from '@lexical/code';
import { Button } from '@/components/ui/button';
import { 
  Bold, 
  Italic, 
  Underline, 
  Strikethrough,
  List,
  ListOrdered,
  Code,
  Quote,
  Heading1,
  Heading2,
  Heading3,
  Type,
  Link,
  Undo,
  Redo
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';

export interface LexicalToolbarProps {
  showFloatingToolbar?: boolean;
}

export default function LexicalToolbar({ showFloatingToolbar = false }: LexicalToolbarProps) {
  const [editor] = useLexicalComposerContext();
  const [activeFormats, setActiveFormats] = useState<Set<string>>(new Set());
  const [blockType, setBlockType] = useState<string>('paragraph');
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // Update toolbar state based on selection
  const updateToolbar = useCallback(() => {
    editor.getEditorState().read(() => {
      const selection = $getSelection();
      
      if ($isRangeSelection(selection)) {
        const formats = new Set<string>();
        
        // Check text formats
        if (selection.hasFormat('bold')) formats.add('bold');
        if (selection.hasFormat('italic')) formats.add('italic');
        if (selection.hasFormat('underline')) formats.add('underline');
        if (selection.hasFormat('strikethrough')) formats.add('strikethrough');
        if (selection.hasFormat('code')) formats.add('code');
        
        setActiveFormats(formats);
  
        // Check block type
        const anchorNode = selection.anchor.getNode();
        const element = anchorNode.getKey() === 'root' 
          ? anchorNode 
          : anchorNode.getTopLevelElementOrThrow();
  
        if ($isHeadingNode(element)) {
          setBlockType(`heading-${element.getTag()}`);
        } else if ($isListNode(element)) {
          setBlockType(`list-${element.getListType()}`);
        } else if ($isQuoteNode(element)) {
          setBlockType('quote');
        } else if ($isCodeNode(element)) {
          setBlockType('code');
        } else {
          setBlockType('paragraph');
        }
      }
    });
  }, [editor]);

  useEffect(() => {
    return editor.registerCommand(
      SELECTION_CHANGE_COMMAND,
      () => {
        updateToolbar();
        return false;
      },
      COMMAND_PRIORITY_CRITICAL,
    );
  }, [editor, updateToolbar]);

  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        updateToolbar();
      });
    });
  }, [editor, updateToolbar]);

  // Format text commands
  const formatText = useCallback((format: string) => {
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, format as TextFormatType);
  }, [editor]);

  // Block format commands
  const formatBlock = useCallback((type: string) => {
    editor.update(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return;

      const anchorNode = selection.anchor.getNode();
      const element = anchorNode.getKey() === 'root' 
        ? anchorNode 
        : anchorNode.getTopLevelElementOrThrow();

      if (type.startsWith('heading-')) {
        const headingTag = type.replace('heading-', '') as HeadingTagType;
        const headingNode = $createHeadingNode(headingTag);
        element.replace(headingNode);
        headingNode.selectEnd();
      } else if (type === 'quote') {
        const quoteNode = $createQuoteNode();
        element.replace(quoteNode);
        quoteNode.selectEnd();
      } else if (type === 'code') {
        const codeNode = $createCodeNode();
        element.replace(codeNode);
        codeNode.selectEnd();
      }
    });
  }, [editor]);

  // List commands
  const formatList = useCallback((listType: 'bullet' | 'number') => {
    if (blockType.startsWith('list-')) {
      editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined);
    } else {
      if (listType === 'bullet') {
        editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
      } else {
        editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined);
      }
    }
  }, [editor, blockType]);

  const toolbarButtons = [
    // Text formatting group
    {
      group: 'text',
      buttons: [
        {
          format: 'bold',
          icon: Bold,
          label: 'Fett (Strg+B)',
          isActive: activeFormats.has('bold'),
          onClick: () => formatText('bold')
        },
        {
          format: 'italic', 
          icon: Italic,
          label: 'Kursiv (Strg+I)',
          isActive: activeFormats.has('italic'),
          onClick: () => formatText('italic')
        },
        {
          format: 'underline',
          icon: Underline, 
          label: 'Unterstrichen (Strg+U)',
          isActive: activeFormats.has('underline'),
          onClick: () => formatText('underline')
        },
        {
          format: 'strikethrough',
          icon: Strikethrough,
          label: 'Durchgestrichen',
          isActive: activeFormats.has('strikethrough'),
          onClick: () => formatText('strikethrough')
        },
        {
          format: 'code',
          icon: Code,
          label: 'Inline Code',
          isActive: activeFormats.has('code'),
          onClick: () => formatText('code')
        }
      ]
    },
    // Block formatting group
    {
      group: 'blocks',
      buttons: [
        {
          format: 'heading-h1',
          icon: Heading1,
          label: 'Überschrift 1',
          isActive: blockType === 'heading-h1',
          onClick: () => formatBlock('heading-h1')
        },
        {
          format: 'heading-h2', 
          icon: Heading2,
          label: 'Überschrift 2',
          isActive: blockType === 'heading-h2',
          onClick: () => formatBlock('heading-h2')
        },
        {
          format: 'heading-h3',
          icon: Heading3,
          label: 'Überschrift 3', 
          isActive: blockType === 'heading-h3',
          onClick: () => formatBlock('heading-h3')
        },
        {
          format: 'paragraph',
          icon: Type,
          label: 'Fließtext',
          isActive: blockType === 'paragraph',
          onClick: () => formatBlock('paragraph')
        }
      ]
    },
    // Lists and special blocks
    {
      group: 'lists',
      buttons: [
        {
          format: 'bullet-list',
          icon: List,
          label: 'Aufzählung',
          isActive: blockType === 'list-bullet',
          onClick: () => formatList('bullet')
        },
        {
          format: 'number-list',
          icon: ListOrdered,
          label: 'Nummerierte Liste',
          isActive: blockType === 'list-number', 
          onClick: () => formatList('number')
        },
        {
          format: 'quote',
          icon: Quote,
          label: 'Zitat',
          isActive: blockType === 'quote',
          onClick: () => formatBlock('quote')
        },
        {
          format: 'code-block',
          icon: Code,
          label: 'Code Block',
          isActive: blockType === 'code',
          onClick: () => formatBlock('code')
        }
      ]
    }
  ];

  if (showFloatingToolbar) {
    // Render compact floating toolbar for text selection
    return (
      <div className="flex items-center gap-1 p-2 bg-background border border-border rounded-lg shadow-lg">
        {toolbarButtons[0].buttons.map(({ format, icon: Icon, label, isActive, onClick }) => (
          <Button
            key={format}
            variant={isActive ? "default" : "ghost"}
            size="sm"
            onClick={onClick}
            title={label}
            className="h-8 w-8 p-0"
          >
            <Icon className="h-4 w-4" />
          </Button>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1 p-3 border-b border-border bg-background">
      {toolbarButtons.map((group, groupIndex) => (
        <React.Fragment key={group.group}>
          <div className="flex items-center gap-1">
            {group.buttons.map(({ format, icon: Icon, label, isActive, onClick }) => (
              <Button
                key={format}
                variant={isActive ? "default" : "ghost"}
                size="sm"
                onClick={onClick}
                title={label}
                className="h-8 w-8 p-0"
              >
                <Icon className="h-4 w-4" />
              </Button>
            ))}
          </div>
          {groupIndex < toolbarButtons.length - 1 && (
            <Separator orientation="vertical" className="h-6 mx-1" />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}