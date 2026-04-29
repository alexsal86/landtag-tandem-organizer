import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type React from 'react';
import SimpleRichTextEditor from './SimpleRichTextEditor';

const updateSpy = vi.fn((callback: () => void) => callback());
const clearSpy = vi.fn();
const appendSpy = vi.fn();
const mockRoot = { clear: clearSpy, append: appendSpy };

let currentEditorHtml = '';

const mockEditor = {
  update: updateSpy,
  getEditorState: () => ({
    read: (callback: () => void) => callback(),
  }),
  focus: vi.fn(),
  registerUpdateListener: vi.fn(() => () => {}),
  dispatchCommand: vi.fn(),
  getRootElement: vi.fn(() => null),
};

vi.mock('@lexical/react/LexicalComposerContext', () => ({
  useLexicalComposerContext: () => [mockEditor],
}));

vi.mock('@lexical/react/LexicalComposer', () => ({
  LexicalComposer: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@lexical/react/LexicalRichTextPlugin', () => ({
  RichTextPlugin: ({ contentEditable }: { contentEditable: React.ReactNode }) => <>{contentEditable}</>,
}));

vi.mock('@lexical/react/LexicalContentEditable', () => ({
  ContentEditable: (props: React.HTMLProps<HTMLDivElement>) => <div data-testid="content-editable" {...props} />,
}));

vi.mock('@lexical/react/LexicalHistoryPlugin', () => ({ HistoryPlugin: () => null }));
vi.mock('@lexical/react/LexicalOnChangePlugin', () => ({ OnChangePlugin: () => null }));
vi.mock('@lexical/react/LexicalListPlugin', () => ({ ListPlugin: () => null }));
vi.mock('@/components/plugins/MentionsPlugin', () => ({ MentionsPlugin: () => null }));
vi.mock('@/hooks/useSpeechDictation', () => ({
  useSpeechDictation: () => ({
    speechError: null,
    interimTranscript: '',
    isListening: false,
    speechSupported: false,
    lastRecognizedCommand: null,
    sessionStartTime: null,
    sessionWordCount: 0,
    toggleSpeechRecognition: vi.fn(),
    startSpeechRecognition: vi.fn(),
    stopSpeechRecognition: vi.fn(),
  }),
}));
vi.mock('@/components/shared/SpeechCommandsDialog', () => ({ SpeechCommandsDialog: () => null }));
vi.mock('@/components/shared/SpeechSessionStats', () => ({ SpeechSessionStats: () => null }));

vi.mock('@lexical/html', () => ({
  $generateNodesFromDOM: () => ['node'],
  $generateHtmlFromNodes: () => currentEditorHtml,
}));

vi.mock('lexical', () => ({
  $getRoot: () => mockRoot,
  $getSelection: vi.fn(),
  $isRangeSelection: vi.fn(() => false),
  FORMAT_TEXT_COMMAND: 'format',
  REDO_COMMAND: 'redo',
  UNDO_COMMAND: 'undo',
}));

vi.mock('@lexical/list', () => ({
  ListNode: function ListNode() {},
  ListItemNode: function ListItemNode() {},
  INSERT_ORDERED_LIST_COMMAND: 'ordered',
  INSERT_UNORDERED_LIST_COMMAND: 'unordered',
}));

vi.mock('@lexical/react/LexicalErrorBoundary', () => ({ LexicalErrorBoundary: () => null }));

describe('SimpleRichTextEditor rehydrate behavior', () => {
  beforeEach(() => {
    currentEditorHtml = '';
    updateSpy.mockClear();
    clearSpy.mockClear();
    appendSpy.mockClear();
  });

  it('rehydrates when contentVersion changes', () => {
    const { rerender } = render(
      <SimpleRichTextEditor
        initialContent="<p>Alpha</p>"
        contentVersion="v1"
        onChange={vi.fn()}
      />,
    );

    expect(updateSpy).toHaveBeenCalledTimes(1);

    currentEditorHtml = '<p>Local edit</p>';

    rerender(
      <SimpleRichTextEditor
        initialContent="<p>Bravo</p>"
        contentVersion="v2"
        onChange={vi.fn()}
      />,
    );

    expect(updateSpy).toHaveBeenCalledTimes(2);
    expect(clearSpy).toHaveBeenCalledTimes(2);
    expect(appendSpy).toHaveBeenCalledTimes(2);
  });

  it('does not rehydrate when key is unchanged, preserving local edits', () => {
    const { rerender } = render(
      <SimpleRichTextEditor
        initialContent="<p>Original</p>"
        contentVersion="stable"
        onChange={vi.fn()}
      />,
    );

    expect(updateSpy).toHaveBeenCalledTimes(1);

    updateSpy.mockClear();
    clearSpy.mockClear();
    appendSpy.mockClear();

    currentEditorHtml = '<p>Lokale Änderung</p>';

    rerender(
      <SimpleRichTextEditor
        initialContent="<p>Server-Wert</p>"
        contentVersion="stable"
        onChange={vi.fn()}
      />,
    );

    expect(updateSpy).not.toHaveBeenCalled();
    expect(clearSpy).not.toHaveBeenCalled();
    expect(appendSpy).not.toHaveBeenCalled();
  });
});
