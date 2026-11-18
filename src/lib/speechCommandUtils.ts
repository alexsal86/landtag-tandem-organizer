export type SpeechCommand =
  | { type: 'stop-listening' }
  | { type: 'toggle-format'; format: 'bold' | 'italic' | 'underline' }
  | { type: 'insert-list'; listType: 'unordered' | 'ordered' }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'insert-newline' }
  | { type: 'delete-last-word' }
  | { type: 'delete-last-sentence' }
  | { type: 'select-last-sentence' }
  | { type: 'go-to-end' }
  | { type: 'insert-checklist' }
  | { type: 'save-note' }
  | { type: 'draft-task-from-selection' }
  | { type: 'select-all' }
  | { type: 'insert-heading'; level: 1 | 2 | 3 }
  | { type: 'insert-quote' }
  | { type: 'replace-text'; search: string; replacement: string };

/** Human-readable label for a recognized command (used for UI feedback). */
export const getSpeechCommandLabel = (command: SpeechCommand): string => {
  switch (command.type) {
    case 'stop-listening': return 'Stopp';
    case 'toggle-format': return command.format === 'bold' ? 'Fett' : command.format === 'italic' ? 'Kursiv' : 'Unterstrichen';
    case 'insert-list': return command.listType === 'unordered' ? 'Aufzählung' : 'Nummerierte Liste';
    case 'undo': return 'Rückgängig';
    case 'redo': return 'Wiederholen';
    case 'insert-newline': return 'Neue Zeile';
    case 'delete-last-word': return 'Wort gelöscht';
    case 'delete-last-sentence': return 'Satz gelöscht';
    case 'select-last-sentence': return 'Letzten Satz markieren';
    case 'go-to-end': return 'Ans Ende springen';
    case 'insert-checklist': return 'Checkliste starten';
    case 'save-note': return 'Notiz speichern';
    case 'draft-task-from-selection': return 'Auswahl als Aufgabe übernehmen';
    case 'select-all': return 'Alles markiert';
    case 'insert-heading': return `Überschrift ${command.level}`;
    case 'insert-quote': return 'Zitat';
    case 'replace-text': return `Ersetzt: ${command.search}`;
  }
};

const PUNCTUATION_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\b(punkt)\b/gi, '.'],
  [/\b(komma)\b/gi, ','],
  [/\b(fragezeichen)\b/gi, '?'],
  [/\b(ausrufezeichen)\b/gi, '!'],
  [/\b(doppelpunkt)\b/gi, ':'],
  [/\b(semikolon)\b/gi, ';'],
  [/\b(neue zeile|zeilenumbruch|neuer absatz)\b/gi, '\n'],
  // Special characters
  [/\b(bindestrich)\b/gi, '-'],
  [/\b(gedankenstrich)\b/gi, ' – '],
  [/\b(klammer auf)\b/gi, '('],
  [/\b(klammer zu)\b/gi, ')'],
  [/\banführungszeichen (?:zu|oben)\b/gi, '“'],
  [/\banführungszeichen(?: auf| unten)?\b/gi, '„'],
  [/\b(leerzeichen)\b/gi, ' '],
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

const REPLACE_PATTERN = /^ersetze\s+(.+?)\s+durch\s+(.+)$/;

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
  { command: { type: 'delete-last-word' }, patterns: [/^letztes wort löschen$/, /^wort löschen$/] },
  { command: { type: 'delete-last-sentence' }, patterns: [/^letzten satz löschen$/, /^satz löschen$/] },
  { command: { type: 'select-last-sentence' }, patterns: [/^letzten satz (?:markieren|auswählen)$/] },
  { command: { type: 'go-to-end' }, patterns: [/^(?:ans|zum) ende springen$/] },
  { command: { type: 'insert-checklist' }, patterns: [/^checkliste (?:starten|einfügen)$/] },
  { command: { type: 'save-note' }, patterns: [/^notiz speichern$/] },
  { command: { type: 'draft-task-from-selection' }, patterns: [/^auswahl als aufgabe übernehmen$/] },
  { command: { type: 'select-all' }, patterns: [/^alles markieren$/, /^alles auswählen$/] },
  { command: { type: 'insert-heading', level: 1 }, patterns: [/^überschrift eins$/, /^überschrift 1$/] },
  { command: { type: 'insert-heading', level: 2 }, patterns: [/^überschrift zwei$/, /^überschrift 2$/] },
  { command: { type: 'insert-heading', level: 3 }, patterns: [/^überschrift drei$/, /^überschrift 3$/] },
  { command: { type: 'insert-quote' }, patterns: [/^zitat$/, /^zitat einfügen$/] },
];

