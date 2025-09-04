import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { HeadingNode, QuoteNode } from '@lexical/rich-text';
import LexicalToolbar from '../LexicalToolbar';

// Mock implementation for tests
const mockInitialConfig = {
  namespace: 'TestEditor',
  theme: {},
  onError: () => {},
  nodes: [HeadingNode, QuoteNode],
};

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <LexicalComposer initialConfig={mockInitialConfig}>
    {children}
  </LexicalComposer>
);

describe('LexicalToolbar', () => {
  it('renders all toolbar buttons', () => {
    render(
      <TestWrapper>
        <LexicalToolbar />
      </TestWrapper>
    );

    // Check text formatting buttons using title attribute
    expect(screen.getByTitle('Fett')).toBeInTheDocument();
    expect(screen.getByTitle('Kursiv')).toBeInTheDocument();
    expect(screen.getByTitle('Unterstrichen')).toBeInTheDocument();

    // Check heading buttons
    expect(screen.getByTitle('Überschrift 1')).toBeInTheDocument();
    expect(screen.getByTitle('Überschrift 2')).toBeInTheDocument();
    expect(screen.getByTitle('Überschrift 3')).toBeInTheDocument();
    expect(screen.getByTitle('Normal')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const customClass = 'custom-toolbar-class';
    render(
      <TestWrapper>
        <LexicalToolbar className={customClass} />
      </TestWrapper>
    );

    const toolbar = document.querySelector('.lexical-toolbar');
    expect(toolbar).toHaveClass('lexical-toolbar');
    expect(toolbar).toHaveClass(customClass);
  });

  it('renders toolbar with proper structure', () => {
    render(
      <TestWrapper>
        <LexicalToolbar />
      </TestWrapper>
    );

    // Check for toolbar groups
    const toolbarGroups = document.querySelectorAll('.toolbar-group');
    expect(toolbarGroups).toHaveLength(2);

    // Check for toolbar divider
    const divider = document.querySelector('.toolbar-divider');
    expect(divider).toBeInTheDocument();
  });

  it('buttons have correct visual elements', () => {
    render(
      <TestWrapper>
        <LexicalToolbar />
      </TestWrapper>
    );

    // Bold button should have <strong>B</strong>
    const boldButton = screen.getByTitle('Fett');
    expect(boldButton.querySelector('strong')).toHaveTextContent('B');

    // Italic button should have <em>I</em>
    const italicButton = screen.getByTitle('Kursiv');
    expect(italicButton.querySelector('em')).toHaveTextContent('I');

    // Underline button should have <u>U</u>
    const underlineButton = screen.getByTitle('Unterstrichen');
    expect(underlineButton.querySelector('u')).toHaveTextContent('U');
  });

  it('can be clicked without errors', () => {
    render(
      <TestWrapper>
        <LexicalToolbar />
      </TestWrapper>
    );

    const boldButton = screen.getByTitle('Fett');
    
    // Should not throw when clicked
    expect(() => {
      fireEvent.click(boldButton);
    }).not.toThrow();
  });
});