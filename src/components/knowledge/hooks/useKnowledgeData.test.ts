import { describe, expect, it } from 'vitest';
import { parseKnowledgeContent, serializeKnowledgeContent } from './useKnowledgeData';

describe('knowledge lexical content persistence', () => {
  it('supports roundtrip for formatted lexical content', () => {
    const nodesJson = JSON.stringify({
      root: {
        type: 'root',
        format: '',
        indent: 0,
        version: 1,
        children: [{ type: 'paragraph', version: 1, children: [{ type: 'text', version: 1, text: 'Fett', format: 1, detail: 0, mode: 'normal', style: '' }] }],
        direction: null,
      },
    });

    const persisted = serializeKnowledgeContent({
      plainText: 'Fett',
      nodesJson,
      html: '<p><strong>Fett</strong></p>',
    });

    const parsed = parseKnowledgeContent(persisted);

    expect(parsed.plainText).toBe('Fett');
    expect(parsed.html).toBe('<p><strong>Fett</strong></p>');
    expect(parsed.nodesJson).toBe(nodesJson);
  });

  it('keeps legacy plain text content readable', () => {
    const parsed = parseKnowledgeContent('Legacy Inhalt ohne JSON');

    expect(parsed.plainText).toBe('Legacy Inhalt ohne JSON');
    expect(parsed.nodesJson).toBeUndefined();
    expect(parsed.html).toBeUndefined();
  });
});