export type ParsedSpeechInput = {
  command: SpeechCommand | null;
  contentText: string;
};

const detectNonStopCommand = (normalizedText: string): SpeechCommand | null => {
  // Check replace pattern first (has captures)
  const replaceMatch = normalizedText.match(REPLACE_PATTERN);
  if (replaceMatch) {
    return { type: 'replace-text', search: replaceMatch[1].trim(), replacement: replaceMatch[2].trim() };
  }

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

const SPOKEN_NUMBERS = [
  'null', 'eins', 'zwei', 'drei', 'vier', 'fünf', 'sechs', 'sieben', 'acht', 'neun',
  'zehn', 'elf', 'zwölf', 'dreizehn', 'vierzehn', 'fünfzehn', 'sechzehn',
  'siebzehn', 'achtzehn', 'neunzehn', 'zwanzig',
];

export const formatDictatedText = (text: string): string => {
  let formatted = text.trim().replace(/\b(?:absatz|abs\.?)\s+(\p{L}+)(?![\p{L}\p{N}])/giu, (phrase, word: string) => {
    const number = SPOKEN_NUMBERS.indexOf(word.toLowerCase());
    return number < 0 ? phrase : 'Abs. ' + number;
  });
  for (const [pattern, replacement] of PUNCTUATION_REPLACEMENTS) {
    formatted = formatted.replace(pattern, replacement);
  }

  // Capitalize after sentence-ending punctuation (. ! ?) and after newlines
  const withSentenceCase = formatted
    .replace(/([.!?])\s*(\p{L})/gu, (_, punct: string, letter: string) => `${punct} ${letter.toUpperCase()}`)
    .replace(/\n\s*(\p{L})/gu, (_, letter: string) => `\n${letter.toUpperCase()}`)
    .replace(/^„?(\p{L})/u, (start: string) => start.toUpperCase());

  return withSentenceCase
    .replace(/\b(?:drucksache|drs\.?)\s+(\d+)\s*(?:schrägstrich|strich|\/|-)\s*(\d+)\b/gi, 'Drs. $1/$2')
    .replace(/\b(?:paragraf|paragraph)\b/gi, '§')
    .replace(/\b(?:absatz|abs)\b\.?/gi, 'Abs.')
    .replace(/\bmdl\b/gi, 'MdL')
    .replace(/\bltt\b/gi, 'LTT')
    .replace(/„[ \t]+/g, '„')
    .replace(/[ \t]+“/g, '“')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/\n\s+/g, '\n')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim();
};

const CITATION_ABBREVIATION = /(?:^|[^\p{L}\p{N}])(?:abs|art|bd|buchst|drs|hrsg|lit|nr|rn|satznr|s|vgl|ziff)$/iu;

