import type { JSX } from 'react';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { AutoFocusPlugin } from '@lexical/react/LexicalAutoFocusPlugin';
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { MarkdownShortcutPlugin } from '@lexical/react/LexicalMarkdownShortcutPlugin';
import { TRANSFORMERS } from '@lexical/markdown';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { TablePlugin } from '@lexical/react/LexicalTablePlugin';
import { HashtagPlugin } from '@lexical/react/LexicalHashtagPlugin';
import { ClearEditorPlugin } from '@lexical/react/LexicalClearEditorPlugin';
import { CollaborationPlugin } from '@lexical/react/LexicalCollaborationPlugin';
import { $generateHtmlFromNodes, $generateNodesFromDOM } from '@lexical/html';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import type { Awareness } from 'y-protocols/awareness';
import type { Doc } from 'yjs';
import { mergeRegister } from '@lexical/utils';
import { $selectAll } from '@lexical/selection';
import { copyToClipboard } from '@lexical/clipboard';
import { $isMarkNode, $createMarkNode } from '@lexical/mark';
import {
  $getRoot,
  $getSelection,
  $isRangeSelection,
  $createParagraphNode,
  $createTextNode,
  SELECTION_CHANGE_COMMAND,
  COMMAND_PRIORITY_CRITICAL,
  FORMAT_TEXT_COMMAND,
  INDENT_CONTENT_COMMAND,
  OUTDENT_CONTENT_COMMAND,
  UNDO_COMMAND,
  REDO_COMMAND,
  TextFormatType,
} from 'lexical';
import { $createHeadingNode, $createQuoteNode } from '@lexical/rich-text';
import { $createListNode, $createListItemNode, INSERT_UNORDERED_LIST_COMMAND, INSERT_ORDERED_LIST_COMMAND } from '@lexical/list';
import { $createCodeNode } from '@lexical/code';
import { INSERT_TABLE_COMMAND } from '@lexical/table';
import { 
  Bold, 
  Italic, 
  Underline, 
  Strikethrough,
  Code,
  List, 
  ListOrdered, 
  Undo, 
  Redo,
  Heading1,
  Heading2,
  Heading3,
  Type,
  Quote,
  Table,
  Subscript,
  Superscript,
  Copy,
  Upload,
  Hash,
  FileImage,
  Link,
  Highlighter,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Indent,
  Outdent,
  Trash2,
  Download,
  Eye,
  EyeOff,
  PaintBucket,
  Scissors,
  ClipboardCopy,
  RotateCcw,
  FileText,
  Search,
  Replace,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Doc as YDoc } from 'yjs';
import { editorNodes } from './editor/config/editorNodes';
import { editorTheme } from './editor/config/editorTheme';
import { ToolbarDropdown } from './editor/components/ToolbarDropdown';
import { FontFamilyDropdown } from './editor/components/FontFamilyDropdown';
import { FontSizeDropdown } from './editor/components/FontSizeDropdown';
import { ColorPicker } from './editor/components/ColorPicker';
import { InsertDropdown } from './editor/components/InsertDropdown';
import { FloatingTextFormatToolbarPlugin } from './editor/plugins/FloatingTextFormatToolbarPlugin';
import { HorizontalRulePlugin } from './editor/plugins/HorizontalRulePlugin';
import { EquationPlugin } from './editor/plugins/EquationPlugin';
import { ImagePlugin } from './editor/plugins/ImagePlugin';
import { CollapsiblePlugin } from './editor/plugins/CollapsiblePlugin';
import { TextColorPlugin } from './editor/plugins/TextColorPlugin';
import { TextAlignmentPlugin } from './editor/plugins/TextAlignmentPlugin';
import { ClearFormattingPlugin } from './editor/plugins/ClearFormattingPlugin';
import { DraggableMenuWrapper } from './editor/components/DraggableMenuWrapper';

// Component props interface
interface LexicalYjsEditorProps {
  documentId: string;
  initialContent?: string;
  onContentChange?: (content: string, html: string) => void;
  className?: string;
  placeholder?: string;
  readOnly?: boolean;
  autoFocus?: boolean;
  yjsDoc?: Doc;
  awareness?: Awareness;
  isInitialized?: boolean;
}

