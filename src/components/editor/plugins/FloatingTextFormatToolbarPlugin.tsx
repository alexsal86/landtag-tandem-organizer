import { useCallback, useEffect, useRef, useState } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getSelection, $isRangeSelection, SELECTION_CHANGE_COMMAND } from 'lexical';
import { $isAtNodeEnd } from '@lexical/selection';
import { getDOMRangeRect } from '../utils/getDOMRangeRect';
import { setFloatingElemPosition } from '../utils/setFloatingElemPosition';
import { FloatingTextFormatToolbar } from '../components/FloatingTextFormatToolbar';

const VERTICAL_GAP = 10;

export function FloatingTextFormatToolbarPlugin(): JSX.Element | null {
  const [editor] = useLexicalComposerContext();
  const [isText, setIsText] = useState(false);
  const [isLink, setIsLink] = useState(false);
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  const [isStrikethrough, setIsStrikethrough] = useState(false);
  const [isSubscript, setIsSubscript] = useState(false);
  const [isSuperscript, setIsSuperscript] = useState(false);
  const [isCode, setIsCode] = useState(false);

  const popupCharStylesEditorRef = useRef<HTMLDivElement | null>(null);

  const updateTextFormatFloatingToolbar = useCallback(() => {
    const selection = $getSelection();

    const popupCharStylesEditorElem = popupCharStylesEditorRef.current;
    const nativeSelection = window.getSelection();

    if (popupCharStylesEditorElem === null) {
      return;
    }

    const rootElement = editor.getRootElement();
    if (
      selection !== null &&
      nativeSelection !== null &&
      !nativeSelection.isCollapsed &&
      rootElement !== null &&
      rootElement.contains(nativeSelection.anchorNode)
    ) {
      const rangeRect = getDOMRangeRect(nativeSelection, rootElement);

      setFloatingElemPosition(
        rangeRect,
        popupCharStylesEditorElem,
        rootElement,
        VERTICAL_GAP,
      );
    }
  }, [editor]);

  useEffect(() => {
    const updateToolbar = () => {
      editor.getEditorState().read(() => {
        const selection = $getSelection();
        const popupCharStylesEditorElem = popupCharStylesEditorRef.current;
        const nativeSelection = window.getSelection();

        if (popupCharStylesEditorElem === null) {
          return;
        }

        if (
          $isRangeSelection(selection) &&
          nativeSelection !== null &&
          !nativeSelection.isCollapsed
        ) {
          const node = selection.getNodes()[0];
          if (node) {
            setIsText(true);
            setIsBold(selection.hasFormat('bold'));
            setIsItalic(selection.hasFormat('italic'));
            setIsUnderline(selection.hasFormat('underline'));
            setIsStrikethrough(selection.hasFormat('strikethrough'));
            setIsSubscript(selection.hasFormat('subscript'));
            setIsSuperscript(selection.hasFormat('superscript'));
            setIsCode(selection.hasFormat('code'));
            popupCharStylesEditorElem.style.visibility = 'visible';
            updateTextFormatFloatingToolbar();
          }
        } else {
          setIsText(false);
          popupCharStylesEditorElem.style.visibility = 'hidden';
        }
      });
    };

    updateToolbar();

    return editor.registerCommand(
      SELECTION_CHANGE_COMMAND,
      () => {
        updateToolbar();
        return false;
      },
      1,
    );
  }, [editor, updateTextFormatFloatingToolbar]);

  if (!isText) {
    return null;
  }

  return (
    <div ref={popupCharStylesEditorRef} className="absolute top-0 left-0 z-10 opacity-0 bg-background rounded-lg shadow-lg border border-border transition-opacity">
      <FloatingTextFormatToolbar
        isBold={isBold}
        isItalic={isItalic}
        isStrikethrough={isStrikethrough}
        isSubscript={isSubscript}
        isSuperscript={isSuperscript}
        isUnderline={isUnderline}
        isCode={isCode}
      />
    </div>
  );
}