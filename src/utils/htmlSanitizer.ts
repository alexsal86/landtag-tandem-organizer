import DOMPurify from 'dompurify';

const FORBID_TAGS = ['script', 'iframe', 'object', 'embed', 'form', 'input', 'button'];

export const sanitizeRichHtml = (html: string): string => {
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_TAGS,
    ALLOW_UNKNOWN_PROTOCOLS: false,
  });
};
