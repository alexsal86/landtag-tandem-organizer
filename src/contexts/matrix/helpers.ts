import React from 'react';
import * as sdk from 'matrix-js-sdk';
import { VerifierEvent, type Verifier } from 'matrix-js-sdk/lib/crypto-api/verification';
import { debugConsole, isDebugConsoleEnabled } from '@/utils/debugConsole';
import type { MatrixMessage } from '@/types/matrix';
import type {
  MatrixEventPayload,
  MatrixEventWithStatus,
  MatrixMessageContentPayload,
  MatrixRelatesToBasePayload,
  MatrixSasData,
  MatrixSasVerificationState,
  MatrixVerificationRequest,
} from './types';
import { MATRIX_CONSOLE_NOISE_PATTERNS } from './constants';

export const shouldSuppressMatrixConsoleNoise = (args: unknown[]) => {
  const text = args
    .map((arg) => {
      if (typeof arg === 'string') return arg;
      if (arg instanceof Error) return arg.message;
      try { return JSON.stringify(arg); } catch { return String(arg); }
    })
    .join(' ');

  return MATRIX_CONSOLE_NOISE_PATTERNS.some((pattern) => text.includes(pattern));
};

export const installMatrixConsoleNoiseFilter = () => {
  if (isDebugConsoleEnabled()) return () => {};

  const originalLog = globalThis.console.log.bind(globalThis.console);
  const originalInfo = globalThis.console.info.bind(globalThis.console);
  const originalWarn = globalThis.console.warn.bind(globalThis.console);
  const originalError = globalThis.console.error.bind(globalThis.console);

  globalThis.console.log = (...args: unknown[]) => { if (shouldSuppressMatrixConsoleNoise(args)) return; originalLog(...args); };
  globalThis.console.info = (...args: unknown[]) => { if (shouldSuppressMatrixConsoleNoise(args)) return; originalInfo(...args); };
  globalThis.console.warn = (...args: unknown[]) => { if (shouldSuppressMatrixConsoleNoise(args)) return; originalWarn(...args); };
  globalThis.console.error = (...args: unknown[]) => { if (shouldSuppressMatrixConsoleNoise(args)) return; originalError(...args); };

  return () => {
    globalThis.console.log = originalLog;
    globalThis.console.info = originalInfo;
    globalThis.console.warn = originalWarn;
    globalThis.console.error = originalError;
  };
};

export const matrixLogger = {
  log: (...args: unknown[]) => debugConsole.log(...args),
  info: (...args: unknown[]) => debugConsole.info(...args),
  warn: (...args: unknown[]) => debugConsole.warn(...args),
  error: (...args: unknown[]) => debugConsole.error(...args),
};

export const toSafeErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  return typeof error === 'string' ? error : 'Unbekannter Fehler';
};

export const toMatrixEventPayload = (event: sdk.MatrixEvent): MatrixEventPayload =>
  (event.getContent() ?? {}) as MatrixEventPayload;

export const getMatrixRelatesToPayload = (event: sdk.MatrixEvent): MatrixRelatesToBasePayload | undefined => {
  const content = toMatrixEventPayload(event);
  if ('m.relates_to' in content) return content['m.relates_to'];
  return undefined;
};

export const mapMatrixEventToMessage = (room: sdk.Room, event: sdk.MatrixEvent): MatrixMessage | null => {
  const eventType = event.getType();
  const isMessageEvent = eventType === 'm.room.message' || eventType === 'm.room.encrypted';
  if (!isMessageEvent) return null;

  const content = toMatrixEventPayload(event);
  if (!('msgtype' in content)) return null;
  const canReadMessageContent = Boolean(content?.msgtype);
  const isStillEncrypted = Boolean(event.isEncrypted?.()) && !canReadMessageContent;
  const relatesTo = (content as MatrixMessageContentPayload)['m.relates_to'];

  if (relatesTo?.rel_type === 'm.annotation' || relatesTo?.rel_type === 'm.replace') return null;

  let replyTo: import('@/types/matrix').MatrixReplyPreview | undefined;
  if (relatesTo?.['m.in_reply_to']?.event_id) {
    const replyEvent = room.findEventById(relatesTo['m.in_reply_to'].event_id);
    if (replyEvent) {
      replyTo = {
        eventId: replyEvent.getId() || '',
        sender: room.getMember(replyEvent.getSender() || '')?.name || replyEvent.getSender() || '',
        content: ((replyEvent.getContent() as MatrixMessageContentPayload).body) || '',
      };
    }
  }

  const msgContent = content as MatrixMessageContentPayload;
  const isMedia = ['m.image', 'm.video', 'm.audio', 'm.file'].includes(msgContent.msgtype ?? '');

  return {
    eventId: event.getId() || '',
    roomId: room.roomId,
    sender: event.getSender() || '',
    senderDisplayName: room.getMember(event.getSender() || '')?.name || event.getSender() || '',
    content: isStillEncrypted ? '[Encrypted]' : (msgContent.body || ''),
    timestamp: event.getTs(),
    type: isStillEncrypted ? 'm.bad.encrypted' : (msgContent.msgtype || 'm.text'),
    status: 'sent',
    replyTo,
    reactions: new Map(),
    mediaContent: !isStillEncrypted && isMedia ? {
      msgtype: msgContent.msgtype || 'm.file',
      body: msgContent.body || '',
      url: msgContent.url,
      info: msgContent.info as import('@/types/matrix').MatrixMessageMediaInfo | undefined,
    } as import('@/types/matrix').MatrixMediaContent : undefined,
  };
};

export const isLocalEchoEvent = (event: sdk.MatrixEvent): boolean => {
  const localEchoByStatus = Boolean((event as MatrixEventWithStatus).status);
  const localEchoByTxn = Boolean(event.getUnsigned()?.transaction_id) && !event.getId();
  return localEchoByStatus || localEchoByTxn;
};

export function setupVerifierListeners(
  verifier: Verifier,
  verificationRequest: MatrixVerificationRequest,
  setActiveSasVerification: React.Dispatch<React.SetStateAction<MatrixSasVerificationState | null>>,
  setLastVerificationError: React.Dispatch<React.SetStateAction<string | null>>,
  describeError?: (error: unknown) => string,
): () => void {
  const formatError = describeError ?? ((e: unknown) => (e instanceof Error ? e.message : 'Verifizierung abgebrochen'));

  const onShowSas = (sas: MatrixSasData) => {
    const emojis = (sas.sas.emoji || []).map(([symbol, description]: [string, string]) => ({ symbol, description }));
    setActiveSasVerification({
      transactionId: verificationRequest.transactionId,
      otherDeviceId: verificationRequest.otherDeviceId,
      emojis,
      decimals: sas.sas.decimal || null,
      confirm: async () => {
        try {
          await sas.confirm();
        } catch (e) {
          setLastVerificationError(e instanceof Error ? e.message : 'Bestaetigung fehlgeschlagen');
          setActiveSasVerification(null);
        }
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
  };

  const onCancel = (error: unknown) => {
    setLastVerificationError(formatError(error));
    setActiveSasVerification(null);
  };

  verifier.on(VerifierEvent.ShowSas, onShowSas);
  verifier.on(VerifierEvent.Cancel, onCancel);

  return () => {
    verifier.off(VerifierEvent.ShowSas, onShowSas);
    verifier.off(VerifierEvent.Cancel, onCancel);
  };
}
