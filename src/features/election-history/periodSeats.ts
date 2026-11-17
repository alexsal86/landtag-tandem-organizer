export type SeatAllocation = { faction: string; seats: number };
export type SeatBasis = 'election_result' | 'opening' | 'as_of' | 'unknown';
export const seatBasisLabels: Record<SeatBasis, string> = {
  election_result: 'Sitzverteilung nach der Wahl', opening: 'Sitzverteilung zu Beginn der Periode', as_of: 'Sitzverteilung zum Stichtag', unknown: 'Bezugsstand noch nicht angegeben',
};
export type PeriodSeatData = {
  seat_total: number | null; seat_distribution: SeatAllocation[]; seat_basis: SeatBasis;
  seat_reference_date: string | null; seat_source_url: string | null; seat_notes: string | null;
};
/** Unknown totals stay unknown: an entered party subset never defines parliament size. */
export function parsePeriodSeats(values: Record<string, string | boolean>): PeriodSeatData {
  const totalRaw = String(values.seat_total ?? '').trim();
  const total = totalRaw ? Number(totalRaw) : null;
  if (total !== null && (!/^\d+$/.test(totalRaw) || !Number.isSafeInteger(total) || total < 1 || total > 1000)) throw new Error('Die Gesamtsitzzahl muss eine ganze Zahl zwischen 1 und 1000 sein.');
  let rows: unknown;
  try { rows = JSON.parse(String(values.seat_distribution || '[]')); } catch { throw new Error('Die Sitzverteilung ist ungültig.'); }
  if (!Array.isArray(rows) || rows.length > 30) throw new Error('Bitte höchstens 30 Parteien / Fraktionen erfassen.');
  const seen = new Set<string>();
  const distribution = rows.map((value): SeatAllocation => {
    if (!value || typeof value !== 'object') throw new Error('Bitte gültige Parteien und Sitzzahlen eingeben.');
    const row = value as Record<string, unknown>;
    const faction = typeof row.faction === 'string' ? row.faction.trim() : '';
    const raw = typeof row.seats === 'string' || typeof row.seats === 'number' ? String(row.seats).trim() : '';
    const seats = Number(raw);
    if (!faction || faction.length > 100 || !/^\d+$/.test(raw) || !Number.isSafeInteger(seats) || seats < 0 || seats > 1000) throw new Error('Jede Partei / Fraktion braucht einen Namen und eine ganze Sitzzahl zwischen 0 und 1000.');
    const key = faction.toLocaleLowerCase('de'); if (seen.has(key)) throw new Error('Eine Partei / Fraktion ist mehrfach in der Sitzverteilung eingetragen.'); seen.add(key);
    return { faction, seats };
  });
  const sum = distribution.reduce((n, row) => n + row.seats, 0);
  if (sum > 1000 || (total !== null && sum > total)) throw new Error('Die Fraktionssitze dürfen die Gesamtsitzzahl nicht überschreiten.');
  const basis = String(values.seat_basis || 'unknown');
  if (!Object.prototype.hasOwnProperty.call(seatBasisLabels, basis)) throw new Error('Bitte einen gültigen Bezugsstand der Sitzverteilung auswählen.');
  const rawDate = String(values.seat_reference_date || '').trim();
  const date = rawDate ? rawDate.replace(/^(\d{2})\.(\d{2})\.(\d{4})$/, '$3-$2-$1') : null;
  if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date)) throw new Error('Bitte ein gültiges Datum für den Sitzverteilungsstand angeben.');
  if (basis === 'as_of' && !date) throw new Error('Für eine Sitzverteilung zum Stichtag bitte das Datum angeben.');
  const source = String(values.seat_source_url || '').trim() || null;
  if (source) { let valid = false; try { valid = ['http:', 'https:'].includes(new URL(source).protocol); } catch { /* Invalid URL. */ } if (!valid) throw new Error('Bitte die Quelle der Sitzzahlen als vollständige http(s)-Adresse angeben.'); }
  return { seat_total: total, seat_distribution: distribution, seat_basis: basis as SeatBasis, seat_reference_date: date, seat_source_url: source, seat_notes: String(values.seat_notes || '').trim() || null };
}
