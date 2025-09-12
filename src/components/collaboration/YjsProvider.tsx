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
  private clientId: string;
  private isConnectedState: boolean = false;
  private eventListeners: Map<string, Set<Function>> = new Map();

  constructor(doc: Y.Doc, documentId: string, userId: string) {
    this.doc = doc;
    this.userId = userId;
    this.clientId = `${userId}-${doc.clientID}-${crypto.randomUUID().slice(0, 8)}`;
    this.awareness = new Awareness(doc);
    
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
        if (payload && payload.clientId !== this.clientId && payload.update) {
          console.log(`[SupabaseYjsProvider] Received remote Yjs update from client: ${payload.clientId}`);
          try {
            const update = new Uint8Array(payload.update);
            Y.applyUpdate(this.doc, update, 'remote');
          } catch (e) {
            console.warn('[SupabaseYjsProvider] Failed to apply remote update:', e);
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
      if (origin !== 'remote' && this.channel) {
        console.log(`[SupabaseYjsProvider] Broadcasting local Yjs update from client: ${this.clientId}`);
        this.channel.send({
          type: 'broadcast',
          event: 'yjs-update',
          payload: {
            clientId: this.clientId,
            userId: this.userId,
            update: Array.from(update)
          }
        });
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
    if (this.channel && !this.isConnectedState) {
      console.log('[SupabaseYjsProvider] Connecting to Supabase transport');
      this.channel.subscribe(async (status: string) => {
        const wasConnected = this.isConnectedState;
        this.isConnectedState = status === 'SUBSCRIBED';
        
        if (this.isConnectedState && !wasConnected) {
          console.log('[SupabaseYjsProvider] Connected to Supabase transport');
          this.emit('connect');
        } else if (!this.isConnectedState && wasConnected) {
          console.log('[SupabaseYjsProvider] Disconnected from Supabase transport');
          this.emit('disconnect');
        }
      });
    }
  }

  disconnect() {
    if (this.channel) {
      console.log('[SupabaseYjsProvider] Disconnecting from Supabase transport');
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
  isConnected: boolean;
  isSynced: boolean;
}

export const YjsProviderContext = React.createContext<YjsProviderContextValue>({
  doc: null,
  provider: null,
  isConnected: false,
  isSynced: false,
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
  
  const onConnectedRef = useRef(onConnected);
  const onDisconnectedRef = useRef(onDisconnected);
  const onCollaboratorsChangeRef = useRef(onCollaboratorsChange);
  
  // Keep callback refs stable
  useEffect(() => {
    onConnectedRef.current = onConnected;
    onDisconnectedRef.current = onDisconnected;
    onCollaboratorsChangeRef.current = onCollaboratorsChange;
  }, [onConnected, onDisconnected, onCollaboratorsChange]);

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
    isConnected,
    isSynced,
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
