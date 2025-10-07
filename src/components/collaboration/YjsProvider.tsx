import React, { useEffect, useRef } from 'react';
import * as Y from 'yjs';
import { Awareness, encodeAwarenessUpdate, applyAwarenessUpdate } from 'y-protocols/awareness';
import { IndexeddbPersistence } from 'y-indexeddb';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface YjsProviderProps {
  documentId: string;
  children: React.ReactNode;
  onConnected?: () => void;
  onDisconnected?: () => void;
  onCollaboratorsChange?: (collaborators: any[]) => void;
}

// Custom Provider implementation for Yjs with Supabase transport
class SupabaseYjsProvider {
  public awareness: Awareness;
  private doc: Y.Doc;
  private channel: any = null;
  private persistence: any = null;
  private userId: string;
  public clientId: string;
  private documentId: string;
  private isConnectedState: boolean = false;
  private reconnectTimeout: any = null;
  private eventListeners: Map<string, Set<Function>> = new Map();

  constructor(doc: Y.Doc, documentId: string, userId: string) {
    this.doc = doc;
    this.documentId = documentId;
    this.userId = userId;
    this.clientId = `${userId}-${doc.clientID}-${crypto.randomUUID().slice(0, 8)}`;
    this.awareness = new Awareness(doc);
    
    // Set up initial awareness state to match Lexical-Yjs requirements
    this.awareness.setLocalStateField('user', {
      name: userId,
      color: `#${Math.floor(Math.random()*16777215).toString(16)}`,
      colorLight: `#${Math.floor(Math.random()*16777215).toString(16)}`
    });
    
    console.log(`[SupabaseYjsProvider] Created with clientId: ${this.clientId}`);
    this.initializePersistence(documentId);
    this.initializeSupabaseTransport(documentId);
  }

  private initializePersistence(documentId: string) {
    // IndexedDB persistence is now handled by YjsProvider
    console.log('[SupabaseYjsProvider] IndexedDB persistence handled externally');
  }

  private initializeSupabaseTransport(documentId: string) {
    const channelName = `yjs_document_${documentId}`;
    console.log(`[SupabaseYjsProvider] Initializing transport for channel: ${channelName}, clientId: ${this.clientId}`);
    this.channel = supabase.channel(channelName);

    // Listen for Yjs updates via Supabase
    this.channel
      .on('broadcast', { event: 'yjs-update' }, ({ payload }: any) => {
        // Echo prevention: only check clientId
        if (payload && payload.clientId !== this.clientId && payload.update) {
          console.log(`[SupabaseYjsProvider] Received remote Yjs update from client: ${payload.clientId}`);
          try {
            const update = new Uint8Array(payload.update);
            // Apply update without origin tag
            Y.applyUpdate(this.doc, update);
          } catch (e) {
            console.warn('[SupabaseYjsProvider] Failed to apply remote update:', e);
          }
        }
      })
      .on('broadcast', { event: 'request-state' }, ({ payload }: any) => {
        // If someone requests state and it's not us, send full state
        if (payload && payload.requesterId !== this.clientId && this.doc) {
          console.log(`[SupabaseYjsProvider] Received state request from: ${payload.requesterId}, sending full state`);
          const state = Y.encodeStateAsUpdate(this.doc);
          this.channel.send({
            type: 'broadcast',
            event: 'full-state',
            payload: {
              state: Array.from(state),
              targetId: payload.requesterId,
              senderId: this.clientId
            }
          });
        }
      })
      .on('broadcast', { event: 'full-state' }, ({ payload }: any) => {
        // Only apply if this state is meant for us
        if (payload && payload.targetId === this.clientId && payload.state) {
          console.log(`[SupabaseYjsProvider] Received full state from: ${payload.senderId}`);
          try {
            const state = new Uint8Array(payload.state);
            Y.applyUpdate(this.doc, state);
            console.log('[SupabaseYjsProvider] Applied initial state successfully');
          } catch (e) {
            console.error('[SupabaseYjsProvider] Failed to apply initial state:', e);
          }
        }
      })
      .on('broadcast', { event: 'awareness-update' }, ({ payload }: any) => {
        if (payload && payload.clientId !== this.clientId && payload.awarenessUpdate) {
          console.log(`[SupabaseYjsProvider] Received awareness update from client: ${payload.clientId}`);
          try {
            const awarenessUpdate = new Uint8Array(payload.awarenessUpdate);
            applyAwarenessUpdate(this.awareness, awarenessUpdate, 'remote');
          } catch (e) {
            console.warn('[SupabaseYjsProvider] Failed to apply awareness update:', e);
          }
        }
      });

    // Listen to local Yjs updates to broadcast via Supabase
    this.doc.on('update', (update: Uint8Array, origin: any) => {
      // FIX 2: Refined echo prevention - Only broadcast if NOT from our own client
      if (origin !== this.clientId && this.channel) {
        console.log(`[SupabaseYjsProvider] Broadcasting local Yjs update (origin: ${origin}, own: ${this.clientId})`);
        this.channel.send({
          type: 'broadcast',
          event: 'yjs-update',
          payload: {
            clientId: this.clientId,
            userId: this.userId,
            update: Array.from(update)
          }
        });
      } else {
        console.log(`[SupabaseYjsProvider] Skipping broadcast (own update, origin: ${origin})`);
      }
    });

    // Listen to awareness updates
    this.awareness.on('update', ({ added, updated, removed }: any, origin: any) => {
      if (origin !== 'remote' && this.channel) {
        const changedClients = added.concat(updated).concat(removed);
        const awarenessUpdate = encodeAwarenessUpdate(this.awareness, changedClients);
        console.log(`[SupabaseYjsProvider] Broadcasting awareness update from client: ${this.clientId}`);
        this.channel.send({
          type: 'broadcast',
          event: 'awareness-update',
          payload: {
            clientId: this.clientId,
            userId: this.userId,
            awarenessUpdate: Array.from(awarenessUpdate)
          }
        });
      }
    });
  }

