import { describe, expect, it } from 'vitest';
import { sanitizeCss, sanitizeRichHtml } from '@/utils/htmlSanitizer';

describe('sanitizeRichHtml', () => {
  it('removes script tags and inline event handlers', () => {
    const dirty = '<div onclick="alert(1)">safe</div><script>alert(2)</script>';
    const clean = sanitizeRichHtml(dirty);

    expect(clean).toContain('safe');
    expect(clean).not.toContain('<script');
    expect(clean).not.toContain('onclick=');
  });

  it('strips javascript: URLs', () => {
    const dirty = '<a href="javascript:alert(1)">click</a>';
    const clean = sanitizeRichHtml(dirty);

    expect(clean).toContain('click');
    expect(clean).not.toContain('javascript:');
  });

  it('removes forbidden embedded content tags', () => {
    const dirty = '<iframe src="https://evil.example"></iframe><p>ok</p>';
    const clean = sanitizeRichHtml(dirty);

    expect(clean).toContain('<p>ok</p>');
    expect(clean).not.toContain('<iframe');
  });
});

describe('sanitizeCss', () => {
  it('removes expression and javascript url payloads', () => {
    const dirtyCss = `
      .x { width: expression(alert(1)); }
      .y { background: url(javascript:alert(1)); }
      .z { behavior: javascript:alert(2); }
    `;

    const cleanCss = sanitizeCss(dirtyCss);

    expect(cleanCss).not.toMatch(/expression\s*\(/i);
    expect(cleanCss).not.toMatch(/javascript\s*:/i);
  });

  it('removes @import directives', () => {
    const dirtyCss = '@import "https://evil.example/x.css"; .a { color: red; }';
    const cleanCss = sanitizeCss(dirtyCss);

    expect(cleanCss).not.toMatch(/@import/i);
    expect(cleanCss).toContain('color: red');
  });
});
