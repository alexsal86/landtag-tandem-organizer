import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import * as sdk from 'matrix-js-sdk';
import { VerifierEvent, type Verifier } from 'matrix-js-sdk/lib/crypto-api/verification';
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

interface MatrixSasVerificationState {
  transactionId?: string;
  otherDeviceId?: string;
  emojis: Array<{ symbol: string; description: string }>;
  decimals: [number, number, number] | null;
  confirm: () => Promise<void>;
  mismatch: () => void;
  cancel: () => void;
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

const mapMatrixEventToMessage = (room: sdk.Room, event: sdk.MatrixEvent): MatrixMessage | null => {
  const eventType = event.getType();
  const clearType = (event as any).getClearType?.();
  const isMessageEvent = eventType === 'm.room.message' || clearType === 'm.room.message' || eventType === 'm.room.encrypted';

  if (!isMessageEvent) return null;

  const content = event.getContent();
  const canReadMessageContent = Boolean(content?.msgtype);
  const isStillEncrypted = Boolean(event.isEncrypted?.()) && !canReadMessageContent;
  const relatesTo = content['m.relates_to'];

  if (relatesTo?.rel_type === 'm.annotation' || relatesTo?.rel_type === 'm.replace') {
    return null;
  }

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

  const isMedia = ['m.image', 'm.video', 'm.audio', 'm.file'].includes(content.msgtype);

  return {
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
};

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
  requestSelfVerification: (otherDeviceId?: string) => Promise<void>;
  activeSasVerification: MatrixSasVerificationState | null;
  confirmSasVerification: () => Promise<void>;
  rejectSasVerification: () => void;
  lastVerificationError: string | null;
  resetCryptoStore: () => Promise<void>;
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
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const [typingUsers, setTypingUsers] = useState<Map<string, string[]>>(new Map());
  const [activeSasVerification, setActiveSasVerification] = useState<MatrixSasVerificationState | null>(null);
  const isConnectingRef = useRef(false);
  const [lastVerificationError, setLastVerificationError] = useState<string | null>(null);
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

  const connect = useCallback(async (creds: MatrixCredentials) => {
    if (isConnectingRef.current || isConnected) return;

    isConnectingRef.current = true;
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
      const resolvedDeviceId = creds.deviceId || localDeviceId || await fetchDeviceIdFromWhoAmI() || undefined;
      // Kein Fehler mehr wenn leer -- Server vergibt automatisch eine neue Device ID

      const matrixClient = sdk.createClient({
        baseUrl: creds.homeserverUrl,
        accessToken: creds.accessToken,
        userId: creds.userId,
        ...(resolvedDeviceId ? { deviceId: resolvedDeviceId } : {}),
        verificationMethods: ['m.sas.v1'],
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
          const newMessage = mapMatrixEventToMessage(room, event);
          if (!newMessage) return;

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
      
      const finalDeviceId = resolvedDeviceId || matrixClient.getDeviceId() || '';
      if (finalDeviceId) {
        localStorage.setItem(`matrix_device_id:${creds.userId}`, finalDeviceId);
      }
      setClient(matrixClient);
      setCredentials({ ...creds, deviceId: finalDeviceId || undefined });
    } catch (error) {
      console.error('Error connecting to Matrix:', error);
      setConnectionError(error instanceof Error ? error.message : 'Verbindungsfehler');
      setIsConnecting(false);
    } finally {
      isConnectingRef.current = false;
    }
  }, [isConnected]);

  // Auto-connect when credentials are available
  useEffect(() => {
    if (credentials && !isConnected && !isConnecting && !client) {
      connect(credentials);
    }
  }, [credentials, isConnected, isConnecting, client, connect]);

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
    setActiveSasVerification(null);
    setLastVerificationError(null);
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


  const requestSelfVerification = useCallback(async (otherDeviceId?: string) => {
    if (!client || !isConnected || !credentials?.userId) {
      throw new Error('Nicht mit Matrix verbunden');
    }

    const crypto = client.getCrypto();
    if (!crypto) {
      throw new Error('Crypto API ist nicht verfügbar. E2EE muss zuerst aktiv sein.');
    }

    setLastVerificationError(null);
    setActiveSasVerification(null);

    const describeVerificationFailure = (error: unknown): string => {
      if (error instanceof sdk.MatrixEvent) {
        const content = error.getContent() || {};
        const code = typeof content.code === 'string' ? content.code : null;
        const reason = typeof content.reason === 'string' ? content.reason : null;
        if (code && reason) return `${code}: ${reason}`;
        if (reason) return reason;
        if (code) return code;
      }

      if (error instanceof Error) {
        return error.message;
      }

      return 'Unbekannter Verifizierungsfehler';
    };

    const trimmedDeviceId = otherDeviceId?.trim();
    let verificationRequest = trimmedDeviceId
      ? await crypto.requestDeviceVerification(credentials.userId, trimmedDeviceId)
      : await crypto.requestOwnUserVerification();

    // Wait until the other client accepts the request (phase becomes 'ready' or 'started')
    if ((verificationRequest as any).phase !== 'started') {
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Verifizierungs-Timeout: Der andere Client hat nicht rechtzeitig geantwortet. Stellen Sie sicher, dass der andere Client online ist und die Verifizierung akzeptiert.'));
        }, 60000);

        const checkReady = () => {
          const phase = (verificationRequest as any).phase;
          if (phase === 'ready' || phase === 'started') {
            clearTimeout(timeout);
            resolve();
          }
        };

        (verificationRequest as any).on?.('change', checkReady);
        checkReady();
      });
    }

