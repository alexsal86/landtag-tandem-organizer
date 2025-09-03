import React, { useCallback, useEffect, useState } from 'react';
import {
  $getSelection,
  $isRangeSelection,
  $createParagraphNode,
  FORMAT_ELEMENT_COMMAND,
  FORMAT_TEXT_COMMAND,
  SELECTION_CHANGE_COMMAND,
  $getNodeByKey,
} from 'lexical';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  $createHeadingNode,
  $createQuoteNode,
  $isHeadingNode,
  HeadingTagType,
} from '@lexical/rich-text';
import {
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  $isListNode,
  ListNode,
} from '@lexical/list';
import { $createCodeNode, $isCodeNode } from '@lexical/code';
import { $createLinkNode, $isLinkNode, TOGGLE_LINK_COMMAND } from '@lexical/link';
import {
  $getSelectionStyleValueForProperty,
  $patchStyleText,
  $setBlocksType,
} from '@lexical/selection';
import { $findMatchingParent, mergeRegister } from '@lexical/utils';

interface ToolbarPluginProps {
  onFormatChange?: (activeFormats: string[]) => void;
  formatCommand?: string;
}

const ToolbarPlugin: React.FC<ToolbarPluginProps> = ({ 
  onFormatChange, 
  formatCommand 
}) => {
  const [editor] = useLexicalComposerContext();
  const [activeFormats, setActiveFormats] = useState<string[]>([]);
  const [blockType, setBlockType] = useState<string>('paragraph');

  const updateToolbar = useCallback(() => {
    const selection = $getSelection();
    if ($isRangeSelection(selection)) {
      const anchorNode = selection.anchor.getNode();
      let element =
        anchorNode.getKey() === 'root'
          ? anchorNode
          : $findMatchingParent(anchorNode, (e) => {
              const parent = e.getParent();
              return parent !== null && parent.getKey() === 'root';
            });

      if (element === null) {
        element = anchorNode.getTopLevelElementOrThrow();
      }

      const elementKey = element.getKey();
      const elementDOM = editor.getElementByKey(elementKey);

      // Update active formats
      const formats: string[] = [];
      
      if (selection.hasFormat('bold')) formats.push('bold');
      if (selection.hasFormat('italic')) formats.push('italic');
      if (selection.hasFormat('underline')) formats.push('underline');
      if (selection.hasFormat('strikethrough')) formats.push('strikethrough');

      // Check block type
      if ($isHeadingNode(element)) {
        const tag = element.getTag();
        setBlockType(`heading${tag.slice(1)}`); // h1 -> heading1
        formats.push(`heading${tag.slice(1)}`);
      } else if ($isListNode(element)) {
        const listType = element.getListType();
        setBlockType(listType === 'bullet' ? 'bulletlist' : 'numberlist');
        formats.push(listType === 'bullet' ? 'bulletlist' : 'numberlist');
      } else if ($isCodeNode(element)) {
        setBlockType('code');
        formats.push('code');
      } else {
        const parentNode = element.getParent();
        if ($isListNode(parentNode)) {
          const listType = parentNode.getListType();
          setBlockType(listType === 'bullet' ? 'bulletlist' : 'numberlist');
          formats.push(listType === 'bullet' ? 'bulletlist' : 'numberlist');
        } else {
          setBlockType('paragraph');
        }
      }

      setActiveFormats(formats);
      onFormatChange?.(formats);
    }
  }, [editor, onFormatChange]);

  useEffect(() => {
    return mergeRegister(
      editor.registerUpdateListener(({ editorState }) => {
        editorState.read(() => {
          updateToolbar();
        });
      }),
      editor.registerCommand(
        SELECTION_CHANGE_COMMAND,
        () => {
          updateToolbar();
          return false;
        },
        1,
      ),
    );
  }, [editor, updateToolbar]);

  // Handle format commands from external toolbar
  useEffect(() => {
    if (!formatCommand) return;

    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        switch (formatCommand) {
          case 'bold':
            editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold');
            break;
          case 'italic':
            editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic');
            break;
          case 'underline':
            editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'underline');
            break;
          case 'strikethrough':
            editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'strikethrough');
            break;
          case 'heading1':
            $setBlocksType(selection, () => $createHeadingNode('h1'));
            break;
          case 'heading2':
            $setBlocksType(selection, () => $createHeadingNode('h2'));
            break;
          case 'heading3':
            $setBlocksType(selection, () => $createHeadingNode('h3'));
            break;
          case 'text':
          case 'paragraph':
            $setBlocksType(selection, () => $createParagraphNode());
            break;
          case 'bulletlist':
            editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
            break;
          case 'numberlist':
            editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined);
            break;
          case 'code':
            $setBlocksType(selection, () => $createCodeNode());
            break;
          case 'quote':
            $setBlocksType(selection, () => $createQuoteNode());
            break;
          case 'link':
            if (!$isLinkNode(selection.anchor.getNode())) {
              editor.dispatchCommand(TOGGLE_LINK_COMMAND, 'https://');
            } else {
              editor.dispatchCommand(TOGGLE_LINK_COMMAND, null);
            }
            break;
        }
      }
    });
  }, [editor, formatCommand]);

  return null; // This plugin doesn't render anything
};

export default ToolbarPlugin;