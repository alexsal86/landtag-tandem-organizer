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

interface RichTextEditorRef {
  formatSelection: (format: string) => void;
}

const RichTextEditor = React.forwardRef<RichTextEditorRef, RichTextEditorProps>(({
  value,
  onChange,
  onSelectionChange,
  onFormatText,
  disabled = false,
  className,
  placeholder = "Beginnen Sie zu schreiben..."
}, ref) => {
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
      .replace(/^### (.*$)/gm, '<h3>$1</h3>')
      .replace(/^## (.*$)/gm, '<h2>$1</h2>')
      .replace(/^# (.*$)/gm, '<h1>$1</h1>')
      .replace(/^> (.*$)/gm, '<blockquote>$1</blockquote>')
      .replace(/```\n(.*?)\n```/gs, '<pre><code>$1</code></pre>')
      .replace(/`(.*?)`/g, '<code>$1</code>')
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
      .replace(/<h1[^>]*>(.*?)<\/h1>/g, '# $1')
      .replace(/<h2[^>]*>(.*?)<\/h2>/g, '## $1')
      .replace(/<h3[^>]*>(.*?)<\/h3>/g, '### $1')
      .replace(/<blockquote[^>]*>(.*?)<\/blockquote>/g, '> $1')
      .replace(/<pre[^>]*><code[^>]*>(.*?)<\/code><\/pre>/g, '```\n$1\n```')
      .replace(/<code[^>]*>(.*?)<\/code>/g, '`$1`')
      .replace(/<ul[^>]*>(.*?)<\/ul>/gs, (match, content) => {
        return content.replace(/<li[^>]*>(.*?)<\/li>/g, '- $1\n').trim();
      })
      .replace(/<ol[^>]*>(.*?)<\/ol>/gs, (match, content) => {
        let counter = 1;
        return content.replace(/<li[^>]*>(.*?)<\/li>/g, () => `${counter++}. $1\n`).trim();
      })
      .replace(/<span[^>]*>(.*?)<\/span>/g, '<!-- $1 -->')
      .replace(/<br\s*\/?>/g, '\n')
      .replace(/<div[^>]*>/g, '\n')
      .replace(/<\/div>/g, '')
      .replace(/<p[^>]*>/g, '\n')
      .replace(/<\/p>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/\n\s*\n\s*\n/g, '\n\n') // Reduce multiple newlines
      .trim();
  };

  // Initialize content on mount
  useEffect(() => {
    if (editorRef.current && !lastValueRef.current && value) {
      const html = convertToHtml(value);
      editorRef.current.innerHTML = html;
      lastValueRef.current = value;
    }
  }, []);

  // Only update from external changes (not user input)
  useEffect(() => {
    if (!editorRef.current || isComposing) return;

    // Skip update if this was triggered by our own input
    if (skipNextUpdateRef.current) {
      skipNextUpdateRef.current = false;
      return;
    }

    // Only update if the value actually changed from outside
    if (value !== lastValueRef.current) {
      console.log('RichTextEditor: External update detected', { 
        newValue: value, 
        lastValue: lastValueRef.current 
      });
      
      try {
        const html = convertToHtml(value);
        editorRef.current.innerHTML = html;
        lastValueRef.current = value;
      } catch (error) {
        console.warn('RichTextEditor: Error during HTML conversion:', error);
      }
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

    // Prevent React from updating the DOM while we're manually manipulating it
    skipNextUpdateRef.current = true;
    
    // For headings, we need to work with the current line/block
    if (['heading1', 'heading2', 'heading3', 'text'].includes(format)) {
      const range = selection.getRangeAt(0);
      
      // Find the current line by expanding to line boundaries
      let startContainer = range.startContainer;
      let endContainer = range.endContainer;
      
      // If we're in a text node, get the parent element
      if (startContainer.nodeType === Node.TEXT_NODE) {
        startContainer = startContainer.parentNode as Node;
      }
      if (endContainer.nodeType === Node.TEXT_NODE) {
        endContainer = endContainer.parentNode as Node;
      }
      
      // Find the line element (div, p, h1, h2, h3, or create one if needed)
      let lineElement = startContainer as Element;
      while (lineElement && lineElement !== editorRef.current && 
             !['DIV', 'P', 'H1', 'H2', 'H3'].includes(lineElement.tagName)) {
        lineElement = lineElement.parentElement!;
      }
      
      if (lineElement && lineElement !== editorRef.current) {
        const text = lineElement.textContent || '';
        let newElement: HTMLElement;
        
        switch (format) {
          case 'heading1':
            newElement = document.createElement('h1');
            break;
          case 'heading2':
            newElement = document.createElement('h2');
            break;
          case 'heading3':
            newElement = document.createElement('h3');
            break;
          case 'text':
            newElement = document.createElement('div');
            break;
          default:
            return;
        }
        
        newElement.textContent = text;
        
        try {
          lineElement.parentNode?.replaceChild(newElement, lineElement);
        } catch (error) {
          console.warn('RichTextEditor: Error replacing element:', error);
          return;
        }
        
        // Set cursor at the end of the new element
        const newRange = document.createRange();
        newRange.selectNodeContents(newElement);
        newRange.collapse(false);
        selection.removeAllRanges();
        selection.addRange(newRange);
        
        setTimeout(() => handleInput(), 0);
        return;
      } else {
        // If no line element found, create a new heading with selected text
        const range = selection.getRangeAt(0);
        const selectedText = range.toString();
        
        if (selectedText) {
          let newElement: HTMLElement;
          
          switch (format) {
            case 'heading1':
              newElement = document.createElement('h1');
              break;
            case 'heading2':
              newElement = document.createElement('h2');
              break;
            case 'heading3':
              newElement = document.createElement('h3');
              break;
            case 'text':
              newElement = document.createElement('div');
              break;
            default:
              return;
          }
          
          newElement.textContent = selectedText;
          range.deleteContents();
          range.insertNode(newElement);
          
          setTimeout(() => handleInput(), 0);
          return;
        }
      }
    }
    
    // For other formatting (bold, italic, etc.)
    const range = selection.getRangeAt(0);
    const selectedText = range.toString();
    
    if (!selectedText && !['bulletlist', 'numberlist', 'todolist', 'togglelist', 'code', 'quote', 'page'].includes(format)) {
      return;
    }
    
    let wrapper: HTMLElement;
    let needsSelection = true;
    
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
      case 'bulletlist':
        wrapper = document.createElement('ul');
        const li = document.createElement('li');
        li.textContent = selectedText || 'List item';
        wrapper.appendChild(li);
        needsSelection = false;
        break;
      case 'numberlist':
        wrapper = document.createElement('ol');
        const liNum = document.createElement('li');
        liNum.textContent = selectedText || 'List item';
        wrapper.appendChild(liNum);
        needsSelection = false;
        break;
      case 'todolist':
        wrapper = document.createElement('div');
        wrapper.className = 'todo-item';
        wrapper.innerHTML = `<input type="checkbox" style="margin-right: 8px;" /><span>${selectedText || 'Todo item'}</span>`;
        needsSelection = false;
        break;
      case 'togglelist':
        wrapper = document.createElement('details');
        const summary = document.createElement('summary');
        summary.textContent = selectedText || 'Toggle';
        wrapper.appendChild(summary);
        const content = document.createElement('div');
        content.textContent = 'Content here...';
        wrapper.appendChild(content);
        needsSelection = false;
        break;
      case 'code':
        wrapper = document.createElement('pre');
        const code = document.createElement('code');
        code.textContent = selectedText || 'Code here...';
        wrapper.appendChild(code);
        needsSelection = false;
        break;
      case 'quote':
        wrapper = document.createElement('blockquote');
        wrapper.textContent = selectedText || 'Quote text';
        needsSelection = false;
        break;
      case 'page':
        wrapper = document.createElement('div');
        wrapper.innerHTML = `<hr style="margin: 20px 0;" /><h1>${selectedText || 'New Page'}</h1>`;
        needsSelection = false;
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
      if (needsSelection && selectedText) {
        range.surroundContents(wrapper);
      } else {
        range.deleteContents();
        range.insertNode(wrapper);
      }
      selection.removeAllRanges();
      
      // Trigger input event to update content
      setTimeout(() => handleInput(), 0);
    } catch (e) {
      // Fallback: replace selection with formatted text
      range.deleteContents();
      if (needsSelection && selectedText) {
        wrapper.textContent = selectedText;
      }
      range.insertNode(wrapper);
      
      setTimeout(() => handleInput(), 0);
    }
  };

  // Expose formatSelection through ref
  React.useImperativeHandle(ref, () => ({
    formatSelection
  }));

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
});

RichTextEditor.displayName = 'RichTextEditor';

export { RichTextEditor, type RichTextEditorProps, type RichTextEditorRef };