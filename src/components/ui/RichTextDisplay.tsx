import React from 'react';
import { cn } from '@/lib/utils';

interface RichTextDisplayProps {
  content: string | null | undefined;
  className?: string;
}

/**
 * Safely renders HTML content that was created by the SimpleRichTextEditor.
 * Sanitizes the content to prevent XSS attacks.
 */
export const RichTextDisplay: React.FC<RichTextDisplayProps> = ({ content, className }) => {
  if (!content) return null;

  // Basic sanitization - remove script tags and event handlers
  const sanitizeHtml = (html: string): string => {
    // Remove script tags
    let sanitized = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    // Remove event handlers
    sanitized = sanitized.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '');
    // Remove javascript: URLs
    sanitized = sanitized.replace(/href\s*=\s*["']javascript:[^"']*["']/gi, 'href="#"');
    return sanitized;
  };

  // Check if content looks like HTML (has tags)
  const isHtml = /<[a-z][\s\S]*>/i.test(content);

  if (!isHtml) {
    // Plain text - render with line breaks preserved
    return (
      <p className={cn("text-sm text-muted-foreground whitespace-pre-wrap", className)}>
        {content}
      </p>
    );
  }

  return (
    <div 
      className={cn(
        "text-sm text-muted-foreground prose prose-sm max-w-none",
        "[&_ul]:list-disc [&_ul]:ml-6 [&_ol]:list-decimal [&_ol]:ml-6",
        "[&_p]:mb-2 [&_li]:mb-1",
        className
      )}
      dangerouslySetInnerHTML={{ __html: sanitizeHtml(content) }}
    />
  );
};

export default RichTextDisplay;
