import { describe, expect, it } from 'vitest';
import {
  isProtocolAgendaItem,
  parseJSONProtocol,
  validateJSONProtocol,
} from '@/utils/jsonProtocolParser';
import { analyzeProtocolStructure } from '@/utils/pdfParser';
import {
  buildEmlFromOutlookHtml,
  isAttachment,
  parseEmlFromArrayBuffer,
  parseMsgFromArrayBuffer,
} from '@/utils/emlParser';

describe('parser boundaries', () => {
  it('rejects JSON protocol payloads with missing mandatory fields', () => {
    const invalidPayload = {
      session: {
        date: '2026-03-24',
      },
      speeches: [],
    };

    expect(validateJSONProtocol(invalidPayload)).toBe(false);
    expect(() => parseJSONProtocol(invalidPayload)).toThrowError('Ungültiges JSON-Protokollformat.');
  });

  it('rejects malformed agenda item payload types', () => {
    expect(isProtocolAgendaItem({ number: '1', title: 'TOP 1' })).toBe(true);
    expect(isProtocolAgendaItem({ number: '1' })).toBe(false);
    expect(isProtocolAgendaItem({ number: { nested: true }, title: 'TOP 2' })).toBe(false);
  });

  it('rejects unknown text input for protocol text analysis', () => {
    expect(() => analyzeProtocolStructure({ text: 'not-a-string' })).toThrowError('Ungültiger Protokolltext.');
  });

  it('rejects unknown email parser buffers', async () => {
    await expect(parseEmlFromArrayBuffer('not-a-buffer')).rejects.toThrowError('Ungültiger EML-Buffer.');
    await expect(parseMsgFromArrayBuffer(123)).rejects.toThrowError('Ungültiger MSG-Buffer.');
  });

  it('guards external attachment payload and html boundary', () => {
    expect(isAttachment({ fileName: 'test.pdf' })).toBe(true);
    expect(isAttachment({ fileName: 42 })).toBe(false);
    expect(buildEmlFromOutlookHtml({ raw: '<html></html>' })).toBeNull();
  });
});
