import { describe, expect, it } from 'vitest';
import { checkBingo, readBingoState } from './bingo';
describe('Mandats-Bingo', () => {
  it('recognizes every row, column and diagonal', () => {
    for (const cells of [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]]) expect(checkBingo(cells)).toBe(true);
  });
  it('rejects incomplete lines, duplicates and invalid cells', () => {
    expect(checkBingo([0,1,3,4])).toBe(false);
    expect(checkBingo([0,0,0])).toBe(false);
    expect(checkBingo([-1,9,10,0,1])).toBe(false);
    expect(checkBingo([])).toBe(false);
  });
  it('does not reuse another week or broken local state', () => {
    expect(readBingoState('{invalid', 'current').started).toBe(false);
    expect(readBingoState(JSON.stringify({ scope:'old', started:true, selected:[0,1,2] }), 'current').started).toBe(false);
  });
});
