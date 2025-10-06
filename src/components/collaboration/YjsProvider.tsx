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

    // Build WebSocket URL for Supabase Edge Function
    const wsUrl = `wss://wawofclbehbkebjivdte.supabase.co/functions/v1/knowledge-collaboration`;
    console.log('[YjsProvider] Connecting to WebSocket:', wsUrl);

    // Create WebSocket provider
    const provider = new WebsocketProvider(
      wsUrl,
      documentId,
      doc,
      {
        params: {
          documentId,
          userId: user.id
        }
      }
    );
    providerRef.current = provider;

    // Handle connection status
    provider.on('status', ({ status }: { status: string }) => {
      console.log('[YjsProvider] Connection status:', status);
      const connected = status === 'connected';
      setIsConnected(connected);
      
      if (connected) {
        onConnected?.();
        toast.success('Mit Collaboration-Server verbunden');
      } else if (status === 'disconnected') {
        onDisconnected?.();
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
      onCollaboratorsChange?.(states);
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
      provider.disconnect();
      provider.destroy();
      persistence.destroy();
      doc.destroy();
      
      docRef.current = null;
      providerRef.current = null;
      persistenceRef.current = null;
    };
  }, [documentId, user?.id, onConnected, onDisconnected, onCollaboratorsChange]);

  // Only provide context once we have doc and provider initialized
  if (!docRef.current || !providerRef.current) {
    return null;
  }

  const contextValue: YjsProviderContextValue = {
    doc: docRef.current,
    provider: providerRef.current,
    sharedType: docRef.current.getText('lexical'),
    clientId: providerRef.current.awareness.clientID.toString(),
    isConnected,
    isSynced,
    collaborators,
    currentUser,
  };

  return (
    <YjsProviderContext.Provider value={contextValue}>
      {children}
    </YjsProviderContext.Provider>
  );
}

export function useYjsProvider() {
  const context = useContext(YjsProviderContext);
  if (!context) {
    throw new Error('useYjsProvider must be used within a YjsProvider');
  }
  return context;
}
