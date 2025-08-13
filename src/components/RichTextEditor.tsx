import React, { useRef, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface RichTextEditorProps {
  value: string;
  onChange: (content: string, html?: string) => void;
  onSelectionChange?: (activeFormats?: string[]) => void;
  onFormatText?: (format: string) => void;
  onCheckboxChange?: (checkboxIndex: number, checked: boolean) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}

interface RichTextEditorRef {
  formatSelection: (format: string) => void;
  getActiveFormats: () => string[];
  updateCheckboxState: (checkboxIndex: number, checked: boolean) => void;
  forceUpdateHandlers: () => void;
}

const RichTextEditor = React.forwardRef<RichTextEditorRef, RichTextEditorProps>(({
  value,
  onChange,
  onSelectionChange,
  onFormatText,
  onCheckboxChange,
  disabled = false,
  className,
  placeholder = "Beginnen Sie zu schreiben..."
}, ref) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const [isComposing, setIsComposing] = useState(false);
  const lastValueRef = useRef<string>('');
  const skipNextUpdateRef = useRef(false);
  const isUpdatingFromRemote = useRef(false);

  // Convert markdown-like syntax to HTML for display
  const convertToHtml = (text: string) => {
    console.log('convertToHtml input:', text);
    const result = text
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
      // Handle lists
      .replace(/^• (.*)$/gm, '<ul><li>$1</li></ul>')
      .replace(/^(\d+)\. (.*)$/gm, '<ol><li>$2</li></ol>')
      // Handle todo lists - styled checkboxes matching the design
      .replace(/^☑\s+(.*)$/gm, '<div class="todo-item" data-checked="true"><span class="todo-checkbox checked" contenteditable="false" data-checkbox="true">✓</span><span class="todo-text checked">$1</span></div>')
      .replace(/^☐\s+(.*)$/gm, '<div class="todo-item" data-checked="false"><span class="todo-checkbox empty" contenteditable="false" data-checkbox="true"></span><span class="todo-text">$1</span></div>')
      .replace(/<!-- (.*?) -->/g, '<span style="color: #888; font-style: italic;">$1</span>')
      // Remove line breaks between todo items to prevent extra spacing
      .replace(/(<\/div>)\n+(?=<div class="todo-item")/g, '$1')
      .replace(/\n/g, '<br>')
      // Merge consecutive list items
      .replace(/<\/ul><br><ul>/g, '')
      .replace(/<\/ol><br><ol>/g, '')
      // Remove <br> tags that appear after todo items
      .replace(/(<div class="todo-item"[^>]*>.*?<\/div>)<br>/g, '$1');
    console.log('convertToHtml output:', result);
    return result;
  };

  // Convert HTML back to markdown-like syntax for storage
  const convertToMarkdown = (html: string) => {
    console.log('convertToMarkdown input:', html);
    
    // Enhanced conversion that properly detects checked state from actual DOM
    let result = html;
    
    // Create temporary DOM to parse HTML accurately
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    
    // Handle todo items with accurate checked state detection
    const todoItems = tempDiv.querySelectorAll('.todo-item');
    console.log('convertToMarkdown: Found todo items:', todoItems.length);
    
    // Process todo items in reverse order to avoid replacement conflicts
    const todoReplacements: { html: string; markdown: string }[] = [];
    
    todoItems.forEach((todoItem, index) => {
      const isChecked = todoItem.getAttribute('data-checked') === 'true';
      const textSpan = todoItem.querySelector('.todo-text');
      if (textSpan) {
        const text = textSpan.textContent || '';
        console.log(`convertToMarkdown: Todo ${index} - text: "${text}", checked: ${isChecked}`);
        
        const markdownSymbol = isChecked ? '☑' : '☐';
        const replacement = `${markdownSymbol} ${text}`;
        
        todoReplacements.push({
          html: todoItem.outerHTML,
          markdown: replacement
        });
      }
    });
    
    // Apply replacements
    todoReplacements.forEach(({ html, markdown }) => {
      result = result.replace(html, markdown);
    });
    
    // Handle any remaining old checkbox structures
    const oldCheckboxes = tempDiv.querySelectorAll('input[type="checkbox"]');
    oldCheckboxes.forEach((checkbox) => {
      const input = checkbox as HTMLInputElement;
      const nextElement = input.nextElementSibling;
      if (nextElement && nextElement.tagName === 'SPAN') {
        const span = nextElement as HTMLSpanElement;
        const text = span.textContent || '';
        const isChecked = input.checked;
        const replacement = isChecked ? `☑ ${text}` : `☐ ${text}`;
        
        // Find and replace the checkbox + span pattern
        const pattern = input.outerHTML + nextElement.outerHTML;
        result = result.replace(pattern, replacement);
      }
    });
    
    result = result
      // Handle todo items FIRST before other conversions destroy them
      // (This has already been done above, but ensure clean result)
      
      // Handle headings first (before other formatting)
      .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1')
      .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1')
      .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1')
      .replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gi, '> $1')
      .replace(/<pre[^>]*><code[^>]*>(.*?)<\/code><\/pre>/gis, '```\n$1\n```')
      .replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`')
      .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
      .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
      .replace(/<u[^>]*>(.*?)<\/u>/gi, '<u>$1</u>')
      .replace(/<del[^>]*>(.*?)<\/del>/gi, '~~$1~~')
      .replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)')
      .replace(/<ul[^>]*>(.*?)<\/ul>/gis, (match, content) => {
        return content.replace(/<li[^>]*>(.*?)<\/li>/gi, '• $1\n').trim();
      })
      .replace(/<ol[^>]*>(.*?)<\/ol>/gis, (match, content) => {
        let counter = 1;
        return content.replace(/<li[^>]*>(.*?)<\/li>/gi, (li, text) => `${counter++}. ${text}\n`).trim();
      })
      // Clean up any remaining artifacts (but preserve todo markers)
      .replace(/<span[^>]*style="color:\s*#888;\s*font-style:\s*italic;"[^>]*>(.*?)<\/span>/gi, '$1')
      .replace(/<!--\s*(.*?)\s*-->/g, '$1')
      .replace(/<br\s*\/?>/gi, '\n')
      // Handle remaining divs that are not todo-items
      .replace(/<div(?![^>]*class="todo-item")[^>]*>/gi, '\n')
      .replace(/<\/div>/gi, '')
      .replace(/<p[^>]*>/gi, '\n')
      .replace(/<\/p>/gi, '')
      .replace(/&nbsp;/gi, ' ')
      .replace(/\n\s*\n\s*\n/g, '\n\n') // Reduce multiple newlines
      .trim();
      
    console.log('convertToMarkdown output:', result);
    return result;
  };

  // Initialize content on mount
  useEffect(() => {
    if (editorRef.current && !lastValueRef.current && value) {
      console.log('RichTextEditor: Initial mount with value:', value);
      
      // CLEAN UP CORRUPTED DATA: Remove any old checkbox HTML before conversion
      const cleanedValue = value
        .replace(/<input[^>]*type="checkbox"[^>]*style="margin-right: 8px;"[^>]*><span[^>]*style="text-decoration: line-through;"[^>]*>(.*?)<\/span>/gi, '☑ $1')
        .replace(/<input[^>]*type="checkbox"[^>]*style="margin-right: 8px;"[^>]*><span[^>]*>(.*?)<\/span>/gi, '☐ $1')
        .replace(/<input[^>]*type="checkbox"[^>]*checked[^>]*[^>]*>[\s]*<span[^>]*>(.*?)<\/span>/gi, '☑ $1')
        .replace(/<input[^>]*type="checkbox"[^>]*>[\s]*<span[^>]*>(.*?)<\/span>/gi, '☐ $1');
      
      console.log('RichTextEditor: Cleaned value:', cleanedValue);
      
      const html = convertToHtml(cleanedValue);
      editorRef.current.innerHTML = html;
      lastValueRef.current = cleanedValue;
      
      // Set up todo click handlers after content is updated - with longer delay for remote updates
      const delay = isUpdatingFromRemote ? 200 : 50;
      setTimeout(() => {
        setupTodoClickHandlers();
      }, delay);
      
      // Immediately save the cleaned version
      if (onChange && cleanedValue !== value) {
        console.log('RichTextEditor: Saving cleaned data');
        onChange(cleanedValue, html);
      }
    }
  }, []);

  // Only update from external changes (not user input)
  useEffect(() => {
    if (!editorRef.current || isComposing) return;

    // Always process external updates, but be careful with timing
    if (value !== lastValueRef.current) {
      console.log('RichTextEditor: External update detected', { 
        newValue: value, 
        lastValue: lastValueRef.current,
        skipNext: skipNextUpdateRef.current
      });
      
      // If we just made a local change, skip this update to prevent loops
      if (skipNextUpdateRef.current) {
        skipNextUpdateRef.current = false;
        return;
      }
      
      try {
        // CLEAN INPUT: Remove corrupted checkbox HTML before conversion
        const cleanedValue = value
          .replace(/<input[^>]*type="checkbox"[^>]*style="margin-right: 8px;"[^>]*><span[^>]*style="text-decoration: line-through;"[^>]*>(.*?)<\/span>/gi, '☑ $1')
          .replace(/<input[^>]*type="checkbox"[^>]*style="margin-right: 8px;"[^>]*><span[^>]*>(.*?)<\/span>/gi, '☐ $1')
          .replace(/<input[^>]*type="checkbox"[^>]*checked[^>]*[^>]*>[\s]*<span[^>]*>(.*?)<\/span>/gi, '☑ $1')
          .replace(/<input[^>]*type="checkbox"[^>]*>[\s]*<span[^>]*>(.*?)<\/span>/gi, '☐ $1');
        
        const html = convertToHtml(cleanedValue);
        console.log('RichTextEditor: Converting cleaned markdown to HTML', { original: value, cleaned: cleanedValue, html });
        editorRef.current.innerHTML = html;
        
        // Set up click handlers for todo items and ensure checkboxes are non-editable
        console.log('RichTextEditor: Setting up simple todo click handlers');
        
        // First, make all checkboxes non-editable and prevent cursor
        const checkboxes = editorRef.current.querySelectorAll('.todo-checkbox');
        checkboxes.forEach((checkbox) => {
          const element = checkbox as HTMLElement;
          element.setAttribute('contenteditable', 'false');
          element.setAttribute('tabindex', '-1');
          element.style.cursor = 'pointer';
          element.style.userSelect = 'none';
          element.style.pointerEvents = 'auto';
          element.style.caretColor = 'transparent';
          element.style.outline = 'none';
          // Prevent any focus that could cause cursor
          element.addEventListener('focus', (e) => {
            e.preventDefault();
            e.stopPropagation();
            element.blur();
          });
        });
        
        // Add event delegation to the editor itself - simplified approach
        if (editorRef.current) {
          // Remove any existing handlers first
          editorRef.current.onclick = null;
          
          // Use a simple onclick handler to avoid duplicate event listeners
          editorRef.current.onclick = (event) => {
            const target = event.target as HTMLElement;
            
            // Only handle clicks on checkboxes or their containers
            if (target.classList.contains('todo-checkbox') || target.closest('.todo-item')) {
              const todoItem = target.closest('.todo-item') as HTMLElement;
              
              if (todoItem) {
                console.log('RichTextEditor: Todo item clicked');
                event.preventDefault();
                event.stopPropagation();
                handleTodoClick(todoItem);
              }
            }
          };
        }
        
        lastValueRef.current = cleanedValue;
      } catch (error) {
        console.warn('RichTextEditor: Error during HTML conversion:', error);
      }
    }
  }, [value, isComposing]);

  const handleInput = () => {
    if (!editorRef.current || disabled || isComposing) return;
    
    console.log('RichTextEditor: handleInput called');
    
    // Simple approach: Just get current innerHTML and convert it
    const html = editorRef.current.innerHTML;
    const markdown = convertToMarkdown(html);
    
    console.log('RichTextEditor: handleInput conversion', { 
      html: html.substring(0, 200) + '...', 
      markdown: markdown.substring(0, 200) + '...'
    });
    
    // Skip the next external update since this is our own change
    skipNextUpdateRef.current = true;
    lastValueRef.current = markdown;
    
    onChange(markdown, html);
  };

  // Setup todo click handlers
  const setupTodoClickHandlers = () => {
    if (!editorRef.current) return;
    
    console.log('RichTextEditor: Setting up todo click handlers');
    
    // First, ensure all checkboxes are properly configured as non-editable
    const checkboxes = editorRef.current.querySelectorAll('.todo-checkbox');
    checkboxes.forEach((checkbox) => {
      const element = checkbox as HTMLElement;
      element.setAttribute('contenteditable', 'false');
      element.setAttribute('tabindex', '-1');
      element.setAttribute('data-checkbox', 'true');
      element.style.cursor = 'pointer';
      element.style.userSelect = 'none';
      element.style.pointerEvents = 'auto';
      element.style.caretColor = 'transparent';
      element.style.outline = 'none';
      // Prevent focus
      element.addEventListener('focus', (e) => {
        e.preventDefault();
        e.stopPropagation();
        element.blur();
      });
    });
    
    // Remove any existing click handlers first to prevent duplicate handlers
    editorRef.current.onclick = null;
    editorRef.current.removeEventListener('click', (editorRef.current as any)._todoClickHandler);
    
    // Create a single click handler and store reference to prevent duplicates
    const handleClick = (event: Event) => {
      const target = event.target as HTMLElement;
      
      // Only handle clicks on checkboxes or todo items
      if (target.classList.contains('todo-checkbox') || target.closest('.todo-item')) {
        const todoItem = target.closest('.todo-item') as HTMLElement;
        
        if (todoItem) {
          console.log('RichTextEditor: Todo item clicked via delegation');
          event.preventDefault();
          event.stopPropagation();
          handleTodoClick(todoItem);
        }
      }
    };
    
    // Store reference and add listener
    (editorRef.current as any)._todoClickHandler = handleClick;
    editorRef.current.addEventListener('click', handleClick);
    
    console.log('RichTextEditor: Event handlers attached successfully');
  };

  // Simplified function to handle todo clicks
  const handleTodoClick = (todoElement: HTMLElement) => {
    const currentChecked = todoElement.getAttribute('data-checked') === 'true';
    const newChecked = !currentChecked;
    
    console.log('RichTextEditor: Todo clicked, changing state', { currentChecked, newChecked });
    
    // Update the element
    todoElement.setAttribute('data-checked', newChecked.toString());
    const checkbox = todoElement.querySelector('.todo-checkbox');
    const text = todoElement.querySelector('.todo-text');
    
    if (checkbox && text) {
      if (newChecked) {
        checkbox.textContent = '✓';
        checkbox.classList.remove('empty');
        checkbox.classList.add('checked');
        (text as HTMLElement).style.textDecoration = 'line-through';
        (text as HTMLElement).style.opacity = '0.6';
        (text as HTMLElement).classList.add('checked');
      } else {
        checkbox.textContent = '';
        checkbox.classList.remove('checked');
        checkbox.classList.add('empty');
        (text as HTMLElement).style.textDecoration = 'none';
        (text as HTMLElement).style.opacity = '1';
        (text as HTMLElement).classList.remove('checked');
      }
    }
    
    // Only broadcast if this is not a remote update
    if (!isUpdatingFromRemote.current && onCheckboxChange) {
      const todoItems = Array.from(editorRef.current?.querySelectorAll('.todo-item') || []);
      const todoIndex = todoItems.indexOf(todoElement);
      console.log('RichTextEditor: Notifying parent of checkbox change', { todoIndex, newChecked, isRemoteUpdate: isUpdatingFromRemote.current });
      onCheckboxChange(todoIndex, newChecked);
    }
    
    // Only save if this is not a remote update to avoid feedback loops
    if (!isUpdatingFromRemote.current) {
      setTimeout(() => {
        console.log('RichTextEditor: Forcing save after todo click');
        handleInput();
      }, 10);
    }
  };

  const handleSelectionChange = () => {
    const activeFormats = getActiveFormats();
    onSelectionChange?.(activeFormats);
  };

  const getActiveFormats = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return [];

    const range = selection.getRangeAt(0);
    if (range.collapsed) return [];

    const container = range.commonAncestorContainer;
    const element = container.nodeType === Node.TEXT_NODE ? container.parentElement : container as Element;
    
    const activeFormats: string[] = [];
    
    // Check for formatting in the selection
    let currentElement = element;
    while (currentElement && currentElement !== editorRef.current) {
      const tagName = currentElement.tagName?.toLowerCase();
      
      switch (tagName) {
        case 'strong':
        case 'b':
          activeFormats.push('bold');
          break;
        case 'em':
        case 'i':
          activeFormats.push('italic');
          break;
        case 'u':
          activeFormats.push('underline');
          break;
        case 'del':
        case 's':
          activeFormats.push('strikethrough');
          break;
        case 'a':
          activeFormats.push('link');
          break;
      }
      
      currentElement = currentElement.parentElement;
    }
    
    return [...new Set(activeFormats)]; // Remove duplicates
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return;
      
      const range = selection.getRangeAt(0);
      const container = range.startContainer;
      
      // Find parent list item or todo item
      let currentElement = container.nodeType === Node.TEXT_NODE ? container.parentElement : container as Element;
      
      // Check if we're in a list item
      while (currentElement && currentElement !== editorRef.current) {
        if (currentElement.tagName === 'LI') {
          e.preventDefault();
          
          // Check if current list item is empty
          const isEmpty = !currentElement.textContent?.trim() || currentElement.innerHTML === '<br>';
          
          if (isEmpty) {
            // Remove empty list item and exit list
            const listParent = currentElement.parentElement;
            currentElement.remove();
            
            // Create new div after the list
            const newDiv = document.createElement('div');
            newDiv.innerHTML = '<br>';
            listParent?.parentNode?.insertBefore(newDiv, listParent.nextSibling);
            
            // Set cursor in new div
            const newRange = document.createRange();
            newRange.selectNodeContents(newDiv);
            newRange.collapse(true);
            selection.removeAllRanges();
            selection.addRange(newRange);
          } else {
            // Create new list item
            const newLi = document.createElement('li');
            newLi.innerHTML = '<br>';
            
            // Insert after current item
            if (currentElement.parentElement) {
              currentElement.parentElement.insertBefore(newLi, currentElement.nextSibling);
            }
            
            // Set cursor in new item
            const newRange = document.createRange();
            newRange.selectNodeContents(newLi);
            newRange.collapse(true);
            selection.removeAllRanges();
            selection.addRange(newRange);
          }
          
          setTimeout(() => handleInput(), 0);
          return;
        }
        
        // Check if we're in a todo item
        if (currentElement.classList?.contains('todo-item')) {
          e.preventDefault();
          
          // Check if current todo item is empty by looking at the text content
          const todoText = currentElement.querySelector('.todo-text');
          const textContent = todoText?.textContent?.trim() || '';
          const innerHTML = todoText?.innerHTML || '';
          
          // Consider it empty if no text content or only contains <br>
          const isEmpty = textContent === '' || innerHTML === '<br>' || innerHTML === '';
          
          console.log('Todo item Enter pressed:', { textContent, innerHTML, isEmpty });
          
          if (isEmpty) {
            // Remove empty todo item and create normal text line
            const newDiv = document.createElement('div');
            newDiv.innerHTML = '<br>';
            
            // Insert the new div after the current todo item
            currentElement.parentNode?.insertBefore(newDiv, currentElement.nextSibling);
            
            // Remove the empty todo item
            currentElement.remove();
            
            // Set cursor in new div
            const newRange = document.createRange();
            newRange.selectNodeContents(newDiv);
            newRange.collapse(true);
            selection.removeAllRanges();
            selection.addRange(newRange);
          } else {
            // Create new todo item with proper structure
            const newTodoItem = document.createElement('div');
            newTodoItem.className = 'todo-item';
            newTodoItem.setAttribute('data-checked', 'false');
            
            const checkbox = document.createElement('span');
            checkbox.className = 'todo-checkbox empty';
            checkbox.setAttribute('contenteditable', 'false');
            checkbox.setAttribute('data-checkbox', 'true');
            
            const textSpan = document.createElement('span');
            textSpan.className = 'todo-text';
            textSpan.innerHTML = '<br>';
            
            newTodoItem.appendChild(checkbox);
            newTodoItem.appendChild(textSpan);
            
            // Insert after current todo item
            currentElement.parentNode?.insertBefore(newTodoItem, currentElement.nextSibling);
            
            // Set cursor in new todo item text
            const newRange = document.createRange();
            newRange.selectNodeContents(textSpan);
            newRange.collapse(true);
            selection.removeAllRanges();
            selection.addRange(newRange);
          }
          
          setTimeout(() => {
            handleInput();
            setupTodoClickHandlers();
          }, 0);
          return;
        }
        
        currentElement = currentElement.parentElement;
      }
    }
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

    // Check if formatting already exists and remove it
    const activeFormats = getActiveFormats();
    const isActive = activeFormats.includes(format);
    
    if (isActive && ['bold', 'italic', 'underline', 'strikethrough'].includes(format)) {
      // Remove existing formatting
      const container = range.commonAncestorContainer;
      let element = container.nodeType === Node.TEXT_NODE ? container.parentElement : container as Element;
      
      // Find the formatting element to remove
      while (element && element !== editorRef.current) {
        const tagName = element.tagName?.toLowerCase();
        const shouldRemove = (
          (format === 'bold' && (tagName === 'strong' || tagName === 'b')) ||
          (format === 'italic' && (tagName === 'em' || tagName === 'i')) ||
          (format === 'underline' && tagName === 'u') ||
          (format === 'strikethrough' && (tagName === 'del' || tagName === 's'))
        );
        
        if (shouldRemove) {
          // Replace the formatted element with its text content
          const textNode = document.createTextNode(element.textContent || '');
          element.parentNode?.replaceChild(textNode, element);
          
          // Select the text
          const newRange = document.createRange();
          newRange.selectNode(textNode);
          selection.removeAllRanges();
          selection.addRange(newRange);
          
          setTimeout(() => handleInput(), 0);
          return;
        }
        element = element.parentElement;
      }
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
        wrapper.setAttribute('data-checked', 'false');
        
        const checkboxSpan = document.createElement('span');
        checkboxSpan.className = 'todo-checkbox empty';
        checkboxSpan.setAttribute('contenteditable', 'false');
        checkboxSpan.setAttribute('data-checkbox', 'true');
        
        const textSpan = document.createElement('span');
        textSpan.className = 'todo-text';
        textSpan.textContent = selectedText || 'Todo item';
        
        wrapper.appendChild(checkboxSpan);
        wrapper.appendChild(textSpan);
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

  // Function to update checkbox state (called from parent for real-time sync)
  const updateCheckboxState = (checkboxIndex: number, checked: boolean) => {
    if (!editorRef.current) {
      console.log('RichTextEditor: updateCheckboxState - no editor ref');
      return;
    }
    
    console.log('RichTextEditor: updateCheckboxState called', { checkboxIndex, checked });
    
    // Set flag to indicate remote update
    isUpdatingFromRemote.current = true;
    
    const todoItems = editorRef.current.querySelectorAll('.todo-item');
    console.log('RichTextEditor: Found checkboxes for update', { count: todoItems.length });
    
    if (checkboxIndex >= 0 && checkboxIndex < todoItems.length) {
      const todoItem = todoItems[checkboxIndex];
      const checkbox = todoItem.querySelector('.todo-checkbox');
      const text = todoItem.querySelector('.todo-text');
      
      console.log('RichTextEditor: Updating checkbox', { checkboxIndex, checked, hasCheckbox: !!checkbox, hasText: !!text });
      
      // Update the data attribute
      todoItem.setAttribute('data-checked', checked.toString());
      
      if (checkbox && text) {
        if (checked) {
          checkbox.textContent = '✓';
          checkbox.classList.remove('empty');
          checkbox.classList.add('checked');
          (text as HTMLElement).style.textDecoration = 'line-through';
          (text as HTMLElement).style.opacity = '0.6';
          (text as HTMLElement).classList.add('checked');
        } else {
          checkbox.textContent = '';
          checkbox.classList.remove('checked');
          checkbox.classList.add('empty');
          (text as HTMLElement).style.textDecoration = 'none';
          (text as HTMLElement).style.opacity = '1';
          (text as HTMLElement).classList.remove('checked');
        }
        
        // Force a content update without triggering broadcast
        setTimeout(() => {
          if (editorRef.current) {
            // Clear any active selection to avoid cursor overlay issues
            const selection = window.getSelection();
            if (selection) {
              selection.removeAllRanges();
            }
            
            const markdown = convertToMarkdown(editorRef.current.innerHTML);
            const html = convertToHtml(markdown);
            lastValueRef.current = markdown;
            onChange(markdown, html);
            
            // Re-setup handlers after remote update
            setTimeout(() => {
              setupTodoClickHandlers();
              isUpdatingFromRemote.current = false;
            }, 50);
          }
        }, 10);
      }
    } else {
      console.log('RichTextEditor: Target checkbox not found', { checkboxIndex, totalCheckboxes: todoItems.length });
      isUpdatingFromRemote.current = false;
    }
  };

  // Expose formatSelection, getActiveFormats, and updateCheckboxState through ref
  React.useImperativeHandle(ref, () => ({
    formatSelection,
    getActiveFormats,
    updateCheckboxState,
    forceUpdateHandlers: () => {
      setTimeout(() => {
        setupTodoClickHandlers();
      }, 100);
    }
  }));

  return (
    <div>
      <style>{`
        .todo-item {
          display: flex;
          align-items: flex-start;
          margin: 4px 0;
          cursor: pointer;
          padding: 2px;
          border-radius: 4px;
        }
        .todo-item:hover {
          background-color: rgba(0, 0, 0, 0.05);
        }
        .todo-checkbox {
          margin: 0 8px 0 0;
          user-select: none;
          font-size: 16px;
          line-height: 1.2;
          cursor: pointer;
          pointer-events: auto;
        }
        .todo-text {
          flex: 1;
          min-height: 1.2em;
          user-select: text;
        }
        .todo-text.checked {
          text-decoration: line-through;
          color: #666;
        }
      `}</style>
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
        onKeyDown={handleKeyDown}
        data-placeholder={placeholder}
        suppressContentEditableWarning={true}
      />
    </div>
  );
});

RichTextEditor.displayName = 'RichTextEditor';

export { RichTextEditor, type RichTextEditorProps, type RichTextEditorRef };