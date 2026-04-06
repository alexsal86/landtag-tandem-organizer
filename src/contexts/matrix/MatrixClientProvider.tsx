import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useMatrixUnread } from '@/contexts/MatrixUnreadContext';
import * as sdk from 'matrix-js-sdk';
import { CryptoEvent } from 'matrix-js-sdk';
import { VerificationPhase, type Verifier } from 'matrix-js-sdk/lib/crypto-api/verification';
import { decodeRecoveryKey } from 'matrix-js-sdk/lib/crypto-api/recovery-key';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';
import { supabase } from '@/integrations/supabase/client';
import { getCoiCapabilityStatus } from '@/lib/coiRuntime';
import type { MatrixCreateRoomOptions, MatrixMessage, MatrixReactionSummary } from '@/types/matrix';

import type {
  MatrixCredentials,
  ConnectOptions,
  MatrixRoom,
  MatrixE2EEDiagnostics,
  MatrixSasVerificationState,
  MatrixRoomMessagesMap,
  MatrixRoomHistoryMap,
  MatrixTypingUsersMap,
  MatrixClientContextType,
  MatrixClientProviderProps,
  MatrixEventListener,
  MatrixMessageContentPayload,
  MatrixRelatesToBasePayload,
  MatrixVerificationRequest,
  MatrixReadMarkersClient,
  MatrixRoomId,
} from './types';

import {
  MAX_CACHED_MESSAGES,
  MAX_CACHED_ROOMS,
  SCROLLBACK_BATCH_LIMIT,
  MAX_SCROLLBACK_LOOPS,
  defaultMatrixClientContext,
  createDefaultE2EEDiagnostics,
} from './constants';

import {
  installMatrixConsoleNoiseFilter,
  matrixLogger,
  toSafeErrorMessage,
  toMatrixEventPayload,
  getMatrixRelatesToPayload,
  mapMatrixEventToMessage,
  isLocalEchoEvent,
  setupVerifierListeners,
} from './helpers';

const MatrixClientContext = createContext<MatrixClientContextType>(defaultMatrixClientContext);

