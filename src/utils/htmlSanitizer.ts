import DOMPurify from 'dompurify';

const FORBID_TAGS = ['script', 'iframe', 'object', 'embed', 'form', 'input', 'button'];

export const sanitizeRichHtml = (html: string): string => {
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_TAGS,
    ALLOW_UNKNOWN_PROTOCOLS: false,
  });
};

/** Sanitize CSS strings to prevent CSS-based attacks (expression(), @import, javascript:) */
export const sanitizeCss = (css: string): string => {
  return css
    .replace(/expression\s*\(/gi, '')
    .replace(/@import\b/gi, '')
    .replace(/javascript\s*:/gi, '')
    .replace(/url\s*\(\s*['"]?\s*javascript:/gi, '');
};
