import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface YjsProviderProps {
  documentId: string;
  children: React.ReactNode;
  onConnected?: () => void;
  onDisconnected?: () => void;
  onCollaboratorsChange?: (collaborators: any[]) => void;
}

export interface YjsProviderContextValue {
  doc: Y.Doc;
  channel: RealtimeChannel | null;
  sharedType: Y.Text;
  clientId: string;
  isConnected: boolean;
  isSynced: boolean;
  collaborators: any[];
  currentUser: any;
}

export const YjsProviderContext = createContext<YjsProviderContextValue | null>(null);

export function YjsProvider({ 
  documentId, 
  children, 
  onConnected, 
  onDisconnected, 
  onCollaboratorsChange 
}: YjsProviderProps) {
  const { user } = useAuth();
  const docRef = useRef<Y.Doc | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const persistenceRef = useRef<IndexeddbPersistence | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isSynced, setIsSynced] = useState(false);
  const [collaborators, setCollaborators] = useState<any[]>([]);
  
  // Prevent double initialization during React StrictMode or fast re-renders
  const isInitializingRef = useRef(false);
  
  // Store callbacks in refs to prevent re-rendering
  const onConnectedRef = useRef(onConnected);
  const onDisconnectedRef = useRef(onDisconnected);
  const onCollaboratorsChangeRef = useRef(onCollaboratorsChange);
  
  // Update refs when callbacks change
  useEffect(() => {
    onConnectedRef.current = onConnected;
    onDisconnectedRef.current = onDisconnected;
    onCollaboratorsChangeRef.current = onCollaboratorsChange;
  }, [onConnected, onDisconnected, onCollaboratorsChange]);

  // Get current user
  const currentUser = user ? {
    user_id: user.id,
    profiles: {
      display_name: user.user_metadata?.display_name || 'Unknown User',
      avatar_url: user.user_metadata?.avatar_url
    }
  } : null;

  useEffect(() => {
    if (!documentId || !user?.id) {
      console.log('[YjsProvider] Missing documentId or user, skipping initialization');
      return;
    }
    
    // Prevent double initialization
    if (isInitializingRef.current) {
      console.log('[YjsProvider] Already initializing, skipping...');
      return;
    }
    
    // Check if already initialized
    if (channelRef.current && docRef.current) {
      console.log('[YjsProvider] Already initialized for document:', documentId);
      return;
    }
    
    isInitializingRef.current = true;
    console.log('[YjsProvider] Initializing Yjs Supabase Realtime collaboration for document:', documentId);

    // Create Yjs document
    const doc = new Y.Doc();
    docRef.current = doc;
    
    // Create shared text type for Lexical
    const sharedType = doc.getText('lexical');

    // Create IndexedDB persistence
    const persistence = new IndexeddbPersistence(`yjs_${documentId}`, doc);
    persistenceRef.current = persistence;

    persistence.on('synced', () => {
      console.log('[YjsProvider] IndexedDB persistence synced');
      setIsSynced(true);
    });

    // Create Supabase Realtime channel for this document
    const channelName = `document:${documentId}`;
    const channel = supabase.channel(channelName, {
      config: {
        broadcast: { self: false }, // Don't receive our own broadcasts
        presence: { key: user.id }
      }
    });
    channelRef.current = channel;

    // Handle Yjs updates - send to other clients
    const updateHandler = (update: Uint8Array, origin: any) => {
      // Don't broadcast updates from remote (would cause loops)
      if (origin !== 'remote') {
        channel.send({
          type: 'broadcast',
          event: 'yjs-update',
          payload: { update: Array.from(update) }
        });
      }
    };
    doc.on('update', updateHandler);

    // Handle Yjs updates - receive from other clients
    channel.on('broadcast', { event: 'yjs-update' }, ({ payload }) => {
      try {
        Y.applyUpdate(doc, new Uint8Array(payload.update), 'remote');
      } catch (error) {
        console.error('[YjsProvider] Error applying update:', error);
      }
    });

    // Handle presence for collaborators tracking
    channel.on('presence', { event: 'sync' }, () => {
      const presenceState = channel.presenceState();
      const collaboratorsList = Object.entries(presenceState)
        .filter(([key]) => key !== user.id)
        .map(([key, data]: [string, any]) => {
          const presence = Array.isArray(data) ? data[0] : data;
          return {
            clientId: key,
            user_id: presence.user_id || key,
            user_color: presence.user_color || `hsl(${Math.abs(hashCode(key)) % 360}, 70%, 50%)`,
            profiles: presence.profiles || {
              display_name: 'Unknown User',
              avatar_url: null
            }
          };
        });
      
      console.log('[YjsProvider] Collaborators changed:', collaboratorsList.length);
      setCollaborators(collaboratorsList);
      onCollaboratorsChangeRef.current?.(collaboratorsList);
    });

    channel.on('presence', { event: 'join' }, ({ key, newPresences }) => {
      console.log('[YjsProvider] User joined:', key);
    });

    channel.on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
      console.log('[YjsProvider] User left:', key);
    });

    // Subscribe to channel
    channel.subscribe(async (status) => {
      console.log('[YjsProvider] Channel status:', status);
      
      if (status === 'SUBSCRIBED') {
        setIsConnected(true);
        
        // Track presence with user info
        await channel.track({
          user_id: user.id,
          profiles: {
            display_name: user.user_metadata?.display_name || 'Unknown User',
            avatar_url: user.user_metadata?.avatar_url
          },
          user_color: `hsl(${Math.abs(hashCode(user.id)) % 360}, 70%, 50%)`,
          online_at: new Date().toISOString()
        });
        
        onConnectedRef.current?.();
        toast.success('Echtzeit-Collaboration aktiv');
      } else if (status === 'CHANNEL_ERROR') {
        setIsConnected(false);
        onDisconnectedRef.current?.();
        toast.error('Verbindungsfehler zur Collaboration');
      } else if (status === 'TIMED_OUT') {
        setIsConnected(false);
        toast.error('Verbindung zur Collaboration unterbrochen');
      }
    });

    console.log('[YjsProvider] Supabase Realtime channel initialized');

    return () => {
      console.log('[YjsProvider] Cleaning up Yjs collaboration');
      isInitializingRef.current = false;
      
      // Unsubscribe from channel
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
      
      // Cleanup persistence and document
      persistence.destroy();
      doc.destroy();
      
      docRef.current = null;
      channelRef.current = null;
      persistenceRef.current = null;
    };
  }, [documentId, user?.id]); // Only re-run when document or user changes

  // Always render children, context will be available once connected
  const contextValue: YjsProviderContextValue | null = 
    (docRef.current && channelRef.current) 
      ? {
          doc: docRef.current,
          channel: channelRef.current,
          sharedType: docRef.current.getText('lexical'),
          clientId: user?.id || 'anonymous',
          isConnected,
          isSynced,
          collaborators,
          currentUser,
        }
      : null;

  return (
    <YjsProviderContext.Provider value={contextValue}>
      {children}
    </YjsProviderContext.Provider>
  );
}

export function useYjsProvider() {
  const context = useContext(YjsProviderContext);
  // Return null if not yet available, don't throw error
  return context;
}

// Simple hash function for consistent colors
function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash;
}
