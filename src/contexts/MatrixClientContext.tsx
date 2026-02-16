import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import * as sdk from 'matrix-js-sdk';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';
import { supabase } from '@/integrations/supabase/client';

interface MatrixCredentials {
  userId: string;
  accessToken: string;
  homeserverUrl: string;
  deviceId?: string;
}

interface MatrixRoom {
  roomId: string;
  name: string;
  lastMessage?: string;
  lastMessageTimestamp?: number;
  unreadCount: number;
  isDirect: boolean;
  memberCount: number;
  isEncrypted: boolean;
}

interface MatrixE2EEDiagnostics {
  secureContext: boolean;
  crossOriginIsolated: boolean;
  sharedArrayBuffer: boolean;
  serviceWorkerControlled: boolean;
  secretStorageReady: boolean | null;
  crossSigningReady: boolean | null;
  keyBackupEnabled: boolean | null;
  cryptoError: string | null;
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
  cryptoEnabled: boolean;
  e2eeDiagnostics: MatrixE2EEDiagnostics;
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
  createRoom: (options: { name: string; topic?: string; isPrivate: boolean; enableEncryption: boolean; inviteUserIds?: string[] }) => Promise<string>;
}

const MatrixClientContext = createContext<MatrixClientContextType | null>(null);

export function MatrixClientProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  
  const [client, setClient] = useState<sdk.MatrixClient | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [cryptoEnabled, setCryptoEnabled] = useState(false);
  const [rooms, setRooms] = useState<MatrixRoom[]>([]);
  const [credentials, setCredentials] = useState<MatrixCredentials | null>(null);
  const [messages, setMessages] = useState<Map<string, MatrixMessage[]>>(new Map());
  const [typingUsers, setTypingUsers] = useState<Map<string, string[]>>(new Map());
  const [e2eeDiagnostics, setE2eeDiagnostics] = useState<MatrixE2EEDiagnostics>({
    secureContext: window.isSecureContext,
    crossOriginIsolated: window.crossOriginIsolated,
    sharedArrayBuffer: typeof SharedArrayBuffer !== 'undefined',
    serviceWorkerControlled: Boolean(navigator.serviceWorker?.controller),
    secretStorageReady: null,
    crossSigningReady: null,
    keyBackupEnabled: null,
    cryptoError: null,
  });

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
          const storedDeviceId = localStorage.getItem(`matrix_device_id:${profile.matrix_user_id}`) || undefined;
          const creds: MatrixCredentials = {
            userId: profile.matrix_user_id,
            accessToken: profile.matrix_access_token,
            homeserverUrl: profile.matrix_homeserver_url || 'https://matrix.org',
            deviceId: storedDeviceId,
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
      const fetchDeviceIdFromWhoAmI = async (): Promise<string | null> => {
        try {
          const response = await fetch(`${creds.homeserverUrl.replace(/\/$/, '')}/_matrix/client/v3/account/whoami`, {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${creds.accessToken}`,
            },
          });

          if (!response.ok) {
            return null;
          }

          const whoami = await response.json();
          return typeof whoami?.device_id === 'string' ? whoami.device_id : null;
        } catch (error) {
          console.error('Could not resolve Matrix device ID via whoami:', error);
          return null;
        }
      };

      const localDeviceId = localStorage.getItem(`matrix_device_id:${creds.userId}`) || null;
      const resolvedDeviceId = creds.deviceId || localDeviceId || await fetchDeviceIdFromWhoAmI();

      if (!resolvedDeviceId) {
        throw new Error('Matrix Device ID konnte nicht ermittelt werden. Bitte tragen Sie die Device ID in den Matrix-Einstellungen ein (Element: Einstellungen → Hilfe & Info).');
      }

      const matrixClient = sdk.createClient({
        baseUrl: creds.homeserverUrl,
        accessToken: creds.accessToken,
        userId: creds.userId,
        deviceId: resolvedDeviceId,
        cryptoCallbacks: {
          getSecretStorageKey: async ({ keys }) => {
            const recoveryKey = localStorage.getItem(`matrix_recovery_key:${creds.userId}`);
            if (!recoveryKey) return null;

            const keyIds = Object.keys(keys);
            if (keyIds.length === 0) return null;

            try {
              const privateKey = (matrixClient as any).keyBackupKeyFromRecoveryKey(recoveryKey.trim()) as Uint8Array;
              return [keyIds[0], privateKey];
            } catch (error) {
              console.error('Invalid Matrix recovery key from local storage:', error);
              return null;
            }
          },
        },
      });

      const updateRuntimeDiagnostics = (
        cryptoError: string | null = null,
        cryptoState?: { secretStorageReady: boolean | null; crossSigningReady: boolean | null; keyBackupEnabled: boolean | null }
      ) => {
        setE2eeDiagnostics({
          secureContext: window.isSecureContext,
          crossOriginIsolated: window.crossOriginIsolated,
          sharedArrayBuffer: typeof SharedArrayBuffer !== 'undefined',
          serviceWorkerControlled: Boolean(navigator.serviceWorker?.controller),
          secretStorageReady: cryptoState?.secretStorageReady ?? null,
          crossSigningReady: cryptoState?.crossSigningReady ?? null,
          keyBackupEnabled: cryptoState?.keyBackupEnabled ?? null,
          cryptoError,
        });
      };

      const syncCryptoEnabledState = () => {
        setCryptoEnabled(Boolean(matrixClient.getCrypto()));
      };

      updateRuntimeDiagnostics();

      // Listen for sync events
      matrixClient.on(sdk.ClientEvent.Sync, (state: string) => {
        if (state === 'PREPARED') {
          setIsConnected(true);
          setIsConnecting(false);
          syncCryptoEnabledState();
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

        // Handle message events (plain + encrypted placeholders that will be replaced after decryption)
        if (eventType === 'm.room.message' || eventType === 'm.room.encrypted') {
          const content = event.getContent();

          const isStillEncrypted = eventType === 'm.room.encrypted' || (!content.msgtype && event.isEncrypted?.());
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
            content: isStillEncrypted ? '[Encrypted]' : (content.body || ''),
            timestamp: event.getTs(),
            type: isStillEncrypted ? 'm.bad.encrypted' : (content.msgtype || 'm.text'),
            status: 'sent',
            replyTo,
            reactions: new Map(),
            mediaContent: !isStillEncrypted && isMedia ? {
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

      // Listen for decrypted events
      matrixClient.on(sdk.MatrixEventEvent.Decrypted, (event) => {
        const roomId = event.getRoomId();
        if (!roomId) return;

        const clearType = (event as any).getClearType?.();
        if (clearType && clearType !== 'm.room.message') return;

        const content = event.getContent();
        if (!content?.msgtype) return;
        const room = matrixClient.getRoom(roomId);
        if (!room) return;

        const isMedia = ['m.image', 'm.video', 'm.audio', 'm.file'].includes(content.msgtype);

        const decryptedMessage: MatrixMessage = {
          eventId: event.getId() || '',
          roomId,
          sender: event.getSender() || '',
          senderDisplayName: room.getMember(event.getSender() || '')?.name || event.getSender() || '',
          content: content.body || '[Entschlüsselung fehlgeschlagen]',
          timestamp: event.getTs(),
          type: content.msgtype || 'm.text',
          status: 'sent',
          reactions: new Map(),
          mediaContent: isMedia ? {
            msgtype: content.msgtype,
            body: content.body,
            url: content.url,
            info: content.info,
          } : undefined,
        };

        setMessages(prev => {
          const roomMessages = prev.get(roomId) || [];
          const updated = new Map(prev);

          const existingIndex = roomMessages.findIndex(m => m.eventId === decryptedMessage.eventId);
          if (existingIndex >= 0) {
            const next = [...roomMessages];
            next[existingIndex] = decryptedMessage;
            updated.set(roomId, next);
          } else {
            updated.set(roomId, [...roomMessages, decryptedMessage].slice(-100));
          }

          return updated;
        });
      });

      let lastCryptoError: string | null = null;

      // Initialize E2EE with Rust Crypto
      try {
        // Check Cross-Origin Isolation status (required for SharedArrayBuffer)
        console.log('=== Matrix E2EE Diagnostics ===');
        console.log('Cross-Origin Isolated:', window.crossOriginIsolated);
        console.log('SharedArrayBuffer available:', typeof SharedArrayBuffer !== 'undefined');
        console.log('Running in iframe:', window.self !== window.top);
        
        if (!window.crossOriginIsolated) {
          console.warn('Cross-Origin Isolation is not enabled. This is required for Matrix E2EE.');
          console.warn('This typically happens when running in an iframe (like Lovable Preview).');
          console.warn('Try opening the app in a new tab for E2EE support.');
        }
        
        console.log('Initializing Matrix E2EE with Rust Crypto...');
        await matrixClient.initRustCrypto();
        
        // Verify crypto is working
        const crypto = matrixClient.getCrypto();
        if (crypto) {
          console.log('Matrix E2EE initialized successfully');
          console.log('Device ID:', matrixClient.getDeviceId());
        } else {
          console.warn('Crypto API not available directly after initialization, retry after client start');
        }
      } catch (cryptoError) {
        console.error('Failed to initialize E2EE:', cryptoError);
        console.error('E2EE will not be available for encrypted rooms.');
        lastCryptoError = cryptoError instanceof Error ? cryptoError.message : 'E2EE-Initialisierung fehlgeschlagen';
        updateRuntimeDiagnostics(lastCryptoError);
        setCryptoEnabled(false);
        // Continue without encryption - user will see warning for encrypted rooms
      }

      // Start the client with E2EE support
      await matrixClient.startClient({ initialSyncLimit: 50 });

      // Retry once after start in case crypto was not ready during first init attempt
      if (!matrixClient.getCrypto()) {
        try {
          await matrixClient.initRustCrypto();
        } catch (retryError) {
          console.error('Retry initRustCrypto after start failed:', retryError);
          if (!lastCryptoError) {
            lastCryptoError = retryError instanceof Error ? retryError.message : 'E2EE-Initialisierung nach Start fehlgeschlagen';
          }
        }
      }

      const crypto = matrixClient.getCrypto();
      setCryptoEnabled(Boolean(crypto));

      let secretStorageReady: boolean | null = null;
      let crossSigningReady: boolean | null = null;
      let keyBackupEnabled: boolean | null = null;

      if (crypto) {
        try {
          secretStorageReady = await crypto.isSecretStorageReady();
          crossSigningReady = await crypto.isCrossSigningReady();
          keyBackupEnabled = (await crypto.checkKeyBackupAndEnable()) !== null;
        } catch (cryptoStateError) {
          console.error('Failed to read Matrix crypto state:', cryptoStateError);
        }
      }

      if (!crypto && !lastCryptoError) {
        lastCryptoError = 'Rust-Crypto wurde initialisiert, aber es wurde keine CryptoApi bereitgestellt. Bitte Browser-Konsole prüfen.';
      }

      updateRuntimeDiagnostics(lastCryptoError, { secretStorageReady, crossSigningReady, keyBackupEnabled });
      
      localStorage.setItem(`matrix_device_id:${creds.userId}`, resolvedDeviceId);
      setClient(matrixClient);
      setCredentials({ ...creds, deviceId: resolvedDeviceId });
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
    setCryptoEnabled(false);
    setE2eeDiagnostics({
      secureContext: window.isSecureContext,
      crossOriginIsolated: window.crossOriginIsolated,
      sharedArrayBuffer: typeof SharedArrayBuffer !== 'undefined',
      serviceWorkerControlled: Boolean(navigator.serviceWorker?.controller),
      secretStorageReady: null,
      crossSigningReady: null,
      keyBackupEnabled: null,
      cryptoError: null,
    });
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
      
      // Check if the room has encryption enabled
      const isEncrypted = room.hasEncryptionStateEvent();
      
      return {
        roomId: room.roomId,
        name: room.name || room.roomId,
        lastMessage: lastMessageEvent?.getContent().body,
        lastMessageTimestamp: lastMessageEvent?.getTs(),
        unreadCount: room.getUnreadNotificationCount() || 0,
        isDirect,
        memberCount: room.getJoinedMemberCount(),
        isEncrypted,
      };
    });

    roomList.sort((a, b) => (b.lastMessageTimestamp || 0) - (a.lastMessageTimestamp || 0));
    
    setRooms(roomList);
  };

  const sendMessage = useCallback(async (roomId: string, message: string, replyToEventId?: string) => {
    if (!client || !isConnected) {
      throw new Error('Nicht mit Matrix verbunden');
    }

    // Check if room is encrypted and crypto is available
    const room = client.getRoom(roomId);
    const isRoomEncrypted = room?.hasEncryptionStateEvent();
    
    if (isRoomEncrypted && !client.getCrypto()) {
      throw new Error('Verschlüsselung ist für diesen Raum erforderlich, aber Ihr Browser unterstützt die Verschlüsselung nicht. Bitte laden Sie die Seite neu.');
    }

    const content: Record<string, unknown> = {
      msgtype: 'm.text',
      body: message,
    };

    // Add reply relation if replying
    if (replyToEventId) {
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

    // Use type assertion for the content to satisfy TypeScript
    await client.sendMessage(roomId, content as any);
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

  const createRoom = useCallback(async (options: { name: string; topic?: string; isPrivate: boolean; enableEncryption: boolean; inviteUserIds?: string[] }) => {
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

    if (options.enableEncryption) {
      createRoomOptions.initial_state = [
        {
          type: 'm.room.encryption',
          state_key: '',
          content: { algorithm: 'm.megolm.v1.aes-sha2' },
        },
      ];
    }

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
      .filter(event => ['m.room.message', 'm.room.encrypted'].includes(event.getType()))
      .map(event => {
        const content = event.getContent();
        const isEncrypted = event.getType() === 'm.room.encrypted' || (!content.msgtype && event.isEncrypted?.());
        const isMedia = ['m.image', 'm.video', 'm.audio', 'm.file'].includes(content.msgtype);

        return {
          eventId: event.getId() || '',
          roomId,
          sender: event.getSender() || '',
          senderDisplayName: room.getMember(event.getSender() || '')?.name || event.getSender() || '',
          content: isEncrypted ? '[Encrypted]' : (content.body || ''),
          timestamp: event.getTs(),
          type: isEncrypted ? 'm.bad.encrypted' : (content.msgtype || 'm.text'),
          status: 'sent' as const,
          reactions: new Map(),
          mediaContent: !isEncrypted && isMedia ? {
            msgtype: content.msgtype,
            body: content.body,
            url: content.url,
            info: content.info,
          } : undefined,
        };
      })
      .slice(-limit);

    // Use functional update to avoid dependency on messages
    setMessages(prev => {
      // Only update if not already cached
      if (prev.get(roomId)?.length) return prev;
      const updated = new Map(prev);
      updated.set(roomId, roomMessages);
      return updated;
    });

    return roomMessages;
  }, [client]); // Remove messages from dependencies

  const totalUnreadCount = rooms.reduce((sum, room) => sum + room.unreadCount, 0);

  const value: MatrixClientContextType = {
    client,
    isConnected,
    isConnecting,
    connectionError,
    cryptoEnabled,
    e2eeDiagnostics,
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
