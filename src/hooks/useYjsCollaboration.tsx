import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '@/integrations/supabase/client';
import * as Y from 'yjs';
// import { WebsocketProvider } from 'y-websocket';

interface YjsCollaborator {
  user_id: string;
  user_color: string;
  cursor_position?: any;
  selection_state?: any;
  profiles?: {
    display_name: string; // Make required to match CollaborationUser
    avatar_url?: string;
  };
}

interface UseYjsCollaborationProps {
  documentId: string;
  onContentChange?: (content: string) => void;
  onCursorChange?: (cursor: any) => void;
  onSelectionChange?: (selection: any) => void;
}

interface UseYjsCollaborationReturn {
  connectionState: 'disconnected' | 'connecting' | 'connected';
  isConnected: boolean;
  isConnecting: boolean;
  collaborators: YjsCollaborator[];
  currentUser: {
    id: string;
    display_name: string;
    user_color: string;
    avatar_url?: string;
    isAuthenticated: boolean;
  };
  ydoc: Y.Doc;
  ytext: Y.Text;
  awareness: any; // y-websocket awareness
  connect: () => void;
  disconnect: () => void;
  sendCursorUpdate: (cursor: any) => void;
  sendSelectionUpdate: (selection: any) => void;
  sendContentUpdate: (content: string) => void;
}

// Generate consistent color for user based on their ID
const getUserColor = (userId: string): string => {
  const colors = [
    '#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', 
    '#3b82f6', '#8b5cf6', '#ec4899', '#f43f5e', '#84cc16'
  ];
  
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash + userId.charCodeAt(i)) & 0xffffffff;
  }
  return colors[Math.abs(hash) % colors.length];
};

