import { detectSpeechCommand, findLastDictatedSentenceStart, formatDictatedText, parseSpeechInput } from './speechCommandUtils';

describe('speechCommandUtils stop-listening parser', () => {
  it('detects strict stop command as full phrase', () => {
    expect(detectSpeechCommand('Stopp')).toEqual({ type: 'stop-listening' });
    expect(detectSpeechCommand('mikrofon aus')).toEqual({ type: 'stop-listening' });
  });

  it('supports mixed utterances with stop command at the end', () => {
    expect(parseSpeechInput('Bitte notieren X Y Z stopp')).toEqual({
      command: { type: 'stop-listening' },
      contentText: 'notieren x y z',
    });
  });

  it('does not trigger stop-listening when stop appears at the beginning', () => {
    expect(parseSpeechInput('stopp bitte notieren x y z')).toEqual({
      command: null,
      contentText: 'stopp notieren x y z',
    });
  });

  it('does not trigger stop-listening when stop appears in the middle', () => {
    expect(parseSpeechInput('bitte notieren stopp x y z')).toEqual({
      command: null,
      contentText: 'notieren stopp x y z',
    });
  });

  it('does not trigger on partial words containing stop', () => {
    expect(parseSpeechInput('Der Stoppuhrknopf ist rot')).toEqual({
      command: null,
      contentText: 'der stoppuhrknopf ist rot',
    });
  });

  it('ignores filler words around command phrases', () => {
    expect(detectSpeechCommand('ähm bitte stopp jetzt mal')).toEqual({ type: 'stop-listening' });
  });
});

describe('speechCommandUtils formatting', () => {
  it('adds a space and uppercase letter after period punctuation', () => {
    expect(formatDictatedText('hallo punkt wie geht es dir')).toBe('Hallo. Wie geht es dir');
  });

  it('uppercases words after existing periods without spaces', () => {
    expect(formatDictatedText('hallo.welt')).toBe('Hallo. Welt');
  });

  it.each([
    ['drucksache 17 schrägstrich 1234', 'Drs. 17/1234'],
    ['siehe drs. 17 / 42', 'Siehe Drs. 17/42'],
    ['drucksache 17-42', 'Drs. 17/42'],
    ['nach paragraph 3 abs. 2', 'Nach § 3 Abs. 2'],
    ['paragraf 4 absatz 1', '§ 4 Abs. 1'],
    ['mdl im ltt', 'MdL im LTT'],
  ])('formats parliamentary dictation "%s"', (input, expected) => {
    expect(formatDictatedText(input)).toBe(expected);
  });
});

describe('findLastDictatedSentenceStart', () => {
  it.each([
    ['', 'Der Antrag bezieht sich auf § 3 Abs. 2.'],
    ['Das gilt weiterhin. ', 'Siehe Drs. 17/1234 und Art. 4 Abs. 2 Satz 1 Nr. 3.'],
    ['Die Regel gilt nach § 3 Abs. 2. ', 'Die nächste Sitzung beginnt morgen.'],
    ['„Ist der Antrag angenommen?“ ', 'Die Abstimmung folgt.'],
    ['1. ', 'Der Ausschuss empfiehlt die Annahme.'],
    ['Erste Zeile\n  ', 'Siehe Drs. 17/1234'],
    ['Das gilt weiterhin. ', 'Das betrifft z. B. § 3 Abs.'],
  ])('preserves the prefix "%s" before the sentence "%s"', (prefix, sentence) => {
    expect(findLastDictatedSentenceStart(prefix + sentence)).toBe(prefix.length);
  });

  it('finds an unfinished sentence at a cursor in the middle of the block', () => {
    const prefix = 'Der Antrag liegt vor. ';
    const beforeCursor = prefix + 'Es gilt § 3 Abs. 2';
    const afterCursor = ' des Gesetzes. Weitere Hinweise folgen.';
    const start = findLastDictatedSentenceStart(beforeCursor);

    const block = beforeCursor + afterCursor;
    const remaining = block.slice(0, start) + block.slice(beforeCursor.length);

    expect(remaining).toBe(prefix + afterCursor);
  });
});
