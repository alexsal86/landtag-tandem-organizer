import React, { useState, useEffect, useCallback } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $createTextNode, $getSelection, $isRangeSelection, TextNode } from 'lexical';
import { mergeRegister } from '@lexical/utils';
import { KEY_ARROW_DOWN_COMMAND, KEY_ARROW_UP_COMMAND, KEY_ENTER_COMMAND, KEY_ESCAPE_COMMAND, COMMAND_PRIORITY_NORMAL } from 'lexical';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';

interface User {
  id: string;
  display_name: string;
  avatar_url?: string;
}

interface MentionSuggestionsProps {
  users: User[];
  selectedIndex: number;
  onSelect: (user: User) => void;
  position: { x: number; y: number };
}

const MentionSuggestions: React.FC<MentionSuggestionsProps> = ({
  users,
  selectedIndex,
  onSelect,
  position
}) => {
  return (
    <Card 
      className="absolute z-50 w-64 max-h-48 overflow-y-auto shadow-lg border"
      style={{ left: position.x, top: position.y }}
    >
      <CardContent className="p-0">
        {users.map((user, index) => (
          <div
            key={user.id}
            className={`flex items-center gap-2 p-2 cursor-pointer hover:bg-accent ${
              index === selectedIndex ? 'bg-accent' : ''
            }`}
            onClick={() => onSelect(user)}
          >
            <Avatar className="h-6 w-6">
              <AvatarImage src={user.avatar_url} />
              <AvatarFallback className="text-xs">
                {user.display_name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm">{user.display_name}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export function MentionsPlugin() {
  const [editor] = useLexicalComposerContext();
  const { currentTenant } = useTenant();
  const [users, setUsers] = useState<User[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mentionPosition, setMentionPosition] = useState({ x: 0, y: 0 });
  const [currentMentionText, setCurrentMentionText] = useState('');

  useEffect(() => {
    if (currentTenant) {
      fetchUsers();
    }
  }, [currentTenant]);

  const fetchUsers = async () => {
    if (!currentTenant) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, display_name, avatar_url')
        .eq('tenant_id', currentTenant.id);

      if (error) throw error;

      const formattedUsers = data.map(profile => ({
        id: profile.user_id,
        display_name: profile.display_name || 'Unknown User',
        avatar_url: profile.avatar_url
      }));

      setUsers(formattedUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const insertMention = useCallback((user: User) => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        // Remove the @ and any typed text
        const anchor = selection.anchor;
        const focus = selection.focus;
        const anchorNode = anchor.getNode();
        
        if (anchorNode instanceof TextNode) {
          const text = anchorNode.getTextContent();
          const atIndex = text.lastIndexOf('@', anchor.offset);
          
          if (atIndex !== -1) {
            // Replace from @ to current position with mention
            const beforeAt = text.substring(0, atIndex);
            const afterMention = text.substring(anchor.offset);
            
            const mentionText = `@${user.display_name}`;
            const newText = beforeAt + mentionText + afterMention;
            
            anchorNode.setTextContent(newText);
            
            // Set cursor after mention
            const newOffset = atIndex + mentionText.length;
            selection.setTextNodeRange(anchorNode, newOffset, anchorNode, newOffset);
          }
        }
      }
    });
    
    setShowSuggestions(false);
    setCurrentMentionText('');
    setSelectedIndex(0);
  }, [editor]);

  useEffect(() => {
    return mergeRegister(
      editor.registerCommand(
        KEY_ARROW_DOWN_COMMAND,
        () => {
          if (showSuggestions) {
            setSelectedIndex(prev => 
              prev < filteredUsers.length - 1 ? prev + 1 : 0
            );
            return true;
          }
          return false;
        },
        COMMAND_PRIORITY_NORMAL
      ),
      editor.registerCommand(
        KEY_ARROW_UP_COMMAND,
        () => {
          if (showSuggestions) {
            setSelectedIndex(prev => 
              prev > 0 ? prev - 1 : filteredUsers.length - 1
            );
            return true;
          }
          return false;
        },
        COMMAND_PRIORITY_NORMAL
      ),
      editor.registerCommand(
        KEY_ENTER_COMMAND,
        () => {
          if (showSuggestions && filteredUsers[selectedIndex]) {
            insertMention(filteredUsers[selectedIndex]);
            return true;
          }
          return false;
        },
        COMMAND_PRIORITY_NORMAL
      ),
      editor.registerCommand(
        KEY_ESCAPE_COMMAND,
        () => {
          if (showSuggestions) {
            setShowSuggestions(false);
            return true;
          }
          return false;
        },
        COMMAND_PRIORITY_NORMAL
      )
    );
  }, [editor, showSuggestions, filteredUsers, selectedIndex, insertMention]);

  useEffect(() => {
    const unregister = editor.registerTextContentListener(() => {
      editor.getEditorState().read(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) {
          setShowSuggestions(false);
          return;
        }

        const anchor = selection.anchor;
        const anchorNode = anchor.getNode();
        
        if (anchorNode instanceof TextNode) {
          const text = anchorNode.getTextContent();
          const cursorOffset = anchor.offset;
          
          // Find the last @ before cursor
          const atIndex = text.lastIndexOf('@', cursorOffset - 1);
          
          if (atIndex !== -1 && atIndex < cursorOffset) {
            const mentionText = text.substring(atIndex + 1, cursorOffset);
            
            // Check if there's a space after @, if so, hide suggestions
            if (mentionText.includes(' ') || mentionText.includes('\n')) {
              setShowSuggestions(false);
              return;
            }
            
            setCurrentMentionText(mentionText);
            
            // Filter users based on mention text
            const filtered = users.filter(user =>
              user.display_name.toLowerCase().includes(mentionText.toLowerCase())
            );
            
            setFilteredUsers(filtered);
            setSelectedIndex(0);
            
            if (filtered.length > 0) {
              // Calculate position for suggestions
              const editorElement = editor.getRootElement();
              if (editorElement) {
                const nativeSelection = window.getSelection();
                const range = nativeSelection?.rangeCount ? nativeSelection.getRangeAt(0) : null;
                const rect = range?.getBoundingClientRect();
                if (rect) {
                  const editorRect = editorElement.getBoundingClientRect();
                  
                  setMentionPosition({
                    x: rect.left - editorRect.left,
                    y: rect.bottom - editorRect.top + 5
                  });
                }
                
                setShowSuggestions(true);
              }
            } else {
              setShowSuggestions(false);
            }
          } else {
            setShowSuggestions(false);
          }
        } else {
          setShowSuggestions(false);
        }
      });
    });

    return unregister;
  }, [editor, users]);

  return (
    <>
      {showSuggestions && filteredUsers.length > 0 && (
        <MentionSuggestions
          users={filteredUsers}
          selectedIndex={selectedIndex}
          onSelect={insertMention}
          position={mentionPosition}
        />
      )}
    </>
  );
}