// Content change tracking plugin with proper HTML serialization
const ContentChangePlugin = ({ onContentChange }: { onContentChange?: (content: string, html: string) => void }) => {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    if (!onContentChange) return;

    const unregister = editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const root = $getRoot();
        const content = root.getTextContent();
        
        // Use official Lexical HTML generation
        const htmlContent = $generateHtmlFromNodes(editor, null);
        
        onContentChange(content, htmlContent);
      });
    });

    return unregister;
  }, [editor, onContentChange]);

  return null;
};

// Initial content setup plugin with proper HTML parsing
const InitialContentPlugin = ({ initialContent }: { initialContent?: string }) => {
  const [editor] = useLexicalComposerContext();
  const hasInitialized = useRef(false);

  useEffect(() => {
    if (!initialContent || hasInitialized.current) return;

    console.log('InitialContentPlugin: Initializing with content:', initialContent.length, 'characters');

    editor.update(() => {
      const root = $getRoot();
      
      // Only initialize if the editor is truly empty
      if (root.getChildrenSize() === 0 || (root.getChildrenSize() === 1 && root.getFirstChild()?.getTextContent() === '')) {
        console.log('InitialContentPlugin: Editor is empty, setting initial content');
        
        // Clear existing content
        root.clear();
        
        // Check if content contains HTML
        if (initialContent.includes('<') && initialContent.includes('>')) {
          // Use official Lexical HTML parsing
          const parser = new DOMParser();
          const dom = parser.parseFromString(initialContent, 'text/html');
          const nodes = $generateNodesFromDOM(editor, dom);
          
          root.append(...nodes);
        } else {
          // Parse simple markdown-like text content
          const lines = initialContent.split('\n');
          
          lines.forEach((line, index) => {
            if (line.startsWith('# ')) {
              const heading = $createHeadingNode('h1');
              heading.append($createTextNode(line.slice(2)));
              root.append(heading);
            } else if (line.startsWith('## ')) {
              const heading = $createHeadingNode('h2');
              heading.append($createTextNode(line.slice(3)));
              root.append(heading);
            } else if (line.startsWith('### ')) {
              const heading = $createHeadingNode('h3');
              heading.append($createTextNode(line.slice(4)));
              root.append(heading);
            } else if (line.startsWith('- ')) {
              const list = $createListNode('bullet');
              const listItem = $createListItemNode();
              listItem.append($createTextNode(line.slice(2)));
              list.append(listItem);
              root.append(list);
            } else if (line.trim()) {
              const paragraph = $createParagraphNode();
              paragraph.append($createTextNode(line));
              root.append(paragraph);
            }
          });
        }
        
        hasInitialized.current = true;
        console.log('InitialContentPlugin: Content initialized');
      } else {
        console.log('InitialContentPlugin: Editor already has content, skipping initialization');
        hasInitialized.current = true;
      }
    });
  }, [editor, initialContent]);

  return null;
};

