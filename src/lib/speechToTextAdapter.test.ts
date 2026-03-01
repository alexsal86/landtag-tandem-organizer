import { WebSpeechToTextAdapter } from './speechToTextAdapter';

type MockSpeechRecognitionInstance = {
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
};

const createSpeechRecognitionEvent = (segments: string[]): SpeechRecognitionEvent => {
  const results = segments.map((segment) => {
    const alternative = { transcript: segment, confidence: 1 } as SpeechRecognitionAlternative;
    return {
      0: alternative,
      length: 1,
      isFinal: true,
      item: (index: number) => [alternative][index],
    } as unknown as SpeechRecognitionResult;
  });

  const resultList = {
    length: results.length,
    item: (index: number) => results[index],
    ...results,
  } as unknown as SpeechRecognitionResultList;

  return {
    resultIndex: 0,
    results: resultList,
  } as SpeechRecognitionEvent;
};

describe('WebSpeechToTextAdapter', () => {
  const originalSpeechRecognition = window.SpeechRecognition;
  const originalWebkitSpeechRecognition = window.webkitSpeechRecognition;

  afterEach(() => {
    window.SpeechRecognition = originalSpeechRecognition;
    window.webkitSpeechRecognition = originalWebkitSpeechRecognition;
  });

  it('emits only new final transcript deltas across cumulative recognition events', () => {
    const instances: MockSpeechRecognitionInstance[] = [];

    class MockSpeechRecognition {
      onresult: ((event: SpeechRecognitionEvent) => void) | null = null;
      onerror: ((event: SpeechRecognitionErrorEvent) => void) | null = null;
      onend: (() => void) | null = null;
      lang = '';
      continuous = false;
      interimResults = false;
      maxAlternatives = 1;
      start = vi.fn();
      stop = vi.fn();

      constructor() {
        instances.push(this);
      }
    }

    window.SpeechRecognition = MockSpeechRecognition as unknown as typeof SpeechRecognition;
    window.webkitSpeechRecognition = undefined;

    const adapter = new WebSpeechToTextAdapter();
    const emittedSegments: string[] = [];

    adapter.onFinalTranscript = (text) => {
      emittedSegments.push(text);
    };

    adapter.start();

    const recognition = instances[0];
    expect(recognition).toBeDefined();

    recognition.onresult?.(createSpeechRecognitionEvent(['in']));
    recognition.onresult?.(createSpeechRecognitionEvent(['in Karlsruhe']));
    recognition.onresult?.(createSpeechRecognitionEvent(['in Karlsruhe scheint die Sonne']));

    expect(emittedSegments).toEqual(['in', 'Karlsruhe', 'scheint die Sonne']);
    expect(emittedSegments.join(' ')).toBe('in Karlsruhe scheint die Sonne');
  });
});