/** Offset of the last sentence or unfinished sentence before the cursor. */
export const findLastDictatedSentenceStart = (beforeCursor: string): number => {
  const text = beforeCursor.trimEnd();
  let start = 0;

  // A soft line break also separates sentences for this editing command.
  for (const boundary of text.matchAll(/([.!?]+)([»«“”„"’')\]]*)[^\S\r\n]+|[\r\n]+[^\S\r\n]*/g)) {
    const [separator, punctuation, closingMarks] = boundary;
    const offset = boundary.index ?? 0;
    const nextStart = offset + separator.length;

    if (punctuation === '.' && !closingMarks) {
      const prefix = text.slice(start, offset);
      if (CITATION_ABBREVIATION.test(prefix)) continue;

      const suffix = text.slice(nextStart);
      if (/\bz$/i.test(prefix) && /^b\./i.test(suffix)) continue;
      if (/\bz\.\s+b$/i.test(prefix)) continue;
    }

    start = nextStart;
  }

  return start;
};

/** Structured command reference for the help dialog */
export interface SpeechCommandGroup {
  label: string;
  commands: Array<{ trigger: string; description: string; requires?: SpeechCommand['type'] }>;
}

export const SPEECH_COMMAND_REFERENCE: SpeechCommandGroup[] = [
  {
    label: 'Formatierung',
    commands: [
      { trigger: 'Fett', description: 'Text fett formatieren' },
      { trigger: 'Kursiv', description: 'Text kursiv formatieren' },
      { trigger: 'Unterstreichen', description: 'Text unterstreichen' },
      { trigger: 'Überschrift 1 / 2 / 3', description: 'Überschrift-Ebene setzen' },
      { trigger: 'Zitat', description: 'Zitat-Block einfügen' },
    ],
  },
  {
    label: 'Listen',
    commands: [
      { trigger: 'Aufzählung / Liste', description: 'Aufzählungsliste einfügen' },
      { trigger: 'Nummerierte Liste', description: 'Nummerierte Liste einfügen' },
      { trigger: 'Checkliste starten', description: 'Liste mit abhakbaren Punkten beginnen', requires: 'insert-checklist' },
    ],
  },
  {
    label: 'Satzzeichen & Sonderzeichen',
    commands: [
      { trigger: 'Punkt', description: '. einfügen' },
      { trigger: 'Komma', description: ', einfügen' },
      { trigger: 'Fragezeichen', description: '? einfügen' },
      { trigger: 'Ausrufezeichen', description: '! einfügen' },
      { trigger: 'Doppelpunkt', description: ': einfügen' },
      { trigger: 'Semikolon', description: '; einfügen' },
      { trigger: 'Bindestrich', description: '- einfügen' },
      { trigger: 'Gedankenstrich', description: '– einfügen' },
      { trigger: 'Klammer auf / Klammer zu', description: '( ) einfügen' },
      { trigger: 'Anführungszeichen unten / Anführungszeichen auf', description: '„ einfügen' },
      { trigger: 'Anführungszeichen oben / Anführungszeichen zu', description: '“ einfügen' },
      { trigger: 'Absatz zwei', description: 'Abs. 2 im Diktattext einfügen' },
      { trigger: 'Leerzeichen', description: 'Explizites Leerzeichen' },
    ],
  },
  {
    label: 'Korrektur',
    commands: [
      { trigger: 'Letztes Wort löschen', description: 'Letztes Wort entfernen' },
      { trigger: 'Letzten Satz markieren', description: 'Satz bis zum Cursor zum Überdiktieren auswählen' },
      { trigger: 'Letzten Satz löschen', description: 'Satz bis zur Cursorposition entfernen' },
      { trigger: 'Ersetze X durch Y', description: 'Text im Absatz ersetzen' },
      { trigger: 'Rückgängig', description: 'Letzte Aktion rückgängig' },
      { trigger: 'Wiederholen', description: 'Rückgängig wiederherstellen' },
    ],
  },
  {
    label: 'Navigation & Steuerung',
    commands: [
      { trigger: 'Neue Zeile / Neuer Absatz', description: 'Zeilenumbruch einfügen' },
      { trigger: 'Ans Ende springen', description: 'Cursor ans Ende des Textes setzen' },
      { trigger: 'Notiz speichern', description: 'Diktat abschließen und QuickNote speichern', requires: 'save-note' },
      { trigger: 'Auswahl als Aufgabe übernehmen', description: 'Aufgabenentwurf mit dem markierten Text öffnen', requires: 'draft-task-from-selection' },
      { trigger: 'Alles markieren', description: 'Gesamten Text markieren' },
      { trigger: 'Stopp', description: 'Aufnahme beenden' },
    ],
  },
];
