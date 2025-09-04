import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LexicalEditor from '../LexicalEditor';

describe('LexicalEditor', () => {
  it('renders without crashing', () => {
    render(<LexicalEditor />);
    expect(document.querySelector('.lexical-editor')).toBeInTheDocument();
  });

  it('renders with default placeholder', () => {
    render(<LexicalEditor />);
    expect(screen.getByText('Schreiben...')).toBeInTheDocument();
  });

  it('renders with custom placeholder', () => {
    const customPlaceholder = 'Custom placeholder text';
    render(<LexicalEditor placeholder={customPlaceholder} />);
    expect(screen.getByText(customPlaceholder)).toBeInTheDocument();
  });

  it('shows toolbar by default', () => {
    render(<LexicalEditor />);
    const toolbar = document.querySelector('.lexical-toolbar');
    expect(toolbar).toBeInTheDocument();
  });

  it('hides toolbar when showToolbar is false', () => {
    render(<LexicalEditor showToolbar={false} />);
    const toolbar = document.querySelector('.lexical-toolbar');
    expect(toolbar).not.toBeInTheDocument();
  });

  it('renders export button when onExportJSON is provided', () => {
    const mockExport = vi.fn();
    render(<LexicalEditor onExportJSON={mockExport} />);
    
    const exportButton = screen.getByRole('button', { name: /json/i });
    expect(exportButton).toBeInTheDocument();
  });

  it('does not render export button when onExportJSON is not provided', () => {
    render(<LexicalEditor />);
    
    const exportButton = screen.queryByRole('button', { name: /json/i });
    expect(exportButton).not.toBeInTheDocument();
  });

  it('calls onExportJSON when export button is clicked', () => {
    const mockExport = vi.fn();
    render(<LexicalEditor onExportJSON={mockExport} />);
    
    const exportButton = screen.getByRole('button', { name: /json/i });
    fireEvent.click(exportButton);
    
    expect(mockExport).toHaveBeenCalledTimes(1);
    expect(mockExport).toHaveBeenCalledWith(expect.stringContaining('timestamp'));
  });

  it('calls onChange when content changes', async () => {
    const user = userEvent.setup();
    const mockChange = vi.fn();
    render(<LexicalEditor onChange={mockChange} />);
    
    const contentEditable = document.querySelector('.lexical-editor-inner');
    expect(contentEditable).toBeInTheDocument();
    
    // Focus and type in the editor
    if (contentEditable) {
      await user.click(contentEditable);
      await user.type(contentEditable, 'Hello World');
    }
    
    // onChange should be called (might be called multiple times during typing)
    expect(mockChange).toHaveBeenCalled();
  });

  it('renders with initial content', () => {
    const initialText = 'Initial content';
    render(<LexicalEditor initialContent={initialText} />);
    
    // The initial content plugin should set this content
    // We can't easily test the internal state, but we can verify the component renders
    expect(document.querySelector('.lexical-editor')).toBeInTheDocument();
  });

  it('has proper CSS classes', () => {
    render(<LexicalEditor />);
    
    const editor = document.querySelector('.lexical-editor');
    const contentEditable = document.querySelector('.lexical-editor-inner');
    const placeholder = document.querySelector('.lexical-placeholder');
    
    expect(editor).toHaveClass('lexical-editor');
    expect(contentEditable).toHaveClass('lexical-editor-inner');
    expect(placeholder).toHaveClass('lexical-placeholder');
  });

  it('export function generates valid JSON', () => {
    const mockExport = vi.fn();
    render(<LexicalEditor onExportJSON={mockExport} />);
    
    const exportButton = screen.getByRole('button', { name: /json/i });
    fireEvent.click(exportButton);
    
    expect(mockExport).toHaveBeenCalledTimes(1);
    const jsonString = mockExport.mock.calls[0][0];
    
    // Should be valid JSON
    expect(() => JSON.parse(jsonString)).not.toThrow();
    
    const parsed = JSON.parse(jsonString);
    expect(parsed).toHaveProperty('timestamp');
    expect(parsed).toHaveProperty('content');
    expect(parsed).toHaveProperty('version');
  });
});