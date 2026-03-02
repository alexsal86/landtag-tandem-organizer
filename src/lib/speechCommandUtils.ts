export type SpeechCommand =
  | { type: 'stop-listening' }
  | { type: 'toggle-format'; format: 'bold' | 'italic' | 'underline' }
  | { type: 'insert-list'; listType: 'unordered' | 'ordered' }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'insert-newline' };

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
  /^stop+p?$/i,
  /^(aufnahme|mikro(?:fon)?|diktat)\s+(aus|abstellen|stoppen?|beenden?)$/i,
  /^beende\s+(aufnahme|mikro(?:fon)?|diktat)$/i,
  /^(ausmachen|abschalten)\s+(aufnahme|mikro(?:fon)?|diktat)$/i,
];

const STOP_SUFFIX_PATTERNS: RegExp[] = [
  /^(?<content>.+?)\s+stop+p?$/i,
  /^(?<content>.+?)\s+(aufnahme|mikro(?:fon)?|diktat)\s+(aus|abstellen|stoppen?|beenden?)$/i,
  /^(?<content>.+?)\s+beende\s+(aufnahme|mikro(?:fon)?|diktat)$/i,
  /^(?<content>.+?)\s+(ausmachen|abschalten)\s+(aufnahme|mikro(?:fon)?|diktat)$/i,
];

const COMMAND_MATCHERS: Array<{ command: SpeechCommand; patterns: RegExp[] }> = [
  { command: { type: 'toggle-format', format: 'bold' }, patterns: [/^fett$/, /^fett markieren$/] },
  { command: { type: 'toggle-format', format: 'italic' }, patterns: [/^kursiv$/] },
  {
    command: { type: 'toggle-format', format: 'underline' },
    patterns: [/^unterstreichen$/, /^unterstrichen$/],
  },
  { command: { type: 'insert-list', listType: 'unordered' }, patterns: [/^aufzählung$/, /^liste$/] },
  { command: { type: 'insert-list', listType: 'ordered' }, patterns: [/^nummerierte liste$/] },
  { command: { type: 'undo' }, patterns: [/^rückgängig$/] },
  { command: { type: 'redo' }, patterns: [/^wiederholen$/, /^wiederherstellen$/] },
  { command: { type: 'insert-newline' }, patterns: [/^neue zeile$/, /^neuer absatz$/] },
];

export type ParsedSpeechInput = {
  command: SpeechCommand | null;
  contentText: string;
};

const detectNonStopCommand = (normalizedText: string): SpeechCommand | null => {
  for (const { command, patterns } of COMMAND_MATCHERS) {
    if (patterns.some((pattern) => pattern.test(normalizedText))) {
      return command;
    }
  }

  return null;
};

export const parseSpeechInput = (text: string): ParsedSpeechInput => {
  const normalized = normalizeSpeechText(text);

  if (!normalized) {
    return { command: null, contentText: '' };
  }

  if (STOP_COMMAND_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return { command: { type: 'stop-listening' }, contentText: '' };
  }

  for (const pattern of STOP_SUFFIX_PATTERNS) {
    const match = normalized.match(pattern);
    const suffixContent = match?.groups?.content?.trim();
    if (suffixContent) {
      return {
        command: { type: 'stop-listening' },
        contentText: suffixContent,
      };
    }
  }

  const command = detectNonStopCommand(normalized);
  if (command) {
    return { command, contentText: '' };
  }

  return { command: null, contentText: normalized };
};

export const detectSpeechCommand = (text: string): SpeechCommand | null => {
  return parseSpeechInput(text).command;
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
