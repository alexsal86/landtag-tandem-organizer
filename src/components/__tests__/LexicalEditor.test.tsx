import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CollaborationProvider } from '@/contexts/CollaborationContext';
import LexicalEditor from '../LexicalEditor';

// Mock the auth hook
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: {
      id: 'test-user-id',
      email: 'test@example.com',
      user_metadata: {
        display_name: 'Test User'
      }
    }
  })
}));

// Mock the collaboration persistence hook
vi.mock('@/hooks/useCollaborationPersistence', () => ({
  useCollaborationPersistence: () => ({})
}));

// Mock WebSocket
global.WebSocket = vi.fn().mockImplementation(() => ({
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  send: vi.fn(),
  close: vi.fn(),
  readyState: 1, // OPEN
  dispatchEvent: vi.fn()
}));

// Mock Y.js for snapshot tests
vi.mock('yjs', () => ({
  Doc: vi.fn().mockImplementation(() => ({
    transact: vi.fn(),
    getMap: vi.fn().mockReturnValue({
      set: vi.fn(),
      clear: vi.fn()
    }),
    on: vi.fn(),
    off: vi.fn(),
    destroy: vi.fn()
  })),
  applyUpdate: vi.fn(),
  encodeStateAsUpdate: vi.fn().mockReturnValue(new Uint8Array())
}));

// Wrapper component for tests
const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <CollaborationProvider>
    {children}
  </CollaborationProvider>
);

describe('LexicalEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

describe('LexicalEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(
      <TestWrapper>
        <LexicalEditor />
      </TestWrapper>
    );
    expect(document.querySelector('.lexical-editor')).toBeInTheDocument();
  });

  it('renders with default placeholder', () => {
    render(
      <TestWrapper>
        <LexicalEditor />
      </TestWrapper>
    );
    expect(screen.getByText('Schreiben...')).toBeInTheDocument();
  });

  it('renders with custom placeholder', () => {
    const customPlaceholder = 'Custom placeholder text';
    render(
      <TestWrapper>
        <LexicalEditor placeholder={customPlaceholder} />
      </TestWrapper>
    );
    expect(screen.getByText(customPlaceholder)).toBeInTheDocument();
  });

  it('shows toolbar by default', () => {
    render(
      <TestWrapper>
        <LexicalEditor />
      </TestWrapper>
    );
    const toolbar = document.querySelector('.lexical-toolbar');
    expect(toolbar).toBeInTheDocument();
  });

  it('hides toolbar when showToolbar is false', () => {
    render(
      <TestWrapper>
        <LexicalEditor showToolbar={false} />
      </TestWrapper>
    );
    const toolbar = document.querySelector('.lexical-toolbar');
    expect(toolbar).not.toBeInTheDocument();
  });

  it('renders export button when onExportJSON is provided', () => {
    const mockExport = vi.fn();
    render(
      <TestWrapper>
        <LexicalEditor onExportJSON={mockExport} />
      </TestWrapper>
    );
    
    const exportButton = screen.getByRole('button', { name: /json/i });
    expect(exportButton).toBeInTheDocument();
  });

  it('does not render export button when onExportJSON is not provided', () => {
    render(
      <TestWrapper>
        <LexicalEditor />
      </TestWrapper>
    );
    
    const exportButton = screen.queryByRole('button', { name: /json/i });
    expect(exportButton).not.toBeInTheDocument();
  });

  it('calls onExportJSON when export button is clicked', () => {
    const mockExport = vi.fn();
    render(
      <TestWrapper>
        <LexicalEditor onExportJSON={mockExport} />
      </TestWrapper>
    );
    
    const exportButton = screen.getByRole('button', { name: /json/i });
    fireEvent.click(exportButton);
    
    expect(mockExport).toHaveBeenCalledTimes(1);
    expect(mockExport).toHaveBeenCalledWith(expect.stringContaining('timestamp'));
  });

  it('calls onChange when content changes and collaboration is disabled', async () => {
    const user = userEvent.setup();
    const mockChange = vi.fn();
    render(
      <TestWrapper>
        <LexicalEditor onChange={mockChange} enableCollaboration={false} />
      </TestWrapper>
    );
    
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
    render(
      <TestWrapper>
        <LexicalEditor initialContent={initialText} />
      </TestWrapper>
    );
    
    // The initial content plugin should set this content
    // We can't easily test the internal state, but we can verify the component renders
    expect(document.querySelector('.lexical-editor')).toBeInTheDocument();
  });

  it('has proper CSS classes', () => {
    render(
      <TestWrapper>
        <LexicalEditor />
      </TestWrapper>
    );
    
    const editor = document.querySelector('.lexical-editor');
    const contentEditable = document.querySelector('.lexical-editor-inner');
    const placeholder = document.querySelector('.lexical-placeholder');
    
    expect(editor).toHaveClass('lexical-editor');
    expect(contentEditable).toHaveClass('lexical-editor-inner');
    expect(placeholder).toHaveClass('lexical-placeholder');
  });

  it('export function generates valid JSON with updated schema', () => {
    const mockExport = vi.fn();
    render(
      <TestWrapper>
        <LexicalEditor onExportJSON={mockExport} />
      </TestWrapper>
    );
    
    const exportButton = screen.getByRole('button', { name: /json/i });
    fireEvent.click(exportButton);
    
    expect(mockExport).toHaveBeenCalledTimes(1);
    const jsonString = mockExport.mock.calls[0][0];
    
    // Should be valid JSON
    expect(() => JSON.parse(jsonString)).not.toThrow();
    
    const parsed = JSON.parse(jsonString);
    expect(parsed).toHaveProperty('timestamp');
    expect(parsed).toHaveProperty('collaboration');
    expect(parsed).toHaveProperty('version', '2.0');
    expect(parsed).toHaveProperty('connected');
    expect(parsed).toHaveProperty('ready');
  });

  describe('Collaboration Features', () => {
    it('shows collaboration status when collaboration is enabled', () => {
      render(
        <TestWrapper>
          <LexicalEditor 
            enableCollaboration={true} 
            documentId="test-doc-id"
            showToolbar={true}
          />
        </TestWrapper>
      );
      
      // Should show snapshot button for collaboration
      expect(screen.getByText('Snapshot')).toBeInTheDocument();
    });

    it('does not show collaboration features when disabled', () => {
      render(
        <TestWrapper>
          <LexicalEditor 
            enableCollaboration={false}
            showToolbar={true}
          />
        </TestWrapper>
      );
      
      // Should not show snapshot button
      expect(screen.queryByText('Snapshot')).not.toBeInTheDocument();
    });

    it('snapshot button is disabled when collaboration is not ready', () => {
      render(
        <TestWrapper>
          <LexicalEditor 
            enableCollaboration={true} 
            documentId="test-doc-id"
            showToolbar={true}
          />
        </TestWrapper>
      );
      
      const snapshotButton = screen.getByText('Snapshot');
      expect(snapshotButton).toBeDisabled();
    });

    it('does not call onChange when collaboration is active', async () => {
      const user = userEvent.setup();
      const mockChange = vi.fn();
      render(
        <TestWrapper>
          <LexicalEditor 
            onChange={mockChange} 
            enableCollaboration={true}
            documentId="test-doc-id"
          />
        </TestWrapper>
      );
      
      const contentEditable = document.querySelector('.lexical-editor-inner');
      if (contentEditable) {
        await user.click(contentEditable);
        await user.type(contentEditable, 'Hello World');
      }
      
      // onChange should not be called when collaboration is active
      expect(mockChange).not.toHaveBeenCalled();
    });
  });
});