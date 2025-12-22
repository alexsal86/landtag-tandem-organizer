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
  isDirect: boolean;
  memberCount: number;
}

export interface MatrixMessage {
  eventId: string;
  roomId: string;
  sender: string;
  senderDisplayName: string;
  content: string;
  timestamp: number;
  type: string;
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'error';
  replyTo?: {
    eventId: string;
    sender: string;
    content: string;
  };
  reactions: Map<string, { count: number; userReacted: boolean }>;
  mediaContent?: {
    msgtype: string;
    body: string;
    url?: string;
    info?: {
      mimetype?: string;
      size?: number;
      w?: number;
      h?: number;
      duration?: number;
      thumbnail_url?: string;
    };
  };
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
  sendMessage: (roomId: string, message: string, replyToEventId?: string) => Promise<void>;
  getMessages: (roomId: string, limit?: number) => MatrixMessage[];
  totalUnreadCount: number;
  roomMessages: Map<string, MatrixMessage[]>;
  typingUsers: Map<string, string[]>;
  sendTypingNotification: (roomId: string, isTyping: boolean) => void;
  addReaction: (roomId: string, eventId: string, emoji: string) => Promise<void>;
  removeReaction: (roomId: string, eventId: string, emoji: string) => Promise<void>;
  createRoom: (options: { name: string; topic?: string; isPrivate: boolean; inviteUserIds?: string[] }) => Promise<string>;
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
  const [typingUsers, setTypingUsers] = useState<Map<string, string[]>>(new Map());

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
        if (!room) return;

        const eventType = event.getType();

        // Handle message events
        if (eventType === 'm.room.message') {
          const content = event.getContent();
          const relatesTo = content['m.relates_to'];
          
          // Skip if this is a reaction or edit
          if (relatesTo?.rel_type === 'm.annotation' || relatesTo?.rel_type === 'm.replace') {
            return;
          }

          // Get reply info if present
          let replyTo: MatrixMessage['replyTo'] = undefined;
          if (relatesTo?.['m.in_reply_to']?.event_id) {
            const replyEvent = room.findEventById(relatesTo['m.in_reply_to'].event_id);
            if (replyEvent) {
              replyTo = {
                eventId: replyEvent.getId() || '',
                sender: room.getMember(replyEvent.getSender() || '')?.name || replyEvent.getSender() || '',
                content: replyEvent.getContent().body || '',
              };
            }
          }

          // Check if this is a media message
          const isMedia = ['m.image', 'm.video', 'm.audio', 'm.file'].includes(content.msgtype);

          const newMessage: MatrixMessage = {
            eventId: event.getId() || '',
            roomId: room.roomId,
            sender: event.getSender() || '',
            senderDisplayName: room.getMember(event.getSender() || '')?.name || event.getSender() || '',
            content: content.body || '',
            timestamp: event.getTs(),
            type: content.msgtype || 'm.text',
            status: 'sent',
            replyTo,
            reactions: new Map(),
            mediaContent: isMedia ? {
              msgtype: content.msgtype,
              body: content.body,
              url: content.url,
              info: content.info,
            } : undefined,
          };

          setMessages(prev => {
            const roomMessages = prev.get(room.roomId) || [];
            if (roomMessages.some(m => m.eventId === newMessage.eventId)) {
              return prev;
            }
            const updated = new Map(prev);
            updated.set(room.roomId, [...roomMessages, newMessage].slice(-100));
            return updated;
          });

          updateRoomList(matrixClient);
        }