export function MatrixClientProvider({ children }: MatrixClientProviderProps): React.JSX.Element {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const { setLiveUnreadCount } = useMatrixUnread();

  const [client, setClient] = useState<sdk.MatrixClient | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [cryptoEnabled, setCryptoEnabled] = useState(false);
  const [rooms, setRooms] = useState<MatrixRoom[]>([]);
  const [credentials, setCredentials] = useState<MatrixCredentials | null>(null);
  const [messages, setMessages] = useState<MatrixRoomMessagesMap>(new Map());
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const [typingUsers, setTypingUsers] = useState<MatrixTypingUsersMap>(new Map());
  const [roomHistoryState, setRoomHistoryState] = useState<MatrixRoomHistoryMap>(new Map());
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
    coiBlockedReason: getCoiCapabilityStatus().reason,
  });

  const isConnectingRef = useRef(false);
  const connectCalledRef = useRef(false);
  const isConnectedRef = useRef(false);
  const authPasswordRef = useRef<string | undefined>(undefined);
  const clientRef = useRef<sdk.MatrixClient | null>(null);
  const listenersRef = useRef<MatrixEventListener[]>([]);
  const refreshInFlightRef = useRef<Set<string>>(new Set());
  const historyLoadInFlightRef = useRef<Set<string>>(new Set());
  const messagesRoomLruRef = useRef<string[]>([]);
  const keyBackupActivatedRef = useRef(false);

  const touchRoomInLru = useCallback((roomId: string) => {
    const lru = messagesRoomLruRef.current;
    const existingIndex = lru.indexOf(roomId);
    if (existingIndex >= 0) lru.splice(existingIndex, 1);
    lru.push(roomId);
  }, []);

  const upsertRoomMessages = useCallback((
    prev: MatrixRoomMessagesMap,
    roomId: string,
    updater: (current: MatrixMessage[]) => MatrixMessage[],
  ) => {
    const current = prev.get(roomId) || [];
    const nextRoomMessages = updater(current).slice(-MAX_CACHED_MESSAGES);
    const next = new Map(prev);
    next.set(roomId, nextRoomMessages);

    touchRoomInLru(roomId);
    const lru = messagesRoomLruRef.current;
    while (next.size > MAX_CACHED_ROOMS && lru.length > 0) {
      const evictRoomId = lru.shift();
      if (!evictRoomId || evictRoomId === roomId) continue;
      next.delete(evictRoomId);
    }

    return next;
  }, [touchRoomInLru]);

  useEffect(() => { isConnectedRef.current = isConnected; }, [isConnected]);

  useEffect(() => {
    const restoreConsole = installMatrixConsoleNoiseFilter();
    return () => { restoreConsole(); };
  }, []);

  const updateRoomList = useCallback((matrixClient: sdk.MatrixClient) => {
    const joinedRooms = matrixClient.getRooms();
    const roomList: MatrixRoom[] = joinedRooms.map(room => {
      const timeline = room.getLiveTimeline().getEvents();
      const lastMessageEvent = timeline.filter(e => e.getType() === 'm.room.message').pop();
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
  }, []);

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
          return;
        }
        setCredentials(null);
      } catch (error) {
        matrixLogger.error('Error loading Matrix credentials:', error);
      }
    };
    loadCredentials();
  }, [user, currentTenant?.id]);

  const connect = useCallback(async (creds: MatrixCredentials, options?: ConnectOptions) => {
    if (isConnectingRef.current) return;
    isConnectingRef.current = true;
    setIsConnecting(true);
    setConnectionError(null);

    try {
      const deviceStorageKey = `matrix_device_id:${creds.userId}`;
      const resolveDeviceId = async (opts?: { ignoreCached?: boolean }) => {
        const cachedDeviceId = opts?.ignoreCached
          ? undefined
          : (creds.deviceId || localStorage.getItem(deviceStorageKey) || undefined);
        if (cachedDeviceId) return cachedDeviceId;

        let whoamiBody: { user_id?: string; device_id?: string };
        try {
          const whoamiResponse = await fetch(`${creds.homeserverUrl}/_matrix/client/v3/account/whoami`, {
            headers: { Authorization: `Bearer ${creds.accessToken}` },
          });
          if (!whoamiResponse.ok) throw new Error(`whoami antwortete mit HTTP ${whoamiResponse.status}`);
          whoamiBody = await whoamiResponse.json();
        } catch (error) {
          throw new Error(`Matrix-Connect abgebrochen: deviceId konnte nicht via whoami ermittelt werden (${error instanceof Error ? error.message : 'Unbekannter Fehler'}).`);
        }

        if (whoamiBody.user_id && whoamiBody.user_id !== creds.userId) {
          throw new Error(`Matrix-Connect abgebrochen: whoami user_id (${whoamiBody.user_id}) passt nicht zu den Credentials (${creds.userId}).`);
        }

        const resolvedDeviceId = whoamiBody.device_id;
        if (!resolvedDeviceId) throw new Error('Matrix-Connect abgebrochen: whoami lieferte keine device_id und lokal ist keine deviceId gespeichert.');
        localStorage.setItem(deviceStorageKey, resolvedDeviceId);
        return resolvedDeviceId;
      };

      let localDeviceId = await resolveDeviceId();
      const uiaPassword = options?.uiaPassword?.trim() || undefined;
      authPasswordRef.current = uiaPassword;

      const getSecretStorageKey = async ({ keys }: { keys: Record<string, unknown> }) => {
        const recoveryKey = localStorage.getItem(`matrix_recovery_key:${creds.userId}`)?.trim();
        if (!recoveryKey) return null;
        const keyId = Object.keys(keys)[0];
        if (!keyId) return null;
        try { return [keyId, decodeRecoveryKey(recoveryKey)] as [string, Uint8Array]; } catch { return null; }
      };

      let matrixClient = sdk.createClient({
        baseUrl: creds.homeserverUrl,
        accessToken: creds.accessToken,
        userId: creds.userId,
        deviceId: localDeviceId,
        cryptoCallbacks: { getSecretStorageKey },
      });
      clientRef.current = matrixClient;

      const clearLocalCryptoStores = async (userId: string) => {
        try {
          if (typeof indexedDB.databases === 'function') {
            const databases = await indexedDB.databases();
            const cryptoDbs = databases.filter(db => db.name && (db.name.includes('matrix-js-sdk:crypto') || db.name.includes('rust-crypto') || db.name.includes('matrix-sdk-crypto')));
            for (const db of cryptoDbs) { if (db.name) { indexedDB.deleteDatabase(db.name); matrixLogger.log('Cleared stale crypto DB:', db.name); } }
          } else {
            const knownNames = [`matrix-js-sdk:crypto:${userId}`, `matrix-rust-sdk-crypto-${userId}`];
            for (const name of knownNames) { try { indexedDB.deleteDatabase(name); } catch {} }
          }
        } catch (e) { matrixLogger.warn('Could not clear crypto stores:', e); }
      };

      if (localDeviceId) {
        try {
          const resp = await fetch(`${creds.homeserverUrl}/_matrix/client/v3/devices/${localDeviceId}`, { headers: { Authorization: `Bearer ${creds.accessToken}` } });
          if (!resp.ok) {
            matrixLogger.warn('Stored device no longer exists on server, creating new device');
            localStorage.removeItem(`matrix_device_id:${creds.userId}`);
            await clearLocalCryptoStores(creds.userId);
            localDeviceId = await resolveDeviceId({ ignoreCached: true });
            matrixClient = sdk.createClient({ baseUrl: creds.homeserverUrl, accessToken: creds.accessToken, userId: creds.userId, deviceId: localDeviceId, cryptoCallbacks: { getSecretStorageKey } });
            clientRef.current = matrixClient;
          }
        } catch (e) { matrixLogger.warn('Device validation fetch failed:', e); }
      }

      const updateRuntimeDiagnostics = (
        cryptoError: string | null = null,
        cryptoState?: { secretStorageReady: boolean | null; crossSigningReady: boolean | null; keyBackupEnabled: boolean | null }
      ) => {
        const coiStatus = getCoiCapabilityStatus();
        setE2eeDiagnostics({
          secureContext: window.isSecureContext,
          crossOriginIsolated: window.crossOriginIsolated,
          sharedArrayBuffer: typeof SharedArrayBuffer !== 'undefined',
          serviceWorkerControlled: Boolean(navigator.serviceWorker?.controller),
          secretStorageReady: cryptoState?.secretStorageReady ?? null,
          crossSigningReady: cryptoState?.crossSigningReady ?? null,
          keyBackupEnabled: cryptoState?.keyBackupEnabled ?? null,
          cryptoError,
          coiBlockedReason: coiStatus.reason,
        });
      };

      updateRuntimeDiagnostics();
      let lastCryptoError: string | null = null;

      const coiStatus = getCoiCapabilityStatus();
      if (coiStatus.blocked) {
        lastCryptoError = 'Cross-Origin-Isolation ist in dieser Session nicht erreichbar (iframe). Bitte in einem neuen Tab öffnen.';
        matrixLogger.warn('Skipping Matrix E2EE init due to hard COI capability block:', coiStatus);
        updateRuntimeDiagnostics(lastCryptoError);
        setCryptoEnabled(false);
      } else {
        try {
          matrixLogger.log('=== Matrix E2EE Diagnostics ===');
          matrixLogger.log('Cross-Origin Isolated:', window.crossOriginIsolated);
          matrixLogger.log('SharedArrayBuffer available:', typeof SharedArrayBuffer !== 'undefined');
          if (!window.crossOriginIsolated) matrixLogger.warn('Cross-Origin Isolation not enabled. E2EE may not work. Try a new tab.');
          await matrixClient.initRustCrypto();
          matrixLogger.log('Matrix E2EE initialized successfully');
        } catch (cryptoError) {
          matrixLogger.error('Failed to initialize E2EE:', cryptoError);
          lastCryptoError = cryptoError instanceof Error ? cryptoError.message : 'E2EE-Initialisierung fehlgeschlagen';
          updateRuntimeDiagnostics(lastCryptoError);
          setCryptoEnabled(false);
        }
      }

      const bootstrapCryptoSecrets = async (cryptoApi: ReturnType<typeof matrixClient.getCrypto>, userId: string, password?: string) => {
        if (!cryptoApi) return;
        const existingKey = localStorage.getItem(`matrix_recovery_key:${userId}`);
        try {
          const isReady = await cryptoApi.isSecretStorageReady();
          if (!isReady) {
            try {
              await cryptoApi.bootstrapSecretStorage({
                createSecretStorageKey: async () => {
                  if (existingKey) {
                    try { const privateKey = decodeRecoveryKey(existingKey.trim()); return { privateKey, encodedPrivateKey: existingKey.trim() }; } catch {}
                  }
                  const newKey = await cryptoApi.createRecoveryKeyFromPassphrase(undefined);
                  localStorage.setItem(`matrix_recovery_key:${userId}`, newKey.encodedPrivateKey ?? '');
                  matrixLogger.log('Generated and stored new Matrix recovery key');
                  return newKey;
                },
              });
              matrixLogger.log('Secret Storage bootstrapped');
            } catch (e) { matrixLogger.warn('bootstrapSecretStorage failed (non-critical):', e); }
          } else {
            matrixLogger.log('Secret Storage already ready, skipping bootstrap');
          }
        } catch (e) { matrixLogger.warn('isSecretStorageReady check failed:', e); }

        try {
          await cryptoApi.bootstrapCrossSigning(
            password
              ? { authUploadDeviceSigningKeys: async (makeRequest: (auth: Record<string, unknown>) => Promise<void>) => { const localpart = userId.split(':')[0].substring(1); await makeRequest({ type: 'm.login.password', identifier: { type: 'm.id.user', user: localpart }, password }); } }
              : {}
          );
          matrixLogger.log('Cross-Signing bootstrapped');
        } catch (e) { matrixLogger.warn(`bootstrapCrossSigning failed: ${toSafeErrorMessage(e)}`); }

        try { await cryptoApi.checkKeyBackupAndEnable(); matrixLogger.log('Key backup checked/enabled'); } catch (e) { matrixLogger.warn('checkKeyBackupAndEnable failed (non-critical):', e); }
      };

      await bootstrapCryptoSecrets(matrixClient.getCrypto(), creds.userId, uiaPassword);

      const registeredListeners: MatrixEventListener[] = [];

      const onSync = (state: string, prevState: string | null) => {
        matrixLogger.log('[Matrix] Sync state:', prevState, '->', state);
        if (state === 'PREPARED' || state === 'SYNCING' || state === 'CATCHUP') {
          isConnectedRef.current = true;
          setIsConnected(true);
          setIsConnecting(false);
          setConnectionError(null);
          if (state === 'PREPARED') {
            setCryptoEnabled(Boolean(matrixClient.getCrypto()));
            updateRoomList(matrixClient);
            if (!keyBackupActivatedRef.current) {
              keyBackupActivatedRef.current = true;
              const cryptoApi = matrixClient.getCrypto();
              if (cryptoApi) cryptoApi.checkKeyBackupAndEnable().catch(() => {});
            }
          }
        } else if (state === 'RECONNECTING') {
          isConnectedRef.current = false;
          setIsConnected(false);
          setIsConnecting(true);
        } else if (state === 'ERROR') {
          isConnectedRef.current = false;
          setIsConnected(false);
          setConnectionError('Sync-Fehler aufgetreten');
          setIsConnecting(false);
        } else if (state === 'STOPPED') {
          isConnectedRef.current = false;
          setIsConnected(false);
          setIsConnecting(false);
        }
      };

      const onTimeline = (event: sdk.MatrixEvent, room: sdk.Room | undefined) => {
        if (!room) return;
        const eventType = event.getType();

        if (eventType === 'm.room.message' || eventType === 'm.room.encrypted') {
          if (isLocalEchoEvent(event)) return;
          const newMessage = mapMatrixEventToMessage(room, event);
          if (!newMessage) return;
          setMessages(prev => {
            const roomMessages = prev.get(room.roomId) || [];
            if (roomMessages.some(m => m.eventId === newMessage.eventId)) return prev;
            return upsertRoomMessages(prev, room.roomId, (existing) => [...existing, newMessage]);
          });
          updateRoomList(matrixClient);
        }

        if (eventType === 'm.reaction') {
          const relatesTo = getMatrixRelatesToPayload(event);
          if (relatesTo?.rel_type === 'm.annotation') {
            const targetEventId = relatesTo.event_id;
            const emoji = relatesTo.key;
            if (!targetEventId || !emoji) return;
            setMessages(prev => {
              const roomMessages = prev.get(room.roomId);
              if (!roomMessages) return prev;
              const newRoomMessages = roomMessages.map(msg => {
                if (msg.eventId === targetEventId) {
                  const reactions = new Map(msg.reactions);
                  const existing: MatrixReactionSummary = reactions.get(emoji) || { count: 0, userReacted: false };
                  reactions.set(emoji, { count: existing.count + 1, userReacted: existing.userReacted || event.getSender() === creds.userId });
                  return { ...msg, reactions };
                }
                return msg;
              });
              return upsertRoomMessages(prev, room.roomId, () => newRoomMessages);
            });
          }
        }
      };

      const onTyping = (_event: sdk.MatrixEvent, member: sdk.RoomMember) => {
        const presencePayload = toMatrixEventPayload(_event);
        if ('user_ids' in presencePayload && !Array.isArray(presencePayload.user_ids)) return;
        const roomId = member.roomId;
        const r = matrixClient.getRoom(roomId);
        if (!r) return;
        const typingMembers = r.getMembers().filter(m => m.typing && m.userId !== creds.userId).map(m => m.name || m.userId);
        setTypingUsers(prev => { const updated = new Map(prev); updated.set(roomId, typingMembers); return updated; });
      };

      const onDecrypted = (event: sdk.MatrixEvent) => {
        const roomId = event.getRoomId();
        if (!roomId) return;
        const content = toMatrixEventPayload(event);
        if (!('msgtype' in content)) return;
        const msgContent = content as MatrixMessageContentPayload;
        if (!msgContent?.msgtype) return;
        const r = matrixClient.getRoom(roomId);
        if (!r) return;
        const isMedia = ['m.image', 'm.video', 'm.audio', 'm.file'].includes(msgContent.msgtype);
        const decryptedMessage: MatrixMessage = {
          eventId: event.getId() || '',
          roomId,
          sender: event.getSender() || '',
          senderDisplayName: r.getMember(event.getSender() || '')?.name || event.getSender() || '',
          content: msgContent.body || '[Entschlüsselung fehlgeschlagen]',
          timestamp: event.getTs(),
          type: msgContent.msgtype || 'm.text',
          status: 'sent',
          reactions: new Map(),
          mediaContent: isMedia ? { msgtype: msgContent.msgtype, body: msgContent.body || '', url: msgContent.url, info: msgContent.info as import('@/types/matrix').MatrixMessageMediaInfo | undefined } as import('@/types/matrix').MatrixMediaContent : undefined,
        };
        setMessages(prev => {
          const roomMessages = prev.get(roomId) || [];
          const existingIndex = roomMessages.findIndex(m => m.eventId === decryptedMessage.eventId);
          if (existingIndex >= 0) { const next = [...roomMessages]; next[existingIndex] = decryptedMessage; return upsertRoomMessages(prev, roomId, () => next); }
          return upsertRoomMessages(prev, roomId, (existing) => [...existing, decryptedMessage]);
        });
      };

      const onVerificationRequestReceived = async (verificationRequest: MatrixVerificationRequest) => {
        matrixLogger.log('[Matrix] Incoming verification request, phase:', verificationRequest.phase);
        if (verificationRequest.phase === VerificationPhase.Requested) {
          try { await verificationRequest.accept(); matrixLogger.log('[Matrix] Verification request accepted'); } catch (e) { matrixLogger.error('[Matrix] Failed to accept verification request:', e); return; }
        }

        if (verificationRequest.phase !== VerificationPhase.Ready && verificationRequest.phase !== VerificationPhase.Started) {
          const waitResult = await new Promise<'ok' | 'cancelled' | 'timeout'>((resolve) => {
            let timeoutId: ReturnType<typeof setTimeout>;
            const check = () => {
              const phase = verificationRequest.phase;
              if (phase === VerificationPhase.Ready || phase === VerificationPhase.Started) { clearTimeout(timeoutId); verificationRequest.off?.('change', check); resolve('ok'); }
              else if (phase === VerificationPhase.Cancelled || phase === VerificationPhase.Done) { clearTimeout(timeoutId); verificationRequest.off?.('change', check); resolve('cancelled'); }
            };
            verificationRequest.on?.('change', check);
            check();
            timeoutId = setTimeout(() => { verificationRequest.off?.('change', check); resolve('timeout'); }, 60000);
          });
          if (waitResult !== 'ok') { try { await verificationRequest.cancel(); } catch {} matrixLogger.warn('[Matrix] Incoming verification aborted:', waitResult); return; }
        }

        if (verificationRequest.phase === VerificationPhase.Cancelled || verificationRequest.phase === VerificationPhase.Done) return;

        try {
          const verifier: Verifier = verificationRequest.phase === VerificationPhase.Started && verificationRequest.verifier
            ? verificationRequest.verifier
            : await verificationRequest.startVerification('m.sas.v1');
          const cleanupVerifierListeners = setupVerifierListeners(verifier, verificationRequest, setActiveSasVerification, setLastVerificationError);
          verifier.verify()
            .then(() => { matrixLogger.log('[Matrix] Incoming SAS verification succeeded'); setLastVerificationError(null); setActiveSasVerification(null); cleanupVerifierListeners(); })
            .catch((err: unknown) => { matrixLogger.error('[Matrix] Incoming SAS verification failed:', err); setLastVerificationError(err instanceof Error ? err.message : 'Verifizierung fehlgeschlagen'); setActiveSasVerification(null); cleanupVerifierListeners(); });
          matrixLogger.log('[Matrix] Incoming verification SAS started');
        } catch (err) { matrixLogger.error('[Matrix] Failed to handle incoming verification:', err); }
      };

      matrixClient.on(sdk.ClientEvent.Sync, onSync);
      matrixClient.on(sdk.RoomEvent.Timeline, onTimeline as unknown as (...args: unknown[]) => void);
      matrixClient.on(sdk.RoomMemberEvent.Typing, onTyping as unknown as (...args: unknown[]) => void);
      matrixClient.on(sdk.MatrixEventEvent.Decrypted, onDecrypted);
      matrixClient.on(CryptoEvent.VerificationRequestReceived, onVerificationRequestReceived);

      registeredListeners.push(
        { event: sdk.ClientEvent.Sync, handler: onSync },
        { event: sdk.RoomEvent.Timeline, handler: onTimeline as (...args: unknown[]) => void },
        { event: sdk.RoomMemberEvent.Typing, handler: onTyping as (...args: unknown[]) => void },
        { event: sdk.MatrixEventEvent.Decrypted, handler: onDecrypted },
        { event: CryptoEvent.VerificationRequestReceived, handler: onVerificationRequestReceived },
      );
      listenersRef.current = registeredListeners;

      let otkCollisionDetected = false;
      const nativeFetch = window.fetch;
      window.fetch = async function (...args: Parameters<typeof fetch>) {
        const response = await nativeFetch.apply(this, args);
        if (!otkCollisionDetected && response.status === 400) {
          const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request)?.url || '';
          if (url.includes('/keys/upload')) {
            try { const cloned = response.clone(); const body = await cloned.json(); if (body?.error?.includes('already exists') || body?.errcode === 'M_UNKNOWN') { otkCollisionDetected = true; matrixLogger.warn('[Matrix] OTK collision detected – will auto-recover after sync'); } } catch {}
          }
        }
        return response;
      };

      await matrixClient.startClient({ initialSyncLimit: 50 });
      window.fetch = nativeFetch;

      if (otkCollisionDetected) {
        matrixLogger.warn('[Matrix] Auto-recovering from OTK collision: clearing crypto stores and reconnecting...');
        matrixClient.stopClient();
        await clearLocalCryptoStores(creds.userId);
        localStorage.removeItem(`matrix_device_id:${creds.userId}`);
        localDeviceId = await resolveDeviceId({ ignoreCached: true });
        matrixClient = sdk.createClient({ baseUrl: creds.homeserverUrl, accessToken: creds.accessToken, userId: creds.userId, deviceId: localDeviceId, cryptoCallbacks: { getSecretStorageKey } });
        clientRef.current = matrixClient;
        if (!getCoiCapabilityStatus().blocked) {
          await matrixClient.initRustCrypto();
          await bootstrapCryptoSecrets(matrixClient.getCrypto(), creds.userId, uiaPassword);
        }
        registeredListeners.length = 0;
        matrixClient.on(sdk.ClientEvent.Sync, onSync);
        matrixClient.on(sdk.RoomEvent.Timeline, onTimeline as (...args: unknown[]) => void);
        matrixClient.on(sdk.RoomMemberEvent.Typing, onTyping as (...args: unknown[]) => void);
        matrixClient.on(sdk.MatrixEventEvent.Decrypted, onDecrypted);
        matrixClient.on(CryptoEvent.VerificationRequestReceived, onVerificationRequestReceived);
        registeredListeners.push(
          { event: sdk.ClientEvent.Sync, handler: onSync },
          { event: sdk.RoomEvent.Timeline, handler: onTimeline as (...args: unknown[]) => void },
          { event: sdk.RoomMemberEvent.Typing, handler: onTyping as (...args: unknown[]) => void },
          { event: sdk.MatrixEventEvent.Decrypted, handler: onDecrypted },
          { event: CryptoEvent.VerificationRequestReceived, handler: onVerificationRequestReceived },
        );
        listenersRef.current = registeredListeners;
        await matrixClient.startClient({ initialSyncLimit: 50 });
        matrixLogger.log('[Matrix] OTK collision recovery complete');
      }

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
        } catch (e) { matrixLogger.error('Failed to read crypto state:', e); }
      }
      if (!cryptoAfterStart && !lastCryptoError) lastCryptoError = 'Rust-Crypto wurde initialisiert, aber keine CryptoApi verfügbar.';
      updateRuntimeDiagnostics(lastCryptoError, { secretStorageReady, crossSigningReady, keyBackupEnabled });

      const finalDeviceId = matrixClient.getDeviceId() || localDeviceId || '';
      if (finalDeviceId) localStorage.setItem(`matrix_device_id:${creds.userId}`, finalDeviceId);

      setClient(matrixClient);
      setCredentials({ ...creds, deviceId: finalDeviceId || undefined });
    } catch (error) {
      matrixLogger.error(`Error connecting to Matrix: ${toSafeErrorMessage(error)}`);
      setConnectionError(error instanceof Error ? error.message : 'Verbindungsfehler');
      setIsConnecting(false);
    } finally {
      isConnectingRef.current = false;
    }
  }, [updateRoomList]);

  const disconnect = useCallback(() => {
    const mc = clientRef.current;
    if (mc) {
      for (const { event, handler } of listenersRef.current) {
        // @ts-expect-error matrix-js-sdk event union type mismatch
        try { mc.removeListener(event, handler); } catch {}
      }
      listenersRef.current = [];
      mc.stopClient();
      clientRef.current = null;
      setClient(null);
    }
    isConnectedRef.current = false;
    keyBackupActivatedRef.current = false;
    authPasswordRef.current = undefined;
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
      coiBlockedReason: getCoiCapabilityStatus().reason,
    });
    setRooms([]);
    setMessages(new Map());
    setTypingUsers(new Map());
    setRoomHistoryState(new Map());
    setActiveSasVerification(null);
    setLastVerificationError(null);
    connectCalledRef.current = false;
  }, []);

  const refreshMessages = useCallback((roomId: string, limit: number = MAX_CACHED_MESSAGES) => {
    const refreshStartedAt = performance.now();
    const mc = clientRef.current;
    if (!mc) return;
    const room = mc.getRoom(roomId);
    if (!room) return;

    const normalizedLimit = Math.min(limit, MAX_CACHED_MESSAGES);
    touchRoomInLru(roomId);
    const timeline = room.getLiveTimeline().getEvents();
    const timelineWindow = timeline.slice(-normalizedLimit);

    let scrollbackLoops = 0;
    if (timeline.length < normalizedLimit && !refreshInFlightRef.current.has(roomId)) {
      refreshInFlightRef.current.add(roomId);
      void (async () => {
        try {
          let hasMore = true;
          while (hasMore && room.getLiveTimeline().getEvents().length < normalizedLimit && scrollbackLoops < MAX_SCROLLBACK_LOOPS) {
            scrollbackLoops += 1;
            hasMore = (await mc.scrollback(room, SCROLLBACK_BATCH_LIMIT)) as unknown as boolean;
          }
        } catch (error) { matrixLogger.warn('Matrix scrollback failed:', error); }
        finally { refreshInFlightRef.current.delete(roomId); }
      })();
    }

    const cached = messagesRef.current.get(roomId) || [];
    const cachedEventIds = new Set(cached.map((message) => message.eventId));
    const visibleOrNewEvents = timelineWindow.filter((event) => { const id = event.getId(); return !id || !cachedEventIds.has(id); });

    visibleOrNewEvents.forEach(event => {
      if (event.isEncrypted()) {
        try {
          // @ts-expect-error matrix-js-sdk CryptoApi vs CryptoBackend mismatch
          event.attemptDecryption(mc.getCrypto()).catch(() => {});
        } catch {}
      }
    });

    const cachedFailedIds = new Set(cached.filter(m => m.type === 'm.bad.encrypted').map(m => m.eventId));
    if (cachedFailedIds.size > 0) {
      timelineWindow.forEach(event => {
        const id = event.getId();
        if (id && cachedFailedIds.has(id) && event.isEncrypted()) {
          try {
            // @ts-expect-error matrix-js-sdk CryptoApi vs CryptoBackend mismatch
            event.attemptDecryption(mc.getCrypto()).catch(() => {});
          } catch {}
        }
      });
    }

    const timelineMessages: MatrixMessage[] = timelineWindow
      .map(event => mapMatrixEventToMessage(room, event))
      .filter((msg): msg is MatrixMessage => Boolean(msg));

    const deltaMessages: MatrixMessage[] = [];
    const cachedById = new Map<string, MatrixMessage>(cached.map((message) => [message.eventId, message]));
    for (const message of timelineMessages) {
      const existing = cachedById.get(message.eventId);
      const shouldReplace = existing != null && (
        (existing.type === 'm.bad.encrypted' && message.type !== 'm.bad.encrypted') ||
        (existing.type === 'm.room.encrypted' && message.type !== 'm.room.encrypted' && message.type !== 'm.bad.encrypted') ||
        (existing.content === '[Encrypted]' && message.content !== '[Encrypted]')
      );
      if (!existing || shouldReplace) deltaMessages.push(message);
    }

    if (deltaMessages.length > 0 || !messagesRef.current.has(roomId)) {
      setMessages(prev => upsertRoomMessages(prev, roomId, (current) => {
        const merged = [...current];
        for (const deltaMessage of deltaMessages) {
          const existingIndex = merged.findIndex((message) => message.eventId === deltaMessage.eventId);
          if (existingIndex >= 0) { merged[existingIndex] = deltaMessage; continue; }
          const insertIndex = merged.findIndex((message) => message.timestamp > deltaMessage.timestamp);
          if (insertIndex === -1) merged.push(deltaMessage);
          else merged.splice(insertIndex, 0, deltaMessage);
        }
        return merged;
      }));
    }

    matrixLogger.log('[Matrix][Perf] refreshMessages', {
      roomId, durationMs: Number((performance.now() - refreshStartedAt).toFixed(2)),
      timelineEvents: timeline.length, windowEvents: timelineWindow.length,
      cachedEvents: cached.length, deltaEvents: deltaMessages.length,
      decryptAttempts: visibleOrNewEvents.length, scrollbackLoops, cacheRooms: messagesRef.current.size,
    });
  }, [touchRoomInLru, upsertRoomMessages]);

  const loadOlderMessages = useCallback(async (roomId: string, pages: number = 1) => {
    const mc = clientRef.current;
    if (!mc || historyLoadInFlightRef.current.has(roomId)) return;
    const room = mc.getRoom(roomId);
    if (!room) return;

    historyLoadInFlightRef.current.add(roomId);
    setRoomHistoryState((prev: MatrixRoomHistoryMap) => {
      const next = new Map(prev);
      const existing = next.get(roomId);
      next.set(roomId, { isLoadingMore: true, hasMoreHistory: existing?.hasMoreHistory ?? true });
      return next;
    });

    const safePages = Math.max(1, pages);
    let hasMoreHistory = true;
    try {
      for (let i = 0; i < safePages; i += 1) {
        hasMoreHistory = (await mc.scrollback(room, SCROLLBACK_BATCH_LIMIT)) as unknown as boolean;
        if (!hasMoreHistory) break;
      }
      const currentLength = messagesRef.current.get(roomId)?.length || 0;
      const nextLimit = Math.min(MAX_CACHED_MESSAGES, Math.max(100, currentLength + (safePages * SCROLLBACK_BATCH_LIMIT)));
      refreshMessages(roomId, nextLimit);
    } catch (error) { matrixLogger.warn('Matrix loadOlderMessages failed:', error); }
    finally {
      historyLoadInFlightRef.current.delete(roomId);
      setRoomHistoryState((prev: MatrixRoomHistoryMap) => { const next = new Map(prev); next.set(roomId, { isLoadingMore: false, hasMoreHistory }); return next; });
    }
  }, [refreshMessages]);

  const sendMessage = useCallback(async (roomId: string, message: string, replyToEventId?: string) => {
    const mc = clientRef.current;
    if (!mc || !isConnectedRef.current) throw new Error('Nicht mit Matrix verbunden');
    const room = mc.getRoom(roomId);
    if (room?.hasEncryptionStateEvent() && !mc.getCrypto()) throw new Error('Verschlüsselung erforderlich, aber nicht verfügbar. Seite neu laden.');

    const content: MatrixMessageContentPayload = { msgtype: 'm.text', body: message };
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
    // @ts-expect-error matrix-js-sdk RoomMessageEventContent union type mismatch
    await mc.sendMessage(roomId, content as unknown as Record<string, unknown>);
  }, []);

  const sendTypingNotification = useCallback((roomId: string, isTyping: boolean) => {
    const mc = clientRef.current;
    if (!mc) return;
    mc.sendTyping(roomId, isTyping, isTyping ? 30000 : 0);
  }, []);

  const sendReadReceiptForLatestVisibleEvent = useCallback(async (roomId: string) => {
    const mc = clientRef.current;
    if (!mc || !isConnectedRef.current) return;
    const room = mc.getRoom(roomId);
    if (!room) return;
    const cachedMessages = messagesRef.current.get(roomId) || [];
    const lastVisibleEventId = cachedMessages[cachedMessages.length - 1]?.eventId;
    const latestEvent = lastVisibleEventId
      ? room.findEventById(lastVisibleEventId)
      : (() => { const events = room.getLiveTimeline().getEvents(); return events[events.length - 1]; })();
    if (!latestEvent) return;
    try {
      await mc.sendReadReceipt(latestEvent);
      const latestEventId = latestEvent.getId();
      if (latestEventId) {
        const readMarkersClient = mc as unknown as MatrixReadMarkersClient;
        if (typeof readMarkersClient.setRoomReadMarkers === 'function') await readMarkersClient.setRoomReadMarkers(roomId, latestEventId, latestEventId);
      }
    } catch (error) { matrixLogger.warn('Failed to send read receipt (non-critical):', error); }
  }, []);

  const addReaction = useCallback(async (roomId: string, eventId: string, emoji: string) => {
    const mc = clientRef.current;
    if (!mc) return;
    // @ts-expect-error matrix-js-sdk m.reaction not in keyof TimelineEvents
    await mc.sendEvent(roomId, 'm.reaction', { 'm.relates_to': { rel_type: 'm.annotation', event_id: eventId, key: emoji } });
  }, []);

  const removeReaction = useCallback(async (roomId: string, eventId: string, emoji: string) => {
    const mc = clientRef.current;
    if (!mc) return;
    const room = mc.getRoom(roomId);
    if (!room) return;
    const timeline = room.getLiveTimeline().getEvents();
    const myUserId = mc.getUserId();
    const reactionEvent = timeline.find(ev => {
      if (ev.getType() !== 'm.reaction') return false;
      const rel = getMatrixRelatesToPayload(ev);
      return rel?.rel_type === 'm.annotation' && rel?.event_id === eventId && rel?.key === emoji && ev.getSender() === myUserId;
    });
    if (reactionEvent) { const reactionEventId = reactionEvent.getId(); if (reactionEventId) await mc.redactEvent(roomId, reactionEventId); }
  }, []);

  const createRoom = useCallback(async (options: { name: string; topic?: string; isPrivate: boolean; enableEncryption: boolean; inviteUserIds?: string[] }) => {
    const mc = clientRef.current;
    if (!mc) throw new Error('Nicht mit Matrix verbunden');
    const createRoomOptions: sdk.ICreateRoomOpts = {
      name: options.name, topic: options.topic,
      visibility: options.isPrivate ? sdk.Visibility.Private : sdk.Visibility.Public,
      preset: options.isPrivate ? sdk.Preset.PrivateChat : sdk.Preset.PublicChat,
      invite: options.inviteUserIds,
    };
    if (options.enableEncryption) {
      createRoomOptions.initial_state = [{ type: 'm.room.encryption', state_key: '', content: { algorithm: 'm.megolm.v1.aes-sha2' } }];
    }
    const result = await mc.createRoom(createRoomOptions);
    updateRoomList(mc);
    return result.room_id;
  }, []);

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
        const content = (error.getContent() ?? {}) as Record<string, unknown>;
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

    if (verificationRequest.phase !== VerificationPhase.Started) {
      await new Promise<void>((resolve, reject) => {
        let timeoutId: ReturnType<typeof setTimeout>;
        const checkReady = () => {
          const phase = verificationRequest.phase;
          if (phase === VerificationPhase.Ready || phase === VerificationPhase.Started) { clearTimeout(timeoutId); (verificationRequest as unknown as MatrixVerificationRequest).off?.('change', checkReady); resolve(); }
          else if (phase === VerificationPhase.Cancelled || phase === VerificationPhase.Done) { clearTimeout(timeoutId); (verificationRequest as unknown as MatrixVerificationRequest).off?.('change', checkReady); reject(new Error('Verifizierung wurde vom anderen Gerät abgebrochen.')); }
        };
        (verificationRequest as unknown as MatrixVerificationRequest).on?.('change', checkReady);
        checkReady();
        timeoutId = setTimeout(() => { (verificationRequest as unknown as MatrixVerificationRequest).off?.('change', checkReady); reject(new Error('Verifizierungs-Timeout: Der andere Client hat nicht rechtzeitig geantwortet.')); }, 60000);
      });
    }

    let verifier: Verifier;
    try { verifier = await verificationRequest.startVerification('m.sas.v1'); } catch (error) {
      const reason = describeError(error);
      const isUnknownDevice = Boolean(trimmedDeviceId) && /other device is unknown/i.test(reason);
      if (!isUnknownDevice) throw error;
      setLastVerificationError(`Device ${trimmedDeviceId} nicht gefunden. Erneuter Versuch ohne feste Device-ID.`);
      verificationRequest = await crypto.requestOwnUserVerification();
      verifier = await verificationRequest.startVerification('m.sas.v1');
    }

    const cleanupVerifierListeners = setupVerifierListeners(verifier, verificationRequest as unknown as MatrixVerificationRequest, setActiveSasVerification, setLastVerificationError, describeError);
    void verifier.verify()
      .then(() => { setLastVerificationError(null); setActiveSasVerification(null); cleanupVerifierListeners(); })
      .catch((error) => { matrixLogger.error('Matrix SAS verification failed:', error); setLastVerificationError(describeError(error)); setActiveSasVerification(null); cleanupVerifierListeners(); });
  }, []);

  const confirmSasVerification = useCallback(async () => {
    if (!activeSasVerification) throw new Error('Keine aktive Emoji-Verifizierung vorhanden.');
    await activeSasVerification.confirm();
  }, [activeSasVerification]);

  const rejectSasVerification = useCallback(() => {
    if (!activeSasVerification) return;
    activeSasVerification.mismatch();
  }, [activeSasVerification]);

  const resetCryptoStore = useCallback(async () => {
    const mc = clientRef.current;
    if (mc) {
      try {
        const deviceId = mc.getDeviceId();
        if (deviceId) {
          const localpart = credentials?.userId?.split(':')[0].substring(1);
          await mc.deleteDevice(deviceId, authPasswordRef.current ? { type: 'm.login.password', identifier: { type: 'm.id.user', user: localpart }, password: authPasswordRef.current } : {});
          matrixLogger.log('Device deleted from server:', deviceId);
        }
      } catch (e) { matrixLogger.warn('Could not delete device from server (non-critical):', e); }
    }

    disconnect();

    try {
      if (typeof indexedDB.databases === 'function') {
        const databases = await indexedDB.databases();
        const cryptoDbs = databases.filter(db => db.name && (db.name.includes('matrix-js-sdk:crypto') || db.name.includes('rust-crypto') || db.name.includes('matrix-sdk-crypto')));
        for (const db of cryptoDbs) { if (db.name) { indexedDB.deleteDatabase(db.name); matrixLogger.log('Deleted crypto DB:', db.name); } }
      } else { throw new Error('databases() not available'); }
    } catch {
      const userId = credentials?.userId || '';
      const knownNames = [`matrix-js-sdk:crypto:${userId}`, `matrix-rust-sdk-crypto-${userId}`];
      for (const name of knownNames) { try { indexedDB.deleteDatabase(name); } catch {} }
    }

    const userId = credentials?.userId || '';
    if (userId) localStorage.removeItem(`matrix_device_id:${userId}`);

    if (credentials) {
      await new Promise(r => setTimeout(r, 500));
      isConnectingRef.current = false;
      connectCalledRef.current = false;
      await connect({ ...credentials, deviceId: undefined });
    }
  }, [credentials, connect, disconnect]);

  useEffect(() => {
    if (user && currentTenant?.id) return;
    disconnect();
    setCredentials(null);
    connectCalledRef.current = false;
  }, [user, currentTenant?.id, disconnect]);

  useEffect(() => {
    if (credentials && !connectCalledRef.current && !isConnectingRef.current) {
      const start = () => { if (!connectCalledRef.current && !isConnectingRef.current) { connectCalledRef.current = true; connect(credentials); } };
      const id = setTimeout(start, 0);
      return () => clearTimeout(id);
    }
  }, [credentials, connect]);

  useEffect(() => { return () => { disconnect(); }; }, [disconnect]);

  const totalUnreadCount = rooms.reduce((sum, room) => sum + room.unreadCount, 0);
  useEffect(() => { setLiveUnreadCount(totalUnreadCount); }, [totalUnreadCount, setLiveUnreadCount]);

  const value: MatrixClientContextType = {
    client, isConnected, isConnecting, connectionError, cryptoEnabled, e2eeDiagnostics, rooms, credentials,
    connect, disconnect, sendMessage, refreshMessages, loadOlderMessages, totalUnreadCount,
    roomMessages: messages, roomHistoryState, typingUsers, sendTypingNotification,
    sendReadReceiptForLatestVisibleEvent, addReaction, removeReaction, createRoom,
    requestSelfVerification, activeSasVerification, confirmSasVerification, rejectSasVerification,
    lastVerificationError, resetCryptoStore,
  };

  return (
    <MatrixClientContext.Provider value={value}>
      {children}
    </MatrixClientContext.Provider>
  );
}

export function useMatrixClient(): MatrixClientContextType {
  return useContext(MatrixClientContext);
}
