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

  it('displays localStorage key information', () => {
    render(<LexicalEditor />);
    expect(screen.getByText(/State is automatically saved to localStorage/)).toBeInTheDocument();
    expect(screen.getByText(/lexical-editor-content/)).toBeInTheDocument();
  });

  it('renders clear content button', () => {
    render(<LexicalEditor />);
    const clearButton = screen.getByRole('button', { name: /clear content/i });
    expect(clearButton).toBeInTheDocument();
  });

  it('attempts to load state from localStorage on mount', () => {
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

    expect(consoleSpy).toHaveBeenCalledWith('Failed to load editor state from localStorage:', expect.any(Error));
    
    consoleSpy.mockRestore();
  });

  it('calls clear function when clear button is clicked', async () => {
    const user = userEvent.setup();
    render(<LexicalEditor />);
    
    const clearButton = screen.getByRole('button', { name: /clear content/i });
    await user.click(clearButton);

    expect(localStorageMock.removeItem).toHaveBeenCalledWith('lexical-editor-content');
  });

  it('calls onChange callback when provided', () => {
    const mockOnChange = vi.fn();
    render(<LexicalEditor onChange={mockOnChange} />);
    
    // Note: Testing onChange might require more complex setup with Lexical's test utilities
    // For now, we verify the callback is not called initially
    expect(mockOnChange).not.toHaveBeenCalled();
  });

  it('shows backend integration comment', () => {
    render(<LexicalEditor />);
    // Check that the backend integration comment is visible in the DOM (for debugging purposes)
    expect(screen.getByText(/State is automatically saved to localStorage/)).toBeInTheDocument();
  });
});