    let verifier: Verifier;
    try {
      verifier = await verificationRequest.startVerification('m.sas.v1');
    } catch (error) {
      const reason = describeVerificationFailure(error);
      const isUnknownDeviceError = Boolean(trimmedDeviceId) && /other device is unknown/i.test(reason);

      if (!isUnknownDeviceError) {
        throw error;
      }

      setLastVerificationError(`Device ID ${trimmedDeviceId} wurde auf dem Homeserver nicht gefunden. Verifizierung wird ohne feste Device-ID erneut gestartet.`);
      verificationRequest = await crypto.requestOwnUserVerification();
      verifier = await verificationRequest.startVerification('m.sas.v1');
    }

    verifier.on(VerifierEvent.ShowSas, (sas) => {
      const emojis = (sas.sas.emoji || []).map(([symbol, description]) => ({ symbol, description }));
      setActiveSasVerification({
        transactionId: verificationRequest.transactionId,
        otherDeviceId: verificationRequest.otherDeviceId,
        emojis,
        decimals: sas.sas.decimal || null,
        confirm: async () => {
          await sas.confirm();
          setActiveSasVerification(null);
          setLastVerificationError(null);
        },
        mismatch: () => {
          sas.mismatch();
          setActiveSasVerification(null);
          setLastVerificationError('Sie haben die Emoji-Codes als nicht übereinstimmend markiert.');
        },
        cancel: () => {
          sas.cancel();
          setActiveSasVerification(null);
          setLastVerificationError('Verifizierung wurde abgebrochen.');
        },
      });
    });

    verifier.on(VerifierEvent.Cancel, (error) => {
      const message = describeVerificationFailure(error);
      setLastVerificationError(message);
      setActiveSasVerification(null);
    });

