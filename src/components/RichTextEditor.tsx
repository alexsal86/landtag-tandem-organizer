import React, { useRef, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface RichTextEditorProps {
  value: string;
  onChange: (content: string, html?: string) => void;
  onSelectionChange?: () => void;
  onFormatText?: (format: string) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}

const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  onSelectionChange,
  onFormatText,
  disabled = false,
  className,
  placeholder = "Beginnen Sie zu schreiben..."
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const [isComposing, setIsComposing] = useState(false);
  const isUpdatingRef = useRef(false);

  // Convert markdown-like syntax to HTML for display
  const convertToHtml = (text: string) => {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/<u>(.*?)<\/u>/g, '<u>$1</u>')
      .replace(/~~(.*?)~~/g, '<del>$1</del>')
      .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
      .replace(/^## (.*$)/gm, '<h2>$1</h2>')
      .replace(/<!-- (.*?) -->/g, '<span style="color: #888; font-style: italic;">$1</span>')
      .replace(/\n/g, '<br>');
  };

  // Convert HTML back to markdown-like syntax for storage
  const convertToMarkdown = (html: string) => {
    return html
      .replace(/<strong>(.*?)<\/strong>/g, '**$1**')
      .replace(/<em>(.*?)<\/em>/g, '*$1*')
      .replace(/<u>(.*?)<\/u>/g, '<u>$1</u>')
      .replace(/<del>(.*?)<\/del>/g, '~~$1~~')
      .replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/g, '[$2]($1)')
      .replace(/<h2>(.*?)<\/h2>/g, '## $1')
      .replace(/<span[^>]*>(.*?)<\/span>/g, '<!-- $1 -->')
      .replace(/<br\s*\/?>/g, '\n')
      .replace(/<div>/g, '\n')
      .replace(/<\/div>/g, '')
      .replace(/&nbsp;/g, ' ');
  };

  // Update editor content when value changes
  useEffect(() => {
    if (!editorRef.current || isComposing || isUpdatingRef.current) return;
    
    const currentContent = editorRef.current.innerText;
    const newContent = value;
    
    // Only update if content actually changed and it's not our own input
    if (currentContent !== newContent) {
      console.log('RichTextEditor: External content update needed', { currentContent, newContent });
      
      // Set flag to prevent onChange loop
      isUpdatingRef.current = true;
      
      // Store current selection details
      const selection = window.getSelection();
      let savedSelection: { node: Node | null; offset: number; } | null = null;
      
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        savedSelection = {
          node: range.startContainer,
          offset: range.startOffset
        };
      }
      
      // Update content
      const newHtml = convertToHtml(newContent);
      editorRef.current.innerHTML = newHtml;
      
      // Restore cursor position only if we have a valid saved selection
      if (savedSelection && savedSelection.node) {
        try {
          const newRange = document.createRange();
          
          // Find a suitable text node to place cursor
          const walker = document.createTreeWalker(
            editorRef.current,
            NodeFilter.SHOW_TEXT,
            null
          );
          
          let targetNode = walker.nextNode();
          let targetOffset = 0;
          
          // Try to find the closest position in the new content
          if (targetNode && targetNode.textContent) {
            targetOffset = Math.min(savedSelection.offset, targetNode.textContent.length);
          }
          
          if (targetNode) {
            newRange.setStart(targetNode, targetOffset);
            newRange.collapse(true);
            selection.removeAllRanges();
            selection.addRange(newRange);
          }
        } catch (e) {
          console.log('RichTextEditor: Could not restore cursor, placing at end');
          // Fallback: place cursor at end
          try {
            const range = document.createRange();
            range.selectNodeContents(editorRef.current);
            range.collapse(false);
            selection?.removeAllRanges();
            selection?.addRange(range);
          } catch (fallbackError) {
            // If all else fails, just leave the cursor where it is
          }
        }
      }
      
      // Reset flag after DOM update completes
      setTimeout(() => {
        isUpdatingRef.current = false;
      }, 10);
    }
  }, [value, isComposing]);

  const handleInput = () => {
    if (!editorRef.current || disabled || isUpdatingRef.current) return;
    
    const html = editorRef.current.innerHTML;
    const markdown = convertToMarkdown(html);
    console.log('RichTextEditor: Input changed', { html, markdown });
    onChange(markdown, html);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      // Let the browser handle Enter naturally for contentEditable
      // This prevents cursor jumping issues
      setTimeout(() => {
        if (!editorRef.current || isUpdatingRef.current) return;
        const html = editorRef.current.innerHTML;
        const markdown = convertToMarkdown(html);
        console.log('RichTextEditor: Enter key processed', { html, markdown });
        onChange(markdown, html);
      }, 0);
    }
  };

  const handleSelectionChange = () => {
    onSelectionChange?.();
  };

  const formatSelection = (format: string) => {
    if (!editorRef.current || disabled) return;
    
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    
    const range = selection.getRangeAt(0);
    const selectedText = range.toString();
    
    if (!selectedText) return;
    
    let wrapper: HTMLElement;
    
    switch (format) {
      case 'bold':
        wrapper = document.createElement('strong');
        break;
      case 'italic':
        wrapper = document.createElement('em');
        break;
      case 'underline':
        wrapper = document.createElement('u');
        break;
      case 'strikethrough':
        wrapper = document.createElement('del');
        break;
      case 'link':
        const url = prompt('Link-URL eingeben:');
        if (!url) return;
        wrapper = document.createElement('a');
        (wrapper as HTMLAnchorElement).href = url;
        (wrapper as HTMLAnchorElement).target = '_blank';
        (wrapper as HTMLAnchorElement).rel = 'noopener noreferrer';
        break;
      case 'heading':
        wrapper = document.createElement('h2');
        break;
      case 'comment':
        wrapper = document.createElement('span');
        wrapper.style.color = '#888';
        wrapper.style.fontStyle = 'italic';
        break;
      default:
        return;
    }
    
    try {
      range.surroundContents(wrapper);
      selection.removeAllRanges();
      
      // Trigger input event to update content
      setTimeout(() => handleInput(), 0);
    } catch (e) {
      // Fallback: replace selection with formatted text
      range.deleteContents();
      wrapper.textContent = selectedText;
      range.insertNode(wrapper);
      
      setTimeout(() => handleInput(), 0);
    }
  };

  return (
    <div
      ref={editorRef}
      contentEditable={!disabled}
      className={cn(
        "min-h-96 border-none px-0 focus-visible:outline-none bg-transparent resize-none text-base leading-relaxed",
        "prose prose-sm max-w-none",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
      style={{
        whiteSpace: 'pre-wrap',
        wordWrap: 'break-word'
      }}
      onInput={handleInput}
      onKeyDown={handleKeyDown}
      onMouseUp={handleSelectionChange}
      onKeyUp={handleSelectionChange}
      onCompositionStart={() => setIsComposing(true)}
      onCompositionEnd={() => setIsComposing(false)}
      data-placeholder={placeholder}
      suppressContentEditableWarning={true}
    />
  );
};

export { RichTextEditor, type RichTextEditorProps };