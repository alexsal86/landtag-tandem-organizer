import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import * as sdk from 'matrix-js-sdk';
import { CryptoEvent } from 'matrix-js-sdk';
import { VerifierEvent, VerificationPhase, type Verifier } from 'matrix-js-sdk/lib/crypto-api/verification';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';
import { supabase } from '@/integrations/supabase/client';

// ─── Interfaces ──────────────────────────────────────────────────────────────

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

// ─── Constants ───────────────────────────────────────────────────────────────

const MAX_CACHED_MESSAGES = 200;

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

/**
 * Shared helper: attach SAS verifier listeners.
 * Used by both `connect` (incoming verification) and `requestSelfVerification` (outgoing).
 */
function setupVerifierListeners(
  verifier: Verifier,
  verificationRequest: any,
  setActiveSasVerification: React.Dispatch<React.SetStateAction<MatrixSasVerificationState | null>>,
  setLastVerificationError: React.Dispatch<React.SetStateAction<string | null>>,
  describeError?: (error: unknown) => string,
) {
  const formatError = describeError ?? ((e: unknown) => (e instanceof Error ? e.message : 'Verifizierung abgebrochen'));

  verifier.on(VerifierEvent.ShowSas, (sas) => {
    const emojis = (sas.sas.emoji || []).map(([symbol, description]: [string, string]) => ({ symbol, description }));
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
    setLastVerificationError(formatError(error));
    setActiveSasVerification(null);
  });
}

// ─── Context type ────────────────────────────────────────────────────────────

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
  refreshMessages: (roomId: string, limit?: number) => void;
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

// ─── Provider ────────────────────────────────────────────────────────────────

