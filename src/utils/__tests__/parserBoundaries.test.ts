import { describe, expect, it } from 'vitest';

import { buildEmlFromOutlookHtml } from '@/utils/emlParser';
import { analyzeProtocolStructure } from '@/utils/pdfParser';
import { validateJSONProtocol } from '@/utils/jsonProtocolParser';

describe('parser boundaries', () => {
  it('rejects invalid JSON protocol payloads with missing required fields', () => {
    expect(validateJSONProtocol({ session: { extracted_at: '2026-01-01T00:00:00Z' }, speeches: [] })).toBe(false);
    expect(validateJSONProtocol({ session: {}, speeches: [{ index: 1, text: 'x' }] })).toBe(false);
  });

  it('rejects non-string PDF protocol input', () => {
    expect(() => analyzeProtocolStructure({ text: 'invalid' })).toThrow('Protocol text must be a string.');
  });

  it('returns null for non-email outlook html payload', () => {
    const html = '<html><body><div>Hi</div></body></html>';
    expect(buildEmlFromOutlookHtml(html)).toBeNull();
  });
});
