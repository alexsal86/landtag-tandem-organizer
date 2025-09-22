/**
 * Content validation and parsing utilities for Lexical Editor collaboration
 * Prevents JSON serialization corruption and handles content recovery
 */

export interface ContentValidationResult {
  isValid: boolean;
  type: 'json' | 'text' | 'empty';
  content: string;
  error?: string;
}

/**
 * Validates if a string is valid JSON
 */
export const isValidJSON = (str: string): boolean => {
  if (!str || typeof str !== 'string') return false;
  
  try {
    const parsed = JSON.parse(str);
    return typeof parsed === 'object' && parsed !== null;
  } catch {
    return false;
  }
};

/**
 * Sanitizes content to prevent corruption from double serialization
 */
export const sanitizeContent = (content: string): ContentValidationResult => {
  if (!content || content.trim() === '') {
    return {
      isValid: true,
      type: 'empty',
      content: ''
    };
  }

  // Check if content looks like corrupted JSON (multiple JSON objects concatenated)
  const jsonPattern = /\{"root":\{.*?\}\}/g;
  const jsonMatches = content.match(jsonPattern);
  
  if (jsonMatches && jsonMatches.length > 1) {
    console.warn('🚨 Detected corrupted content with multiple JSON objects:', jsonMatches.length);
    
    // Try to recover the last valid JSON object
    const lastJsonMatch = jsonMatches[jsonMatches.length - 1];
    if (isValidJSON(lastJsonMatch)) {
      return {
        isValid: true,
        type: 'json',
        content: lastJsonMatch,
        error: 'Recovered from corrupted concatenated JSON'
      };
    }
    
    // If JSON recovery fails, extract plain text
    const textContent = extractTextFromCorruptedContent(content);
    return {
      isValid: true,
      type: 'text',
      content: textContent,
      error: 'Extracted text from corrupted JSON'
    };
  }

  // Check if it's valid JSON
  if (isValidJSON(content)) {
    return {
      isValid: true,
      type: 'json',
      content: content
    };
  }

  // Treat as plain text
  return {
    isValid: true,
    type: 'text',
    content: content
  };
};

/**
 * Extracts readable text content from corrupted JSON
 */
const extractTextFromCorruptedContent = (content: string): string => {
  try {
    // Try to extract text from JSON objects
    const jsonPattern = /\{"root":\{.*?\}\}/g;
    const matches = content.match(jsonPattern);
    
    if (matches) {
      const textParts: string[] = [];
      
      for (const match of matches) {
        try {
          const parsed = JSON.parse(match);
          const extractedText = extractTextFromLexicalJSON(parsed);
          if (extractedText && extractedText.trim()) {
            textParts.push(extractedText.trim());
          }
        } catch (e) {
          // Skip invalid JSON parts
        }
      }
      
      // Combine text parts and remove duplicates
      const combinedText = textParts.join(' ').replace(/\s+/g, ' ').trim();
      if (combinedText) {
        return combinedText;
      }
    }
    
    // Fallback: extract any readable text
    return content
      .replace(/\{[^}]*\}/g, '') // Remove JSON-like structures
      .replace(/[{}"\[\]]/g, '') // Remove JSON characters
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
      
  } catch (error) {
    console.error('Error extracting text from corrupted content:', error);
    return 'Inhalt konnte nicht wiederhergestellt werden';
  }
};

/**
 * Recursively extracts text content from Lexical JSON structure
 */
const extractTextFromLexicalJSON = (jsonObj: any): string => {
  if (!jsonObj || typeof jsonObj !== 'object') return '';
  
  if (jsonObj.text && typeof jsonObj.text === 'string') {
    return jsonObj.text;
  }
  
  if (jsonObj.children && Array.isArray(jsonObj.children)) {
    return jsonObj.children
      .map(child => extractTextFromLexicalJSON(child))
      .filter(text => text.trim())
      .join(' ');
  }
  
  if (jsonObj.root) {
    return extractTextFromLexicalJSON(jsonObj.root);
  }
  
  return '';
};

/**
 * Safely parses content and returns appropriate format
 */
export const parseContentSafely = (content: string, contentNodes?: string): {
  plainText: string;
  jsonNodes: string | null;
} => {
  const validation = sanitizeContent(content);
  
  // Handle content nodes separately
  let validJsonNodes: string | null = null;
  if (contentNodes) {
    const nodesValidation = sanitizeContent(contentNodes);
    validJsonNodes = nodesValidation.type === 'json' ? nodesValidation.content : null;
  }
  
  return {
    plainText: validation.type === 'text' ? validation.content : 
              validation.type === 'json' ? extractTextFromLexicalJSON(JSON.parse(validation.content)) : '',
    jsonNodes: validation.type === 'json' ? validation.content : validJsonNodes
  };
};

/**
 * Debounced content update to prevent race conditions
 */
export const createDebouncedContentUpdate = (
  updateFn: (content: string, contentNodes?: string) => void,
  delay: number = 300
) => {
  let timeoutId: NodeJS.Timeout;
  let lastContent = '';
  let lastContentNodes = '';

  return (content: string, contentNodes?: string) => {
    // Prevent duplicate updates
    if (content === lastContent && (contentNodes || '') === lastContentNodes) {
      return;
    }

    lastContent = content;
    lastContentNodes = contentNodes || '';

    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      const sanitized = parseContentSafely(content, contentNodes);
      updateFn(sanitized.plainText, sanitized.jsonNodes);
    }, delay);
  };
};

/**
 * Checks if two content strings are equivalent (handles JSON vs text comparison)
 */
export const areContentsEquivalent = (content1: string, content2: string): boolean => {
  if (content1 === content2) return true;
  
  const parsed1 = parseContentSafely(content1);
  const parsed2 = parseContentSafely(content2);
  
  return parsed1.plainText === parsed2.plainText;
};