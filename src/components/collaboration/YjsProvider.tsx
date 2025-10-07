import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';
import { WebsocketProvider } from 'y-websocket';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface YjsProviderProps {
  documentId: string;
  children: React.ReactNode;
  onConnected?: () => void;
  onDisconnected?: () => void;
  onCollaboratorsChange?: (collaborators: any[]) => void;
}

export interface YjsProviderContextValue {
  doc: Y.Doc;
  provider: WebsocketProvider;
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
  const providerRef = useRef<WebsocketProvider | null>(null);
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
    if (providerRef.current && docRef.current) {
      console.log('[YjsProvider] Already initialized for document:', documentId);
      return;
    }
    
    isInitializingRef.current = true; // Set flag IMMEDIATELY before any async operations
    console.log('[YjsProvider] Initializing Yjs WebSocket collaboration for document:', documentId);

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

    // Build WebSocket URL for Supabase Edge Function - LETTER COLLABORATION
    // y-websocket expects: ws://base/path + /roomname
    // We build the complete URL with documentId in the path and userId as query parameter
    const wsUrl = `wss://wawofclbehbkebjivdte.supabase.co/functions/v1/letter-collaboration/${documentId}?userId=${user.id}`;
    console.log('[YjsProvider] Connecting to WebSocket:', wsUrl);

    // Create WebSocket provider
    const provider = new WebsocketProvider(
      wsUrl,  // Complete URL with documentId in path
      documentId,  // Room name (used internally by y-websocket)
      doc
    );
    providerRef.current = provider;

    // Handle connection status
    provider.on('status', ({ status }: { status: string }) => {
      console.log('[YjsProvider] Connection status:', status);
      const connected = status === 'connected';
      setIsConnected(connected);
      
      if (connected) {
        onConnectedRef.current?.();
        toast.success('Mit Collaboration-Server verbunden');
      } else if (status === 'disconnected') {
        onDisconnectedRef.current?.();
        toast.error('Verbindung zum Collaboration-Server verloren');
      }
    });

    // Handle sync status
    provider.on('sync', (synced: boolean) => {
      console.log('[YjsProvider] Sync status:', synced);
      setIsSynced(synced);
    });

    // Handle collaborators changes via awareness
    const updateCollaborators = () => {
      const states = Array.from(provider.awareness.getStates().entries())
        .filter(([clientId]: [number, any]) => clientId !== provider.awareness.clientID)
        .map(([clientId, state]: [number, any]) => ({
          clientId: clientId.toString(),
          user_id: state.user_id || `client-${clientId}`,
          user_color: state.user_color || `hsl(${(clientId * 137.508) % 360}, 70%, 50%)`,
          profiles: state.profiles || {
            display_name: 'Unknown User',
            avatar_url: null
          }
        }));
      
      console.log('[YjsProvider] Collaborators changed:', states.length);
      setCollaborators(states);
      onCollaboratorsChangeRef.current?.(states);
    };

    provider.awareness.on('change', updateCollaborators);

    // Set local awareness state
    provider.awareness.setLocalStateField('user_id', user.id);
    provider.awareness.setLocalStateField('profiles', {
      display_name: user.user_metadata?.display_name || 'Unknown User',
      avatar_url: user.user_metadata?.avatar_url
    });
    provider.awareness.setLocalStateField('user_color', `#${Math.floor(Math.random()*16777215).toString(16)}`);

    console.log('[YjsProvider] WebSocket provider initialized and connecting');

    return () => {
      console.log('[YjsProvider] Cleaning up Yjs collaboration');
      isInitializingRef.current = false; // Reset flag on cleanup
      
      provider.disconnect();
      provider.destroy();
      persistence.destroy();
      doc.destroy();
      
      docRef.current = null;
      providerRef.current = null;
      persistenceRef.current = null;
    };
  }, [documentId, user?.id]); // Only re-run when document or user changes

  // Always render children, context will be available once connected
  const contextValue: YjsProviderContextValue | null = 
    (docRef.current && providerRef.current) 
      ? {
          doc: docRef.current,
          provider: providerRef.current,
          sharedType: docRef.current.getText('lexical'),
          clientId: providerRef.current.awareness.clientID.toString(),
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
