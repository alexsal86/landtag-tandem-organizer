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
  
  // Return base WebSocket URL without trailing slash to ensure proper roomId appending
  if (isDev) {
    return 'ws://localhost:54321/functions/v1/yjs-collaboration';
  }
  return 'wss://wawofclbehbkebjivdte.supabase.co/functions/v1/yjs-collaboration';
};

// Track active connections to prevent duplicates
const activeConnections = new Map<string, WebsocketProvider>();

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

  // Set up current user with better anonymous ID management
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
      // Improved anonymous user management
      let anonymousId = localStorage.getItem('anonymous_user_id');
      
      // Generate new anonymous ID if none exists or if it's invalid
      if (!anonymousId || anonymousId.length < 10) {
        anonymousId = `anonymous_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        localStorage.setItem('anonymous_user_id', anonymousId);
      }
      
      // Get or generate anonymous display name
      let anonymousName = localStorage.getItem('anonymous_user_name');
      if (!anonymousName) {
        anonymousName = `Anonymous User ${Math.floor(Math.random() * 1000)}`;
        localStorage.setItem('anonymous_user_name', anonymousName);
      }
      
      const anonymousUserData: CollaborationUser = {
        id: anonymousId,
        name: anonymousName,
        avatar: undefined,
        color: localStorage.getItem('anonymous_user_color') || 
               (() => {
                 const color = `hsl(${Math.floor(Math.random() * 360)}, 70%, 50%)`;
                 localStorage.setItem('anonymous_user_color', color);
                 return color;
               })()
      };
      setCurrentUser(anonymousUserData);
    }
  }, [user]);

  const destroyCollaboration = useCallback(() => {
    console.log('Destroying collaboration');
    
    if (provider) {
      try {
        // Simple cleanup
        const roomId = provider.roomname;
        if (roomId) {
          activeConnections.delete(roomId);
        }
        
        // Destroy awareness and provider
        if (provider.awareness) {
          provider.awareness.destroy();
        }
        
        provider.disconnect();
        provider.destroy?.();
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
    setIsReady(false);
  }, [provider, yDoc]);

  const initializeCollaboration = useCallback((documentId: string) => {
    if (!currentUser) {
      console.log('Cannot initialize collaboration: no current user available yet');
      return;
    }

    // Clean up existing collaboration first to prevent memory leaks
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
      // Create new Y.Doc with specific configuration
      const doc = new Y.Doc();
      
      // Add metadata to the document
      doc.getMap('metadata').set('documentId', documentId);
      doc.getMap('metadata').set('createdAt', new Date().toISOString());
      doc.getMap('metadata').set('createdBy', currentUser.id);
      
      setYDoc(doc);

      // Use base WebSocket URL and pass room ID as second parameter
      const wsUrl = getWebSocketUrl();
      // Sanitize documentId and construct roomId to ensure no duplicate parts or invalid characters
      const sanitizedDocumentId = documentId.replace(/[^a-zA-Z0-9\-_]/g, '');
      const roomId = `knowledge-doc-${sanitizedDocumentId}`;
      
      console.log('Connecting to:', wsUrl, 'Room:', roomId);

      // Create WebSocket provider - simplified, don't reuse connections for now
      const wsProvider = new WebsocketProvider(wsUrl, roomId, doc, {
        connect: true,
        params: {
          userId: currentUser.id,
          userName: currentUser.name,
        }
      });

      // Track this connection (simplified)
      activeConnections.set(roomId, wsProvider);

      // Set up awareness before connecting with better error handling
      if (wsProvider.awareness) {
        console.log('🧠 Setting up awareness for user:', currentUser);
        
        try {
          wsProvider.awareness.setLocalStateField('user', {
            name: currentUser.name,
            color: currentUser.color,
            avatar: currentUser.avatar,
            id: currentUser.id,
            timestamp: Date.now()
          });

          // Enhanced awareness change handler (simplified)
          const handleAwarenessChange = () => {
            const states = wsProvider.awareness.getStates();            
            const otherUsers: CollaborationUser[] = [];
            
            states.forEach((state, clientId) => {
              if (state.user && clientId !== wsProvider.awareness.clientID) {
                if (state.user.id && state.user.name) {
                  otherUsers.push({
                    id: state.user.id,
                    name: state.user.name,
                    avatar: state.user.avatar,
                    color: state.user.color || `hsl(${Math.floor(Math.random() * 360)}, 70%, 50%)`
                  });
                }
              }
            });
            
            setUsers(otherUsers);
          };

          wsProvider.awareness.on('change', handleAwarenessChange);
          
        } catch (awarenessError) {
          console.error('Error setting up awareness:', awarenessError);
        }
      }

      // Simplified connection status handling
      const handleStatusChange = (event: { status: string }) => {
        console.log('WebSocket status:', event.status);
        const connected = event.status === 'connected';
        setIsConnected(connected);
        if (connected) {
          setIsReady(true);
        }
      };

      const handleConnectionError = (error: Error) => {
        console.error('WebSocket error:', error);
        setIsConnected(false);
        setIsReady(false);
      };

      wsProvider.on('status', handleStatusChange);
      wsProvider.on('connection-error', handleConnectionError);

      // Add connection timeout - if not connected within 15 seconds, mark as failed
      const connectionTimeout = setTimeout(() => {
        if (!isConnected) {
          console.warn('WebSocket connection timeout - collaboration may not be available');
          setIsConnected(false);
          setIsReady(false);
        }
      }, 15000);

      // Cleanup timeout when component unmounts
      const cleanup = () => {
        clearTimeout(connectionTimeout);
      };

      return cleanup;

      // Enhanced Y.Doc event logging with better error handling
      const handleDocUpdate = (update: Uint8Array, origin: any) => {
        console.log('📝 Y.Doc update:', {
          updateSize: update.length,
          origin: origin?.constructor?.name || origin,
          timestamp: new Date().toISOString(),
          documentId
        });
      };

      const handleBeforeTransaction = (tr: any) => {
        console.log('⚡ Y.Doc before transaction:', {
          origin: tr.origin?.constructor?.name || tr.origin,
          timestamp: new Date().toISOString()
        });
      };

      const handleAfterTransaction = (tr: any) => {
        console.log('✅ Y.Doc after transaction:', {
          origin: tr.origin?.constructor?.name || tr.origin,
          timestamp: new Date().toISOString()
        });
      };

      doc.on('update', handleDocUpdate);
      doc.on('beforeTransaction', handleBeforeTransaction);
      doc.on('afterTransaction', handleAfterTransaction);

      // Store provider and connect with retry mechanism
      setProvider(wsProvider);
      
      // Connect with proper error handling and retry
      setTimeout(() => {
        try {
          console.log('🔌 Attempting to connect WebSocket...');
          wsProvider.connect();
          
          // Set a timeout to check connection status
          setTimeout(() => {
            if (!wsProvider.ws || wsProvider.ws.readyState !== WebSocket.OPEN) {
              console.warn('⚠️ WebSocket connection taking longer than expected');
            }
          }, 5000);
          
        } catch (error) {
          console.error('❌ Error connecting WebSocket:', error);
          handleConnectionError(error);
        }
      }, 100);

    } catch (error) {
      console.error('❌ Error initializing collaboration:', error);
      destroyCollaboration();
    }
  }, [currentUser, destroyCollaboration, user]);

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