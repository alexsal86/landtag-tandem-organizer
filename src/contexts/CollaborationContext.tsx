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
        // Remove from active connections tracking
        const roomId = provider.roomname;
        if (roomId && activeConnections.get(roomId) === provider) {
          activeConnections.delete(roomId);
        }
        
        // Remove all event listeners first
        provider.off('status', () => {});
        provider.off('connection-error', () => {});
        provider.off('connection-close', () => {});
        
        // Properly destroy awareness
        if (provider.awareness) {
          provider.awareness.off('change', () => {});
          provider.awareness.off('update', () => {});
          provider.awareness.destroy();
        }
        
        // Disconnect and destroy provider
        provider.disconnect();
        provider.destroy?.();
      } catch (error) {
        console.error('Error destroying provider:', error);
      }
      setProvider(null);
    }
    
    if (yDoc) {
      try {
        // Remove all event listeners from Y.Doc
        yDoc.off('update', () => {});
        yDoc.off('beforeTransaction', () => {});
        yDoc.off('afterTransaction', () => {});
        
        // Destroy the document
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

      // Check for existing connection to prevent duplicates
      const existingProvider = activeConnections.get(roomId);
      if (existingProvider && existingProvider.ws && existingProvider.ws.readyState === WebSocket.OPEN) {
        console.log('⚠️ Reusing existing connection for room:', roomId);
        setProvider(existingProvider);
        setYDoc(existingProvider.doc);
        setIsConnected(true);
        setIsReady(true);
        return;
      }

      // Create WebSocket provider with connection options
      const wsProvider = new WebsocketProvider(wsUrl, roomId, doc, {
        connect: true,
        awareness: true,
        params: {
          userId: currentUser.id,
          userName: currentUser.name,
        }
      });

      // Track this connection
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

          // Enhanced awareness change handler
          const handleAwarenessChange = (changes: any) => {
            console.log('👥 Awareness change event:', changes);
            const states = wsProvider.awareness.getStates();
            console.log('👥 All awareness states:', states);
            
            const otherUsers: CollaborationUser[] = [];
            
            states.forEach((state, clientId) => {
              if (state.user && clientId !== wsProvider.awareness.clientID) {
                // Validate user data before adding
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
            
            console.log('👥 Valid other users:', otherUsers);
            setUsers(otherUsers);
          };

          wsProvider.awareness.on('change', handleAwarenessChange);

          wsProvider.awareness.on('update', (update: any) => {
            console.log('📡 Awareness update:', update);
          });
          
        } catch (awarenessError) {
          console.error('Error setting up awareness:', awarenessError);
        }
      }

      // Enhanced connection status handling
      const handleStatusChange = (event: any) => {
        console.log('🔌 WebSocket status changed:', {
          status: event.status,
          roomId,
          timestamp: new Date().toISOString(),
          providerUrl: wsUrl
        });
        
        const isConnected = event.status === 'connected';
        setIsConnected(isConnected);
        
        // Set ready state when connected
        if (isConnected) {
          setIsReady(true);
        }
      };

      const handleConnectionError = (error: any) => {
        console.error('❌ WebSocket connection error:', {
          error,
          roomId,
          url: wsUrl,
          timestamp: new Date().toISOString()
        });
        setIsConnected(false);
        setIsReady(false);
      };

      const handleConnectionClose = (event: any) => {
        console.log('🚪 WebSocket connection closed:', {
          event,
          roomId,
          timestamp: new Date().toISOString()
        });
        setIsConnected(false);
        setIsReady(false);
      };

      wsProvider.on('status', handleStatusChange);
      wsProvider.on('connection-error', handleConnectionError);
      wsProvider.on('connection-close', handleConnectionClose);

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