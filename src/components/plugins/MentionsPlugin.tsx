/**
 * MentionsPlugin - based on the official Lexical Playground MentionsPlugin
 * Uses LexicalTypeaheadMenuPlugin for proper trigger matching and menu rendering.
 * Loads users from profiles table filtered by tenant_id.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  LexicalTypeaheadMenuPlugin,
  MenuOption,
  useBasicTypeaheadTriggerMatch,
} from '@lexical/react/LexicalTypeaheadMenuPlugin';
import { TextNode } from 'lexical';

import { $createMentionNode } from '@/components/nodes/MentionNode';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { getHashedColor, AVAILABLE_COLORS } from '@/utils/userColors';

const SUGGESTION_LIST_LENGTH_LIMIT = 8;

interface MentionsPluginProps {
  onMentionInsert?: (userId: string, displayName: string) => void;
}

interface UserProfile {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  badge_color: string | null;
}

class MentionTypeaheadOption extends MenuOption {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  badgeColor: string;

  constructor(
    userId: string,
    displayName: string,
    avatarUrl: string | null,
    badgeColor: string,
  ) {
    super(displayName);
    this.userId = userId;
    this.displayName = displayName;
    this.avatarUrl = avatarUrl;
    this.badgeColor = badgeColor;
  }
}

/**
 * Resolve a Tailwind badge_color class like 'bg-blue-500' to its hex value.
 */
function resolveBadgeColor(badgeColor: string | null, userId: string): string {
  if (!badgeColor) {
    const fallbackClass = getHashedColor(userId);
    const found = AVAILABLE_COLORS.find(c => c.value === fallbackClass);
    return found?.hex || '#3b82f6';
  }

  // If it's already a hex color, return it
  if (badgeColor.startsWith('#')) return badgeColor;

  // Try to resolve from AVAILABLE_COLORS
  const found = AVAILABLE_COLORS.find(c => c.value === badgeColor);
  return found?.hex || '#3b82f6';
}

function MentionsTypeaheadMenuItem({
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
  option: MentionTypeaheadOption;
}) {
  return (
    <li
      key={option.key}
      tabIndex={-1}
      className={`item ${isSelected ? 'selected' : ''}`}
      ref={option.setRefElement}
      role="option"
      aria-selected={isSelected}
      id={'typeahead-item-' + index}
      onMouseEnter={onMouseEnter}
      onMouseDown={onMouseDown}
    >
      <Avatar className="h-6 w-6 flex-shrink-0">
        <AvatarImage src={option.avatarUrl || undefined} />
        <AvatarFallback
          className="text-xs text-white"
          style={{ backgroundColor: option.badgeColor }}
        >
          {option.displayName.charAt(0).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <span className="text">{option.displayName}</span>
      <span
        className="color-dot"
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          backgroundColor: option.badgeColor,
          marginLeft: 'auto',
          flexShrink: 0,
        }}
      />
    </li>
  );
}

// Cast to avoid JSX generic syntax which breaks the build tooling
const TypeaheadMenuPlugin = LexicalTypeaheadMenuPlugin as React.ComponentType<any>;

export function MentionsPlugin({ onMentionInsert }: MentionsPluginProps = {}): React.JSX.Element | null {
  const [editor] = useLexicalComposerContext();
  const { currentTenant } = useTenant();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [queryString, setQueryString] = useState<string | null>(null);

  // Fetch tenant users
  useEffect(() => {
    if (!currentTenant) return;

    const fetchUsers = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('user_id, display_name, avatar_url, badge_color')
          .eq('tenant_id', currentTenant.id);

        if (error) throw error;
        setUsers(
          (data || []).map((p) => ({
            user_id: p.user_id,
            display_name: p.display_name || 'Unbekannt',
            avatar_url: p.avatar_url,
            badge_color: p.badge_color,
          })),
        );
      } catch (error) {
        console.error('Error fetching users for mentions:', error);
      }
    };

    fetchUsers();
  }, [currentTenant]);

  // Use official trigger match for '@'
  const checkForTriggerMatch = useBasicTypeaheadTriggerMatch('@', {
    minLength: 0,
  });

  // Filter users based on query
  const options = useMemo(() => {
    const query = (queryString || '').toLowerCase();
    return users
      .filter((u) => u.display_name.toLowerCase().includes(query))
      .map(
        (u) =>
          new MentionTypeaheadOption(
            u.user_id,
            u.display_name,
            u.avatar_url,
            resolveBadgeColor(u.badge_color, u.user_id),
          ),
      )
      .slice(0, SUGGESTION_LIST_LENGTH_LIMIT);
  }, [users, queryString]);

  const onSelectOption = useCallback(
    (
      selectedOption: MentionTypeaheadOption,
      nodeToReplace: TextNode | null,
      closeMenu: () => void,
    ) => {
      editor.update(() => {
        const mentionNode = $createMentionNode(
          selectedOption.displayName,
          selectedOption.userId,
          selectedOption.badgeColor,
        );
        if (nodeToReplace) {
          nodeToReplace.replace(mentionNode);
        }
        mentionNode.select();
        closeMenu();
      });

      // Notify parent about the mention
      onMentionInsert?.(selectedOption.userId, selectedOption.displayName);
    },
    [editor, onMentionInsert],
  );

  return (
    <TypeaheadMenuPlugin
      onQueryChange={setQueryString}
      onSelectOption={onSelectOption}
      triggerFn={checkForTriggerMatch}
      options={options}
      menuRenderFn={(
        anchorElementRef: React.MutableRefObject<HTMLElement | null>,
        { selectedIndex, selectOptionAndCleanUp, setHighlightedIndex }: {
          selectedIndex: number | null;
          selectOptionAndCleanUp: (option: MentionTypeaheadOption) => void;
          setHighlightedIndex: (index: number) => void;
        },
      ) => {
        if (!anchorElementRef.current || !options.length) return null;

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
                    <MentionsTypeaheadMenuItem
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
            )
      }}
    />
  );
}
