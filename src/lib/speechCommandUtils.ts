export type SpeechCommand =
  | { type: 'stop-listening' }
  | { type: 'toggle-format'; format: 'bold' | 'italic' | 'underline' }
  | { type: 'insert-list'; listType: 'unordered' | 'ordered' }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'insert-newline' };

const COMMAND_PHRASES: Array<{ command: SpeechCommand; phrases: string[] }> = [
  {
    command: { type: 'stop-listening' },
    phrases: [
      'stopp',
      'stop',
      'aufnahme stoppen',
      'diktat stoppen',
      'aufnahme aus',
      'mikro aus',
      'mikrofon aus',
      'diktat aus',
      'aufnahme abstellen',
      'mikro abstellen',
      'diktat beenden',
    ],
  },
  { command: { type: 'toggle-format', format: 'bold' }, phrases: ['fett', 'fett markieren'] },
  { command: { type: 'toggle-format', format: 'italic' }, phrases: ['kursiv'] },
  { command: { type: 'toggle-format', format: 'underline' }, phrases: ['unterstreichen', 'unterstrichen'] },
  { command: { type: 'insert-list', listType: 'unordered' }, phrases: ['aufzählung', 'liste'] },
  { command: { type: 'insert-list', listType: 'ordered' }, phrases: ['nummerierte liste'] },
  { command: { type: 'undo' }, phrases: ['rückgängig'] },
  { command: { type: 'redo' }, phrases: ['wiederholen', 'wiederherstellen'] },
  { command: { type: 'insert-newline' }, phrases: ['neue zeile', 'neuer absatz'] },
];

const PUNCTUATION_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\b(punkt)\b/gi, '.'],
  [/\b(komma)\b/gi, ','],
  [/\b(fragezeichen)\b/gi, '?'],
  [/\b(ausrufezeichen)\b/gi, '!'],
  [/\b(doppelpunkt)\b/gi, ':'],
  [/\b(semikolon)\b/gi, ';'],
  [/\b(neue zeile|zeilenumbruch|neuer absatz)\b/gi, '\n'],
];

export const normalizeSpeechText = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[,:;!?]/g, ' ')
    .trim()
    .replace(/[.!?]+$/g, '')
    .replace(/\b(ähm|äh|hm|bitte|jetzt|mal|einmal|doch|kurz|okay|ok|hey|hallo|servus|guten\s+tag)\b/g, ' ')
    .replace(/\b(kannst\s+du|könntest\s+du|würdest\s+du|mach\s+mal|machst\s+du)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const STOP_COMMAND_PATTERNS: RegExp[] = [
  /\bstop+p?\b/i,
  /\b(stopp|stop)\s+(bitte|jetzt|mal)?\b/i,
  /\b(aufnahme|mikro(?:fon)?|diktat)\s+(aus|abstellen|stoppen?|beenden?)\b/i,
  /\bbeende\s+(aufnahme|mikro(?:fon)?|diktat)\b/i,
  /\b(ausmachen|abschalten)\s+(aufnahme|mikro(?:fon)?|diktat)\b/i,
];

const STOP_KEYWORDS = ['stopp', 'stop', 'aufnahme aus', 'mikro aus', 'mikrofon aus', 'diktat aus'];

const containsStopKeyword = (text: string): boolean =>
  STOP_KEYWORDS.some((keyword) => text.includes(keyword));

const PURE_STOP_COMMAND_PATTERNS: RegExp[] = [
  /^(stopp|stop+p?)$/i,
  /^(stopp|stop)\s+(bitte|jetzt|mal)$/i,
  /^(aufnahme|mikro(?:fon)?|diktat)\s+(aus|abstellen|stoppen?|beenden?)$/i,
  /^beende\s+(aufnahme|mikro(?:fon)?|diktat)$/i,
  /^(ausmachen|abschalten)\s+(aufnahme|mikro(?:fon)?|diktat)$/i,
];

const TRAILING_STOP_COMMAND_PATTERNS: RegExp[] = [
  /^(?<content>.*?)[,;:.!?\s-]+(?:stopp|stop+p?)\s*[.!?]*$/i,
  /^(?<content>.*?)[,;:.!?\s-]+(?:stopp|stop)\s+(?:bitte|jetzt|mal)\s*[.!?]*$/i,
  /^(?<content>.*?)[,;:.!?\s-]+(?:aufnahme|mikro(?:fon)?|diktat)\s+(?:aus|abstellen|stoppen?|beenden?)\s*[.!?]*$/i,
  /^(?<content>.*?)[,;:.!?\s-]+beende\s+(?:aufnahme|mikro(?:fon)?|diktat)\s*[.!?]*$/i,
  /^(?<content>.*?)[,;:.!?\s-]+(?:ausmachen|abschalten)\s+(?:aufnahme|mikro(?:fon)?|diktat)\s*[.!?]*$/i,
];

const isPureStopCommand = (normalizedText: string): boolean =>
  PURE_STOP_COMMAND_PATTERNS.some((pattern) => pattern.test(normalizedText));

export const detectSpeechCommand = (text: string): SpeechCommand | null => {
  const normalized = normalizeSpeechText(text);

  if (containsStopKeyword(normalized) || STOP_COMMAND_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return { type: 'stop-listening' };
  }

  for (const { command, phrases } of COMMAND_PHRASES) {
    if (phrases.includes(normalized) || phrases.some((phrase) => normalized.includes(phrase))) {
      return command;
    }
  }

  return null;
};


export const splitTranscriptAndCommand = (text: string): { contentText: string; command: SpeechCommand | null } => {
  const transcript = text.trim();

  if (!transcript) {
    return { contentText: '', command: null };
  }

  for (const pattern of TRAILING_STOP_COMMAND_PATTERNS) {
    const match = transcript.match(pattern);
    const contentText = match?.groups?.content?.trim() ?? '';

    if (contentText) {
      return { contentText, command: { type: 'stop-listening' } };
    }
  }

  const command = detectSpeechCommand(transcript);
  if (command?.type === 'stop-listening') {
    const normalized = normalizeSpeechText(transcript);
    if (!isPureStopCommand(normalized)) {
      return { contentText: transcript, command: null };
    }
  }

  return { contentText: command ? '' : transcript, command };
};

export const formatDictatedText = (text: string): string => {
  let formatted = text.trim();
  for (const [pattern, replacement] of PUNCTUATION_REPLACEMENTS) {
    formatted = formatted.replace(pattern, replacement);
  }

  return formatted
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/\n\s+/g, '\n')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim();
};
