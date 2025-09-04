/**
 * HTML Sanitization utility to prevent XSS attacks
 * This provides a secure way to render HTML content from user input
 */

// Allowed HTML tags and their allowed attributes
const ALLOWED_TAGS = {
  'p': ['class'],
  'div': ['class'],
  'span': ['class', 'style'],
  'strong': [],
  'em': [],
  'u': [],
  'del': [],
  'h1': [],
  'h2': [],
  'h3': [],
  'h4': [],
  'h5': [],
  'h6': [],
  'blockquote': [],
  'ul': [],
  'ol': [],
  'li': [],
  'br': [],
  'a': ['href', 'target', 'rel'],
  'input': ['type', 'checked', 'disabled', 'style'],
} as const;

// Safe attributes that don't pose XSS risks
const SAFE_ATTRIBUTES = ['class', 'href', 'target', 'rel', 'type', 'checked', 'disabled'];

/**
 * Sanitize HTML content by removing dangerous elements and attributes
 * @param html The HTML string to sanitize
 * @returns Sanitized HTML string safe for innerHTML usage
 */
export function sanitizeHTML(html: string): string {
  // Create a temporary DOM element to parse the HTML
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  
  return sanitizeElement(tempDiv).innerHTML;
}

/**
 * Recursively sanitize a DOM element and its children
 * @param element The DOM element to sanitize
 * @returns The sanitized element
 */
function sanitizeElement(element: Element): Element {
  const tagName = element.tagName.toLowerCase() as keyof typeof ALLOWED_TAGS;
  
  // If tag is not allowed, remove it but keep its content
  if (!ALLOWED_TAGS[tagName]) {
    const fragment = document.createDocumentFragment();
    while (element.firstChild) {
      const child = element.firstChild;
      if (child.nodeType === Node.ELEMENT_NODE) {
        fragment.appendChild(sanitizeElement(child as Element));
      } else {
        fragment.appendChild(child);
      }
    }
    
    // Replace the element with its sanitized content
    const wrapper = document.createElement('span');
    wrapper.appendChild(fragment);
    return wrapper;
  }
  
  // Clean attributes
  const allowedAttributes = ALLOWED_TAGS[tagName] || [];
  const attributesToRemove: string[] = [];
  
  for (let i = 0; i < element.attributes.length; i++) {
    const attr = element.attributes[i];
    const attrName = attr.name.toLowerCase();
    
    if (!allowedAttributes.includes(attrName) || !SAFE_ATTRIBUTES.includes(attrName)) {
      // Special handling for style attribute - only allow safe CSS
      if (attrName === 'style') {
        const safeStyle = sanitizeStyle(attr.value);
        if (safeStyle) {
          attr.value = safeStyle;
        } else {
          attributesToRemove.push(attr.name);
        }
      } else {
        attributesToRemove.push(attr.name);
      }
    } else {
      // Sanitize attribute values
      attr.value = sanitizeAttributeValue(attrName, attr.value);
    }
  }
  
  // Remove unsafe attributes
  attributesToRemove.forEach(attrName => {
    element.removeAttribute(attrName);
  });
  
  // Recursively sanitize children
  const children = Array.from(element.children);
  children.forEach(child => {
    sanitizeElement(child);
  });
  
  return element;
}

/**
 * Sanitize CSS style values to prevent XSS
 * @param styleValue The CSS style value to sanitize
 * @returns Sanitized style value or null if unsafe
 */
function sanitizeStyle(styleValue: string): string | null {
  // Only allow safe CSS properties
  const SAFE_CSS_PROPERTIES = [
    'margin-right', 'margin-left', 'margin-top', 'margin-bottom',
    'padding-right', 'padding-left', 'padding-top', 'padding-bottom',
    'text-decoration', 'font-weight', 'font-style', 'color',
    'background-color', 'border', 'border-radius', 'display'
  ];
  
  // Remove any javascript: or expression() or other dangerous patterns
  if (/javascript:|expression\(|@import|behavior:|mozbinding/i.test(styleValue)) {
    return null;
  }
  
  // Simple whitelist approach - only allow known safe properties
  const declarations = styleValue.split(';').filter(decl => {
    const [property] = decl.split(':').map(s => s.trim().toLowerCase());
    return SAFE_CSS_PROPERTIES.includes(property);
  });
  
  return declarations.length > 0 ? declarations.join(';') : null;
}

/**
 * Sanitize attribute values based on attribute type
 * @param attrName The attribute name
 * @param attrValue The attribute value
 * @returns Sanitized attribute value
 */
function sanitizeAttributeValue(attrName: string, attrValue: string): string {
  switch (attrName.toLowerCase()) {
    case 'href':
      // Only allow safe protocols
      if (/^(https?:|mailto:|tel:)/i.test(attrValue)) {
        return attrValue;
      }
      // For relative URLs, ensure they don't contain javascript:
      if (!/javascript:|data:|vbscript:/i.test(attrValue)) {
        return attrValue;
      }
      return '#';
      
    case 'target':
      // Only allow safe target values
      return ['_blank', '_self', '_parent', '_top'].includes(attrValue) ? attrValue : '_self';
      
    case 'rel':
      // Ensure noopener noreferrer for external links
      return attrValue.includes('noopener') ? attrValue : `${attrValue} noopener noreferrer`.trim();
      
    case 'type':
      // For input elements, only allow safe types
      return ['checkbox', 'text', 'email', 'password'].includes(attrValue) ? attrValue : 'text';
      
    default:
      return attrValue;
  }
}

/**
 * Safe method to set HTML content with sanitization
 * Use this instead of direct innerHTML assignment
 * @param element The element to update
 * @param html The HTML content to set (will be sanitized)
 */
export function safeSetInnerHTML(element: HTMLElement, html: string): void {
  const sanitizedHTML = sanitizeHTML(html);
  element.innerHTML = sanitizedHTML;
}