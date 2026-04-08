import { useCallback, useMemo, useState } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  LexicalTypeaheadMenuPlugin,
  MenuOption,
  useBasicTypeaheadTriggerMatch,
} from '@lexical/react/LexicalTypeaheadMenuPlugin';
import { $createParagraphNode, $getSelection, $isRangeSelection, TextNode } from 'lexical';
import { $createHeadingNode, $createQuoteNode } from '@lexical/rich-text';
import {
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  INSERT_CHECK_LIST_COMMAND,
} from '@lexical/list';
import { $createCodeNode } from '@lexical/code';
import { INSERT_HORIZONTAL_RULE_COMMAND } from '@lexical/react/LexicalHorizontalRuleNode';
import { createPortal } from 'react-dom';
import {
  Heading1, Heading2, Heading3,
  List, ListOrdered, CheckSquare,
  Quote, Code, Minus, Type,
} from 'lucide-react';

class ComponentPickerOption extends MenuOption {
  title: string;
  icon: React.ReactNode;
  keywords: string[];
  onSelect: (queryTextForItem: string) => void;

  constructor(
    title: string,
    options: {
      icon: React.ReactNode;
      keywords?: string[];
      onSelect: (queryTextForItem: string) => void;
    },
  ) {
    super(title);
    this.title = title;
    this.icon = options.icon;
    this.keywords = options.keywords ?? [];
    this.onSelect = options.onSelect;
  }
}

function ComponentPickerMenuItem({
  index,
  isSelected,
  onClick,
  onMouseEnter,
  option,
}: {
  index: number;
  isSelected: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
  option: ComponentPickerOption;
}) {
  return (
    <li
      key={option.key}
      tabIndex={-1}
      className={`component-picker-item ${isSelected ? 'selected' : ''}`}
      ref={option.setRefElement}
      role="option"
      aria-selected={isSelected}
      id={`typeahead-item-${index}`}
      onMouseEnter={onMouseEnter}
      onClick={onClick}
    >
      <span className="component-picker-item-icon">{option.icon}</span>
      <span className="component-picker-item-text">{option.title}</span>
    </li>
  );
}

