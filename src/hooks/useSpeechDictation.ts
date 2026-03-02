import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { $createTextNode, $getNodeByKey, $getSelection, $isRangeSelection, TextNode, type LexicalEditor } from 'lexical';
import { WebSpeechToTextAdapter, type SpeechToTextError, type SpeechToTextState } from '@/lib/speechToTextAdapter';
import { formatDictatedText, parseSpeechInput, type SpeechCommand } from '@/lib/speechCommandUtils';

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

  const interimNodeKeyRef = useRef<string | null>(null);
  const lastInsertedSegmentRef = useRef('');

  // Stabilize callbacks via refs so the setup effect doesn't re-run on every render
  const insertTextRef = useRef(insertText);
  insertTextRef.current = insertText;
  const dispatchCommandRef = useRef(dispatchCommand);
  dispatchCommandRef.current = dispatchCommand;

  const speechAdapter = useMemo(() => new WebSpeechToTextAdapter(), []);

  const removeInterimNode = useCallback(() => {
    const interimNodeKey = interimNodeKeyRef.current;
    if (!interimNodeKey) return null;

    const interimNode = $getNodeByKey(interimNodeKey);
    if (interimNode instanceof TextNode) {
      interimNode.remove();
      interimNodeKeyRef.current = null;
      return interimNode;
    }

    interimNodeKeyRef.current = null;
    return null;
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

    editor.update(() => {
      const shouldAddTrailingSpace =
        !!formattedText && !formattedText.endsWith('\n') && !/[,.;:!?]$/.test(formattedText);
      const textToInsert = formattedText
        ? shouldAddTrailingSpace
          ? `${formattedText} `
          : formattedText
        : '';

      const interimNode = removeInterimNode();
      if (interimNode instanceof TextNode) {
        if (textToInsert) {
          interimNode.replace($createTextNode(textToInsert));
          lastInsertedSegmentRef.current = textToInsert;
        }
        return;
      }

      if (!textToInsert || lastInsertedSegmentRef.current === textToInsert) return;

      insertTextRef.current(textToInsert);
      lastInsertedSegmentRef.current = textToInsert;
    });

    setInterimTranscript('');
  }, [editor, removeInterimNode]);

  // Setup effect: only depends on stable references (editor, speechAdapter, memoized callbacks)
  useEffect(() => {
    speechAdapter.onStateChange = setSpeechState;
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
    };
  }, [commitContentText, editor, removeInterimNode, speechAdapter, updateInterimNode]);

  const toggleSpeechRecognition = useCallback(() => {
    if (!speechAdapter.supported) return;

    if (speechState === 'listening') {
      speechAdapter.stop();
      return;
    }

    setSpeechError(null);
    speechAdapter.start();
    editor.focus();
  }, [editor, speechAdapter, speechState]);

  return {
    speechState,
    speechError,
    interimTranscript,
    isListening: speechState === 'listening',
    speechSupported: speechAdapter.supported,
    toggleSpeechRecognition,
  };
};