        // Handle reactions
        if (eventType === 'm.reaction') {
          const relatesTo = event.getContent()['m.relates_to'];
          if (relatesTo?.rel_type === 'm.annotation') {
            const targetEventId = relatesTo.event_id;
            const emoji = relatesTo.key;
            
            setMessages(prev => {
              const roomMessages = prev.get(room.roomId);
              if (!roomMessages) return prev;

              const updated = new Map(prev);
              const newRoomMessages = roomMessages.map(msg => {
                if (msg.eventId === targetEventId) {
                  const reactions = new Map(msg.reactions);
                  const existing = reactions.get(emoji) || { count: 0, userReacted: false };
                  reactions.set(emoji, {
                    count: existing.count + 1,
                    userReacted: existing.userReacted || event.getSender() === creds.userId,
                  });
                  return { ...msg, reactions };
                }
                return msg;
              });
              updated.set(room.roomId, newRoomMessages);
              return updated;
            });
          }
        }
      });

      // Listen for typing events
      matrixClient.on(sdk.RoomMemberEvent.Typing, (event, member) => {
        const roomId = member.roomId;
        const room = matrixClient.getRoom(roomId);
        if (!room) return;

        const typingMembers = room.getMembers()
          .filter(m => m.typing && m.userId !== creds.userId)
          .map(m => m.name || m.userId);

        setTypingUsers(prev => {
          const updated = new Map(prev);
          updated.set(roomId, typingMembers);
          return updated;
        });
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
    setTypingUsers(new Map());
  }, [client]);

  const updateRoomList = (matrixClient: sdk.MatrixClient) => {
    const joinedRooms = matrixClient.getRooms();
    
    const roomList: MatrixRoom[] = joinedRooms.map(room => {
      const timeline = room.getLiveTimeline().getEvents();
      const lastMessageEvent = timeline
        .filter(e => e.getType() === 'm.room.message')
        .pop();

      // Check if this is a direct message room
      const isDirect = room.getJoinedMemberCount() === 2;
      
      return {
        roomId: room.roomId,
        name: room.name || room.roomId,
        lastMessage: lastMessageEvent?.getContent().body,
        lastMessageTimestamp: lastMessageEvent?.getTs(),
        unreadCount: room.getUnreadNotificationCount() || 0,
        isDirect,
        memberCount: room.getJoinedMemberCount(),
      };
    });

    roomList.sort((a, b) => (b.lastMessageTimestamp || 0) - (a.lastMessageTimestamp || 0));
    
    setRooms(roomList);
  };

  const sendMessage = useCallback(async (roomId: string, message: string, replyToEventId?: string) => {
    if (!client || !isConnected) {
      throw new Error('Nicht mit Matrix verbunden');
    }

    const content: Record<string, unknown> = {
      msgtype: 'm.text',
      body: message,
    };

    // Add reply relation if replying
    if (replyToEventId) {
      const room = client.getRoom(roomId);
      const replyEvent = room?.findEventById(replyToEventId);
      if (replyEvent) {
        const replyBody = replyEvent.getContent().body || '';
        const replySender = replyEvent.getSender() || '';
        content['m.relates_to'] = {
          'm.in_reply_to': {
            event_id: replyToEventId,
          },
        };
        // Format body for fallback
        content.body = `> <${replySender}> ${replyBody}\n\n${message}`;
        content.format = 'org.matrix.custom.html';
        content.formatted_body = `<mx-reply><blockquote><a href="#">In reply to</a> <a href="#">${replySender}</a><br>${replyBody}</blockquote></mx-reply>${message}`;
      }
    }

    await client.sendMessage(roomId, content);
  }, [client, isConnected]);

  const sendTypingNotification = useCallback((roomId: string, isTyping: boolean) => {
    if (!client || !isConnected) return;
    client.sendTyping(roomId, isTyping, isTyping ? 30000 : 0);
  }, [client, isConnected]);

  const addReaction = useCallback(async (roomId: string, eventId: string, emoji: string) => {
    if (!client || !isConnected) return;

    // Use sendEvent with type assertion for custom event types
    await (client as any).sendEvent(roomId, 'm.reaction', {
      'm.relates_to': {
        rel_type: 'm.annotation',
        event_id: eventId,
        key: emoji,
      },
    });
  }, [client, isConnected]);

  const removeReaction = useCallback(async (roomId: string, eventId: string, emoji: string) => {
    if (!client || !isConnected) return;
    // Note: Matrix doesn't have a direct "remove reaction" - you need to redact the reaction event
    // This is simplified; in production you'd need to find and redact the specific reaction event
    console.log('Remove reaction not fully implemented:', roomId, eventId, emoji);
  }, [client, isConnected]);

  const createRoom = useCallback(async (options: { name: string; topic?: string; isPrivate: boolean; inviteUserIds?: string[] }) => {
    if (!client || !isConnected) {
      throw new Error('Nicht mit Matrix verbunden');
    }

    const createRoomOptions: sdk.ICreateRoomOpts = {
      name: options.name,
      topic: options.topic,
      visibility: options.isPrivate ? sdk.Visibility.Private : sdk.Visibility.Public,
      preset: options.isPrivate ? sdk.Preset.PrivateChat : sdk.Preset.PublicChat,
      invite: options.inviteUserIds,
    };

    const result = await client.createRoom(createRoomOptions);
    
    // Update room list
    updateRoomList(client);
    
    return result.room_id;
  }, [client, isConnected]);

  const getMessages = useCallback((roomId: string, limit: number = 50): MatrixMessage[] => {
    if (!client) return [];

    const cached = messages.get(roomId) || [];
    if (cached.length > 0) {
      return cached.slice(-limit);
    }

    const room = client.getRoom(roomId);
    if (!room) return [];

    const timeline = room.getLiveTimeline().getEvents();
    const roomMessages: MatrixMessage[] = timeline
      .filter(event => event.getType() === 'm.room.message')
      .map(event => {
        const content = event.getContent();
        const isMedia = ['m.image', 'm.video', 'm.audio', 'm.file'].includes(content.msgtype);
        
        return {
          eventId: event.getId() || '',
          roomId,
          sender: event.getSender() || '',
          senderDisplayName: room.getMember(event.getSender() || '')?.name || event.getSender() || '',
          content: content.body || '',
          timestamp: event.getTs(),
          type: content.msgtype || 'm.text',
          status: 'sent' as const,
          reactions: new Map(),
          mediaContent: isMedia ? {
            msgtype: content.msgtype,
            body: content.body,
            url: content.url,
            info: content.info,
          } : undefined,
        };
      })
      .slice(-limit);

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
    totalUnreadCount,
    roomMessages: messages,
    typingUsers,
    sendTypingNotification,
    addReaction,
    removeReaction,
    createRoom,
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