export default function ComponentPickerPlugin(): JSX.Element {
  const [editor] = useLexicalComposerContext();
  const [queryString, setQueryString] = useState<string | null>(null);

  const checkForTriggerMatch = useBasicTypeaheadTriggerMatch('/', {
    minLength: 0,
  });

  const options = useMemo(() => {
    const iconClass = 'h-4 w-4';
    const baseOptions: ComponentPickerOption[] = [
      new ComponentPickerOption('Text', {
        icon: <Type className={iconClass} />,
        keywords: ['paragraph', 'normal', 'text'],
        onSelect: () =>
          editor.update(() => {
            const selection = $getSelection();
            if ($isRangeSelection(selection)) {
              selection.insertNodes([$createParagraphNode()]);
            }
          }),
      }),
      new ComponentPickerOption('Überschrift 1', {
        icon: <Heading1 className={iconClass} />,
        keywords: ['heading', 'h1', 'title', 'überschrift'],
        onSelect: () =>
          editor.update(() => {
            const selection = $getSelection();
            if ($isRangeSelection(selection)) {
              const anchor = selection.anchor.getNode();
              const element = anchor.getTopLevelElementOrThrow();
              const heading = $createHeadingNode('h1');
              element.replace(heading);
              heading.selectEnd();
            }
          }),
      }),
      new ComponentPickerOption('Überschrift 2', {
        icon: <Heading2 className={iconClass} />,
        keywords: ['heading', 'h2', 'subtitle', 'überschrift'],
        onSelect: () =>
          editor.update(() => {
            const selection = $getSelection();
            if ($isRangeSelection(selection)) {
              const anchor = selection.anchor.getNode();
              const element = anchor.getTopLevelElementOrThrow();
              const heading = $createHeadingNode('h2');
              element.replace(heading);
              heading.selectEnd();
            }
          }),
      }),
      new ComponentPickerOption('Überschrift 3', {
        icon: <Heading3 className={iconClass} />,
        keywords: ['heading', 'h3', 'überschrift'],
        onSelect: () =>
          editor.update(() => {
            const selection = $getSelection();
            if ($isRangeSelection(selection)) {
              const anchor = selection.anchor.getNode();
              const element = anchor.getTopLevelElementOrThrow();
              const heading = $createHeadingNode('h3');
              element.replace(heading);
              heading.selectEnd();
            }
          }),
      }),
      new ComponentPickerOption('Aufzählung', {
        icon: <List className={iconClass} />,
        keywords: ['bullet', 'list', 'unordered', 'aufzählung', 'liste'],
        onSelect: () =>
          editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined),
      }),
      new ComponentPickerOption('Nummerierte Liste', {
        icon: <ListOrdered className={iconClass} />,
        keywords: ['numbered', 'list', 'ordered', 'nummeriert'],
        onSelect: () =>
          editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined),
      }),
      new ComponentPickerOption('Checkliste', {
        icon: <CheckSquare className={iconClass} />,
        keywords: ['check', 'checklist', 'todo', 'task'],
        onSelect: () =>
          editor.dispatchCommand(INSERT_CHECK_LIST_COMMAND, undefined),
      }),
      new ComponentPickerOption('Zitat', {
        icon: <Quote className={iconClass} />,
        keywords: ['quote', 'blockquote', 'zitat'],
        onSelect: () =>
          editor.update(() => {
            const selection = $getSelection();
            if ($isRangeSelection(selection)) {
              const anchor = selection.anchor.getNode();
              const element = anchor.getTopLevelElementOrThrow();
              const quote = $createQuoteNode();
              element.replace(quote);
              quote.selectEnd();
            }
          }),
      }),
      new ComponentPickerOption('Code-Block', {
        icon: <Code className={iconClass} />,
        keywords: ['code', 'codeblock'],
        onSelect: () =>
          editor.update(() => {
            const selection = $getSelection();
            if ($isRangeSelection(selection)) {
              const anchor = selection.anchor.getNode();
              const element = anchor.getTopLevelElementOrThrow();
              const codeNode = $createCodeNode();
              element.replace(codeNode);
              codeNode.selectEnd();
            }
          }),
      }),
      new ComponentPickerOption('Trennlinie', {
        icon: <Minus className={iconClass} />,
        keywords: ['hr', 'divider', 'separator', 'trennlinie', 'horizontal'],
        onSelect: () =>
          editor.dispatchCommand(INSERT_HORIZONTAL_RULE_COMMAND, undefined),
      }),
    ];

    if (!queryString) {
      return baseOptions;
    }

    const regex = new RegExp(queryString, 'i');
    return baseOptions.filter(
      (option) =>
        regex.test(option.title) ||
        option.keywords.some((keyword) => regex.test(keyword)),
    );
  }, [editor, queryString]);

  const onSelectOption = useCallback(
    (
      selectedOption: ComponentPickerOption,
      nodeToRemove: TextNode | null,
      closeMenu: () => void,
      matchingString: string,
    ) => {
      editor.update(() => {
        nodeToRemove?.remove();
        selectedOption.onSelect(matchingString);
        closeMenu();
      });
    },
    [editor],
  );

  return (
    <LexicalTypeaheadMenuPlugin<ComponentPickerOption>
      onQueryChange={setQueryString}
      onSelectOption={onSelectOption}
      triggerFn={checkForTriggerMatch}
      options={options}
      menuRenderFn={(
        anchorElementRef,
        { selectedIndex, selectOptionAndCleanUp, setHighlightedIndex },
      ) => {
        if (anchorElementRef.current == null || options.length === 0) {
          return null;
        }
        return createPortal(
          <div className="component-picker-menu">
            <ul>
              {options.map((option, i) => (
                <ComponentPickerMenuItem
                  index={i}
                  isSelected={selectedIndex === i}
                  onClick={() => {
                    setHighlightedIndex(i);
                    selectOptionAndCleanUp(option);
                  }}
                  onMouseEnter={() => setHighlightedIndex(i)}
                  option={option}
                  key={option.key}
                />
              ))}
            </ul>
          </div>,
          anchorElementRef.current,
        );
      }}
    />
  );
}
