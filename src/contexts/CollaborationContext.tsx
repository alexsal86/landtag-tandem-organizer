import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { useAuth } from '@/hooks/useAuth';

interface CollaborationUser {
  id: string;
  name?: string;
  avatar?: string;
  color?: string;
}

interface CollaborationContextValue {
  yDoc: Y.Doc | null;
  provider: WebsocketProvider | null;
  isConnected: boolean;
  users: CollaborationUser[];
  currentUser: CollaborationUser | null;
  initializeCollaboration: (documentId: string) => void;
  destroyCollaboration: () => void;
}

const CollaborationContext = createContext<CollaborationContextValue | null>(null);

const getWebSocketUrl = () => {
  // Use localhost for development, production URL for production
  const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  if (isDev) {
    return 'ws://localhost:54321/functions/v1/yjs-collaboration';
  }
  return 'wss://wawofclbehbkebjivdte.supabase.co/functions/v1/yjs-collaboration';
};

interface CollaborationProviderProps {
  children: ReactNode;
}

export const CollaborationProvider: React.FC<CollaborationProviderProps> = ({ children }) => {
  const { user } = useAuth();
  const [yDoc, setYDoc] = useState<Y.Doc | null>(null);
  const [provider, setProvider] = useState<WebsocketProvider | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [users, setUsers] = useState<CollaborationUser[]>([]);
  const [currentUser, setCurrentUser] = useState<CollaborationUser | null>(null);

  // Set up current user
  useEffect(() => {
    if (user) {
      const userData: CollaborationUser = {
        id: user.id,
        name: user.user_metadata?.display_name || user.email || 'Anonymous',
        avatar: user.user_metadata?.avatar_url,
        color: `hsl(${Math.floor(Math.random() * 360)}, 70%, 50%)`
      };
      setCurrentUser(userData);
    } else {
      setCurrentUser(null);
    }
  }, [user]);

  const destroyCollaboration = useCallback(() => {
    console.log('Destroying collaboration');
    
    if (provider) {
      try {
        if (provider.awareness) {
          provider.awareness.destroy();
        }
        provider.disconnect();
      } catch (error) {
        console.error('Error destroying provider:', error);
      }
      setProvider(null);
    }
    
    if (yDoc) {
      try {
        yDoc.destroy();
      } catch (error) {
        console.error('Error destroying Y.Doc:', error);
      }
      setYDoc(null);
    }
    
    setIsConnected(false);
    setUsers([]);
  }, [provider, yDoc]);

  const initializeCollaboration = useCallback((documentId: string) => {
    if (!currentUser) {
      console.log('Cannot initialize collaboration: no current user');
      return;
    }

    // Clean up existing collaboration
    destroyCollaboration();

    console.log('Initializing collaboration for document:', documentId);

    try {
      // Create new Y.Doc
      const doc = new Y.Doc();
      setYDoc(doc);

      // Create WebSocket URL and room ID
      const wsUrl = getWebSocketUrl();
      const roomId = `knowledge-doc-${documentId}`;
      
      console.log('Connecting to:', wsUrl, 'Room:', roomId);

      // Create WebSocket provider with minimal configuration
      const wsProvider = new WebsocketProvider(wsUrl, roomId, doc, {
        connect: false, // Don't auto-connect, we'll do it manually
        maxBackoffTime: 1000,
        resyncInterval: -1, // Disable automatic resync to reduce postMessage noise
      });

      // Set up awareness before connecting
      if (wsProvider.awareness) {
        wsProvider.awareness.setLocalStateField('user', {
          name: currentUser.name,
          color: currentUser.color,
          avatar: currentUser.avatar,
          id: currentUser.id
        });

        // Track other users
        wsProvider.awareness.on('change', () => {
          const states = wsProvider.awareness.getStates();
          const otherUsers: CollaborationUser[] = [];
          
          states.forEach((state, clientId) => {
            if (state.user && clientId !== wsProvider.awareness.clientID) {
              otherUsers.push({
                id: state.user.id || clientId.toString(),
                name: state.user.name,
                avatar: state.user.avatar,
                color: state.user.color
              });
            }
          });
          
          setUsers(otherUsers);
        });
      }

      // Connection status handling
      wsProvider.on('status', (event: any) => {
        console.log('WebSocket status:', event.status);
        setIsConnected(event.status === 'connected');
      });

      wsProvider.on('connection-error', (error: any) => {
        console.error('WebSocket connection error:', error);
        setIsConnected(false);
      });

      wsProvider.on('connection-close', () => {
        console.log('WebSocket connection closed');
        setIsConnected(false);
      });

      // Store provider and connect
      setProvider(wsProvider);
      
      // Connect with error handling
      setTimeout(() => {
        try {
          wsProvider.connect();
        } catch (error) {
          console.error('Error connecting WebSocket:', error);
        }
      }, 100);

    } catch (error) {
      console.error('Error initializing collaboration:', error);
      destroyCollaboration();
    }
  }, [currentUser, destroyCollaboration]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      destroyCollaboration();
    };
  }, [destroyCollaboration]);

  const value: CollaborationContextValue = {
    yDoc,
    provider,
    isConnected,
    users,
    currentUser,
    initializeCollaboration,
    destroyCollaboration
  };

  return (
    <CollaborationContext.Provider value={value}>
      {children}
    </CollaborationContext.Provider>
  );
};

export const useCollaboration = () => {
  const context = useContext(CollaborationContext);
  if (!context) {
    throw new Error('useCollaboration must be used within a CollaborationProvider');
  }
  return context;
};