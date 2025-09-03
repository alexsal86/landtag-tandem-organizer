import React, { createContext, useState, useEffect, useCallback, ReactNode } from 'react';
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
  isReady: boolean;
}

const CollaborationContext = createContext<CollaborationContextValue | null>(null);

export { CollaborationContext };

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
  console.log('🔄 CollaborationProvider rendering');
  const { user } = useAuth();
  const [yDoc, setYDoc] = useState<Y.Doc | null>(null);
  const [provider, setProvider] = useState<WebsocketProvider | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [users, setUsers] = useState<CollaborationUser[]>([]);
  const [currentUser, setCurrentUser] = useState<CollaborationUser | null>(null);
  const [isReady, setIsReady] = useState(false);

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
      // Allow anonymous collaboration for knowledge management without Supabase auth
      const anonymousId = localStorage.getItem('anonymous_user_id') || 
        `anonymous_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('anonymous_user_id', anonymousId);
      
      const anonymousUserData: CollaborationUser = {
        id: anonymousId,
        name: 'Anonymous User',
        avatar: undefined,
        color: `hsl(${Math.floor(Math.random() * 360)}, 70%, 50%)`
      };
      setCurrentUser(anonymousUserData);
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
      console.log('Cannot initialize collaboration: no current user available yet');
      return;
    }

    // Clean up existing collaboration
    destroyCollaboration();

    console.log('🚀 Initializing collaboration for document:', documentId);
    console.log('👤 Current user:', {
      id: currentUser.id,
      name: currentUser.name,
      avatar: currentUser.avatar,
      color: currentUser.color
    });
    console.log('🔐 Auth context:', {
      hasUser: !!user,
      userId: user?.id,
      userEmail: user?.email,
      isAnonymous: !user
    });

    try {
      // Create new Y.Doc
      const doc = new Y.Doc();
      setYDoc(doc);

      // Create WebSocket URL and room ID
      const wsUrl = getWebSocketUrl();
      const roomId = `knowledge-doc-${documentId}`;
      
      console.log('Connecting to:', wsUrl, 'Room:', roomId);

      // Create WebSocket provider - room ID is now in URL path for native Yjs protocol
      const wsProvider = new WebsocketProvider(`${wsUrl}/${roomId}`, roomId, doc);

      // Set up awareness before connecting
      if (wsProvider.awareness) {
        console.log('🧠 Setting up awareness for user:', currentUser);
        wsProvider.awareness.setLocalStateField('user', {
          name: currentUser.name,
          color: currentUser.color,
          avatar: currentUser.avatar,
          id: currentUser.id
        });

        // Log all awareness events
        wsProvider.awareness.on('change', (changes: any) => {
          console.log('👥 Awareness change event:', changes);
          const states = wsProvider.awareness.getStates();
          console.log('👥 All awareness states:', states);
          
          const otherUsers: CollaborationUser[] = [];
          
          states.forEach((state, clientId) => {
            console.log('👤 Client state:', { clientId, state });
            if (state.user && clientId !== wsProvider.awareness.clientID) {
              otherUsers.push({
                id: state.user.id || clientId.toString(),
                name: state.user.name,
                avatar: state.user.avatar,
                color: state.user.color
              });
            }
          });
          
          console.log('👥 Other users:', otherUsers);
          setUsers(otherUsers);
        });

        wsProvider.awareness.on('update', (update: any) => {
          console.log('📡 Awareness update:', update);
        });
      }

      // Connection status handling with detailed logging
      wsProvider.on('status', (event: any) => {
        console.log('🔌 WebSocket status changed:', {
          status: event.status,
          roomId,
          timestamp: new Date().toISOString(),
          providerUrl: wsUrl
        });
        setIsConnected(event.status === 'connected');
      });

      wsProvider.on('connection-error', (error: any) => {
        console.error('❌ WebSocket connection error:', {
          error,
          roomId,
          url: wsUrl,
          timestamp: new Date().toISOString()
        });
        setIsConnected(false);
      });

      wsProvider.on('connection-close', (event: any) => {
        console.log('🚪 WebSocket connection closed:', {
          event,
          roomId,
          timestamp: new Date().toISOString()
        });
        setIsConnected(false);
      });

      // Add Y.Doc event logging
      doc.on('update', (update: Uint8Array, origin: any) => {
        console.log('📝 Y.Doc update:', {
          updateSize: update.length,
          origin,
          timestamp: new Date().toISOString()
        });
      });

      doc.on('beforeTransaction', (tr: any) => {
        console.log('⚡ Y.Doc before transaction:', tr);
      });

      doc.on('afterTransaction', (tr: any) => {
        console.log('✅ Y.Doc after transaction:', tr);
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

  // Set up isReady when provider is available
  useEffect(() => {
    setIsReady(true);
  }, []);

  const value: CollaborationContextValue = {
    yDoc,
    provider,
    isConnected,
    users,
    currentUser,
    initializeCollaboration,
    destroyCollaboration,
    isReady
  };

  console.log('🚀 CollaborationProvider providing context:', { 
    hasYDoc: !!yDoc, 
    hasProvider: !!provider, 
    isConnected, 
    currentUser: currentUser?.name 
  });

  return (
    <CollaborationContext.Provider value={value}>
      {children}
    </CollaborationContext.Provider>
  );
};