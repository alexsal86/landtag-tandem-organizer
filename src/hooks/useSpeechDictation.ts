import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { $createTextNode, $getNodeByKey, $getSelection, $isRangeSelection, TextNode, type LexicalEditor } from 'lexical';
import { WebSpeechToTextAdapter, type SpeechToTextError, type SpeechToTextState } from '@/lib/speechToTextAdapter';
import { formatDictatedText, getSpeechCommandLabel, parseSpeechInput, type SpeechCommand } from '@/lib/speechCommandUtils';
import { playTone } from '@/lib/speechAudioFeedback';

export type SpeechDictationInsertText = (text: string) => void;
export type SpeechDictationCommandDispatch = (command: SpeechCommand) => void;

interface UseSpeechDictationOptions {
  editor: LexicalEditor;
  insertText: SpeechDictationInsertText;
  dispatchCommand: SpeechDictationCommandDispatch;
}

export const useSpeechDictation = ({ editor, insertText, dispatchCommand }: UseSpeechDictationOptions) => {
  const [speechState, setSpeechState] = useState<SpeechToTextState>('idle');
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
      if (!$isRangeSelection(selection)) return;

      const node = $createTextNode(text);
      node.setStyle('opacity: 0.65; font-style: italic;');
      selection.insertNodes([node]);
      interimNodeKeyRef.current = node.getKey();
    });
  }, [editor]);

  const commitContentText = useCallback((contentText: string) => {
    const formattedText = formatDictatedText(contentText);

    // Count words for session stats
    if (formattedText) {
      const wordCount = formattedText.split(/\s+/).filter(Boolean).length;
      setSessionWordCount((prev) => prev + wordCount);
    }

    editor.update(() => {
      const shouldAddTrailingSpace =
        !!formattedText && !formattedText.endsWith('\n') && !/[,.;:!?]$/.test(formattedText);
      const textToInsert = formattedText
        ? shouldAddTrailingSpace
          ? `${formattedText} `
          : formattedText
        : '';

      // takeInterimNode leaves the node in the tree so replace() works
      const interimNode = takeInterimNode();
      if (interimNode instanceof TextNode) {
        if (textToInsert) {
          interimNode.replace($createTextNode(textToInsert));
          lastInsertedSegmentRef.current = textToInsert;
        } else {
          interimNode.remove();
        }
        return;
      }

      if (!textToInsert || lastInsertedSegmentRef.current === textToInsert) return;

      insertTextRef.current(textToInsert);
      lastInsertedSegmentRef.current = textToInsert;
    });

    setInterimTranscript('');
  }, [editor, takeInterimNode]);

  // Setup effect
  useEffect(() => {
    speechAdapter.onStateChange = (state) => {
      setSpeechState(state);
      if (state === 'listening') {
        playTone('start');
        setSessionStartTime(Date.now());
        setSessionWordCount(0);
        lastInsertedSegmentRef.current = '';
      } else if (state === 'idle') {
        playTone('stop');
        setSessionStartTime(null);
        // Clean up any leftover interim node
        editor.update(() => {
          clearInterimNode();
        });
        setInterimTranscript('');
      }
    };
    speechAdapter.onError = setSpeechError;

    speechAdapter.onInterimTranscript = (text) => {
      const { command, contentText } = parseSpeechInput(text);
      setInterimTranscript(contentText);
      updateInterimNode(contentText);

      if (command?.type === 'stop-listening') {
        if (contentText) {
          commitContentText(contentText);
        } else {
          editor.update(() => {
            removeInterimNode();
          });
          setInterimTranscript('');
        }
        speechAdapter.stop();
      }
    };

    speechAdapter.onFinalTranscript = (text) => {
      const { command, contentText } = parseSpeechInput(text);

      if (command) {
        showCommandFeedback(command);

        if (contentText) {
          commitContentText(contentText);
        } else {
          editor.update(() => {
            removeInterimNode();
          });
          setInterimTranscript('');
        }

        if (command.type === 'stop-listening') {
          if (!contentText) {
            speechAdapter.stop();
          }
          return;
        }

        dispatchCommandRef.current(command);
        return;
      }

      commitContentText(contentText || text);
    };

    if (!speechAdapter.supported) {
      setSpeechState('unsupported');
    }

    return () => {
      speechAdapter.destroy();
      if (commandFeedbackTimerRef.current) clearTimeout(commandFeedbackTimerRef.current);
    };
  }, [commitContentText, editor, removeInterimNode, showCommandFeedback, speechAdapter, updateInterimNode]);

  const startSpeechRecognition = useCallback(() => {
    if (!speechAdapter.supported) return;
    if (speechState === 'listening') return;

    setSpeechError(null);
    speechAdapter.start();
    editor.focus();
  }, [editor, speechAdapter, speechState]);

  const stopSpeechRecognition = useCallback(() => {
    if (!speechAdapter.supported) return;
    if (speechState !== 'listening') return;

    speechAdapter.stop();
  }, [speechAdapter, speechState]);

  const toggleSpeechRecognition = useCallback(() => {
    if (!speechAdapter.supported) return;

    if (speechState === 'listening') {
      stopSpeechRecognition();
      return;
    }

    startSpeechRecognition();
  }, [speechAdapter, speechState, startSpeechRecognition, stopSpeechRecognition]);

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
