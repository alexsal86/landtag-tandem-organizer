import DOMPurify from 'dompurify';
import { styleMention } from './mentionColors';

const FORBID_TAGS = ['script', 'iframe', 'object', 'embed', 'form', 'input', 'button'];

export const sanitizeRichHtml = (html: string): string => {
  const clean = DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_TAGS,
    ALLOW_UNKNOWN_PROTOCOLS: false,
  });
  if (!clean.includes('data-lexical-mention')) return clean;

  // Stored mentions retain the employee color even if their old inline styles
  // used a fixed color. Normalize only after sanitizing the input.
  const template = document.createElement('template');
  template.innerHTML = clean;
  template.content.querySelectorAll<HTMLElement>('span[data-lexical-mention="true"]').forEach(element => {
    styleMention(element, element.getAttribute('data-lexical-mention-color'));
  });
  return template.innerHTML;
};

/** Sanitize CSS strings to prevent CSS-based attacks (expression(), @import, javascript:) */
export const sanitizeCss = (css: string): string => {
  return css
    .replace(/expression\s*\(/gi, '')
    .replace(/@import\b/gi, '')
    .replace(/javascript\s*:/gi, '')
    .replace(/url\s*\(\s*['"]?\s*javascript:/gi, '');
};
