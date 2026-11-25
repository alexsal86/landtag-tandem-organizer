/**
 * TopicsPlugin - Typeahead für #-Themen-Erwähnungen.
 * Lädt den Themenkatalog des aktuellen Mandanten und fügt einen TopicNode
 * mit stabiler Themen-ID ein; das Label bleibt nur Anzeige.
 */

import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  LexicalTypeaheadMenuPlugin,
  MenuOption,
  useBasicTypeaheadTriggerMatch,
} from '@lexical/react/LexicalTypeaheadMenuPlugin';
import { TextNode } from 'lexical';

import { $createTopicNode } from '@/components/nodes/TopicNode';
import { supabase } from '@/integrations/supabase/client';
import { useOptionalTenant } from '@/hooks/useTenant';
import { debugConsole } from '@/utils/debugConsole';

const SUGGESTION_LIST_LENGTH_LIMIT = 8;

interface TopicRow {
  id: string;
  label: string;
  color: string;
}

class TopicTypeaheadOption extends MenuOption {
  topicId: string;
  label: string;
  color: string;

  constructor(topicId: string, label: string, color: string) {
    super(`${label}-${topicId}`);
    this.topicId = topicId;
    this.label = label;
    this.color = color;
  }
}

interface TypeaheadMenuState {
  selectedIndex: number | null;
  selectOptionAndCleanUp: (option: TopicTypeaheadOption) => void;
  setHighlightedIndex: (index: number) => void;
}

interface TopicTypeaheadMenuPluginProps {
  onQueryChange: (query: string | null) => void;
  onSelectOption: (
    selectedOption: TopicTypeaheadOption,
    nodeToReplace: TextNode | null,
    closeMenu: () => void,
    matchingString: string,
  ) => void;
  triggerFn: (text: string, editor: unknown) => unknown;
  options: TopicTypeaheadOption[];
  menuRenderFn: (
    anchorElementRef: React.RefObject<HTMLElement | null>,
    itemProps: TypeaheadMenuState,
  ) => React.ReactNode;
}

function TopicsTypeaheadMenuItem({
  index,
  isSelected,
  onMouseDown,
  onMouseEnter,
  option,
}: {
  index: number;
  isSelected: boolean;
  onMouseDown: (event: React.MouseEvent<HTMLLIElement>) => void;
  onMouseEnter: () => void;
  option: TopicTypeaheadOption;
}) {
  return (
    <li
      key={option.key}
      tabIndex={-1}
      className={`item ${isSelected ? 'selected' : ''}`}
      ref={option.setRefElement}
      role="option"
      aria-selected={isSelected}
      id={'topic-typeahead-item-' + index}
      onMouseEnter={onMouseEnter}
      onMouseDown={onMouseDown}
    >
      <span
        className="color-dot"
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          backgroundColor: option.color,
          flexShrink: 0,
        }}
      />
      <span className="text">#{option.label}</span>
    </li>
  );
}

// Cast to avoid JSX generic syntax which breaks the build tooling
const TypeaheadMenuPlugin = LexicalTypeaheadMenuPlugin as React.ComponentType<TopicTypeaheadMenuPluginProps>;

export function TopicsPlugin(): React.JSX.Element | null {
  const [editor] = useLexicalComposerContext();
  // Ohne TenantProvider gibt es keinen Themenkatalog: dann kein Menü statt Absturz.
  const tenantId = useOptionalTenant()?.currentTenant?.id ?? null;
  const [topics, setTopics] = useState<TopicRow[]>([]);
  const [queryString, setQueryString] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantId) {
      setTopics([]);
      return;
    }

    const fetchTopics = async () => {
      try {
        const { data, error } = await supabase
          .from('topics')
          .select('id, label, color')
          .eq('tenant_id', tenantId)
          .eq('is_active', true)
          .order('order_index');

        if (error) throw error;
        setTopics(
          (data ?? []).map((topic) => ({
            id: topic.id,
            label: topic.label || topic.id,
            color: topic.color || '#3b82f6',
          })),
        );
      } catch (error) {
        debugConsole.error('Error fetching topics for mentions:', error);
      }
    };

    fetchTopics();
  }, [tenantId]);

  const checkForTriggerMatch = useBasicTypeaheadTriggerMatch('#', {
    minLength: 0,
  });

  const options = useMemo(() => {
    const query = (queryString || '').toLocaleLowerCase('de');
    return topics
      .filter((topic) => topic.label.toLocaleLowerCase('de').includes(query))
      .map(
        (topic) =>
          new TopicTypeaheadOption(topic.id, topic.label, topic.color),
      )
      .slice(0, SUGGESTION_LIST_LENGTH_LIMIT);
  }, [topics, queryString]);

  const onSelectOption = useCallback(
    (
      selectedOption: TopicTypeaheadOption,
      nodeToReplace: TextNode | null,
      closeMenu: () => void,
    ) => {
      editor.update(() => {
        const topicNode = $createTopicNode(
          selectedOption.label,
          selectedOption.topicId,
          selectedOption.color,
        );
        if (nodeToReplace) {
          nodeToReplace.replace(topicNode);
        }
        topicNode.select();
        closeMenu();
      });
    },
    [editor],
  );

  return (
    <TypeaheadMenuPlugin
      onQueryChange={setQueryString}
      onSelectOption={onSelectOption}
      triggerFn={checkForTriggerMatch}
      options={options}
      menuRenderFn={(
        anchorElementRef: React.RefObject<HTMLElement | null>,
        { selectedIndex, selectOptionAndCleanUp, setHighlightedIndex }: TypeaheadMenuState,
      ) => {
        if (!anchorElementRef.current || !options.length) return null;

        // Lexical renders the typeahead anchor element itself; in modal contexts it can end up
        // below the dialog layer or with non-interactive pointer behavior. Normalize it here.
        anchorElementRef.current.style.zIndex = '9999';
        anchorElementRef.current.style.pointerEvents = 'auto';

        return ReactDOM.createPortal(
          <div
            className="typeahead-popover mentions-menu"
            style={{ zIndex: 9999, pointerEvents: 'auto' }}
            onMouseDown={(event) => {
              // Keep editor focus while interacting with the menu.
              event.preventDefault();
            }}
          >
            <ul>
              {options.map((option, i: number) => (
                <TopicsTypeaheadMenuItem
                  index={i}
                  isSelected={selectedIndex === i}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    setHighlightedIndex(i);
                    selectOptionAndCleanUp(option);
                  }}
                  onMouseEnter={() => {
                    setHighlightedIndex(i);
                  }}
                  key={option.key}
                  option={option}
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
