import { describe, expect, it } from 'vitest';
import { readFlag, readPartySelection, setFlag, setPartySelection, toggleParty } from './viewState';

describe('URL-gebundener Ansichtszustand', () => {
  it('liest nur bekannte Parteien und entfernt den Parameter bei leerer Auswahl', () => {
    const params = new URLSearchParams('historyHidden=CDU,Fremd,GRÜNE');
    expect(readPartySelection(params, 'historyHidden', ['CDU', 'SPD', 'GRÜNE'])).toEqual(['CDU', 'GRÜNE']);
    expect(readPartySelection(new URLSearchParams(), 'historyHidden', ['CDU'])).toEqual([]);
    expect(setPartySelection(params, 'historyHidden', [], ['CDU']).has('historyHidden')).toBe(false);
    expect(setPartySelection(new URLSearchParams(), 'historyHidden', ['SPD', 'Fremd'], ['CDU', 'SPD']).get('historyHidden')).toBe('SPD');
  });

  it('schaltet Parteien um und schreibt Schalter nur im aktiven Zustand', () => {
    expect(toggleParty([], 'CDU')).toEqual(['CDU']);
    expect(toggleParty(['CDU', 'SPD'], 'CDU')).toEqual(['SPD']);
    expect(readFlag(new URLSearchParams('profileHistory=1'), 'profileHistory')).toBe(true);
    expect(readFlag(new URLSearchParams('profileHistory=0'), 'profileHistory')).toBe(false);
    expect(setFlag(new URLSearchParams(), 'profileHistory', true).get('profileHistory')).toBe('1');
    expect(setFlag(new URLSearchParams('profileHistory=1&x=2'), 'profileHistory', false).toString()).toBe('x=2');
  });
});
