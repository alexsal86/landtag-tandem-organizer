export type SpeechCommand =
  | { type: 'stop-listening' }
  | { type: 'toggle-format'; format: 'bold' | 'italic' | 'underline' }
  | { type: 'insert-list'; listType: 'unordered' | 'ordered' }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'insert-newline' };

const COMMAND_PHRASES: Array<{ command: SpeechCommand; phrases: string[] }> = [
  { command: { type: 'stop-listening' }, phrases: ['stopp', 'stop', 'aufnahme stoppen', 'diktat stoppen'] },
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
    .trim()
    .replace(/[.!?]+$/g, '')
    .trim();

export const detectSpeechCommand = (text: string): SpeechCommand | null => {
  const normalized = normalizeSpeechText(text);

  for (const { command, phrases } of COMMAND_PHRASES) {
    if (phrases.includes(normalized)) {
      return command;
    }
  }

  return null;
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