export const useYjsCollaboration = ({
  documentId,
  onContentChange,
  onCursorChange,
  onSelectionChange
}: UseYjsCollaborationProps): UseYjsCollaborationReturn => {
  const { user: authUser } = useAuth();
  const [connectionState, setConnectionState] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [collaborators, setCollaborators] = useState<YjsCollaborator[]>([]);
  const [userProfiles, setUserProfiles] = useState<Record<string, any>>({});
  
  // Yjs document and text
  const ydoc = useRef<Y.Doc>();
  const ytext = useRef<Y.Text>();
  const provider = useRef<any>();
  const awareness = useRef<any>();
  const supabaseChannel = useRef<any>();

  // Initialize Yjs document
  useEffect(() => {
    if (!ydoc.current) {
      ydoc.current = new Y.Doc();
      ytext.current = ydoc.current.getText('content');
      
      // Listen to content changes
      ytext.current.observe(() => {
        const content = ytext.current?.toString() || '';
        onContentChange?.(content);
      });
    }

    return () => {
      ydoc.current?.destroy();
      ydoc.current = undefined;
      ytext.current = undefined;
    };
  }, [documentId, onContentChange]);

  // Load user profiles
  const loadUserProfiles = useCallback(async (userIds: string[]) => {
    if (userIds.length === 0) return;
    
    try {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url')
        .in('id', userIds);
      
      if (profiles) {
        const profilesMap = profiles.reduce((acc, profile) => {
          acc[profile.id] = profile;
          return acc;
        }, {} as Record<string, any>);
        
        setUserProfiles(prev => ({ ...prev, ...profilesMap }));
      }
    } catch (error) {
      console.error('Error loading user profiles:', error);
    }
  }, []);

  // Current user object
  const currentUser = useMemo(() => {
    if (authUser) {
      const userProfile = userProfiles[authUser.id];
      return {
        id: authUser.id,
        display_name: userProfile?.display_name || 'Unknown User',
        avatar_url: userProfile?.avatar_url,
        user_color: getUserColor(authUser.id),
        isAuthenticated: true
      };
    } else {
      // Mock user for testing
      const mockId = 'mock-user-' + Math.random().toString(36).substr(2, 9);
      return {
        id: mockId,
        display_name: 'Test User',
        user_color: getUserColor(mockId),
        isAuthenticated: false
      };
    }
  }, [authUser?.id, userProfiles[authUser?.id]]);

  // Connect to Yjs collaboration
  const connect = useCallback(async () => {
    if (connectionState !== 'disconnected' || !documentId || !ydoc.current) {
      return;
    }

    console.log('[Yjs] Connecting to collaboration for document:', documentId);
    setConnectionState('connecting');

    try {
      // For now, use Supabase Realtime as Yjs provider
      // TODO: Replace with proper Yjs WebSocket provider or custom Supabase provider
      
      const channelName = `yjs_document_${documentId}`;
      supabaseChannel.current = supabase.channel(channelName);

      // Set up awareness (cursor/selection tracking)
      awareness.current = {
        getLocalState: () => ({
          user_id: currentUser.id,
          user_color: currentUser.user_color,
          cursor_position: null,
          selection_state: null
        }),
        setLocalState: (state: any) => {
          // Broadcast awareness state via Supabase
          supabaseChannel.current?.send({
            type: 'broadcast',
            event: 'awareness-update',
            payload: { ...state, user_id: currentUser.id }
          });
        },
        getStates: () => new Map(), // Will be populated from Supabase
        on: () => {}, // Event listeners
        off: () => {},
        destroy: () => {}
      };

      // Listen for Yjs updates via Supabase
      supabaseChannel.current
        .on('broadcast', { event: 'yjs-update' }, (payload: any) => {
          if (payload.userId !== currentUser.id && ydoc.current) {
            // Apply remote Yjs update
            const update = new Uint8Array(payload.update);
            Y.applyUpdate(ydoc.current, update);
          }
        })
        .on('broadcast', { event: 'awareness-update' }, (payload: any) => {
          if (payload.user_id !== currentUser.id) {
            // Update collaborators list
            setCollaborators(prev => {
              const filtered = prev.filter(c => c.user_id !== payload.user_id);
              return [...filtered, {
                user_id: payload.user_id,
                user_color: payload.user_color,
                cursor_position: payload.cursor_position,
                selection_state: payload.selection_state
              }];
            });

            // Load profile if not cached
            if (!userProfiles[payload.user_id]) {
              loadUserProfiles([payload.user_id]);
            }
          }
        });

      await supabaseChannel.current.subscribe();

      // Listen to local Yjs updates to broadcast
      ydoc.current.on('update', (update: Uint8Array) => {
        supabaseChannel.current?.send({
          type: 'broadcast',
          event: 'yjs-update',
          payload: {
            userId: currentUser.id,
            update: Array.from(update) // Convert to array for JSON serialization
          }
        });
      });

      setConnectionState('connected');
      console.log('[Yjs] Connected successfully');

    } catch (error) {
      console.error('[Yjs] Connection failed:', error);
      setConnectionState('disconnected');
    }
  }, [connectionState, documentId, currentUser, userProfiles, loadUserProfiles]);

  // Disconnect from collaboration
  const disconnect = useCallback(() => {
    console.log('[Yjs] Disconnecting from collaboration');
    
    if (supabaseChannel.current) {
      supabase.removeChannel(supabaseChannel.current);
      supabaseChannel.current = null;
    }
    
    provider.current?.destroy();
    provider.current = null;
    awareness.current = null;
    
    setConnectionState('disconnected');
    setCollaborators([]);
  }, []);

  // Send cursor update
  const sendCursorUpdate = useCallback((cursor: any) => {
    if (awareness.current) {
      awareness.current.setLocalState({
        ...awareness.current.getLocalState(),
        cursor_position: cursor
      });
    }
    onCursorChange?.(cursor);
  }, [onCursorChange]);

  // Send selection update
  const sendSelectionUpdate = useCallback((selection: any) => {
    if (awareness.current) {
      awareness.current.setLocalState({
        ...awareness.current.getLocalState(),
        selection_state: selection
      });
    }
    onSelectionChange?.(selection);
  }, [onSelectionChange]);

  // Send content update (handled automatically by Yjs)
  const sendContentUpdate = useCallback((content: string) => {
    // Content updates are handled automatically by Yjs
    // This is kept for API compatibility
  }, []);

  // Auto-connect when documentId changes
  useEffect(() => {
    if (documentId && currentUser) {
      connect();
    }
    
    return () => {
      disconnect();
    };
  }, [documentId, currentUser?.id]);

  // Load current user profile
  useEffect(() => {
    if (authUser && !userProfiles[authUser.id]) {
      loadUserProfiles([authUser.id]);
    }
  }, [authUser, userProfiles, loadUserProfiles]);

  return {
    connectionState,
    isConnected: connectionState === 'connected',
    isConnecting: connectionState === 'connecting',
    collaborators: collaborators.map(c => ({
      ...c,
      profiles: userProfiles[c.user_id] ? {
        display_name: userProfiles[c.user_id].display_name || 'Unknown User',
        avatar_url: userProfiles[c.user_id].avatar_url
      } : {
        display_name: 'Unknown User'
      }
    })),
    currentUser,
    ydoc: ydoc.current!,
    ytext: ytext.current!,
    awareness: awareness.current,
    connect,
    disconnect,
    sendCursorUpdate,
    sendSelectionUpdate,
    sendContentUpdate
  };
};