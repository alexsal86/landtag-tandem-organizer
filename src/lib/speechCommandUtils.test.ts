import { detectSpeechCommand, parseSpeechInput } from './speechCommandUtils';

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
      contentText: 'notieren x y z',
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
