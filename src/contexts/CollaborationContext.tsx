import React, { createContext, useState, useEffect, useCallback, ReactNode, useRef } from 'react';
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
  const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  return isDev
    ? 'ws://localhost:54321/functions/v1/yjs-collaboration'
    : 'wss://wawofclbehbkebjivdte.supabase.co/functions/v1/yjs-collaboration';
};

const activeConnections = new Map<string, WebsocketProvider>();

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
  const [isReady, setIsReady] = useState(false);

  const awarenessHandlerRef = useRef<(() => void) | null>(null);
  const statusHandlerRef = useRef<((event: { status: string }) => void) | null>(null);
  const connectionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentRoomRef = useRef<string | null>(null);

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
      let anonymousId = localStorage.getItem('anonymous_user_id');
      if (!anonymousId || anonymousId.length < 10) {
        anonymousId = `anonymous_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
        localStorage.setItem('anonymous_user_id', anonymousId);
      }
      let anonymousName = localStorage.getItem('anonymous_user_name');
      if (!anonymousName) {
        anonymousName = `Anonymous User ${Math.floor(Math.random() * 1000)}`;
        localStorage.setItem('anonymous_user_name', anonymousName);
      }
      const color =
        localStorage.getItem('anonymous_user_color') ||
        (() => {
          const c = `hsl(${Math.floor(Math.random() * 360)}, 70%, 50%)`;
          localStorage.setItem('anonymous_user_color', c);
          return c;
        })();
      setCurrentUser({
        id: anonymousId,
        name: anonymousName,
        color
      });
    }
  }, [user]);

  const destroyCollaboration = useCallback(() => {
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
      connectionTimeoutRef.current = null;
    }

    if (provider) {
      try {
        if (provider.awareness && awarenessHandlerRef.current) {
          provider.awareness.off('change', awarenessHandlerRef.current as any);
        }
        if (statusHandlerRef.current) {
          provider.off('status', statusHandlerRef.current);
        }
        const roomId = provider.roomname;
        if (roomId) {
          activeConnections.delete(roomId);
        }
        provider.disconnect();
        provider.destroy?.();
      } catch (e) {
        console.error('Error destroying provider:', e);
      }
      setProvider(null);
    }

    if (yDoc) {
      try {
        yDoc.destroy();
      } catch (e) {
        console.error('Error destroying Y.Doc:', e);
      }
      setYDoc(null);
    }

    currentRoomRef.current = null;
    setIsConnected(false);
    setUsers([]);
    setIsReady(false);
  }, [provider, yDoc]);

  const initializeCollaboration = useCallback(
    (documentId: string) => {
      if (!currentUser) {
        console.log('Collab init deferred – user not ready yet.');
        return;
      }

      const sanitizedDocumentId = documentId.replace(/[^a-zA-Z0-9-_]/g, '');
      const roomId = `knowledge-doc-${sanitizedDocumentId}`;
      if (currentRoomRef.current === roomId && provider && yDoc) {
        console.log('Already connected to requested document:', roomId);
        return;
      }

      destroyCollaboration();

      console.log('Initializing collaboration for', documentId, 'as room', roomId);

      try {
        const doc = new Y.Doc();
        doc.getMap('metadata').set('documentId', documentId);
        doc.getMap('metadata').set('createdAt', new Date().toISOString());
        doc.getMap('metadata').set('createdBy', currentUser.id);
        setYDoc(doc);

        const wsUrl = getWebSocketUrl();
        const wsProvider = new WebsocketProvider(wsUrl, roomId, doc, {
          connect: false,
          params: {
            userId: currentUser.id,
            userName: currentUser.name
          }
        });

        currentRoomRef.current = roomId;
        activeConnections.set(roomId, wsProvider);

        if (wsProvider.awareness) {
            wsProvider.awareness.setLocalStateField('user', {
              id: currentUser.id,
              name: currentUser.name,
              color: currentUser.color,
              avatar: currentUser.avatar,
              timestamp: Date.now()
            });

            const handleAwarenessChange = () => {
              const states = wsProvider.awareness.getStates();
              const otherUsers: CollaborationUser[] = [];
              states.forEach((state: any, clientId: number) => {
                if (state.user && clientId !== wsProvider.awareness.clientID) {
                  otherUsers.push({
                    id: state.user.id,
                    name: state.user.name,
                    avatar: state.user.avatar,
                    color: state.user.color
                  });
                }
              });
              setUsers(otherUsers);
            };
            awarenessHandlerRef.current = handleAwarenessChange;
            wsProvider.awareness.on('change', handleAwarenessChange);
        }

        const handleStatusChange = (event: { status: string }) => {
          const connected = event.status === 'connected';
            setIsConnected(connected);
            if (connected) {
              setIsReady(true);
            }
        };
        statusHandlerRef.current = handleStatusChange;
        wsProvider.on('status', handleStatusChange);

        connectionTimeoutRef.current = setTimeout(() => {
          if (!wsProvider.connected) {
            console.warn('WebSocket connection timeout – collaboration not ready.');
            setIsConnected(false);
            setIsReady(false);
          }
        }, 15000);

        const handleDocUpdate = (update: Uint8Array, origin: any) => {
          // Minimal debug logging (optional)
        };
        doc.on('update', handleDocUpdate);

        setProvider(wsProvider);

        setTimeout(() => {
          try {
            wsProvider.connect();
          } catch (e) {
            console.error('Error during WebSocket connect:', e);
            setIsConnected(false);
            setIsReady(false);
          }
        }, 50);
      } catch (e) {
        console.error('Error initializing collaboration:', e);
        destroyCollaboration();
      }
    },
    [currentUser, destroyCollaboration, provider, yDoc]
  );

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
    destroyCollaboration,
    isReady
  };

  return <CollaborationContext.Provider value={value}>{children}</CollaborationContext.Provider>;
};