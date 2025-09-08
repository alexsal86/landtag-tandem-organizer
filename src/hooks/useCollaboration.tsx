import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';
import { useAuth } from './useAuth';

interface Collaborator {
  user_id: string;
  user_color: string;
  cursor_position?: any;
  selection_state?: any;
  profiles?: {
    display_name: string;
    avatar_url?: string;
  };
}

interface UseCollaborationProps {
  documentId: string;
  onContentChange?: (content: string) => void;
  onCursorChange?: (userId: string, cursor: any) => void;
  onSelectionChange?: (userId: string, selection: any) => void;
}

// Generate a unique color for each user
const getUserColor = (userId: string): string => {
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
    '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
  ];
  const hash = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length];
};

export function useCollaboration({
  documentId,
  onContentChange,
  onCursorChange,
  onSelectionChange
}: UseCollaborationProps) {
  const { user: authUser } = useAuth();
  const [connectionState, setConnectionState] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const lastContentRef = useRef<string>('');
  const isInitialized = useRef(false);
  
  // Stabilize callbacks to prevent infinite useEffect loops
  const stableOnContentChange = useRef(onContentChange);
  const stableOnCursorChange = useRef(onCursorChange);
  const stableOnSelectionChange = useRef(onSelectionChange);
  
  useEffect(() => {
    stableOnContentChange.current = onContentChange;
    stableOnCursorChange.current = onCursorChange;
    stableOnSelectionChange.current = onSelectionChange;
  }, [onContentChange, onCursorChange, onSelectionChange]);

  // Create tab-specific mock user ID using sessionStorage (unique per tab)
  const getMockUser = useCallback(() => {
    let mockUserId = sessionStorage.getItem('collaboration-mock-user-id');
    if (!mockUserId) {
      // Generate unique ID and tab number for better identification
      const randomId = Math.random().toString(36).substr(2, 9);
      const tabNumber = Math.floor(Math.random() * 99) + 1;
      mockUserId = `mock-user-${randomId}`;
      sessionStorage.setItem('collaboration-mock-user-id', mockUserId);
      sessionStorage.setItem('collaboration-tab-number', tabNumber.toString());
      console.log('🆕 Generated new mock user:', { mockUserId, tabNumber });
    }
    
    const tabNumber = sessionStorage.getItem('collaboration-tab-number') || '1';
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F'];
    const userColor = colors[parseInt(tabNumber) % colors.length];
    
    const mockUser = {
      id: mockUserId,
      user_metadata: { 
        display_name: `Test User ${tabNumber}`,
        avatar_url: undefined 
      },
      user_color: userColor
    };
    
    console.log('👤 Mock user for this tab:', mockUser);
    return mockUser;
  }, []);

  // Use mock user if no auth user (for testing) - now stable across renders
  const currentUser = authUser || getMockUser();

  const connect = useCallback(async () => {
    if (!currentUser || !documentId || channelRef.current || isInitialized.current) return;

    console.log('🔄 Starting Supabase Realtime collaboration...', {
      userId: currentUser.id,
      documentId,
      isAuthenticated: !!authUser
    });
    setConnectionState('connecting');
    
    try {
      const channelName = `document-${documentId}`;
      const channel = supabase.channel(channelName, {
        config: {
          presence: {
            key: currentUser.id,
          },
        },
      });

      // Add subscription timeout
      const subscriptionTimeout = setTimeout(() => {
        console.error('⏰ Channel subscription timeout');
        setConnectionState('disconnected');
      }, 10000); // 10 second timeout

      // Track user presence
      channel.on('presence', { event: 'sync' }, () => {
        console.log('👥 Presence sync');
        const state = channel.presenceState();
        console.log('📊 Full presence state:', state);
        console.log('🔑 Presence state keys:', Object.keys(state));
        
        const users = Object.keys(state).map(userId => {
          const presenceArray = state[userId];
          const presence = presenceArray[0] as any; // Type assertion for presence payload
          console.log(`👤 Processing user ${userId}:`, presence);
          
          return {
            user_id: userId,
            user_color: presence?.user_color || getUserColor(userId),
            cursor_position: presence?.cursor,
            selection_state: presence?.selection,
            profiles: {
              display_name: presence?.display_name || 'Anonymous',
              avatar_url: presence?.avatar_url
            }
          };
        }).filter(user => user.user_id !== currentUser.id);
        
        console.log('👥 Filtered collaborators (excluding current user):', users);
        console.log('🔍 Current user ID for filtering:', currentUser.id);
        setCollaborators(users);
      });

      channel.on('presence', { event: 'join' }, ({ key, newPresences }) => {
        console.log('👋 User joined:', key, newPresences);
      });

      channel.on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        console.log('👋 User left:', key, leftPresences);
      });

      // Listen for content updates
      channel.on('broadcast', { event: 'content-update' }, (payload) => {
        console.log('📝 Content update received:', payload);
        if (payload.content && payload.userId !== currentUser.id && stableOnContentChange.current) {
          lastContentRef.current = payload.content;
          stableOnContentChange.current(payload.content);
        }
      });

      // Listen for cursor updates
      channel.on('broadcast', { event: 'cursor-update' }, (payload) => {
        if (payload.userId !== currentUser.id && stableOnCursorChange.current) {
          stableOnCursorChange.current(payload.userId, payload.cursor);
        }
      });

      // Listen for selection updates
      channel.on('broadcast', { event: 'selection-update' }, (payload) => {
        if (payload.userId !== currentUser.id && stableOnSelectionChange.current) {
          stableOnSelectionChange.current(payload.userId, payload.selection);
        }
      });

      await channel.subscribe(async (status) => {
        clearTimeout(subscriptionTimeout);
        console.log('📡 Channel subscription status:', status);
        
        if (status === 'SUBSCRIBED') {
          console.log('✅ Connected to collaboration channel');
          setConnectionState('connected');
          
          try {
            // Track user presence with user color for mock users
            const presenceData: any = {
              user_id: currentUser.id,
              display_name: currentUser.user_metadata?.display_name || 'Anonymous User',
              avatar_url: currentUser.user_metadata?.avatar_url,
              online_at: new Date().toISOString(),
            };

            // Add user_color for mock users
            if ('user_color' in currentUser && currentUser.user_color) {
              presenceData.user_color = currentUser.user_color;
            }

            const trackResult = await channel.track(presenceData);
            console.log('👤 User presence tracked:', trackResult);
            console.log('📡 Presence data sent:', presenceData);
          } catch (trackError) {
            console.warn('⚠️ Failed to track presence:', trackError);
          }
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          console.error('❌ Channel subscription failed:', status);
          setConnectionState('disconnected');
        }
      });

      channelRef.current = channel;
      isInitialized.current = true;
      
    } catch (error) {
      console.error('❌ Error setting up collaboration:', error);
      setConnectionState('disconnected');
    }
  }, [currentUser, documentId]); // Removed callback dependencies to prevent loops

  const disconnect = useCallback(() => {
    console.log('🔌 Disconnecting collaboration...');
    
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    
    setConnectionState('disconnected');
    setCollaborators([]);
    isInitialized.current = false;
    
    console.log('✅ Collaboration disconnected and cleaned up');
  }, []);

  const sendCursorUpdate = useCallback((cursor: any) => {
    if (channelRef.current && currentUser) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'cursor-update',
        payload: {
          userId: currentUser.id,
          documentId,
          cursor,
          timestamp: Date.now()
        }
      });
    }
  }, [documentId, currentUser]);

  const sendSelectionUpdate = useCallback((selection: any) => {
    if (channelRef.current && currentUser) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'selection-update',
        payload: {
          userId: currentUser.id,
          documentId,
          selection,
          timestamp: Date.now()
        }
      });
    }
  }, [documentId, currentUser]);

  const sendContentUpdate = useCallback((content: string) => {
    if (channelRef.current && currentUser && content !== lastContentRef.current) {
      lastContentRef.current = content;
      channelRef.current.send({
        type: 'broadcast',
        event: 'content-update',
        payload: {
          userId: currentUser.id,
          documentId,
          content,
          timestamp: Date.now()
        }
      });
    }
  }, [documentId, currentUser]);

  // Improved debugging for user ID stability
  useEffect(() => {
    console.log('👤 Current user changed:', {
      userId: currentUser?.id,
      isAuth: !!authUser,
      isMock: !authUser,
      displayName: currentUser?.user_metadata?.display_name
    });
  }, [currentUser?.id, authUser]);

  // Connect when user and documentId are available
  useEffect(() => {
    if (currentUser && documentId && documentId !== '') {
      console.log('🚀 Collaboration hook: Starting connection...', {
        userId: currentUser.id,
        hasUser: !!currentUser,
        documentId,
        isAuthenticated: !!authUser
      });
      connect();
    } else {
      console.log('❌ Collaboration hook: Not connecting - missing requirements', {
        userId: currentUser?.id || 'none',
        hasUser: !!currentUser,
        documentId: documentId || 'empty'
      });
    }
    
    return () => {
      console.log('🔄 Collaboration hook: Cleanup on unmount/deps change', {
        userId: currentUser?.id
      });
      disconnect();
    };
  }, [currentUser?.id, documentId]); // Only depend on stable values

  return {
    connectionState,
    isConnected: connectionState === 'connected',
    isConnecting: connectionState === 'connecting',
    collaborators,
    currentUser,
    sendCursorUpdate,
    sendSelectionUpdate,
    sendContentUpdate,
    connect,
    disconnect
  };
}