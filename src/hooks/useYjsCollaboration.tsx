import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '@/integrations/supabase/client';
import { debugConsole } from '@/utils/debugConsole';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import type {
  AwarenessState,
  AwarenessUpdatePayload,
  CollaborationBroadcastEvent,
  CursorPosition,
  SelectionState,
  SupabaseBroadcastEnvelope,
  YjsDocumentUpdate,
  YjsCollaborator,
  YjsUpdatePayload,
} from '@/types/yjsCollaboration';

interface UseYjsCollaborationProps {
  documentId: string;
  onContentChange?: (content: string) => void;
  onCursorChange?: (cursor: CursorPosition | null) => void;
  onSelectionChange?: (selection: SelectionState | null) => void;
}

export interface UseYjsCollaborationReturn {
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
  awareness: {
    getLocalState: () => AwarenessState;
    setLocalState: (state: AwarenessState) => void;
    getStates: () => Map<string, AwarenessState>;
    on: () => void;
    off: () => void;
    destroy: () => void;
  } | null;
  connect: () => void;
  disconnect: () => void;
  sendCursorUpdate: (cursor: CursorPosition | null) => void;
  sendSelectionUpdate: (selection: SelectionState | null) => void;
  sendContentUpdate: (content: string) => void;
}

interface ProfileRecord {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface SupabaseProfilesResponse {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
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
  const [userProfiles, setUserProfiles] = useState<Record<string, ProfileRecord>>({});

  // Yjs document and text
  const ydoc = useRef<Y.Doc>(null);
  const ytext = useRef<Y.Text>(null);
  const provider = useRef<WebsocketProvider | null>(null);
  const awareness = useRef<UseYjsCollaborationReturn['awareness']>(null);
  const supabaseChannel = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Initialize Yjs document
  useEffect((): (() => void) => {
    if (!ydoc.current) {
      ydoc.current = new Y.Doc();
      ytext.current = ydoc.current.getText('content');

      // Listen to content changes
      ytext.current.observe((): void => {
        const content = ytext.current?.toString() || '';
        onContentChange?.(content);
      });
    }

    return (): void => {
      ydoc.current?.destroy();
      ydoc.current = null;
      ytext.current = null;
    };
  }, [documentId, onContentChange]);

