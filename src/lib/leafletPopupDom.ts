/**
 * Shared DOM builders for Leaflet content.
 *
 * `bindPopup`, `bindTooltip` and `DivIconOptions.html` all accept an element, so
 * map content is assembled from nodes instead of interpolated HTML. That keeps
 * tenant data (names, addresses, labels) out of the HTML parser, and contact
 * links only ever get the scheme they belong to.
 */

type TextTag = 'p' | 'span' | 'div' | 'h3' | 'strong';

/** Append a text-only child element to popup or tooltip content. */
export const appendText = (
  parent: HTMLElement,
  tag: TextTag,
  text: string,
  styles: Record<string, string> = {},
): HTMLElement => {
  const element = document.createElement(tag);
  Object.assign(element.style, styles);
  element.textContent = text;
  parent.appendChild(element);
  return element;
};

const EMAIL_PATTERN = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

/**
 * Contact values only become links for the scheme they belong to; anything else
 * stays plain text, so javascript:/data: payloads never reach an href.
 */
export const safeContactHref = (
  raw: string | null | undefined,
  kind: 'phone' | 'email' | 'website',
): string | null => {
  const value = raw?.trim();
  if (!value) return null;

  if (kind === 'phone') {
    const digits = value.replace(/[^\d+]/g, '');
    return /^\+?\d{3,}$/.test(digits) ? `tel:${digits}` : null;
  }

  if (kind === 'email') {
    return EMAIL_PATTERN.test(value) ? `mailto:${value}` : null;
  }

  // Websites may be stored with or without a scheme; only http(s) is allowed.
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(candidate);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
};

/** Round div-icon bubble around a DOM node, so colors stay CSS values. */
export const createMapIconBubble = (
  size: number,
  content: HTMLElement,
  styles: Record<string, string> = {},
): HTMLElement => {
  const bubble = document.createElement('div');
  Object.assign(bubble.style, {
    width: `${size}px`,
    height: `${size}px`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '50%',
    border: '2px solid white',
    cursor: 'pointer',
    ...styles,
  });
  bubble.appendChild(content);
  return bubble;
};