// Enhanced EditorToolbar component
const EditorToolbar = ({ className }: { className?: string }) => {
  const [editor] = useLexicalComposerContext();
  const [activeFormats, setActiveFormats] = useState<Set<string>>(new Set());
  const [blockType, setBlockType] = useState('paragraph');

  useEffect(() => {
    return editor.registerCommand(
      SELECTION_CHANGE_COMMAND,
      () => {
        editor.getEditorState().read(() => {
          const selection = $getSelection();
          if ($isRangeSelection(selection)) {
            const formats = new Set<string>();
            if (selection.hasFormat('bold')) formats.add('bold');
            if (selection.hasFormat('italic')) formats.add('italic');
            if (selection.hasFormat('underline')) formats.add('underline');
            if (selection.hasFormat('strikethrough')) formats.add('strikethrough');
            if (selection.hasFormat('code')) formats.add('code');
            if (selection.hasFormat('subscript')) formats.add('subscript');
            if (selection.hasFormat('superscript')) formats.add('superscript');
            setActiveFormats(formats);

            // Detect current block type
            const anchorNode = selection.anchor.getNode();
            const element = anchorNode.getKey() === 'root' ? anchorNode : anchorNode.getTopLevelElementOrThrow();
            const elementType = element.getType();
            
            if (elementType === 'heading') {
              setBlockType(`heading-${(element as any).getTag()}`);
            } else if (elementType === 'quote') {
              setBlockType('quote');
            } else if (elementType === 'code') {
              setBlockType('code');
            } else {
              setBlockType('paragraph');
            }
          }
        });
        return false;
      },
      COMMAND_PRIORITY_CRITICAL
    );
  }, [editor]);

  const formatText = (format: TextFormatType) => {
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, format);
  };

  const insertList = (listType: 'bullet' | 'number') => {
    if (listType === 'bullet') {
      editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
    } else {
      editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined);
    }
  };

  const formatBlockType = (type: string) => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        const anchorNode = selection.anchor.getNode();
        const element = anchorNode.getKey() === 'root' ? anchorNode : anchorNode.getTopLevelElementOrThrow();
        
        if (type === 'paragraph') {
          const paragraph = $createParagraphNode();
          paragraph.append($createTextNode(element.getTextContent()));
          element.replace(paragraph);
        } else if (type.startsWith('heading-')) {
          const tag = type.replace('heading-', '') as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
          const heading = $createHeadingNode(tag);
          heading.append($createTextNode(element.getTextContent()));
          element.replace(heading);
        } else if (type === 'quote') {
          const quote = $createQuoteNode();
          quote.append($createTextNode(element.getTextContent()));
          element.replace(quote);
        } else if (type === 'code') {
          const code = $createCodeNode();
          code.append($createTextNode(element.getTextContent()));
          element.replace(code);
        }
      }
    });
  };

  const insertTable = () => {
    editor.dispatchCommand(INSERT_TABLE_COMMAND, { columns: '3', rows: '3', includeHeaders: true });
  };

  const handleUndo = () => {
    editor.dispatchCommand(UNDO_COMMAND, undefined);
  };

  const handleCopyAll = () => {
    editor.update(() => {
      $selectAll();
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        const textContent = selection.getTextContent();
        navigator.clipboard.writeText(textContent);
      }
    });
  };

  const insertHashtag = () => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        selection.insertText('#hashtag ');
      }
    });
  };

  const insertLink = () => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        const url = prompt('Enter URL:');
        if (url) {
          selection.insertText(`[Link](${url})`);
        }
      }
    });
  };

  const highlightText = () => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection) && !selection.isCollapsed()) {
        const markNode = $createMarkNode(['highlight']);
        selection.insertNodes([markNode]);
      }
    });
  };

  const clearFormatting = () => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        selection.getNodes().forEach(node => {
          if (node.getTextContent) {
            const textContent = node.getTextContent();
            const textNode = $createTextNode(textContent);
            node.replace(textNode);
          }
        });
      }
    });
  };

  const handleIndent = () => {
    editor.dispatchCommand(INDENT_CONTENT_COMMAND, undefined);
  };

  const handleOutdent = () => {
    editor.dispatchCommand(OUTDENT_CONTENT_COMMAND, undefined);
  };

  const clearEditor = () => {
    editor.update(() => {
      const root = $getRoot();
      root.clear();
      const paragraph = $createParagraphNode();
      root.append(paragraph);
      paragraph.select();
    });
  };

  const exportAsPlainText = () => {
    editor.getEditorState().read(() => {
      const content = $getRoot().getTextContent();
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'document.txt';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  };

  const exportAsHTML = () => {
    editor.getEditorState().read(() => {
      const htmlContent = $generateHtmlFromNodes(editor, null);
      const blob = new Blob([htmlContent], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'document.html';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  };

  const handleRedo = () => {
    editor.dispatchCommand(REDO_COMMAND, undefined);
  };

  const blockTypeOptions = [
    { key: 'paragraph', label: 'Normal Text', icon: <Type className="h-4 w-4" />, onClick: () => formatBlockType('paragraph') },
    { key: 'heading-h1', label: 'Heading 1', icon: <Heading1 className="h-4 w-4" />, onClick: () => formatBlockType('heading-h1') },
    { key: 'heading-h2', label: 'Heading 2', icon: <Heading2 className="h-4 w-4" />, onClick: () => formatBlockType('heading-h2') },
    { key: 'heading-h3', label: 'Heading 3', icon: <Heading3 className="h-4 w-4" />, onClick: () => formatBlockType('heading-h3') },
    { key: 'quote', label: 'Quote', icon: <Quote className="h-4 w-4" />, onClick: () => formatBlockType('quote') },
    { key: 'code', label: 'Code Block', icon: <Code className="h-4 w-4" />, onClick: () => formatBlockType('code') },
  ];

  return (
    <div className={`toolbar-container border-b bg-card ${className || ''}`}>
      {/* First Row - Main Controls */}
      <div className="flex items-center gap-2 p-2 flex-wrap">
        {/* History */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleUndo}
            className="h-8 w-8 p-0"
            title="Undo (Ctrl+Z)"
          >
            <Undo className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRedo}
            className="h-8 w-8 p-0"
            title="Redo (Ctrl+Y)"
          >
            <Redo className="h-4 w-4" />
          </Button>
        </div>

        <Separator orientation="vertical" className="h-6" />

        {/* Block Type */}
        <ToolbarDropdown
          options={blockTypeOptions}
          selectedKey={blockType}
          buttonLabel="Format"
          className="min-w-32"
        />

        <Separator orientation="vertical" className="h-6" />

        {/* Font Controls */}
        <div className="flex items-center gap-1">
          <FontFamilyDropdown selectedFontFamily="" />
          <FontSizeDropdown selectedFontSize="16px" />
        </div>

        <Separator orientation="vertical" className="h-6" />

        {/* Text Formatting */}
        <div className="flex items-center gap-1">
          <Button
            variant={activeFormats.has('bold') ? 'default' : 'ghost'}
            size="sm"
            onClick={() => formatText('bold')}
            className="h-8 w-8 p-0"
            title="Bold (Ctrl+B)"
          >
            <Bold className="h-4 w-4" />
          </Button>
          <Button
            variant={activeFormats.has('italic') ? 'default' : 'ghost'}
            size="sm"
            onClick={() => formatText('italic')}
            className="h-8 w-8 p-0"
            title="Italic (Ctrl+I)"
          >
            <Italic className="h-4 w-4" />
          </Button>
          <Button
            variant={activeFormats.has('underline') ? 'default' : 'ghost'}
            size="sm"
            onClick={() => formatText('underline')}
            className="h-8 w-8 p-0"
            title="Underline (Ctrl+U)"
          >
            <Underline className="h-4 w-4" />
          </Button>
          <Button
            variant={activeFormats.has('strikethrough') ? 'default' : 'ghost'}
            size="sm"
            onClick={() => formatText('strikethrough')}
            className="h-8 w-8 p-0"
            title="Strikethrough"
          >
            <Strikethrough className="h-4 w-4" />
          </Button>
          <Button
            variant={activeFormats.has('code') ? 'default' : 'ghost'}
            size="sm"
            onClick={() => formatText('code')}
            className="h-8 w-8 p-0"
            title="Inline Code"
          >
            <Code className="h-4 w-4" />
          </Button>
          <Button
            variant={activeFormats.has('subscript') ? 'default' : 'ghost'}
            size="sm"
            onClick={() => formatText('subscript')}
            className="h-8 w-8 p-0"
            title="Subscript"
          >
            <Subscript className="h-4 w-4" />
          </Button>
          <Button
            variant={activeFormats.has('superscript') ? 'default' : 'ghost'}
            size="sm"
            onClick={() => formatText('superscript')}
            className="h-8 w-8 p-0"
            title="Superscript"
          >
            <Superscript className="h-4 w-4" />
          </Button>
        </div>

        <Separator orientation="vertical" className="h-6" />

        {/* Color Controls */}
        <TextColorPlugin />

        <Separator orientation="vertical" className="h-6" />

        {/* Text Alignment */}
        <TextAlignmentPlugin />
        
        <Separator orientation="vertical" className="h-6" />
        
        {/* Clear Formatting */}
        <ClearFormattingPlugin />
      </div>

      {/* Second Row - Lists, Insert, and Advanced Controls */}
      <div className="flex items-center gap-2 p-2 pt-0 flex-wrap border-t">
        {/* Insert Menu */}
        <InsertDropdown />

        <Separator orientation="vertical" className="h-6" />

        {/* Lists */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => insertList('bullet')}
            className="h-8 w-8 p-0"
            title="Bullet List"
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => insertList('number')}
            className="h-8 w-8 p-0"
            title="Numbered List"
          >
            <ListOrdered className="h-4 w-4" />
          </Button>
        </div>

        <Separator orientation="vertical" className="h-6" />

        {/* Indentation */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleOutdent}
            className="h-8 w-8 p-0"
            title="Decrease Indent"
          >
            <Outdent className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleIndent}
            className="h-8 w-8 p-0"
            title="Increase Indent"
          >
            <Indent className="h-4 w-4" />
          </Button>
        </div>

        <Separator orientation="vertical" className="h-6" />

        {/* Links and Special */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={insertLink}
            className="h-8 w-8 p-0"
            title="Insert Link"
          >
            <Link className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={insertHashtag}
            className="h-8 w-8 p-0"
            title="Insert Hashtag"
          >
            <Hash className="h-4 w-4" />
          </Button>
        </div>

        <Separator orientation="vertical" className="h-6" />

        {/* Clear and Export */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFormatting}
            className="h-8 w-8 p-0"
            title="Clear Formatting"
          >
            <PaintBucket className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={clearEditor}
            className="h-8 w-8 p-0"
            title="Clear All Content"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={exportAsHTML}
            className="h-8 w-8 p-0"
            title="Export as HTML"
          >
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

// Main component
export function LexicalYjsEditor({
  documentId,
  initialContent,
  onContentChange,
  className,
  placeholder = "Enter some text...",
  readOnly = false,
  autoFocus = false,
  yjsDoc,
  awareness,
  isInitialized = false
}: LexicalYjsEditorProps) {
  const yjsDocRef = useRef<YDoc | null>(null);
  const contentEditableRef = useRef<HTMLDivElement>(null);
  const blockMenuRef = useRef<HTMLDivElement>(null);
  const targetLineRef = useRef<HTMLDivElement>(null);
  const [anchorElem, setAnchorElem] = useState<HTMLElement | null>(null);

  const initializeYjsDoc = useCallback(() => {
    if (!yjsDocRef.current) {
      yjsDocRef.current = new YDoc();
    }
    return yjsDocRef.current;
  }, []);

  const initialConfig = {
    namespace: 'YjsEditor',
    nodes: editorNodes,
    onError: (error: Error) => {
      console.error('Lexical error:', error);
    },
    theme: editorTheme,
  };

  useEffect(() => {
    initializeYjsDoc();
    
    // Set anchor element when contentEditableRef is available
    if (contentEditableRef.current) {
      console.log('Setting anchor element:', contentEditableRef.current);
      setAnchorElem(contentEditableRef.current);
    }
  }, [initializeYjsDoc]);

  // Update anchor element when ref changes
  useEffect(() => {
    if (contentEditableRef.current && !anchorElem) {
      setAnchorElem(contentEditableRef.current);
    }
  }, [anchorElem]);

  const isOnBlockMenu = (element: HTMLElement): boolean => {
    return blockMenuRef.current?.contains(element) || false;
  };

  return (
    <div className={`lexical-editor ${className || ''}`}>
      <LexicalComposer initialConfig={initialConfig}>
        {!readOnly && <EditorToolbar />}
        <div className="relative group min-h-[400px]">
          <div className="relative h-full editor-container">
            <RichTextPlugin
              contentEditable={
                <ContentEditable 
                  ref={contentEditableRef}
                  className="ContentEditable__root min-h-[400px] p-4 outline-none focus:outline-none resize-none overflow-auto"
                  style={{ 
                    caretColor: 'rgb(5, 5, 5)',
                    paddingLeft: '44px', // Space for block handles
                  }}
                  readOnly={readOnly}
                />
              }
              placeholder={
                <div className="absolute top-4 left-11 text-muted-foreground pointer-events-none select-none">
                  {placeholder}
                </div>
              }
              ErrorBoundary={LexicalErrorBoundary}
            />
          </div>
          
          {/* Block handles will be positioned by DraggableMenuWrapper */}
          
          {/* Draggable Block Plugin Wrapper */}
          <DraggableMenuWrapper contentEditableRef={contentEditableRef} />
        </div>
        <HistoryPlugin />
        {autoFocus && <AutoFocusPlugin />}
        <LinkPlugin />
        <ListPlugin />
        <TablePlugin />
        <HashtagPlugin />
        <ClearEditorPlugin />
        <HorizontalRulePlugin />
        <EquationPlugin />
        <ImagePlugin />
        <CollapsiblePlugin />
        <MarkdownShortcutPlugin transformers={TRANSFORMERS} />
        <FloatingTextFormatToolbarPlugin />
        <ContentChangePlugin onContentChange={onContentChange} />
        <InitialContentPlugin initialContent={initialContent} />
        {/* CollaborationPlugin temporarily disabled due to initialization issues
        {yjsDoc && awareness && isInitialized && (
          <CollaborationPlugin
            id={documentId}
            providerFactory={(id, yjsDocMap) => {
              // Create a mock provider that implements the required interface
              return {
                disconnect: () => {},
                connect: () => {},
                doc: yjsDoc,
                awareness: awareness,
                // Add required event emitter methods
                on: () => {},
                off: () => {}
              } as any;
            }}
            shouldBootstrap={false}
            username={awareness.getLocalState()?.user?.name || 'Anonymous'}
            cursorColor={awareness.getLocalState()?.user?.color || '#ff0000'}
            cursorsContainerRef={{
              current: null
            }}
            initialEditorState={null}
            excludedProperties={new Map()}
          />
        )}
        */}
      </LexicalComposer>
      
      <style>{`
        .lexical-editor .ContentEditable__root {
          border: none;
          font-size: 15px;
          line-height: 1.7;
          color: #000;
        }
        .lexical-editor .ContentEditable__root:focus {
          outline: none;
        }
        .lexical-editor .ContentEditable__root p {
          margin: 0 0 8px 0;
        }
        .lexical-editor .ContentEditable__root h1,
        .lexical-editor .ContentEditable__root h2,
        .lexical-editor .ContentEditable__root h3 {
          margin: 16px 0 8px 0;
        }
        .lexical-editor .ContentEditable__root ul,
        .lexical-editor .ContentEditable__root ol {
          margin: 8px 0;
          padding-left: 20px;
        }
        .lexical-editor .ContentEditable__root blockquote {
          margin: 16px 0;
          border-left: 4px solid #e2e8f0;
          padding-left: 16px;
          color: #64748b;
          font-style: italic;
        }
        .lexical-editor .ContentEditable__root pre {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          padding: 16px;
          margin: 16px 0;
          overflow-x: auto;
          font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', 'source-code-pro', monospace;
          font-size: 14px;
          line-height: 1.5;
        }
        .lexical-editor .ContentEditable__root table {
          border-collapse: collapse;
          width: 100%;
          margin: 16px 0;
        }
        .lexical-editor .ContentEditable__root td,
        .lexical-editor .ContentEditable__root th {
          border: 1px solid #e2e8f0;
          padding: 8px 12px;
          text-align: left;
        }
        .lexical-editor .ContentEditable__root th {
          background-color: #f8fafc;
          font-weight: 600;
        }
      `}</style>
    </div>
  );
}