  // Load user profiles
  const loadUserProfiles = useCallback(async (userIds: string[]): Promise<void> => {
    if (userIds.length === 0) return;

    try {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url')
        .in('id', userIds);

      const typedProfiles = profiles as SupabaseProfilesResponse[] | null;
      if (typedProfiles) {
        const profilesMap = typedProfiles.reduce<Record<string, ProfileRecord>>((acc, profile) => {
          acc[profile.id] = profile;
          return acc;
        }, {});

        setUserProfiles((prev) => ({ ...prev, ...profilesMap }));
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      debugConsole.error('Error loading user profiles:', message);
    }
  }, []);

  // Current user object
  const currentUser = useMemo<UseYjsCollaborationReturn['currentUser']>(() => {
    if (authUser) {
      const userProfile = userProfiles[authUser.id];
      return {
        id: authUser.id,
        display_name: userProfile?.display_name || 'Unknown User',
        avatar_url: userProfile?.avatar_url ?? undefined,
        user_color: getUserColor(authUser.id),
        isAuthenticated: true
      };
    }

    // Mock user for testing
    const mockId = `mock-user-${Math.random().toString(36).substring(2, 11)}`;
    return {
      id: mockId,
      display_name: 'Test User',
      user_color: getUserColor(mockId),
      isAuthenticated: false
    };
  }, [authUser, userProfiles]);

  // Connect to Yjs collaboration
  const connect = useCallback(async (): Promise<void> => {
    if (connectionState !== 'disconnected' || !documentId || !ydoc.current) {
      return;
    }

    setConnectionState('connecting');

    try {
      // For now, use Supabase Realtime as Yjs provider
      // TODO: Replace with proper Yjs WebSocket provider or custom Supabase provider
      const channelName = `yjs_document_${documentId}`;
      supabaseChannel.current = supabase.channel(channelName);

      // Set up awareness (cursor/selection tracking)
      awareness.current = {
        getLocalState: (): AwarenessState => ({
          user_id: currentUser.id,
          user_color: currentUser.user_color,
          cursor_position: null,
          selection_state: null
        }),
        setLocalState: (state: AwarenessState): void => {
          supabaseChannel.current?.send({
            type: 'broadcast',
            event: 'awareness-update',
            payload: { ...state, user_id: currentUser.id }
          });
        },
        getStates: (): Map<string, AwarenessState> => new Map(),
        on: (): void => {},
        off: (): void => {},
        destroy: (): void => {}
      };

      const applyDocumentUpdate = (updateEvent: YjsDocumentUpdate): void => {
        if (!ydoc.current) {
          return;
        }
        Y.applyUpdate(ydoc.current, updateEvent.update);
      };

      const handleBroadcastEvent = (eventData: CollaborationBroadcastEvent): void => {
        if (eventData.event === 'yjs-update') {
          const { payload } = eventData;
          if (payload.userId !== currentUser.id) {
            applyDocumentUpdate({
              source: 'remote',
              update: new Uint8Array(payload.update),
              userId: payload.userId,
            });
          }
          return;
        }

        const { payload } = eventData;
        if (payload.user_id !== currentUser.id) {
          setCollaborators((prev) => {
            const filtered = prev.filter((collaborator) => collaborator.user_id !== payload.user_id);
            return [
              ...filtered,
              {
                user_id: payload.user_id,
                user_color: payload.user_color,
                cursor_position: payload.cursor_position,
                selection_state: payload.selection_state,
              },
            ];
          });

          if (!userProfiles[payload.user_id]) {
            void loadUserProfiles([payload.user_id]);
          }
        }
      };

      supabaseChannel.current
        .on('broadcast', { event: 'yjs-update' }, ({ payload }: SupabaseBroadcastEnvelope<YjsUpdatePayload>) => {
          handleBroadcastEvent({
            event: 'yjs-update',
            payload,
          });
        })
        .on('broadcast', { event: 'awareness-update' }, ({ payload }: SupabaseBroadcastEnvelope<AwarenessUpdatePayload>) => {
          handleBroadcastEvent({
            event: 'awareness-update',
            payload,
          });
        });

      await supabaseChannel.current.subscribe();

      // Listen to local Yjs updates to broadcast
      ydoc.current.on('update', (update: Uint8Array): void => {
        const localUpdate: YjsDocumentUpdate = {
          source: 'local',
          update,
          userId: currentUser.id,
        };

        supabaseChannel.current?.send({
          type: 'broadcast',
          event: 'yjs-update',
          payload: {
            userId: localUpdate.userId,
            update: Array.from(localUpdate.update),
          },
        });
      });

      setConnectionState('connected');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      debugConsole.error('[Yjs] Connection failed:', message);
      setConnectionState('disconnected');
    }
  }, [connectionState, documentId, currentUser, userProfiles, loadUserProfiles]);

  // Disconnect from collaboration
  const disconnect = useCallback((): void => {
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
  const sendCursorUpdate = useCallback((cursor: CursorPosition | null): void => {
    if (awareness.current) {
      awareness.current.setLocalState({
        ...awareness.current.getLocalState(),
        cursor_position: cursor
      });
    }
    onCursorChange?.(cursor);
  }, [onCursorChange]);

  // Send selection update
  const sendSelectionUpdate = useCallback((selection: SelectionState | null): void => {
    if (awareness.current) {
      awareness.current.setLocalState({
        ...awareness.current.getLocalState(),
        selection_state: selection
      });
    }
    onSelectionChange?.(selection);
  }, [onSelectionChange]);

  // Send content update (handled automatically by Yjs)
  const sendContentUpdate = useCallback((content: string): void => {
    void content;
    // Content updates are handled automatically by Yjs
    // This is kept for API compatibility
  }, []);

  // Auto-connect when documentId changes
  useEffect((): (() => void) => {
    if (documentId && currentUser) {
      void connect();
    }

    return (): void => {
      disconnect();
    };
  }, [documentId, currentUser?.id, connect, disconnect]);

  // Load current user profile
  useEffect((): void => {
    if (authUser && !userProfiles[authUser.id]) {
      void loadUserProfiles([authUser.id]);
    }
  }, [authUser, userProfiles, loadUserProfiles]);

  return {
    connectionState,
    isConnected: connectionState === 'connected',
    isConnecting: connectionState === 'connecting',
    collaborators: collaborators.map((collaborator) => ({
      ...collaborator,
      profiles: userProfiles[collaborator.user_id]
        ? {
            display_name: userProfiles[collaborator.user_id].display_name || 'Unknown User',
            avatar_url: userProfiles[collaborator.user_id].avatar_url ?? undefined,
          }
        : {
            display_name: 'Unknown User',
          },
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
