export function checkBingo(selectedCells: readonly number[]): boolean {
  const cells = new Set(selectedCells.filter(index => Number.isInteger(index) && index >= 0 && index < 9));
  return [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]]
    .some(line => line.every(index => cells.has(index)));
}
export function validBingoFields(fields: readonly string[]): boolean {
  const normalized = fields.map(field => field.trim());
  return normalized.length >= 9 && normalized.length <= 40 && normalized.every(field => field.length > 0 && Array.from(field).length <= 120)
    && new Set(normalized.map(field => field.toLowerCase())).size === normalized.length;
}
function hash(value: string): number {
  let result = 2166136261;
  for (const char of value) result = Math.imul(result ^ char.charCodeAt(0), 16777619);
  return result >>> 0;
}
/** Stable local board for this person/week/configuration; no server scores or progress. */
export function bingoBoard(fields: readonly string[], seed: string): string[] {
  return [...fields].sort((a, b) => hash(seed + a) - hash(seed + b) || a.localeCompare(b)).slice(0, 9);
}
export interface BingoState { started: boolean; selected: number[] }
export function readBingoState(raw: string | null, scope: string): BingoState {
  try {
    const value: unknown = JSON.parse(raw ?? 'null');
    if (value && typeof value === 'object' && 'scope' in value && value.scope === scope
      && 'started' in value && value.started === true && 'selected' in value && Array.isArray(value.selected)
      && value.selected.length <= 9 && value.selected.every((index: unknown) => typeof index === 'number' && Number.isInteger(index) && index >= 0 && index < 9)) {
      return { started: true, selected: [...new Set<number>(value.selected)] };
    }
  } catch { /* Invalid or expired local data starts a fresh voluntary round. */ }
  return { started: false, selected: [] };
}
