import { describe, expect, it } from 'vitest';
import { AVAILABLE_COLORS } from '../userColors';
import { mentionColors } from '../mentionColors';
import { sanitizeRichHtml } from '../htmlSanitizer';

describe('employee mention colors', () => {
  it('maps current and legacy employee colors to opaque 200/950 pairs', () => {
    expect(mentionColors('#f59e0b')).toEqual({ background: '#fde68a', text: '#451a03' });
    expect(mentionColors('#3b82f6')).toEqual({ background: '#bfdbfe', text: '#172554' });
    for (const color of AVAILABLE_COLORS) {
      for (const value of [color.value, color.baseHex, color.hex]) {
        expect(mentionColors(value)).toEqual({ background: color.hex, text: color.text });
      }
    }
  });

  it('restores employee colors in saved mentions with old fixed styles', () => {
    const clean = sanitizeRichHtml('<span data-lexical-mention="true" data-lexical-mention-color="#3b82f6" data-lexical-mention-user-id="alice" style="background-color: #fcdda3; color: #805000">@Alice</span><span data-lexical-mention="true" data-lexical-mention-color="#f59e0b">@Bob</span>');
    const template = document.createElement('template');
    template.innerHTML = clean;
    const [alice, bob] = template.content.querySelectorAll('span');
    expect(alice.style.backgroundColor).toBe('rgb(191, 219, 254)');
    expect(alice.style.color).toBe('rgb(23, 37, 84)');
    expect(alice.dataset.lexicalMentionUserId).toBe('alice');
    expect(bob.style.backgroundColor).toBe('rgb(253, 230, 138)');
    expect(bob.style.color).toBe('rgb(69, 26, 3)');
  });

  it('falls back safely for invalid color attributes', () => {
    expect(mentionColors('red; background: url(https://example.com)')).toEqual(mentionColors(null));
  });
});
