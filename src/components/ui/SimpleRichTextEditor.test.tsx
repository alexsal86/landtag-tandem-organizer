import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type React from 'react';
import type { SpeechDictationCommandDispatch } from '@/hooks/useSpeechDictation';
import SimpleRichTextEditor from './SimpleRichTextEditor';

const updateSpy = vi.fn((callback: () => void) => callback());
const clearSpy = vi.fn();
const appendSpy = vi.fn();
const selectSpy = vi.fn();
const mockRoot = { clear: clearSpy, append: appendSpy, select: selectSpy, getChildrenSize: () => 2 };

let currentEditorHtml = '';
let isListening = false;
let dispatchSpeechCommand: SpeechDictationCommandDispatch;

const mockEditor = {
  update: updateSpy,
  getEditorState: () => ({
    read: (callback: () => void) => callback(),
  }),
  focus: vi.fn(),
  registerUpdateListener: vi.fn(() => () => {}),
  dispatchCommand: vi.fn(),
  getRootElement: vi.fn(() => null),
  setEditable: vi.fn(),
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
  SPEECH_INTERIM_UPDATE_TAG: 'speech-interim',
  useSpeechDictation: ({ dispatchCommand }: { dispatchCommand: SpeechDictationCommandDispatch }) => {
    dispatchSpeechCommand = dispatchCommand;
    return {
      speechError: null,
      interimTranscript: 'Vorläufiges Transkript',
      isListening,
      speechSupported: true,
      lastRecognizedCommand: null,
      sessionStartTime: null,
      sessionWordCount: 0,
      toggleSpeechRecognition: vi.fn(),
      startSpeechRecognition: vi.fn(),
      stopSpeechRecognition: vi.fn(),
    };
  },
}));
vi.mock('@/components/shared/SpeechCommandsDialog', () => ({
  SpeechCommandsDialog: () => <button type="button">Sprachbefehle</button>,
}));
vi.mock('@/components/shared/SpeechSessionStats', () => ({ SpeechSessionStats: () => null }));

vi.mock('@lexical/html', () => ({
  $generateNodesFromDOM: () => ['node'],
  $generateHtmlFromNodes: () => currentEditorHtml,
}));

vi.mock('lexical', async (importOriginal) => ({
  ...await importOriginal<typeof import('lexical')>(),
  $getRoot: () => mockRoot,
  $getSelection: vi.fn(),
  $isRangeSelection: vi.fn(() => false),
  FORMAT_TEXT_COMMAND: 'format',
  REDO_COMMAND: 'redo',
  UNDO_COMMAND: 'undo',
}));

vi.mock('@lexical/list', async (importOriginal) => ({
  ...await importOriginal<typeof import('@lexical/list')>(),
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

describe('SimpleRichTextEditor dictation', () => {
  it('includes the speech command reference in the compact toolbar', () => {
    render(<SimpleRichTextEditor compactToolbar onChange={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Sprachbefehle' })).toBeTruthy();
  });

  it('shows the recording status without repeating the interim transcript', () => {
    isListening = true;
    try {
      render(<SimpleRichTextEditor onChange={vi.fn()} />);

      expect(screen.getByText('Aufnahme läuft…')).toBeTruthy();
      expect(screen.queryByText('Vorläufiges Transkript')).toBeNull();
    } finally {
      isListening = false;
    }
  });

  it('hands the save command to the note workflow', () => {
    const onDictatedSave = vi.fn();
    render(<SimpleRichTextEditor onChange={vi.fn()} onDictatedSave={onDictatedSave} />);

    dispatchSpeechCommand({ type: 'save-note' }, async () => true);

    expect(onDictatedSave).toHaveBeenCalledOnce();
  });

  it('selects the full editor contents on the select-all voice command', () => {
    render(<SimpleRichTextEditor onChange={vi.fn()} />);

    dispatchSpeechCommand({ type: 'select-all' }, async () => true);

    expect(selectSpy).toHaveBeenCalledWith(0, 2);
  });
});
