import React from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { 
  $getSelection, 
  $isRangeSelection,
  FORMAT_TEXT_COMMAND,
} from 'lexical';
import { $setBlocksType } from '@lexical/selection';
import { $createHeadingNode, HeadingTagType } from '@lexical/rich-text';
import { $createParagraphNode } from 'lexical';

interface LexicalToolbarProps {
  className?: string;
}

const LexicalToolbar: React.FC<LexicalToolbarProps> = ({ className = '' }) => {
  const [editor] = useLexicalComposerContext();
  
  const formatText = (format: 'bold' | 'italic' | 'underline') => {
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, format);
  };

  const formatHeading = (headingSize: HeadingTagType) => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        $setBlocksType(selection, () => $createHeadingNode(headingSize));
      }
    });
  };

  const formatParagraph = () => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        $setBlocksType(selection, () => $createParagraphNode());
      }
    });
  };

  return (
    <div className={`lexical-toolbar ${className}`}>
      <div className="toolbar-group">
        <button
          type="button"
          onClick={() => formatText('bold')}
          className="toolbar-button"
          title="Fett"
        >
          <strong>B</strong>
        </button>
        <button
          type="button"
          onClick={() => formatText('italic')}
          className="toolbar-button"
          title="Kursiv"
        >
          <em>I</em>
        </button>
        <button
          type="button"
          onClick={() => formatText('underline')}
          className="toolbar-button"
          title="Unterstrichen"
        >
          <u>U</u>
        </button>
      </div>
      
      <div className="toolbar-divider"></div>
      
      <div className="toolbar-group">
        <button
          type="button"
          onClick={() => formatHeading('h1')}
          className="toolbar-button"
          title="Überschrift 1"
        >
          H1
        </button>
        <button
          type="button"
          onClick={() => formatHeading('h2')}
          className="toolbar-button"
          title="Überschrift 2"
        >
          H2
        </button>
        <button
          type="button"
          onClick={() => formatHeading('h3')}
          className="toolbar-button"
          title="Überschrift 3"
        >
          H3
        </button>
        <button
          type="button"
          onClick={formatParagraph}
          className="toolbar-button"
          title="Normal"
        >
          P
        </button>
      </div>
    </div>
  );
};

export default LexicalToolbar;