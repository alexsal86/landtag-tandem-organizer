import { describe, expect, it } from 'vitest';
import {
  isJsonProtocol,
  isProtocolAgendaItem,
  parseJSONProtocol,
  validateJSONProtocol,
} from '@/utils/jsonProtocolParser';
import { analyzeProtocolStructure } from '@/utils/pdfParser';
import {
  buildEmlFromOutlookHtml,
  isAttachment,
  isParsedMail,
  parseEmlFromArrayBuffer,
  parseMsgFromArrayBuffer,
} from '@/utils/emlParser';
import { isGeoJsonFeatureCollection } from '@/utils/geoJsonLoader';

describe('parser boundaries', () => {
  it('rejects JSON protocol payloads with missing mandatory fields', () => {
    const invalidPayload = {
      session: {
        date: '2026-03-24',
      },
      speeches: [],
    };

    expect(validateJSONProtocol(invalidPayload)).toBe(false);
    expect(isJsonProtocol(invalidPayload)).toBe(false);
    expect(() => parseJSONProtocol(invalidPayload)).toThrowError('Ungültiges JSON-Protokollformat.');
  });

  it('rejects malformed JSON protocol speech entries', () => {
    const invalidSpeechPayload = {
      session: {
        number: 12,
        legislative_period: 17,
        date: '2026-03-24',
        extracted_at: '2026-03-24T10:00:00Z',
      },
      speeches: [{ index: 0, text: 'Rede ohne Sprecher' }],
    };

    expect(isJsonProtocol(invalidSpeechPayload)).toBe(false);
    expect(validateJSONProtocol(invalidSpeechPayload)).toBe(false);
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

  it('rejects malformed parsed mail and GeoJSON payloads', () => {
    expect(isParsedMail({ subject: 'ok', to: 'invalid' })).toBe(false);
    expect(isParsedMail({ subject: 'ok', to: [], attachments: [] })).toBe(true);

    expect(isGeoJsonFeatureCollection({ type: 'FeatureCollection', features: {} })).toBe(false);
    expect(isGeoJsonFeatureCollection({
      type: 'FeatureCollection',
      features: [{ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [] } }],
    })).toBe(true);
  });
});
