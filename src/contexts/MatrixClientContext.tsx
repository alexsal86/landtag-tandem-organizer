import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import * as sdk from 'matrix-js-sdk';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';
import { supabase } from '@/integrations/supabase/client';

interface MatrixCredentials {
  userId: string;
  accessToken: string;
  homeserverUrl: string;
}

interface MatrixRoom {
  roomId: string;
  name: string;
  lastMessage?: string;
  lastMessageTimestamp?: number;
  unreadCount: number;
}

interface MatrixMessage {
  eventId: string;
  roomId: string;
  sender: string;
  senderDisplayName: string;
  content: string;
  timestamp: number;
  type: string;
}

interface MatrixClientContextType {
  client: sdk.MatrixClient | null;
  isConnected: boolean;
  isConnecting: boolean;
  connectionError: string | null;
  rooms: MatrixRoom[];
  credentials: MatrixCredentials | null;
  connect: (credentials: MatrixCredentials) => Promise<void>;
  disconnect: () => void;
  sendMessage: (roomId: string, message: string) => Promise<void>;
  getMessages: (roomId: string, limit?: number) => MatrixMessage[];
  totalUnreadCount: number;
}

const MatrixClientContext = createContext<MatrixClientContextType | null>(null);

export function MatrixClientProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  
  const [client, setClient] = useState<sdk.MatrixClient | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [rooms, setRooms] = useState<MatrixRoom[]>([]);
  const [credentials, setCredentials] = useState<MatrixCredentials | null>(null);
  const [messages, setMessages] = useState<Map<string, MatrixMessage[]>>(new Map());

  // Load saved credentials from database
  useEffect(() => {
    const loadCredentials = async () => {
      if (!user || !currentTenant?.id) return;

      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('matrix_user_id, matrix_access_token, matrix_homeserver_url')
          .eq('user_id', user.id)
          .eq('tenant_id', currentTenant.id)
          .maybeSingle();

        if (profile?.matrix_user_id && profile?.matrix_access_token) {
          const creds: MatrixCredentials = {
            userId: profile.matrix_user_id,
            accessToken: profile.matrix_access_token,
            homeserverUrl: profile.matrix_homeserver_url || 'https://matrix.org'
          };
          setCredentials(creds);
        }
      } catch (error) {
        console.error('Error loading Matrix credentials:', error);
      }
    };

    loadCredentials();
  }, [user, currentTenant?.id]);

  // Auto-connect when credentials are available
  useEffect(() => {
    if (credentials && !isConnected && !isConnecting && !client) {
      connect(credentials);
    }
  }, [credentials]);

  const connect = useCallback(async (creds: MatrixCredentials) => {
    if (isConnecting || isConnected) return;

    setIsConnecting(true);
    setConnectionError(null);

    try {
      const matrixClient = sdk.createClient({
        baseUrl: creds.homeserverUrl,
        accessToken: creds.accessToken,
        userId: creds.userId,
      });

      // Listen for sync events
      matrixClient.on(sdk.ClientEvent.Sync, (state: string) => {
        if (state === 'PREPARED') {
          setIsConnected(true);
          setIsConnecting(false);
          updateRoomList(matrixClient);
        } else if (state === 'ERROR') {
          setConnectionError('Sync-Fehler aufgetreten');
          setIsConnecting(false);
        }
      });

      // Listen for new messages
      matrixClient.on(sdk.RoomEvent.Timeline, (event, room) => {
        if (event.getType() === 'm.room.message' && room) {
          const newMessage: MatrixMessage = {
            eventId: event.getId() || '',
            roomId: room.roomId,
            sender: event.getSender() || '',
            senderDisplayName: room.getMember(event.getSender() || '')?.name || event.getSender() || '',
            content: event.getContent().body || '',
            timestamp: event.getTs(),
            type: event.getContent().msgtype || 'm.text'
          };

          setMessages(prev => {
            const roomMessages = prev.get(room.roomId) || [];
            // Avoid duplicates
            if (roomMessages.some(m => m.eventId === newMessage.eventId)) {
              return prev;
            }
            const updated = new Map(prev);
            updated.set(room.roomId, [...roomMessages, newMessage].slice(-100)); // Keep last 100 messages
            return updated;
          });

          updateRoomList(matrixClient);
        }
      });

      // Start the client without crypto (no E2EE)
      await matrixClient.startClient({ initialSyncLimit: 50 });
      
      setClient(matrixClient);
      setCredentials(creds);
    } catch (error) {
      console.error('Error connecting to Matrix:', error);
      setConnectionError(error instanceof Error ? error.message : 'Verbindungsfehler');
      setIsConnecting(false);
    }
  }, [isConnecting, isConnected]);

  const disconnect = useCallback(() => {
    if (client) {
      client.stopClient();
      setClient(null);
    }
    setIsConnected(false);
    setRooms([]);
    setMessages(new Map());
  }, [client]);

  const updateRoomList = (matrixClient: sdk.MatrixClient) => {
    const joinedRooms = matrixClient.getRooms();
    
    const roomList: MatrixRoom[] = joinedRooms.map(room => {
      const timeline = room.getLiveTimeline().getEvents();
      const lastMessageEvent = timeline
        .filter(e => e.getType() === 'm.room.message')
        .pop();

      return {
        roomId: room.roomId,
        name: room.name || room.roomId,
        lastMessage: lastMessageEvent?.getContent().body,
        lastMessageTimestamp: lastMessageEvent?.getTs(),
        unreadCount: room.getUnreadNotificationCount() || 0
      };
    });

    // Sort by last message timestamp
    roomList.sort((a, b) => (b.lastMessageTimestamp || 0) - (a.lastMessageTimestamp || 0));
    
    setRooms(roomList);
  };

  const sendMessage = useCallback(async (roomId: string, message: string) => {
    if (!client || !isConnected) {
      throw new Error('Nicht mit Matrix verbunden');
    }

    await client.sendTextMessage(roomId, message);
  }, [client, isConnected]);

  const getMessages = useCallback((roomId: string, limit: number = 50): MatrixMessage[] => {
    if (!client) return [];

    // First try cached messages
    const cached = messages.get(roomId) || [];
    if (cached.length > 0) {
      return cached.slice(-limit);
    }

    // Load from room timeline
    const room = client.getRoom(roomId);
    if (!room) return [];

    const timeline = room.getLiveTimeline().getEvents();
    const roomMessages: MatrixMessage[] = timeline
      .filter(event => event.getType() === 'm.room.message')
      .map(event => ({
        eventId: event.getId() || '',
        roomId,
        sender: event.getSender() || '',
        senderDisplayName: room.getMember(event.getSender() || '')?.name || event.getSender() || '',
        content: event.getContent().body || '',
        timestamp: event.getTs(),
        type: event.getContent().msgtype || 'm.text'
      }))
      .slice(-limit);

    // Cache the messages
    setMessages(prev => {
      const updated = new Map(prev);
      updated.set(roomId, roomMessages);
      return updated;
    });

    return roomMessages;
  }, [client, messages]);

  const totalUnreadCount = rooms.reduce((sum, room) => sum + room.unreadCount, 0);

  const value: MatrixClientContextType = {
    client,
    isConnected,
    isConnecting,
    connectionError,
    rooms,
    credentials,
    connect,
    disconnect,
    sendMessage,
    getMessages,
    totalUnreadCount
  };

  return (
    <MatrixClientContext.Provider value={value}>
      {children}
    </MatrixClientContext.Provider>
  );
}

export function useMatrixClient() {
  const context = useContext(MatrixClientContext);
  if (!context) {
    throw new Error('useMatrixClient must be used within a MatrixClientProvider');
  }
  return context;
}
