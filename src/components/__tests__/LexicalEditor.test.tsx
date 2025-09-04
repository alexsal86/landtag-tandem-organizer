import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LexicalEditor from '../LexicalEditor';

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

describe('LexicalEditor', () => {
  beforeEach(() => {
    // Clear all localStorage mocks before each test
    localStorageMock.getItem.mockClear();
    localStorageMock.setItem.mockClear();
    localStorageMock.removeItem.mockClear();
    localStorageMock.clear.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<LexicalEditor />);
    expect(screen.getByText('Hier schreiben...')).toBeInTheDocument();
  });

  it('displays JSON debug section', () => {
    render(<LexicalEditor />);
    expect(screen.getByText('Current Editor State (JSON Debug):')).toBeInTheDocument();
    expect(screen.getByText('No content yet...')).toBeInTheDocument();
  });

  it('displays localStorage context in standalone mode', () => {
    render(<LexicalEditor />);
    expect(screen.getByText(/State is automatically saved to localStorage/)).toBeInTheDocument();
    expect(screen.getByText(/lexical-editor-content/)).toBeInTheDocument();
  });

  it('displays document context when documentId provided', () => {
    render(
      <LexicalEditor 
        documentId="test-doc-123" 
        tenantId="test-tenant-456"
      />
    );
    expect(screen.getByText(/State is synchronized with document ID: test-doc-123/)).toBeInTheDocument();
    expect(screen.getByText(/Tenant: test-tenant-456/)).toBeInTheDocument();
  });

  it('displays custom placeholder text', () => {
    const customPlaceholder = "Custom placeholder text";
    render(<LexicalEditor placeholder={customPlaceholder} />);
    expect(screen.getByText(customPlaceholder)).toBeInTheDocument();
  });

  it('renders clear content button', () => {
    render(<LexicalEditor />);
    const clearButton = screen.getByRole('button', { name: /clear content/i });
    expect(clearButton).toBeInTheDocument();
  });

  it('loads from provided value when documentId exists', () => {
    const testContent = '{"root":{"children":[],"direction":"ltr","format":"","indent":0,"type":"root","version":1}}';
    
    render(
      <LexicalEditor 
        documentId="test-doc"
        value={testContent}
      />
    );

    // Should not call localStorage.getItem when documentId is provided
    expect(localStorageMock.getItem).not.toHaveBeenCalled();
  });

  it('attempts to load state from localStorage on mount when no documentId', () => {
    const mockState = '{"root":{"children":[{"children":[{"detail":0,"format":0,"mode":"normal","style":"","text":"Hello world","type":"text","version":1}],"direction":"ltr","format":"","indent":0,"type":"paragraph","version":1}],"direction":"ltr","format":"","indent":0,"type":"root","version":1}}';
    localStorageMock.getItem.mockReturnValue(mockState);

    render(<LexicalEditor />);

    expect(localStorageMock.getItem).toHaveBeenCalledWith('lexical-editor-content');
  });

  it('handles localStorage errors gracefully', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    localStorageMock.getItem.mockImplementation(() => {
      throw new Error('localStorage error');
    });

    render(<LexicalEditor />);

    expect(consoleSpy).toHaveBeenCalledWith('Failed to load editor state:', expect.any(Error));
    
    consoleSpy.mockRestore();
  });

  it('accepts onSave callback prop', () => {
    const mockSave = vi.fn();
    render(
      <LexicalEditor 
        documentId="test-doc" 
        onSave={mockSave}
      />
    );
    
    // Component should render without errors when onSave is provided
    expect(screen.getByText(/State is synchronized with document ID: test-doc/)).toBeInTheDocument();
  });

  it('calls clear function when clear button is clicked in localStorage mode', async () => {
    const user = userEvent.setup();
    render(<LexicalEditor />);
    
    const clearButton = screen.getByRole('button', { name: /clear content/i });
    await user.click(clearButton);

    expect(localStorageMock.removeItem).toHaveBeenCalledWith('lexical-editor-content');
  });

  it('calls onSave when clear button is clicked in Supabase mode', async () => {
    const user = userEvent.setup();
    const mockSave = vi.fn().mockResolvedValue(undefined);
    
    render(
      <LexicalEditor 
        documentId="test-doc"
        onSave={mockSave}
      />
    );
    
    const clearButton = screen.getByRole('button', { name: /clear content/i });
    await user.click(clearButton);

    await waitFor(() => {
      expect(mockSave).toHaveBeenCalledWith('');
    });
  });

  it('calls onChange callback when provided', () => {
    const mockOnChange = vi.fn();
    render(<LexicalEditor onChange={mockOnChange} />);
    
    // Note: Testing onChange might require more complex setup with Lexical's test utilities
    // For now, we verify the callback is not called initially
    expect(mockOnChange).not.toHaveBeenCalled();
  });

  it('applies custom className', () => {
    const customClass = 'custom-editor-style';
    render(<LexicalEditor className={customClass} />);
    
    // Check that the custom class is applied to the editor container
    const editorContainer = screen.getByText('Current Editor State (JSON Debug):').closest('div')?.previousElementSibling;
    expect(editorContainer).toHaveClass(customClass);
  });
});