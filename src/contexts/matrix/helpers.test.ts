import { describe, expect, it, vi } from 'vitest';
import { MatrixEvent, type Room } from 'matrix-js-sdk';
import { mapMatrixEventToMessage } from './helpers';

const room = {
  roomId: '!room:example.org',
  getMember: () => ({ name: 'Alice' }),
  findEventById: () => null,
} as unknown as Room;

const encryptedEvent = () => new MatrixEvent({
  event_id: '$message', room_id: room.roomId, sender: '@alice:example.org',
  origin_server_ts: 123, type: 'm.room.encrypted',
  content: { algorithm: 'm.megolm.v1.aes-sha2', ciphertext: 'ciphertext' },
});

// Exercise the actual SDK event lifecycle, including its synthetic failure content.
const backend = (decryptEvent: ReturnType<typeof vi.fn>) =>
  ({ decryptEvent }) as unknown as Parameters<MatrixEvent['attemptDecryption']>[0];

describe('Matrix encrypted message mapping', () => {
  it('keeps pending encrypted messages visible', () => {
    expect(mapMatrixEventToMessage(room, encryptedEvent())).toMatchObject({
      eventId: '$message', type: 'm.bad.encrypted', content: '[Encrypted]',
    });
  });

  it('replaces a failed decryption with plaintext when a later retry succeeds', async () => {
    const event = encryptedEvent();
    await event.attemptDecryption(backend(vi.fn().mockRejectedValue(new Error('Missing room key'))));
    expect(event.isDecryptionFailure()).toBe(true);
    expect(mapMatrixEventToMessage(room, event)).toMatchObject({ type: 'm.bad.encrypted', content: '[Encrypted]' });

    await event.attemptDecryption(backend(vi.fn().mockResolvedValue({
      clearEvent: { type: 'm.room.message', content: { msgtype: 'm.text', body: 'Hallo' } },
    })));
    expect(mapMatrixEventToMessage(room, event)).toMatchObject({
      eventId: '$message', type: 'm.text', content: 'Hallo', senderDisplayName: 'Alice',
    });
  });

  it('filters encrypted edits after decryption', async () => {
    const event = encryptedEvent();
    await event.attemptDecryption(backend(vi.fn().mockResolvedValue({
      clearEvent: { type: 'm.room.message', content: {
        msgtype: 'm.text', body: '* Korrektur',
        'm.relates_to': { rel_type: 'm.replace', event_id: '$original' },
      } },
    })));
    expect(mapMatrixEventToMessage(room, event)).toBeNull();
  });
});
