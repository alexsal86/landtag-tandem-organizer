import type { Ballot, StateResult } from './types';
export const parties = ['GRÜNE', 'CDU', 'SPD', 'FDP', 'AfD'];
export const sectionLabels = { state: 'Landesergebnisse', districts: 'Wahlkreisvergleich', turnout: 'Wahlbeteiligung', flows: 'Wählerwanderung', demographics: 'Alter & Geschlecht', profile: 'Wahlkreis-Steckbrief', swing: 'Swing-Atlas', split: 'Erst-/Zweitstimmen', quality: 'Datenqualität' };
export const ballotLabels: Record<Ballot, string> = { single: 'Einzelstimme', first: 'Erststimme', second: 'Zweitstimme' };
export function ballotsForYear(year: number): Ballot[] { return year >= 2026 ? ['first', 'second'] : ['single']; }
export function effectiveBallot(year: number, selected: Ballot): Ballot { return ballotsForYear(year).includes(selected) ? selected : year >= 2026 ? 'second' : 'single'; }
export function percent(value: number | null | undefined): string { return value == null ? '—' : `${value.toLocaleString('de-DE', { maximumFractionDigits: 1 })} %`; }
export function number(value: number | null | undefined): string { return value == null ? '—' : value.toLocaleString('de-DE'); }
export function difference(current: number | null | undefined, previous: number | null | undefined): string {
  if (current == null || previous == null) return '—';
  const delta = Math.round((current - previous) * 1000) / 1000;
  return `${delta > 0 ? '+' : ''}${delta.toLocaleString('de-DE', { maximumFractionDigits: 1 })} PP`;
}
/** No aggregation of selected parties into a fictitious full electorate. */
export function stateComparison(rows: StateResult[], previous: StateResult[]) {
  return rows.map(row => ({ ...row, previousShare: previous.find(p => p.party === row.party)?.share ?? null }));
}
export function exportAnalysisCsv(rows: object[], filename: string): void {
  if (!rows.length) return;
  const headers = Array.from(new Set(rows.flatMap(row => Object.keys(row))));
  const cell = (value: unknown) => {
    let text = value == null ? '' : typeof value === 'number' ? String(value).replace('.', ',') : String(value);
    // Protect spreadsheet consumers; a numeric negative is a value, not a formula.
    if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  };
  const csv = '\uFEFF' + [headers.map(cell).join(';'), ...rows.map(row => {
    const values = Object.fromEntries(Object.entries(row));
    return headers.map(header => cell(values[header])).join(';');
  })].join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
  const link = document.createElement('a'); link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url);
}


/** Compare original values, never formatted German number strings. Missing
 * values stay at the bottom for both sort directions. */
export function compareAnalysisValues(a: string | number | null, b: string | number | null, direction: 'asc' | 'desc'): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  const result = typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b), 'de', { numeric: true, sensitivity: 'base' });
  return direction === 'asc' ? result : -result;
}
