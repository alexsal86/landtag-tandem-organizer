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
  const lastValueRef = useRef<string>('');
  const skipNextUpdateRef = useRef(false);

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

  // Initialize content on mount
  useEffect(() => {
    if (editorRef.current && !lastValueRef.current) {
      const html = convertToHtml(value);
      editorRef.current.innerHTML = html;
      lastValueRef.current = value;
    }
  }, []);

  // Only update from external changes (not user input)
  useEffect(() => {
    if (!editorRef.current || isComposing || skipNextUpdateRef.current) {
      skipNextUpdateRef.current = false;
      return;
    }

    // Only update if the value actually changed from outside
    if (value !== lastValueRef.current) {
      console.log('RichTextEditor: External update detected', { 
        newValue: value, 
        lastValue: lastValueRef.current 
      });
      
      const html = convertToHtml(value);
      editorRef.current.innerHTML = html;
      lastValueRef.current = value;
    }
  }, [value, isComposing]);

  const handleInput = () => {
    if (!editorRef.current || disabled || isComposing) return;
    
    const html = editorRef.current.innerHTML;
    const markdown = convertToMarkdown(html);
    
    // Skip the next external update since this is our own change
    skipNextUpdateRef.current = true;
    lastValueRef.current = markdown;
    
    console.log('RichTextEditor: Local input change', { html, markdown });
    onChange(markdown, html);
  };

  const handleSelectionChange = () => {
    onSelectionChange?.();
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
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
      onMouseUp={handleSelectionChange}
      onKeyUp={handleSelectionChange}
      onPaste={handlePaste}
      onCompositionStart={() => setIsComposing(true)}
      onCompositionEnd={() => setIsComposing(false)}
      data-placeholder={placeholder}
      suppressContentEditableWarning={true}
    />
  );
};

export { RichTextEditor, type RichTextEditorProps };