  connect() {
    if (!this.channel) {
      console.error('[SupabaseYjsProvider] No channel available');
      return;
    }

    // Only subscribe if not already connected
    if (this.isConnectedState) {
      console.log('[SupabaseYjsProvider] Already connected');
      return;
    }

    console.log('[SupabaseYjsProvider] Connecting to Supabase transport');
    
    this.channel.subscribe(async (status: string) => {
        const wasConnected = this.isConnectedState;
        this.isConnectedState = status === 'SUBSCRIBED';
        
        if (this.isConnectedState && !wasConnected) {
          console.log('[SupabaseYjsProvider] Connected successfully to Supabase transport');
          this.emit('connect');
          
          // Request initial state with longer delay for more stable connection
          setTimeout(() => {
            if (this.channel && this.isConnectedState) {
              console.log('[SupabaseYjsProvider] Requesting initial state from collaborators');
              this.channel.send({
                type: 'broadcast',
                event: 'request-state',
                payload: { requesterId: this.clientId }
              });
            }
          }, 1000); // Extended from 500ms to 1 second
        } else if (!this.isConnectedState && wasConnected) {
          console.log('[SupabaseYjsProvider] Connection lost, attempting reconnect...');
          this.emit('disconnect');
          
          // Clear existing reconnect timeout
          if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
          }
          
          // Auto-Reconnect after 2 seconds
          this.reconnectTimeout = setTimeout(() => {
            if (!this.isConnectedState) {
              console.log('[SupabaseYjsProvider] Reconnecting...');
              this.disconnect();
              this.initializeSupabaseTransport(this.documentId);
              this.connect();
            }
          }, 2000);
        }
      });
  }

  disconnect() {
    if (this.channel) {
      console.log('[SupabaseYjsProvider] Disconnecting from Supabase transport');
      this.channel.unsubscribe();
      supabase.removeChannel(this.channel);
      this.channel = null;
      this.isConnectedState = false;
      this.emit('disconnect');
    }
  }

  isConnected() {
    return this.isConnectedState;
  }

  on(event: string, callback: Function) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);
  }

  off(event: string, callback: Function) {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(callback);
    }
  }

  private emit(event: string, ...args: any[]) {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => callback(...args));
    }
  }

  destroy() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    this.disconnect();
    try {
      this.persistence?.destroy?.();
    } catch (e) {
      console.warn('[SupabaseYjsProvider] Error destroying IndexedDB persistence:', e);
    }
    this.awareness.destroy();
    this.eventListeners.clear();
  }
}

export interface YjsProviderContextValue {
  doc: Y.Doc | null;
  provider: SupabaseYjsProvider | null;
  clientId: string | null;
  isConnected: boolean;
  isSynced: boolean;
  collaborators: any[];
  currentUser: any;
}

export const YjsProviderContext = React.createContext<YjsProviderContextValue>({
  doc: null,
  provider: null,
  clientId: null,
  isConnected: false,
  isSynced: false,
  collaborators: [],
  currentUser: null,
});

