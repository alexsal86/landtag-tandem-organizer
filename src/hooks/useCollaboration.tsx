import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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

// Generate a consistent color for each user based on their user ID
const getUserColor = (userId: string): string => {
  const colors = [
    '#ef4444', '#f97316', '#eab308', '#22c55e', 
    '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899',
    '#f59e0b', '#10b981', '#6366f1', '#d946ef'
  ];
  
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash + userId.charCodeAt(i)) & 0xffffffff;
  }
  return colors[Math.abs(hash) % colors.length];
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
  const [userProfiles, setUserProfiles] = useState<Record<string, any>>({});
  const channelRef = useRef<RealtimeChannel | null>(null);
  const lastContentRef = useRef<string>('');
  
  // Stabilize callbacks to prevent infinite useEffect loops
  const stableOnContentChange = useRef(onContentChange);
  const stableOnCursorChange = useRef(onCursorChange);
  const stableOnSelectionChange = useRef(onSelectionChange);
  
  // Update callback references
  useEffect(() => {
    stableOnContentChange.current = onContentChange;
    stableOnCursorChange.current = onCursorChange;
    stableOnSelectionChange.current = onSelectionChange;
  }, [onContentChange, onCursorChange, onSelectionChange]);

  // Load user profiles from Supabase
  const loadUserProfiles = useCallback(async (userIds: string[]) => {
    if (userIds.length === 0) return;
    
    try {
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('user_id, display_name, avatar_url')
        .in('user_id', userIds);
      
      if (error) {
        console.error('❌ Error loading user profiles:', error);
        return;
      }
      
      const profilesMap = profiles?.reduce((acc, profile) => {
        acc[profile.user_id] = profile;
        return acc;
      }, {} as Record<string, any>) || {};
      
      setUserProfiles(prev => ({ ...prev, ...profilesMap }));
      console.log('👤 Loaded user profiles:', profilesMap);
    } catch (error) {
      console.error('❌ Error loading user profiles:', error);
    }
  }, []);

  // Create stable current user object - only change when auth user ID changes
  const currentUser = useMemo(() => {
    if (authUser) {
      // Real authenticated user - only depend on authUser.id, not full profile
      return {
        id: authUser.id,
        display_name: userProfiles[authUser.id]?.display_name || 'Unknown User',
        avatar_url: userProfiles[authUser.id]?.avatar_url,
        user_color: getUserColor(authUser.id),
        isAuthenticated: true
      };
    } else {
      // Fallback for testing - create consistent mock user per tab
      let mockUserId = sessionStorage.getItem('collaboration-mock-user-id');
      if (!mockUserId) {
        const randomId = Math.random().toString(36).substr(2, 9);
        mockUserId = `mock-user-${randomId}`;
        sessionStorage.setItem('collaboration-mock-user-id', mockUserId);
      }
      
      const tabNumber = sessionStorage.getItem('collaboration-tab-number') || 
                       Math.floor(Math.random() * 99) + 1;
      if (!sessionStorage.getItem('collaboration-tab-number')) {
        sessionStorage.setItem('collaboration-tab-number', tabNumber.toString());
      }
      
      return {
        id: mockUserId,
        display_name: `Test User ${tabNumber}`,
        avatar_url: undefined,
        user_color: getUserColor(mockUserId),
        isAuthenticated: false
      };
    }
  }, [authUser?.id]); // Only depend on user ID, not full profile

  const connect = useCallback(async () => {
    // Prevent duplicate connections
    if (!currentUser?.id || !documentId || channelRef.current) {
      console.log('🚫 Skipping connection - missing requirements or already connected');
      return;
    }

    console.log('🔄 Starting Supabase Realtime collaboration...', {
      userId: currentUser.id,
      displayName: currentUser.display_name,
      documentId,
      isAuthenticated: currentUser.isAuthenticated
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

      // Handle presence updates
      channel.on('presence', { event: 'sync' }, () => {
        console.log('🔄 Presence sync');
        const presenceState = channel.presenceState();
        
        const newCollaborators: Collaborator[] = [];
        const collaboratorUserIds: string[] = [];
        
        for (const [userId, presences] of Object.entries(presenceState)) {
          if (userId !== currentUser.id && presences && presences.length > 0) {
            const presence = presences[0] as any;
            collaboratorUserIds.push(userId);
            
            newCollaborators.push({
              user_id: userId,
              user_color: getUserColor(userId),
              cursor_position: presence.cursor_position,
              selection_state: presence.selection_state,
              profiles: {
                display_name: userProfiles[userId]?.display_name || presence.display_name || `User ${userId.slice(-4)}`,
                avatar_url: userProfiles[userId]?.avatar_url || presence.avatar_url
              }
            });
          }
        }
        
        // Load profiles for new authenticated collaborators
        const unknownAuthUsers = collaboratorUserIds.filter(id => 
          !id.startsWith('mock-user-') && !userProfiles[id]
        );
        if (unknownAuthUsers.length > 0) {
          loadUserProfiles(unknownAuthUsers);
        }
        
        setCollaborators(newCollaborators);
        console.log('👥 Updated collaborators:', newCollaborators);
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
        
        if (payload.payload?.content && payload.payload?.userId !== currentUser.id) {
          lastContentRef.current = payload.payload.content;
          
          if (stableOnContentChange.current) {
            console.log('📝 Applying content update');
            stableOnContentChange.current(payload.payload.content);
          }
        }
      });

      // Listen for cursor updates
      channel.on('broadcast', { event: 'cursor-update' }, (payload) => {
        if (payload.payload?.userId !== currentUser.id && stableOnCursorChange.current) {
          stableOnCursorChange.current(payload.payload.userId, payload.payload.cursor);
        }
      });

      // Listen for selection updates
      channel.on('broadcast', { event: 'selection-update' }, (payload) => {
        if (payload.payload?.userId !== currentUser.id && stableOnSelectionChange.current) {
          stableOnSelectionChange.current(payload.payload.userId, payload.payload.selection);
        }
      });

      await channel.subscribe(async (status) => {
        console.log('📡 Channel subscription status:', status);
        
        if (status === 'SUBSCRIBED') {
          console.log('✅ Connected to collaboration channel');
          setConnectionState('connected');
          
          try {
            // Track user presence
            const presenceData = {
              user_id: currentUser.id,
              display_name: currentUser.display_name,
              avatar_url: currentUser.avatar_url || null,
              user_color: currentUser.user_color,
              online_at: new Date().toISOString(),
              cursor_position: null,
              selection_state: null
            };

            const trackResult = await channel.track(presenceData);
            console.log('👤 User presence tracked:', trackResult);
          } catch (trackError) {
            console.warn('⚠️ Failed to track presence:', trackError);
          }
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          console.error('❌ Channel subscription failed:', status);
          setConnectionState('disconnected');
        }
      });

      channelRef.current = channel;
      
    } catch (error) {
      console.error('❌ Error setting up collaboration:', error);
      setConnectionState('disconnected');
      channelRef.current = null;
    }
  }, [currentUser?.id, documentId]); // Only depend on stable values

  const disconnect = useCallback(() => {
    console.log('🔌 Disconnecting collaboration...');
    
    if (channelRef.current) {
      try {
        supabase.removeChannel(channelRef.current);
      } catch (error) {
        console.warn('⚠️ Error removing channel:', error);
      }
      channelRef.current = null;
    }
    
    setConnectionState('disconnected');
    setCollaborators([]);
    
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

  // Separate effect for connection management - avoid infinite loops
  useEffect(() => {
    let connectionTimeout: NodeJS.Timeout;
    
    if (currentUser?.id && documentId && documentId !== '') {
      console.log('🚀 Collaboration hook: Starting connection...', {
        userId: currentUser.id,
        displayName: currentUser.display_name,
        documentId,
        isAuthenticated: currentUser.isAuthenticated
      });
      
      // Small delay to prevent rapid reconnections
      connectionTimeout = setTimeout(() => {
        connect();
      }, 100);
    }
    
    return () => {
      if (connectionTimeout) {
        clearTimeout(connectionTimeout);
      }
      disconnect();
    };
  }, [currentUser?.id, documentId]); // Only depend on stable user ID and documentId
  
  // Separate effect for profile updates - don't reconnect when profiles change
  useEffect(() => {
    if (authUser && !userProfiles[authUser.id]) {
      loadUserProfiles([authUser.id]);
    }
  }, [authUser?.id, loadUserProfiles]);

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