import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import PlainTextEditor, { type PlainTextEditorRef } from '../PlainTextEditor';

describe('PlainTextEditor', () => {
  it('renders without crashing', () => {
    render(<PlainTextEditor />);
    expect(document.querySelector('.plaintext-editor')).toBeInTheDocument();
  });

  it('renders with default placeholder', () => {
    render(<PlainTextEditor />);
    expect(screen.getByText('Text eingeben...')).toBeInTheDocument();
  });

  it('renders with custom placeholder', () => {
    const customPlaceholder = 'Custom placeholder';
    render(<PlainTextEditor placeholder={customPlaceholder} />);
    expect(screen.getByText(customPlaceholder)).toBeInTheDocument();
  });

  it('hides placeholder when there is content', () => {
    render(<PlainTextEditor initialContent="Some content" />);
    expect(screen.queryByText('Text eingeben...')).not.toBeInTheDocument();
  });

  it('renders export button when onExportJSON is provided', () => {
    const mockExport = vi.fn();
    render(<PlainTextEditor onExportJSON={mockExport} />);
    
    const exportButton = screen.getByRole('button', { name: /json/i });
    expect(exportButton).toBeInTheDocument();
  });

  it('does not render export button when onExportJSON is not provided', () => {
    render(<PlainTextEditor />);
    
    const exportButton = screen.queryByRole('button', { name: /json/i });
    expect(exportButton).not.toBeInTheDocument();
  });

  it('calls onExportJSON when export button is clicked', () => {
    const mockExport = vi.fn();
    render(<PlainTextEditor onExportJSON={mockExport} initialContent="Test content" />);
    
    const exportButton = screen.getByRole('button', { name: /json/i });
    fireEvent.click(exportButton);
    
    expect(mockExport).toHaveBeenCalledTimes(1);
    expect(mockExport).toHaveBeenCalledWith(expect.stringContaining('Test content'));
  });

  it('calls onChange when content changes', async () => {
    const user = userEvent.setup();
    const mockChange = vi.fn();
    render(<PlainTextEditor onChange={mockChange} />);
    
    const textarea = screen.getByRole('textbox');
    await user.type(textarea, 'Hello World');
    
    expect(mockChange).toHaveBeenCalledWith('Hello World');
  });

  it('displays initial content in textarea', () => {
    const initialText = 'Initial content';
    render(<PlainTextEditor initialContent={initialText} />);
    
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    expect(textarea.value).toBe(initialText);
  });

  it('can be disabled', () => {
    render(<PlainTextEditor disabled />);
    
    const textarea = screen.getByRole('textbox');
    expect(textarea).toBeDisabled();
  });

  it('disables export button when disabled', () => {
    const mockExport = vi.fn();
    render(<PlainTextEditor onExportJSON={mockExport} disabled />);
    
    const exportButton = screen.getByRole('button', { name: /json/i });
    expect(exportButton).toBeDisabled();
  });

  it('applies custom className', () => {
    const customClass = 'custom-editor-class';
    render(<PlainTextEditor className={customClass} />);
    
    const editor = document.querySelector('.plaintext-editor');
    expect(editor).toHaveClass(customClass);
  });

  it('export generates valid JSON with metadata', () => {
    const mockExport = vi.fn();
    const testContent = 'This is test content with multiple words';
    render(<PlainTextEditor onExportJSON={mockExport} initialContent={testContent} />);
    
    const exportButton = screen.getByRole('button', { name: /json/i });
    fireEvent.click(exportButton);
    
    expect(mockExport).toHaveBeenCalledTimes(1);
    const jsonString = mockExport.mock.calls[0][0];
    
    // Should be valid JSON
    expect(() => JSON.parse(jsonString)).not.toThrow();
    
    const parsed = JSON.parse(jsonString);
    expect(parsed).toHaveProperty('timestamp');
    expect(parsed).toHaveProperty('content', testContent);
    expect(parsed).toHaveProperty('plainText', true);
    expect(parsed).toHaveProperty('wordCount', 7); // 7 words: 'This', 'is', 'test', 'content', 'with', 'multiple', 'words'
    expect(parsed).toHaveProperty('characterCount', testContent.length);
    expect(parsed).toHaveProperty('version', '1.0');
  });

  describe('ref methods', () => {
    it('getValue returns current value', () => {
      const ref = createRef<PlainTextEditorRef>();
      const initialText = 'Test content';
      render(<PlainTextEditor ref={ref} initialContent={initialText} />);
      
      expect(ref.current?.getValue()).toBe(initialText);
    });

    it('setValue updates the value', async () => {
      const ref = createRef<PlainTextEditorRef>();
      const mockChange = vi.fn();
      render(<PlainTextEditor ref={ref} onChange={mockChange} />);
      
      const newValue = 'Updated content';
      ref.current?.setValue(newValue);
      
      // Wait for the next tick to ensure state has updated
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(ref.current?.getValue()).toBe(newValue);
      expect(mockChange).toHaveBeenCalledWith(newValue);
    });

    it('focus method focuses the textarea', () => {
      const ref = createRef<PlainTextEditorRef>();
      render(<PlainTextEditor ref={ref} />);
      
      const textarea = screen.getByRole('textbox');
      expect(document.activeElement).not.toBe(textarea);
      
      ref.current?.focus();
      expect(document.activeElement).toBe(textarea);
    });

    it('exportToJSON method triggers export', () => {
      const ref = createRef<PlainTextEditorRef>();
      const mockExport = vi.fn();
      render(<PlainTextEditor ref={ref} onExportJSON={mockExport} initialContent="Test" />);
      
      ref.current?.exportToJSON();
      
      expect(mockExport).toHaveBeenCalledTimes(1);
    });
  });
});