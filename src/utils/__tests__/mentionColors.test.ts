import { describe, expect, it } from 'vitest';
import { mentionColors } from '../mentionColors';
import { sanitizeRichHtml } from '../htmlSanitizer';

describe('employee mention colors', () => {
  it('preserves different employee hues and derives darker text', () => {
    expect(mentionColors('#f59e0b')).toEqual({ background: '#f59e0b33', text: '#6e4705' });
    expect(mentionColors('#3b82f6')).toEqual({ background: '#3b82f633', text: '#1b3b6f' });
    expect(mentionColors('#abc')).toEqual({ background: '#aabbcc33', text: '#4d545c' });
  });

  it('restores employee colors in saved mentions with old fixed styles', () => {
    const clean = sanitizeRichHtml('<span data-lexical-mention="true" data-lexical-mention-color="#3b82f6" data-lexical-mention-user-id="alice" style="background-color: #fcdda3; color: #805000">@Alice</span><span data-lexical-mention="true" data-lexical-mention-color="#f59e0b">@Bob</span>');
    const template = document.createElement('template');
    template.innerHTML = clean;
    const [alice, bob] = template.content.querySelectorAll('span');
    expect(alice.style.backgroundColor).toBe('rgba(59, 130, 246, 0.2)');
    expect(alice.style.color).toBe('rgb(27, 59, 111)');
    expect(alice.dataset.lexicalMentionUserId).toBe('alice');
    expect(bob.style.backgroundColor).toBe('rgba(245, 158, 11, 0.2)');
    expect(bob.style.color).toBe('rgb(110, 71, 5)');
  });

  it('falls back safely for invalid color attributes', () => {
    expect(mentionColors('red; background: url(https://example.com)')).toEqual(mentionColors(null));
  });
});
