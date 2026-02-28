import React from 'react';
import { cn } from '@/lib/utils';
import { sanitizeRichHtml } from '@/utils/htmlSanitizer';

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
      dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(content) }}
    />
  );
};

export default RichTextDisplay;
