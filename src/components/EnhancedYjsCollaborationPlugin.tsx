import React, { useEffect } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useYjsProvider } from './collaboration/YjsProvider';
import { 
  $getRoot, 
  $createParagraphNode, 
  $createTextNode,
  $getSelection,
  $isRangeSelection,
  TextNode,
  ElementNode
} from 'lexical';
import { 
  $createHeadingNode, 
  $isHeadingNode, 
  HeadingNode,
  $createQuoteNode,
  $isQuoteNode,
  QuoteNode
} from '@lexical/rich-text';
import { 
  $createListNode, 
  $createListItemNode, 
  $isListNode, 
  $isListItemNode,
  ListNode,
  ListItemNode
} from '@lexical/list';
import { 
  $createCodeNode, 
  $isCodeNode,
  CodeNode
} from '@lexical/code';
import { 
  $createLinkNode, 
  $isLinkNode,
  LinkNode
} from '@lexical/link';
import * as Y from 'yjs';

interface EnhancedYjsCollaborationPluginProps {
  id: string;
  shouldBootstrap?: boolean;
}

// Enhanced Yjs collaboration plugin that handles rich text nodes
export function EnhancedYjsCollaborationPlugin({ 
  id, 
  shouldBootstrap = true 
}: EnhancedYjsCollaborationPluginProps): JSX.Element | null {
  const [editor] = useLexicalComposerContext();
  const { doc, isSynced } = useYjsProvider();

  useEffect(() => {
    if (!doc || !isSynced) return;

    const yText = doc.getText(id);
    let isApplyingRemoteChanges = false;
    let isApplyingLocalChanges = false;

    // Convert Lexical editor state to Yjs format with rich text support
    const lexicalToYjs = (editorState: any) => {
      if (isApplyingRemoteChanges) return;
      
      isApplyingLocalChanges = true;
      
      editorState.read(() => {
        const root = $getRoot();
        const serialized = serializeLexicalToYjs(root);
        
        // Clear and replace Yjs content
        yText.delete(0, yText.length);
        yText.insert(0, JSON.stringify(serialized));
      });
      
      setTimeout(() => {
        isApplyingLocalChanges = false;
      }, 0);
    };

    // Convert Yjs content to Lexical editor state with rich text support  
    const yjsToLexical = () => {
      if (isApplyingLocalChanges) return;
      
      isApplyingRemoteChanges = true;
      
      const yjsContent = yText.toString();
      if (!yjsContent) return;

      try {
        const parsedContent = JSON.parse(yjsContent);
        
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          
          deserializeYjsToLexical(parsedContent, root);
        }, {
          onUpdate: () => {
            setTimeout(() => {
              isApplyingRemoteChanges = false;
            }, 0);
          }
        });
      } catch (error) {
        console.error('Error parsing Yjs content:', error);
        isApplyingRemoteChanges = false;
      }
    };

    // Serialize Lexical nodes to Yjs-compatible format
    const serializeLexicalToYjs = (node: any): any => {
      if (!node) return null;

      const result: any = {
        type: node.getType(),
        version: 1,
      };

      // Handle different node types
      if (node instanceof TextNode) {
        result.text = node.getTextContent();
        result.format = node.getFormat();
        result.style = node.getStyle();
        result.mode = node.getMode();
        console.log('🔄 [Enhanced Yjs] Serializing TextNode:', {
          text: result.text,
          format: result.format,
          style: result.style
        });
      } else if ($isHeadingNode(node)) {
        result.tag = node.getTag();
        result.children = node.getChildren().map(serializeLexicalToYjs);
      } else if ($isQuoteNode(node)) {
        result.children = node.getChildren().map(serializeLexicalToYjs);
      } else if ($isListNode(node)) {
        result.listType = node.getListType();
        result.children = node.getChildren().map(serializeLexicalToYjs);
      } else if ($isListItemNode(node)) {
        result.value = node.getValue();
        result.children = node.getChildren().map(serializeLexicalToYjs);
      } else if ($isCodeNode(node)) {
        result.language = node.getLanguage();
        result.children = node.getChildren().map(serializeLexicalToYjs);
      } else if ($isLinkNode(node)) {
        result.url = node.getURL();
        result.target = node.getTarget();
        result.title = node.getTitle();
        result.children = node.getChildren().map(serializeLexicalToYjs);
      } else if (node instanceof ElementNode) {
        result.children = node.getChildren().map(serializeLexicalToYjs);
      }

      return result;
    };

    // Deserialize Yjs format back to Lexical nodes
    const deserializeYjsToLexical = (data: any, parent: ElementNode) => {
      if (!data) return;

      let node: any = null;

      switch (data.type) {
        case 'text':
          node = $createTextNode(data.text || '');
          if (data.format !== undefined) {
            node.setFormat(data.format);
          }
          if (data.style) {
            node.setStyle(data.style);
          }
          if (data.mode !== undefined) {
            node.setMode(data.mode);
          }
          console.log('🔄 [Enhanced Yjs] Deserializing TextNode:', {
            text: data.text,
            format: data.format,
            style: data.style
          });
          break;

        case 'paragraph':
          node = $createParagraphNode();
          break;

        case 'heading':
          node = $createHeadingNode(data.tag || 'h1');
          break;

        case 'quote':
          node = $createQuoteNode();
          break;

        case 'list':
          node = $createListNode(data.listType || 'bullet');
          break;

        case 'listitem':
          node = $createListItemNode();
          if (data.value !== undefined) {
            node.setValue(data.value);
          }
          break;

        case 'code':
          node = $createCodeNode(data.language);
          break;

        case 'link':
          node = $createLinkNode(data.url || '', {
            target: data.target,
            title: data.title,
          });
          break;

        default:
          // Fallback to paragraph for unknown types
          node = $createParagraphNode();
          break;
      }

      if (node) {
        parent.append(node);
        
        // Recursively add children
        if (data.children && Array.isArray(data.children) && node instanceof ElementNode) {
          data.children.forEach((childData: any) => {
            deserializeYjsToLexical(childData, node);
          });
        }
      }
    };

    // Bootstrap initial content if needed
    if (shouldBootstrap && yText.length === 0) {
      const currentState = editor.getEditorState();
      if (currentState) {
        lexicalToYjs(currentState);
      }
    } else if (shouldBootstrap && yText.length > 0) {
      // Apply existing Yjs content to editor
      yjsToLexical();
    }

    // Listen for Yjs changes
    const yObserver = () => {
      console.log('🔄 [Enhanced Yjs] Remote content change detected');
      yjsToLexical();
    };

    yText.observe(yObserver);

    // Listen for Lexical changes
    const unregisterUpdateListener = editor.registerUpdateListener(({ editorState, dirtyElements, dirtyLeaves }) => {
      // Only sync if there are actual content changes
      if (dirtyElements.size > 0 || dirtyLeaves.size > 0) {
        console.log('📝 [Enhanced Yjs] Local content change detected, syncing to Yjs');
        lexicalToYjs(editorState);
      }
    });

    // Cleanup function
    return () => {
      yText.unobserve(yObserver);
      unregisterUpdateListener();
    };
  }, [editor, doc, id, isSynced, shouldBootstrap]);

  return null;
}