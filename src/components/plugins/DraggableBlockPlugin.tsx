import { useCallback, useEffect, useMemo, useRef, useState, type JSX } from 'react';
import { createPortal } from 'react-dom';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { DraggableBlockPlugin_EXPERIMENTAL } from '@lexical/react/LexicalDraggableBlockPlugin';
import {
  $createParagraphNode,
  $createTextNode,
  $getNearestNodeFromDOMNode,
  $getNodeByKey,
  $isParagraphNode,
  $isTextNode,
  type NodeKey,
} from 'lexical';
import { GripVertical, Plus } from 'lucide-react';
import {
  ComponentPickerMenuItem,
  ComponentPickerOption,
  getBaseOptions,
} from './ComponentPickerPlugin';

const DRAGGABLE_BLOCK_MENU_CLASSNAME = 'draggable-block-menu';

type PickerState = {
  insertBefore: boolean;
  targetNodeKey: NodeKey;
};

function isOnMenu(element: HTMLElement): boolean {
  return !!element.closest(`.${DRAGGABLE_BLOCK_MENU_CLASSNAME}`);
}

interface DraggableBlockPluginProps {
  anchorElem?: HTMLElement;
}

export default function DraggableBlockPlugin({
  anchorElem = document.body,
}: DraggableBlockPluginProps): JSX.Element {
  const [editor] = useLexicalComposerContext();
  const menuRef = useRef<HTMLDivElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const targetLineRef = useRef<HTMLDivElement>(null);
  const [draggableElement, setDraggableElement] = useState<HTMLElement | null>(null);
  const [pickerState, setPickerState] = useState<PickerState | null>(null);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [queryString, setQueryString] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [pickerPosition, setPickerPosition] = useState<{ left: number; top: number } | null>(null);

  const options = useMemo(() => {
    const baseOptions = getBaseOptions(editor);
    if (!queryString) return baseOptions;
    const regex = new RegExp(queryString, 'i');
    return baseOptions.filter(
      (option) =>
        regex.test(option.title) ||
        option.keywords.some((keyword) => regex.test(keyword)),
    );
  }, [editor, queryString]);

  useEffect(() => {
    if (isPickerOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isPickerOpen]);

  useEffect(() => {
    if (!isPickerOpen || !options.length) return;
    setHighlightedIndex((current) =>
      Math.min(current, Math.max(options.length - 1, 0)),
    );
  }, [isPickerOpen, options.length]);

  // Click outside to close picker
  useEffect(() => {
    if (!isPickerOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (
        (pickerRef.current && pickerRef.current.contains(target)) ||
        (menuRef.current && menuRef.current.contains(target))
      ) {
        return;
      }
      setIsPickerOpen(false);
      setPickerState(null);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isPickerOpen]);

  const selectOption = useCallback(
    (option: ComponentPickerOption) => {
      if (!pickerState) {
        setIsPickerOpen(false);
        return;
      }
      setIsPickerOpen(false);
      editor.update(() => {
        const node = $getNodeByKey(pickerState.targetNodeKey);
        if (!node) return;
        const placeholder = $createParagraphNode();
        const textNode = $createTextNode('');
        placeholder.append(textNode);
        if (pickerState.insertBefore) {
          node.insertBefore(placeholder);
        } else {
          node.insertAfter(placeholder);
        }
        textNode.select();
        option.onSelect(queryString);
        const latestPlaceholder = placeholder.getLatest();
        if ($isParagraphNode(latestPlaceholder)) {
          const onlyChild = latestPlaceholder.getFirstChild();
          if (
            $isTextNode(onlyChild) &&
            onlyChild.getTextContent().length === 0 &&
            latestPlaceholder.getChildrenSize() === 1
          ) {
            latestPlaceholder.remove();
          }
        }
      });
    },
    [editor, pickerState, queryString],
  );

  // Keyboard navigation
  useEffect(() => {
    if (!isPickerOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isPickerOpen || !options.length) return;
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setHighlightedIndex((i) => (i + 1 >= options.length ? 0 : i + 1));
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setHighlightedIndex((i) => (i - 1 < 0 ? options.length - 1 : i - 1));
      } else if (event.key === 'Enter') {
        event.preventDefault();
        const option = options[highlightedIndex];
        if (option) selectOption(option);
      } else if (event.key === 'Escape') {
        event.preventDefault();
        setIsPickerOpen(false);
        setPickerState(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [highlightedIndex, isPickerOpen, options, selectOption]);

  function openComponentPicker(e: React.MouseEvent) {
    if (!draggableElement || !editor) return;

    let targetNodeKey: NodeKey | null = null;
    editor.read(() => {
      const resolvedNode = $getNearestNodeFromDOMNode(draggableElement);
      if (resolvedNode) {
        targetNodeKey = resolvedNode.getKey();
      }
    });

    if (!targetNodeKey) return;

    const insertBefore = e.altKey || e.ctrlKey;
    const rect = menuRef.current?.getBoundingClientRect();
    setPickerPosition(
      rect
        ? {
            left: rect.left + rect.width + window.scrollX + 8,
            top: rect.top + window.scrollY,
          }
        : null,
    );
    setPickerState({ insertBefore, targetNodeKey });
    setQueryString('');
    setHighlightedIndex(0);
    setIsPickerOpen(true);
  }

  return (
    <>
      {isPickerOpen && pickerPosition
        ? createPortal(
            <div
              ref={pickerRef}
              className="draggable-block-component-picker component-picker-menu"
              style={{
                position: 'absolute',
                left: pickerPosition.left,
                top: pickerPosition.top,
                zIndex: 100,
              }}
            >
              <input
                ref={searchInputRef}
                className="component-picker-search"
                placeholder="Suche..."
                value={queryString}
                onChange={(event) => setQueryString(event.target.value)}
              />
              <ul>
                {options.map((option, i: number) => (
                  <ComponentPickerMenuItem
                    index={i}
                    isSelected={highlightedIndex === i}
                    onClick={() => {
                      setHighlightedIndex(i);
                      selectOption(option);
                    }}
                    onMouseEnter={() => setHighlightedIndex(i)}
                    key={option.key}
                    option={option}
                  />
                ))}
              </ul>
            </div>,
            document.body,
          )
        : null}
      <DraggableBlockPlugin_EXPERIMENTAL
        anchorElem={anchorElem}
        menuRef={menuRef}
        targetLineRef={targetLineRef}
        menuComponent={
          <div ref={menuRef} className={DRAGGABLE_BLOCK_MENU_CLASSNAME}>
            <button
              type="button"
              className="draggable-block-menu-icon icon-plus"
              onClick={openComponentPicker}
              tabIndex={-1}
              title="Block hinzufügen"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              className="draggable-block-menu-icon"
              tabIndex={-1}
            >
              <GripVertical className="h-3.5 w-3.5" />
            </button>
          </div>
        }
        targetLineComponent={
          <div ref={targetLineRef} className="draggable-block-target-line" />
        }
        isOnMenu={isOnMenu}
        onElementChanged={setDraggableElement}
      />
    </>
  );
}
