import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { $createTextNode, $getNodeByKey, $getSelection, $isRangeSelection, $setSelection, TextNode, type LexicalEditor, type RangeSelection } from 'lexical';
import { WebSpeechToTextAdapter, type SpeechToTextError, type SpeechToTextState } from '@/lib/speechToTextAdapter';
import { formatDictatedText, getSpeechCommandLabel, parseSpeechInput, type SpeechCommand } from '@/lib/speechCommandUtils';
import { playTone } from '@/lib/speechAudioFeedback';

export type SpeechDictationInsertText = (text: string) => void;
export type SpeechDictationCommandDispatch = (
  command: SpeechCommand,
  finishDictation: () => Promise<boolean>,
) => void;

export const SPEECH_INTERIM_UPDATE_TAG = 'speech-interim';

interface UseSpeechDictationOptions {
  editor: LexicalEditor;
  insertText: SpeechDictationInsertText;
  dispatchCommand: SpeechDictationCommandDispatch;
}

export const useSpeechDictation = ({ editor, insertText, dispatchCommand }: UseSpeechDictationOptions) => {
  const [speechState, setSpeechState] = useState<SpeechToTextState>('idle');
  const speechStateRef = useRef<SpeechToTextState>('idle');
  const lastSelectionRef = useRef<RangeSelection | null>(null);
  const [speechError, setSpeechError] = useState<SpeechToTextError | null>(null);
  const [interimTranscript, setInterimTranscript] = useState('');

  // Command feedback state
  const [lastRecognizedCommand, setLastRecognizedCommand] = useState<string | null>(null);
  const commandFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Session statistics
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
  const [sessionWordCount, setSessionWordCount] = useState(0);

  const interimNodeKeyRef = useRef<string | null>(null);
  const lastInsertedSegmentRef = useRef('');

  const insertTextRef = useRef(insertText);
  insertTextRef.current = insertText;
  const dispatchCommandRef = useRef(dispatchCommand);
  dispatchCommandRef.current = dispatchCommand;

  const speechAdapter = useMemo(() => new WebSpeechToTextAdapter(), []);
  const stopSpeechRecognition = useCallback(() => speechAdapter.stop(), [speechAdapter]);

  const showCommandFeedback = useCallback((command: SpeechCommand) => {
    const label = getSpeechCommandLabel(command);
    setLastRecognizedCommand(label);
    if (commandFeedbackTimerRef.current) clearTimeout(commandFeedbackTimerRef.current);
    commandFeedbackTimerRef.current = setTimeout(() => setLastRecognizedCommand(null), 1200);
    playTone('command');
  }, []);

  // Takes the interim node out of the ref WITHOUT removing it from the editor tree.
  // The caller is responsible for replacing or removing it.
  const takeInterimNode = useCallback(() => {
    const interimNodeKey = interimNodeKeyRef.current;
    if (!interimNodeKey) return null;

    interimNodeKeyRef.current = null;
    const interimNode = $getNodeByKey(interimNodeKey);
    if (interimNode instanceof TextNode) {
      return interimNode;
    }

    return null;
  }, []);

  // Removes the interim node from the editor tree and clears the ref.
  const clearInterimNode = useCallback(() => {
    const interimNodeKey = interimNodeKeyRef.current;
    if (!interimNodeKey) return;

    interimNodeKeyRef.current = null;
    const interimNode = $getNodeByKey(interimNodeKey);
    if (interimNode instanceof TextNode) {
      interimNode.remove();
    }
  }, []);

  const updateInterimNode = useCallback((text: string) => {
    if (!text && !interimNodeKeyRef.current) return;
    // Publish pending final text and commands before applying the interim-only tag.
    editor.read(() => {});
    editor.update(() => {
      const interimNodeKey = interimNodeKeyRef.current;
      if (interimNodeKey) {
        const interimNode = $getNodeByKey(interimNodeKey);
        if (interimNode instanceof TextNode) {
          if (!text) {
            interimNode.remove();
            interimNodeKeyRef.current = null;
            return;
          }

          interimNode.setTextContent(text);
          return;
        }

        interimNodeKeyRef.current = null;
      }

      if (!text) return;

      const selection = $getSelection();
      if (!$isRangeSelection(selection) || !selection.isCollapsed()) return;

      const node = $createTextNode(text);
      node.setStyle('opacity: 0.65; font-style: italic;');
      selection.insertNodes([node]);
      interimNodeKeyRef.current = node.getKey();
    }, { tag: SPEECH_INTERIM_UPDATE_TAG, discrete: true });
  }, [editor]);

  const commitContentText = useCallback((contentText: string) => {
    const formattedText = formatDictatedText(contentText);

    // Dedup guard: skip if identical to last inserted segment
    if (formattedText && lastInsertedSegmentRef.current === formattedText) {
      // Still clean up interim node if present
      editor.update(() => { clearInterimNode(); });
      setInterimTranscript('');
      return;
    }

    // Count words for session stats
    if (formattedText) {
      const wordCount = formattedText.split(/\s+/).filter(Boolean).length;
      setSessionWordCount((prev) => prev + wordCount);
    }

    editor.update(() => {
      const shouldAddTrailingSpace =
        !!formattedText && !formattedText.endsWith('\n') && !/[,.;:!?„]$/.test(formattedText);
      const textToInsert = formattedText
        ? shouldAddTrailingSpace
          ? `${formattedText} `
          : formattedText
        : '';

      // takeInterimNode leaves the node in the tree so replace() works
      const interimNode = takeInterimNode();
      if (interimNode instanceof TextNode) {
        const previous = interimNode.getPreviousSibling();
        if (textToInsert.startsWith('“') && previous instanceof TextNode && previous.getTextContent().endsWith(' ')) {
          previous.spliceText(previous.getTextContentSize() - 1, 1, '');
        }
        if (textToInsert) {
          interimNode.replace($createTextNode(textToInsert));
          lastInsertedSegmentRef.current = formattedText;
        } else {
          interimNode.remove();
        }
        return;
      }

      if (!textToInsert) return;

      if (!$isRangeSelection($getSelection())) {
        const lastSelection = lastSelectionRef.current;
        if (lastSelection && [lastSelection.anchor.key, lastSelection.focus.key]
          .every(key => $getNodeByKey(key)?.isAttached())) {
          $setSelection(lastSelection.clone());
        }
      }
      const selection = $getSelection();
      if (textToInsert.startsWith('“') && $isRangeSelection(selection) && selection.isCollapsed()) {
        const { anchor } = selection;
        const node = anchor.getNode();
        if (node instanceof TextNode && node.getTextContent()[anchor.offset - 1] === ' ') {
          node.spliceText(anchor.offset - 1, 1, '', true);
        }
      }
      let insertion = textToInsert;
      if (shouldAddTrailingSpace && $isRangeSelection(selection) && !selection.isCollapsed()) {
        const end = selection.isBackward() ? selection.anchor : selection.focus;
        const node = end.getNode();
        const following = node instanceof TextNode ? node.getTextContent().charAt(end.offset) : '';
        if (following === ' ' || following === '\u00a0') insertion = formattedText;
      }
      insertTextRef.current(insertion);
      lastInsertedSegmentRef.current = formattedText;
    });

    setInterimTranscript('');
  }, [editor, takeInterimNode, clearInterimNode]);

  // Setup effect
  useEffect(() => {
    const unregisterSelection = editor.registerUpdateListener(({ editorState }) => {
      if (speechStateRef.current !== 'listening' && speechStateRef.current !== 'stopping') return;
      editorState.read(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) lastSelectionRef.current = selection.clone();
      });
    });

    speechAdapter.onStateChange = (state) => {
      const previousState = speechStateRef.current;
      speechStateRef.current = state;
      if (state === 'listening' && previousState !== 'listening') {
        playTone('start');
        setSessionStartTime(Date.now());
        setSessionWordCount(0);
        lastInsertedSegmentRef.current = '';
        lastSelectionRef.current = editor.read(() => {
          const selection = $getSelection();
          return $isRangeSelection(selection) ? selection.clone() : null;
        });
      } else if (state === 'idle' && (previousState === 'listening' || previousState === 'stopping')) {
        editor.update(clearInterimNode, { discrete: true });
        lastSelectionRef.current = null;
        setInterimTranscript('');
        setSessionStartTime(null);
        playTone('stop');
      }
      setSpeechState(state);
    };
    speechAdapter.onError = setSpeechError;

    speechAdapter.onInterimTranscript = (text) => {
      setInterimTranscript(text);
      updateInterimNode(text);
    };

    speechAdapter.onFinalTranscript = (text) => {
      const { command, contentText } = parseSpeechInput(text);

      if (command) {
        showCommandFeedback(command);

        if (contentText) {
          commitContentText(contentText);
        } else {
          editor.update(() => {
            clearInterimNode();
          });
          setInterimTranscript('');
        }

        if (command.type === 'stop-listening') {
          speechAdapter.stop();
          return;
        }

        dispatchCommandRef.current(command, stopSpeechRecognition);
        return;
      }

      commitContentText(contentText || text);
    };

    if (!speechAdapter.supported) {
      setSpeechState('unsupported');
    }

    return () => {
      unregisterSelection();
      speechAdapter.onStateChange = undefined;
      speechAdapter.destroy();
      speechStateRef.current = 'idle';
      lastSelectionRef.current = null;
      if (commandFeedbackTimerRef.current) clearTimeout(commandFeedbackTimerRef.current);
    };
  }, [clearInterimNode, commitContentText, editor, showCommandFeedback, speechAdapter, stopSpeechRecognition, updateInterimNode]);

  const startSpeechRecognition = useCallback(() => {
    if (!speechAdapter.supported || !editor.isEditable()) return;
    if (speechStateRef.current === 'listening' || speechStateRef.current === 'stopping') return;

    setSpeechError(null);
    speechAdapter.start();
    editor.focus();
  }, [editor, speechAdapter]);

  const toggleSpeechRecognition = useCallback(() => {
    if (speechStateRef.current === 'listening') {
      void stopSpeechRecognition();
      return;
    }

    startSpeechRecognition();
  }, [startSpeechRecognition, stopSpeechRecognition]);

  return {
    speechState,
    speechError,
    interimTranscript,
    isListening: speechState === 'listening',
    speechSupported: speechAdapter.supported,
    lastRecognizedCommand,
    sessionStartTime,
    sessionWordCount,
    startSpeechRecognition,
    stopSpeechRecognition,
    toggleSpeechRecognition,
  };
};