export function YjsProvider({ 
  documentId, 
  children, 
  onConnected, 
  onDisconnected, 
  onCollaboratorsChange 
}: YjsProviderProps) {
  const { user } = useAuth();
  const docRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<SupabaseYjsProvider | null>(null);
  const persistenceRef = useRef<any>(null);
  const [isConnected, setIsConnected] = React.useState(false);
  const [isSynced, setIsSynced] = React.useState(false);
  const [collaborators, setCollaborators] = React.useState<any[]>([]);
  const [currentUserProfile, setCurrentUserProfile] = React.useState<any>(null);
  
  const onConnectedRef = useRef(onConnected);
  const onDisconnectedRef = useRef(onDisconnected);
  const onCollaboratorsChangeRef = useRef(onCollaboratorsChange);
  
  // Keep callback refs stable
  useEffect(() => {
    onConnectedRef.current = onConnected;
    onDisconnectedRef.current = onDisconnected;
    onCollaboratorsChangeRef.current = onCollaboratorsChange;
  }, [onConnected, onDisconnected, onCollaboratorsChange]);

  // Load user profile separately
  useEffect(() => {
    const loadUserProfile = async () => {
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('display_name, avatar_url')
          .eq('user_id', user.id)
          .maybeSingle();
        
        setCurrentUserProfile(profile);
      }
    };
    
    loadUserProfile();
  }, [user?.id]);

  // Update awareness when profile loads
  useEffect(() => {
    if (providerRef.current && user) {
      providerRef.current.awareness.setLocalStateField('userId', user.id);
      providerRef.current.awareness.setLocalStateField('displayName', currentUserProfile?.display_name || user?.user_metadata?.display_name || user?.email?.split('@')[0]);
      providerRef.current.awareness.setLocalStateField('avatarUrl', currentUserProfile?.avatar_url || user?.user_metadata?.avatar_url);
    }
  }, [currentUserProfile, user]);

  useEffect(() => {
    if (!documentId) return;

    console.log('[YjsProvider] Initializing Yjs provider for document:', documentId);

    // Create Yjs document
    const doc = new Y.Doc();
    docRef.current = doc;

    // Create IndexedDB persistence
    const persistence = new IndexeddbPersistence(`yjs_${documentId}`, doc);
    persistenceRef.current = persistence;
    
    persistence.on('synced', () => {
      console.log('[YjsProvider] IndexedDB synced');
      setIsSynced(true);
    });

    // Create custom provider
    const provider = new SupabaseYjsProvider(doc, documentId, user?.id || 'anonymous');
    providerRef.current = provider;

    // Set up event listeners
    provider.on('connect', () => {
      setIsConnected(true);
      onConnectedRef.current?.();
    });

    provider.on('disconnect', () => {
      setIsConnected(false);
      onDisconnectedRef.current?.();
    });

    // Track awareness changes for collaborators
    const updateCollaborators = () => {
      const awarenessStates = Array.from(provider.awareness.getStates().entries());
      const collaboratorsList = awarenessStates
        .filter(([clientId]) => clientId !== provider.awareness.clientID)
        .map(([clientId, state]: [number, any]) => ({
          user_id: state.userId || `client-${clientId}`,
          user_color: `hsl(${(clientId * 137.508) % 360}, 70%, 50%)`,
          profiles: {
            display_name: state.displayName || state.name || 'Unknown User',
            avatar_url: state.avatarUrl
          }
        }));
      
      setCollaborators(collaboratorsList);
      onCollaboratorsChangeRef.current?.(collaboratorsList);
    };

    provider.awareness.on('update', updateCollaborators);

    // Connect the provider
    provider.connect();

    // Cleanup function
    return () => {
      console.log('[YjsProvider] Cleaning up Yjs provider for document:', documentId);
      
      provider.destroy();
      persistence.destroy();
      doc.destroy();
      
      docRef.current = null;
      providerRef.current = null;
      persistenceRef.current = null;
      setIsConnected(false);
      setIsSynced(false);
    };
  }, [documentId, user?.id]);

  const contextValue: YjsProviderContextValue = {
    doc: docRef.current,
    provider: providerRef.current,
    clientId: providerRef.current?.clientId || null,
    isConnected,
    isSynced,
    collaborators,
    currentUser: { ...user, profile: currentUserProfile },
  };

  return (
    <YjsProviderContext.Provider value={contextValue}>
      {children}
    </YjsProviderContext.Provider>
  );
}

export function useYjsProvider() {
  const context = React.useContext(YjsProviderContext);
  if (!context) {
    throw new Error('useYjsProvider must be used within a YjsProvider');
  }
  return context;
}