export function MatrixClientProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { currentTenant } = useTenant();

  // State
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

  // Refs for cleanup
  const isConnectingRef = useRef(false);
  const clientRef = useRef<sdk.MatrixClient | null>(null);
  const listenersRef = useRef<Array<{ event: string; handler: (...args: any[]) => void }>>([]);

  // ─── updateRoomList (plain function, no hook) ────────────────────────────

  const updateRoomList = (matrixClient: sdk.MatrixClient) => {
    const joinedRooms = matrixClient.getRooms();

    const roomList: MatrixRoom[] = joinedRooms.map(room => {
      const timeline = room.getLiveTimeline().getEvents();
      const lastMessageEvent = timeline
        .filter(e => e.getType() === 'm.room.message')
        .pop();

      const isDirect = room.getJoinedMemberCount() === 2;
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

  // ─── Load credentials from database ─────────────────────────────────────

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
          setCredentials({
            userId: profile.matrix_user_id,
            accessToken: profile.matrix_access_token,
            homeserverUrl: profile.matrix_homeserver_url || 'https://matrix.org',
            deviceId: storedDeviceId,
          });
        }
      } catch (error) {
        console.error('Error loading Matrix credentials:', error);
      }
    };

    loadCredentials();
  }, [user, currentTenant?.id]);

  // ─── connect ─────────────────────────────────────────────────────────────

  const connect = useCallback(async (creds: MatrixCredentials) => {
    if (isConnectingRef.current) return;

    isConnectingRef.current = true;
    setIsConnecting(true);
    setConnectionError(null);

    try {
      // 1. Resolve device ID from localStorage (no whoAmI call)
      const localDeviceId = creds.deviceId || localStorage.getItem(`matrix_device_id:${creds.userId}`) || undefined;

      // 2. Create client (canonical: no verificationMethods, no cryptoCallbacks on createClient)
      const matrixClient = sdk.createClient({
        baseUrl: creds.homeserverUrl,
        accessToken: creds.accessToken,
        userId: creds.userId,
        ...(localDeviceId ? { deviceId: localDeviceId } : {}),
      });

      clientRef.current = matrixClient;

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

      updateRuntimeDiagnostics();

      let lastCryptoError: string | null = null;

      // 3. Init Rust Crypto (BEFORE startClient)
      try {
        console.log('=== Matrix E2EE Diagnostics ===');
        console.log('Cross-Origin Isolated:', window.crossOriginIsolated);
        console.log('SharedArrayBuffer available:', typeof SharedArrayBuffer !== 'undefined');

        if (!window.crossOriginIsolated) {
          console.warn('Cross-Origin Isolation not enabled. E2EE may not work. Try a new tab.');
        }

        await matrixClient.initRustCrypto();
        console.log('Matrix E2EE initialized successfully');
      } catch (cryptoError) {
        console.error('Failed to initialize E2EE:', cryptoError);
        lastCryptoError = cryptoError instanceof Error ? cryptoError.message : 'E2EE-Initialisierung fehlgeschlagen';
        updateRuntimeDiagnostics(lastCryptoError);
        setCryptoEnabled(false);
      }

      // 4. Bootstrap Secret Storage (if recovery key available)
      const crypto = matrixClient.getCrypto();
      if (crypto) {
        const recoveryKey = localStorage.getItem(`matrix_recovery_key:${creds.userId}`);
        if (recoveryKey) {
          try {
            await crypto.bootstrapSecretStorage({
              createSecretStorageKey: async () => {
                // Use the stored recovery key
                try {
                  const privateKey = (matrixClient as any).keyBackupKeyFromRecoveryKey(recoveryKey.trim()) as Uint8Array;
                  return { privateKey, encodedPrivateKey: recoveryKey.trim() } as any;
                } catch {
                  return {} as any;
                }
              },
            });
            console.log('Secret Storage bootstrapped');
          } catch (e) {
            console.warn('bootstrapSecretStorage failed (non-critical):', e);
          }
        }

        // 5. Bootstrap Cross-Signing (non-critical)
        try {
          await crypto.bootstrapCrossSigning({
            authUploadDeviceSigningKeys: async (makeRequest) => {
              await (makeRequest as any)({});
            },
          } as any);
          console.log('Cross-Signing bootstrapped');
        } catch (e) {
          console.warn('bootstrapCrossSigning failed (non-critical):', e);
        }

        // 6. Check & enable key backup
        try {
          await crypto.checkKeyBackupAndEnable();
          console.log('Key backup checked/enabled');
        } catch (e) {
          console.warn('checkKeyBackupAndEnable failed (non-critical):', e);
        }
      }

      // 7. Register event listeners (named references for cleanup)
      const registeredListeners: Array<{ event: string; handler: (...args: any[]) => void }> = [];

      const onSync = (state: string) => {
        if (state === 'PREPARED') {
          setIsConnected(true);
          setIsConnecting(false);
          setCryptoEnabled(Boolean(matrixClient.getCrypto()));
          updateRoomList(matrixClient);
        } else if (state === 'ERROR') {
          setConnectionError('Sync-Fehler aufgetreten');
          setIsConnecting(false);
        }
      };

      const onTimeline = (event: sdk.MatrixEvent, room: sdk.Room | undefined) => {
        if (!room) return;
        const eventType = event.getType();

        if (eventType === 'm.room.message' || eventType === 'm.room.encrypted') {
          const newMessage = mapMatrixEventToMessage(room, event);
          if (!newMessage) return;

          setMessages(prev => {
            const roomMessages = prev.get(room.roomId) || [];
            if (roomMessages.some(m => m.eventId === newMessage.eventId)) return prev;
            const updated = new Map(prev);
            updated.set(room.roomId, [...roomMessages, newMessage].slice(-MAX_CACHED_MESSAGES));
            return updated;
          });
          updateRoomList(matrixClient);
        }

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
      };

      const onTyping = (_event: sdk.MatrixEvent, member: sdk.RoomMember) => {
        const roomId = member.roomId;
        const r = matrixClient.getRoom(roomId);
        if (!r) return;

        const typingMembers = r.getMembers()
          .filter(m => m.typing && m.userId !== creds.userId)
          .map(m => m.name || m.userId);

        setTypingUsers(prev => {
          const updated = new Map(prev);
          updated.set(roomId, typingMembers);
          return updated;
        });
      };

      const onDecrypted = (event: sdk.MatrixEvent) => {
        const roomId = event.getRoomId();
        if (!roomId) return;

        const clearType = (event as any).getClearType?.();
        if (clearType && clearType !== 'm.room.message') return;

        const content = event.getContent();
        if (!content?.msgtype) return;
        const r = matrixClient.getRoom(roomId);
        if (!r) return;

        const isMedia = ['m.image', 'm.video', 'm.audio', 'm.file'].includes(content.msgtype);

        const decryptedMessage: MatrixMessage = {
          eventId: event.getId() || '',
          roomId,
          sender: event.getSender() || '',
          senderDisplayName: r.getMember(event.getSender() || '')?.name || event.getSender() || '',
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
            updated.set(roomId, [...roomMessages, decryptedMessage].slice(-MAX_CACHED_MESSAGES));
          }
          return updated;
        });
      };

      const onVerificationRequestReceived = async (verificationRequest: any) => {
        console.log('[Matrix] Incoming verification request, phase:', verificationRequest.phase);

        if (verificationRequest.phase === VerificationPhase.Requested) {
          try {
            await verificationRequest.accept();
            console.log('[Matrix] Verification request accepted');
          } catch (e) {
            console.error('[Matrix] Failed to accept verification request:', e);
            return;
          }
        }

        if (verificationRequest.phase !== VerificationPhase.Ready && verificationRequest.phase !== VerificationPhase.Started) {
          await new Promise<void>((resolve) => {
            const check = () => {
              const phase = verificationRequest.phase;
              if (phase === VerificationPhase.Ready || phase === VerificationPhase.Started || phase === VerificationPhase.Cancelled || phase === VerificationPhase.Done) {
                resolve();
              }
            };
            verificationRequest.on?.('change', check);
            check();
            setTimeout(() => resolve(), 30000);
          });
        }

        if (verificationRequest.phase === VerificationPhase.Cancelled || verificationRequest.phase === VerificationPhase.Done) return;

        try {
          const verifier = await verificationRequest.startVerification('m.sas.v1');
          setupVerifierListeners(verifier, verificationRequest, setActiveSasVerification, setLastVerificationError);
          void verifier.verify();
          console.log('[Matrix] Incoming verification SAS started');
        } catch (err) {
          console.error('[Matrix] Failed to handle incoming verification:', err);
        }
      };

      // Attach all listeners
      matrixClient.on(sdk.ClientEvent.Sync, onSync);
      matrixClient.on(sdk.RoomEvent.Timeline, onTimeline as any);
      matrixClient.on(sdk.RoomMemberEvent.Typing, onTyping as any);
      matrixClient.on(sdk.MatrixEventEvent.Decrypted, onDecrypted);
      matrixClient.on(CryptoEvent.VerificationRequestReceived, onVerificationRequestReceived);

      registeredListeners.push(
        { event: sdk.ClientEvent.Sync, handler: onSync },
        { event: sdk.RoomEvent.Timeline, handler: onTimeline as any },
        { event: sdk.RoomMemberEvent.Typing, handler: onTyping as any },
        { event: sdk.MatrixEventEvent.Decrypted, handler: onDecrypted },
        { event: CryptoEvent.VerificationRequestReceived, handler: onVerificationRequestReceived },
      );
      listenersRef.current = registeredListeners;

      // 8. Start client
      await matrixClient.startClient({ initialSyncLimit: 50 });

      // 9. Read & persist diagnostics + device ID
      setCryptoEnabled(Boolean(matrixClient.getCrypto()));

      let secretStorageReady: boolean | null = null;
      let crossSigningReady: boolean | null = null;
      let keyBackupEnabled: boolean | null = null;

      const cryptoAfterStart = matrixClient.getCrypto();
      if (cryptoAfterStart) {
        try {
          secretStorageReady = await cryptoAfterStart.isSecretStorageReady();
          crossSigningReady = await cryptoAfterStart.isCrossSigningReady();
          keyBackupEnabled = (await cryptoAfterStart.checkKeyBackupAndEnable()) !== null;
        } catch (e) {
          console.error('Failed to read crypto state:', e);
        }
      }

      if (!cryptoAfterStart && !lastCryptoError) {
        lastCryptoError = 'Rust-Crypto wurde initialisiert, aber keine CryptoApi verfügbar.';
      }

      updateRuntimeDiagnostics(lastCryptoError, { secretStorageReady, crossSigningReady, keyBackupEnabled });

      // Persist device ID AFTER start (canonical)
      const finalDeviceId = matrixClient.getDeviceId() || localDeviceId || '';
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
  }, []); // No dependencies — guards via isConnectingRef

  // ─── disconnect (with listener cleanup) ──────────────────────────────────

  const disconnect = useCallback(() => {
    const mc = clientRef.current;
    if (mc) {
      // Remove all registered listeners
      for (const { event, handler } of listenersRef.current) {
        try { mc.removeListener(event as any, handler); } catch {}
      }
      listenersRef.current = [];
      mc.stopClient();
      clientRef.current = null;
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
  }, []);

  // ─── refreshMessages (mutation, NOT a getter) ────────────────────────────

  const refreshMessages = useCallback((roomId: string, limit: number = MAX_CACHED_MESSAGES) => {
    const mc = clientRef.current;
    if (!mc) return;

    const room = mc.getRoom(roomId);
    if (!room) return;

    const timeline = room.getLiveTimeline().getEvents();

    // Trigger decryption for encrypted events
    timeline.forEach(event => {
      if (event.isEncrypted() && !event.isDecryptionFailure()) {
        try {
          event.attemptDecryption(mc.getCrypto() as any).catch(() => {});
        } catch {}
      }
    });

    const timelineMessages: MatrixMessage[] = timeline
      .map(event => mapMatrixEventToMessage(room, event))
      .filter((msg): msg is MatrixMessage => Boolean(msg));

    const cached = messagesRef.current.get(roomId) || [];
    const mergedByEventId = new Map<string, MatrixMessage>();
    for (const msg of timelineMessages) mergedByEventId.set(msg.eventId, msg);
    for (const msg of cached) {
      const existing = mergedByEventId.get(msg.eventId);
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
  }, []);

  // ─── sendMessage ─────────────────────────────────────────────────────────

  const sendMessage = useCallback(async (roomId: string, message: string, replyToEventId?: string) => {
    const mc = clientRef.current;
    if (!mc) throw new Error('Nicht mit Matrix verbunden');

    const room = mc.getRoom(roomId);
    if (room?.hasEncryptionStateEvent() && !mc.getCrypto()) {
      throw new Error('Verschlüsselung erforderlich, aber nicht verfügbar. Seite neu laden.');
    }

    const content: Record<string, unknown> = { msgtype: 'm.text', body: message };

    if (replyToEventId) {
      const replyEvent = room?.findEventById(replyToEventId);
      if (replyEvent) {
        const replyBody = replyEvent.getContent().body || '';
        const replySender = replyEvent.getSender() || '';
        content['m.relates_to'] = { 'm.in_reply_to': { event_id: replyToEventId } };
        content.body = `> <${replySender}> ${replyBody}\n\n${message}`;
        content.format = 'org.matrix.custom.html';
        content.formatted_body = `<mx-reply><blockquote><a href="#">In reply to</a> <a href="#">${replySender}</a><br>${replyBody}</blockquote></mx-reply>${message}`;
      }
    }

    await mc.sendMessage(roomId, content as any);
  }, []);

  // ─── sendTypingNotification ──────────────────────────────────────────────

  const sendTypingNotification = useCallback((roomId: string, isTyping: boolean) => {
    const mc = clientRef.current;
    if (!mc) return;
    mc.sendTyping(roomId, isTyping, isTyping ? 30000 : 0);
  }, []);

  // ─── addReaction ─────────────────────────────────────────────────────────

  const addReaction = useCallback(async (roomId: string, eventId: string, emoji: string) => {
    const mc = clientRef.current;
    if (!mc) return;
    await (mc as any).sendEvent(roomId, 'm.reaction', {
      'm.relates_to': { rel_type: 'm.annotation', event_id: eventId, key: emoji },
    });
  }, []);

  // ─── removeReaction (implemented with redactEvent) ───────────────────────

  const removeReaction = useCallback(async (roomId: string, eventId: string, emoji: string) => {
    const mc = clientRef.current;
    if (!mc) return;

    const room = mc.getRoom(roomId);
    if (!room) return;

    // Find the reaction event in the timeline
    const timeline = room.getLiveTimeline().getEvents();
    const myUserId = mc.getUserId();
    const reactionEvent = timeline.find(ev => {
      if (ev.getType() !== 'm.reaction') return false;
      const rel = ev.getContent()['m.relates_to'];
      return rel?.rel_type === 'm.annotation' &&
        rel?.event_id === eventId &&
        rel?.key === emoji &&
        ev.getSender() === myUserId;
    });

    if (reactionEvent) {
      const reactionEventId = reactionEvent.getId();
      if (reactionEventId) {
        await mc.redactEvent(roomId, reactionEventId);
      }
    }
  }, []);

  // ─── createRoom ──────────────────────────────────────────────────────────

  const createRoom = useCallback(async (options: { name: string; topic?: string; isPrivate: boolean; enableEncryption: boolean; inviteUserIds?: string[] }) => {
    const mc = clientRef.current;
    if (!mc) throw new Error('Nicht mit Matrix verbunden');

    const createRoomOptions: sdk.ICreateRoomOpts = {
      name: options.name,
      topic: options.topic,
      visibility: options.isPrivate ? sdk.Visibility.Private : sdk.Visibility.Public,
      preset: options.isPrivate ? sdk.Preset.PrivateChat : sdk.Preset.PublicChat,
      invite: options.inviteUserIds,
    };

    if (options.enableEncryption) {
      createRoomOptions.initial_state = [
        { type: 'm.room.encryption', state_key: '', content: { algorithm: 'm.megolm.v1.aes-sha2' } },
      ];
    }

    const result = await mc.createRoom(createRoomOptions);
    updateRoomList(mc);
    return result.room_id;
  }, []);

  // ─── requestSelfVerification (uses shared setupVerifierListeners) ────────

  const requestSelfVerification = useCallback(async (otherDeviceId?: string) => {
    const mc = clientRef.current;
    if (!mc) throw new Error('Nicht mit Matrix verbunden');

    const crypto = mc.getCrypto();
    if (!crypto) throw new Error('Crypto API nicht verfügbar.');

    const userId = mc.getUserId();
    if (!userId) throw new Error('Kein User ID');

    setLastVerificationError(null);
    setActiveSasVerification(null);

    const describeError = (error: unknown): string => {
      if (error instanceof sdk.MatrixEvent) {
        const content = error.getContent() || {};
        const code = typeof content.code === 'string' ? content.code : null;
        const reason = typeof content.reason === 'string' ? content.reason : null;
        if (code && reason) return `${code}: ${reason}`;
        if (reason) return reason;
        if (code) return code;
      }
      if (error instanceof Error) return error.message;
      return 'Unbekannter Verifizierungsfehler';
    };

    const trimmedDeviceId = otherDeviceId?.trim();
    let verificationRequest = trimmedDeviceId
      ? await crypto.requestDeviceVerification(userId, trimmedDeviceId)
      : await crypto.requestOwnUserVerification();

    // Wait for the other client to accept
    if ((verificationRequest as any).phase !== VerificationPhase.Started) {
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Verifizierungs-Timeout: Der andere Client hat nicht rechtzeitig geantwortet.'));
        }, 60000);

        const checkReady = () => {
          const phase = (verificationRequest as any).phase;
          if (phase === VerificationPhase.Ready || phase === VerificationPhase.Started) {
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
      const reason = describeError(error);
      const isUnknownDevice = Boolean(trimmedDeviceId) && /other device is unknown/i.test(reason);

      if (!isUnknownDevice) throw error;

      setLastVerificationError(`Device ${trimmedDeviceId} nicht gefunden. Erneuter Versuch ohne feste Device-ID.`);
      verificationRequest = await crypto.requestOwnUserVerification();
      verifier = await verificationRequest.startVerification('m.sas.v1');
    }

    // Use the shared helper — no duplicated listener code
    setupVerifierListeners(verifier, verificationRequest, setActiveSasVerification, setLastVerificationError, describeError);

    void verifier.verify()
      .then(() => {
        setLastVerificationError(null);
        setActiveSasVerification(null);
      })
      .catch((error) => {
        console.error('Matrix SAS verification failed:', error);
        setLastVerificationError(describeError(error));
        setActiveSasVerification(null);
      });
  }, []);

  // ─── confirmSas / rejectSas ──────────────────────────────────────────────

  const confirmSasVerification = useCallback(async () => {
    if (!activeSasVerification) throw new Error('Keine aktive Emoji-Verifizierung vorhanden.');
    await activeSasVerification.confirm();
  }, [activeSasVerification]);

  const rejectSasVerification = useCallback(() => {
    if (!activeSasVerification) return;
    activeSasVerification.mismatch();
  }, [activeSasVerification]);

  // ─── resetCryptoStore ────────────────────────────────────────────────────

  const resetCryptoStore = useCallback(async () => {
    disconnect();

    try {
      // Feature-detect indexedDB.databases()
      if (typeof indexedDB.databases === 'function') {
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
      } else {
        // Fallback for browsers without indexedDB.databases() (e.g. Safari < 14)
        throw new Error('databases() not available');
      }
    } catch {
      const userId = credentials?.userId || '';
      const knownNames = [
        `matrix-js-sdk:crypto:${userId}`,
        `matrix-rust-sdk-crypto-${userId}`,
      ];
      for (const name of knownNames) {
        try { indexedDB.deleteDatabase(name); } catch {}
      }
    }

    const userId = credentials?.userId || '';
    if (userId) {
      localStorage.removeItem(`matrix_device_id:${userId}`);
    }

    if (credentials) {
      await new Promise(r => setTimeout(r, 500));
      isConnectingRef.current = false;
      await connect({ ...credentials, deviceId: undefined });
    }
  }, [credentials, connect, disconnect]);

  // ─── Auto-connect ────────────────────────────────────────────────────────

  useEffect(() => {
    if (credentials && !isConnected && !isConnecting && !client && !isConnectingRef.current) {
      connect(credentials);
    }
  }, [credentials, isConnected, isConnecting, client, connect]);

  // ─── Context value ───────────────────────────────────────────────────────

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
    refreshMessages,
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