    void verifier.verify()
      .then(() => {
        setLastVerificationError(null);
        setActiveSasVerification(null);
      })
      .catch((error) => {
        const message = describeVerificationFailure(error);
        console.error('Matrix SAS verification failed:', error);
        setLastVerificationError(message);
        setActiveSasVerification(null);
      });
  }, [client, isConnected, credentials?.userId]);

  const confirmSasVerification = useCallback(async () => {
    if (!activeSasVerification) {
      throw new Error('Keine aktive Emoji-Verifizierung vorhanden.');
    }

    await activeSasVerification.confirm();
  }, [activeSasVerification]);

  const rejectSasVerification = useCallback(() => {
    if (!activeSasVerification) return;
    activeSasVerification.mismatch();
  }, [activeSasVerification]);

  const resetCryptoStore = useCallback(async () => {
    if (client) {
      client.stopClient();
      setClient(null);
    }
    setIsConnected(false);
    setCryptoEnabled(false);

    try {
      const databases = await indexedDB.databases();
      const cryptoDbs = databases.filter(db =>
        db.name && (
          db.name.includes('matrix-js-sdk:crypto') ||
          db.name.includes('rust-crypto') ||
          db.name.includes('matrix-sdk-crypto')
        )
      );
      for (const db of cryptoDbs) {
        if (db.name) {
          indexedDB.deleteDatabase(db.name);
          console.log('Deleted crypto DB:', db.name);
        }
      }
    } catch (e) {
      console.warn('Could not enumerate/delete IndexedDB databases:', e);
      const userId = credentials?.userId || '';
      const knownNames = [
        `matrix-js-sdk:crypto:${userId}`,
        `matrix-rust-sdk-crypto-${userId}`,
      ];
      for (const name of knownNames) {
        try { indexedDB.deleteDatabase(name); } catch {}
      }
    }

    // Device ID aus localStorage entfernen, damit der Server eine neue vergibt
    const userId = credentials?.userId || '';
    if (userId) {
      localStorage.removeItem(`matrix_device_id:${userId}`);
    }

    if (credentials) {
      await new Promise(r => setTimeout(r, 500));
      isConnectingRef.current = false;
      // Credentials ohne deviceId übergeben, damit eine neue ID generiert wird
      await connect({ ...credentials, deviceId: undefined });
    }
  }, [client, credentials, connect]);

  const getMessages = useCallback((roomId: string, limit: number = 50): MatrixMessage[] => {
    if (!client) return [];

    const room = client.getRoom(roomId);
    if (!room) return messagesRef.current.get(roomId)?.slice(-limit) || [];

    const timeline = room.getLiveTimeline().getEvents();

    // Actively trigger decryption for encrypted events
    timeline.forEach(event => {
      if (event.isEncrypted() && !event.isDecryptionFailure()) {
        try {
          event.attemptDecryption(client.getCrypto() as any).catch(() => {});
        } catch {}
      }
    });

    const timelineMessages: MatrixMessage[] = timeline
      .map(event => mapMatrixEventToMessage(room, event))
      .filter((message): message is MatrixMessage => Boolean(message));

    const cached = messagesRef.current.get(roomId) || [];
    const mergedByEventId = new Map<string, MatrixMessage>();
    for (const msg of timelineMessages) mergedByEventId.set(msg.eventId, msg);
    for (const msg of cached) {
      const existing = mergedByEventId.get(msg.eventId);
      // Keep cached decrypted version over still-encrypted timeline version
      if (!existing || 
          (existing.type === 'm.bad.encrypted' && msg.type !== 'm.bad.encrypted') ||
          (existing.type === 'm.room.encrypted' && msg.type !== 'm.room.encrypted' && msg.type !== 'm.bad.encrypted') ||
          (existing.content === '[Encrypted]' && msg.content !== '[Encrypted]')) {
        mergedByEventId.set(msg.eventId, msg);
      }
    }

    const mergedMessages = Array.from(mergedByEventId.values())
      .sort((a, b) => a.timestamp - b.timestamp)
      .slice(-limit);

    setMessages(prev => {
      const updated = new Map(prev);
      updated.set(roomId, mergedMessages);
      return updated;
    });

    return mergedMessages;
  }, [client]);

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
    requestSelfVerification,
    activeSasVerification,
    confirmSasVerification,
    rejectSasVerification,
    lastVerificationError,
    resetCryptoStore,
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
