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

  it('sanitizes svg payloads with nested event handlers and javascript urls', () => {
    const dirty = `
      <svg xmlns="http://www.w3.org/2000/svg" onload="alert('xss')">
        <a xlink:href="javascript:alert('xss')">
          <text>unsafe-link</text>
        </a>
        <foreignObject>
          <div onclick="alert('nested')">nested-unsafe</div>
        </foreignObject>
      </svg>
      <p>safe-text</p>
    `;

    const clean = sanitizeRichHtml(dirty);

    expect(clean).toContain('safe-text');
    expect(clean).not.toMatch(/<svg/i);
    expect(clean).not.toMatch(/onload\s*=/i);
    expect(clean).not.toMatch(/onclick\s*=/i);
    expect(clean).not.toMatch(/javascript\s*:/i);
  });

  it('sanitizes encoded and nested javascript payloads in attributes', () => {
    const dirty = `
      <a href="  JaVaScRiPt:alert(1)" data-meta='{"url":"javascript:alert(2)"}'>click me</a>
      <img src="x" srcset="javascript:alert(3) 1x" onerror="alert(4)" alt="preview" />
    `;

    const clean = sanitizeRichHtml(dirty);

    expect(clean).toContain('click me');
    expect(clean).toContain('alt="preview"');
    expect(clean).not.toMatch(/href\s*=\s*"\s*javascript/i);
    expect(clean).not.toMatch(/srcset\s*=\s*"\s*javascript/i);
    expect(clean).not.toMatch(/onerror\s*=/i);
    expect(clean).not.toMatch(/javascript\s*:/i);
  });
});

describe('sanitizeRichHtml regressions for dangerouslySetInnerHTML paths', () => {
  it('keeps formatting for note/email style content while removing executable attributes', () => {
    const dirty = `
      <p>Hallo <strong>Team</strong></p>
      <ul>
        <li data-track='{"source":"ui"}' onclick="alert('xss')">Punkt 1</li>
      </ul>
      <a href="javascript:alert('xss')">Mehr Infos</a>
    `;

    const clean = sanitizeRichHtml(dirty);

    expect(clean).toContain('<p>Hallo <strong>Team</strong></p>');
    expect(clean).toContain('<ul>');
    expect(clean).toContain('Punkt 1');
    expect(clean).not.toContain('onclick=');
    expect(clean).not.toContain('javascript:');
  });

  it('preserves letter template structure but strips scriptable vectors', () => {
    const dirty = `
      <div class="din5008-content-text">
        <p>Sehr geehrte Damen und Herren,</p>
        <img src="x" onerror="alert('xss')" alt="logo" />
        <iframe src="https://evil.example"></iframe>
      </div>
    `;

    const clean = sanitizeRichHtml(dirty);

    expect(clean).toContain('din5008-content-text');
    expect(clean).toContain('Sehr geehrte Damen und Herren');
    expect(clean).toContain('alt="logo"');
    expect(clean).not.toContain('onerror=');
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
