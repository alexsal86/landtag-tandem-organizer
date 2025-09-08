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
  const { user: currentUser } = useAuth();
  const [connectionState, setConnectionState] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const lastContentRef = useRef<string>('');
  const isInitialized = useRef(false);

  const connect = useCallback(async () => {
    if (!currentUser || !documentId || channelRef.current || isInitialized.current) return;

    console.log('🔄 Starting Supabase Realtime collaboration...');
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

      // Track user presence
      channel.on('presence', { event: 'sync' }, () => {
        console.log('👥 Presence sync');
        const state = channel.presenceState();
        const users = Object.keys(state).map(userId => {
          const presenceArray = state[userId];
          const presence = presenceArray[0] as any; // Type assertion for presence payload
          return {
            user_id: userId,
            user_color: getUserColor(userId),
            cursor_position: presence?.cursor,
            selection_state: presence?.selection,
            profiles: {
              display_name: presence?.display_name || 'Anonymous',
              avatar_url: presence?.avatar_url
            }
          };
        }).filter(user => user.user_id !== currentUser.id);
        
        setCollaborators(users);
      });

      channel.on('presence', { event: 'join' }, ({ key, newPresences }) => {
        console.log('👋 User joined:', key);
      });

      channel.on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        console.log('👋 User left:', key);
      });

      // Listen for content updates
      channel.on('broadcast', { event: 'content-update' }, (payload) => {
        console.log('📝 Content update received:', payload);
        if (payload.content && payload.userId !== currentUser.id && onContentChange) {
          lastContentRef.current = payload.content;
          onContentChange(payload.content);
        }
      });

      // Listen for cursor updates
      channel.on('broadcast', { event: 'cursor-update' }, (payload) => {
        if (payload.userId !== currentUser.id && onCursorChange) {
          onCursorChange(payload.userId, payload.cursor);
        }
      });

      // Listen for selection updates
      channel.on('broadcast', { event: 'selection-update' }, (payload) => {
        if (payload.userId !== currentUser.id && onSelectionChange) {
          onSelectionChange(payload.userId, payload.selection);
        }
      });

      await channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ Connected to collaboration channel');
          setConnectionState('connected');
          
          // Track user presence
          await channel.track({
            user_id: currentUser.id,
            display_name: currentUser.user_metadata?.display_name || 'Anonymous',
            avatar_url: currentUser.user_metadata?.avatar_url,
            online_at: new Date().toISOString(),
          });
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Failed to connect to collaboration channel');
          setConnectionState('disconnected');
        }
      });

      channelRef.current = channel;
      isInitialized.current = true;
      
    } catch (error) {
      console.error('Error setting up collaboration:', error);
      setConnectionState('disconnected');
    }
  }, [currentUser, documentId, onContentChange, onCursorChange, onSelectionChange]);

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

  // Connect when user and documentId are available
  useEffect(() => {
    if (currentUser && documentId && documentId !== '') {
      console.log('🚀 Collaboration hook: Starting connection...');
      connect();
    } else {
      console.log('❌ Collaboration hook: Not connecting - missing requirements');
      console.log('- User:', !!currentUser);
      console.log('- DocumentId:', documentId);
    }
    
    return () => {
      console.log('🔄 Collaboration hook: Cleanup on unmount/deps change');
      disconnect();
    };
  }, [currentUser, documentId, connect, disconnect]);

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