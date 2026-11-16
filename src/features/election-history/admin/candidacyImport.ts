import type { ElectionCandidacy, HistoricalDistrict } from '../types';

export interface CandidacyImportRow {
  line: number;
  districtId: string | null;
  districtLabel: string;
  personName: string;
  party: string;
  votes: number | null;
  voteShare: number | null;
  districtRank: number | null;
  listPosition: number | null;
  ballotType: ElectionCandidacy['ballot_type'];
  outcome: ElectionCandidacy['outcome'];
  errors: string[];
}

const normalize = (value: string) => value.trim().toLocaleLowerCase('de-DE').replace(/[ä]/g, 'a').replace(/[ö]/g, 'o').replace(/[ü]/g, 'u').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, '');
const aliases: Record<string, string[]> = {
  district: ['wahlkreis', 'wahlkreisnr', 'wahlkreisnummer', 'wk', 'wknr', 'nr'],
  name: ['name', 'kandidat', 'kandidatin', 'person', 'personenname'],
  party: ['partei', 'fraktion', 'party'],
  votes: ['stimmen', 'personenstimmen', 'erststimmen', 'kandidatenstimmen', 'votes'],
  share: ['prozent', 'stimmenanteil', 'anteil', 'voteshare'],
  rank: ['platz', 'rang', 'wahlkreisplatz', 'districtrank'],
  list: ['listenplatz', 'liste', 'listposition'],
  outcome: ['ausgang', 'wahlausgang', 'gewahlt', 'ergebnis', 'outcome'],
  ballot: ['stimmenart', 'wahlstimme', 'ballottype'],
};
const headerKeys = new Map(Object.entries(aliases).flatMap(([key, values]) => values.map(value => [value, key] as const)));

function delimiterFor(text: string): string {
  const firstLine = text.split(/\r?\n/, 1)[0] || '';
  const candidates = ['\t', ';', ','];
  return candidates.sort((a, b) => firstLine.split(b).length - firstLine.split(a).length)[0];
}

export function parseDelimited(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') { cell += '"'; index += 1; }
      else quoted = !quoted;
    } else if (character === delimiter && !quoted) {
      row.push(cell.trim()); cell = '';
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && text[index + 1] === '\n') index += 1;
      row.push(cell.trim()); cell = '';
      if (row.some(value => value !== '')) rows.push(row);
      row = [];
    } else cell += character;
  }
  if (quoted) throw new Error('Eine Anführungszeichen-Klammer ist nicht geschlossen.');
  row.push(cell.trim());
  if (row.some(value => value !== '')) rows.push(row);
  return rows;
}

function integer(value: string, label: string, minimum: number, maximum = Number.MAX_SAFE_INTEGER): number | null {
  if (!value.trim()) return null;
  const compact = value.replace(/\s/g, '');
  const normalized = /^-?\d{1,3}(\.\d{3})+$/.test(compact) ? compact.replace(/\./g, '') : compact;
  if (!/^-?\d+$/.test(normalized)) throw new Error(`${label} muss eine ganze Zahl sein.`);
  const parsed = Number(normalized);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) throw new Error(`${label} liegt außerhalb des zulässigen Bereichs.`);
  return parsed;
}

function decimal(value: string): number | null {
  if (!value.trim()) return null;
  let normalized = value.replace(/[%\s]/g, '');
  if (normalized.includes(',') && normalized.includes('.')) normalized = normalized.replace(/\./g, '').replace(',', '.');
  else if (normalized.includes(',')) normalized = normalized.replace(',', '.');
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(normalized)) normalized = normalized.replace(/\./g, '');
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) throw new Error('Der Stimmenanteil muss zwischen 0 und 100 liegen.');
  return parsed;
}

function outcome(value: string): ElectionCandidacy['outcome'] {
  const key = normalize(value);
  if (!key || ['offen', 'unbekannt', 'unknown'].includes(key)) return 'unknown';
  if (['direkt', 'direct', 'direktgewahlt', 'direktmandat'].includes(key)) return 'direct';
  if (['liste', 'list', 'uberliste', 'uberdieliste', 'listenmandat', 'listengewahlt'].includes(key)) return 'list';
  if (['nein', 'nichtgewahlt', 'notelected'].includes(key)) return 'not_elected';
  throw new Error('Wahlausgang bitte als direkt, liste, nein oder offen angeben.');
}

function ballot(value: string, fallback: ElectionCandidacy['ballot_type']): ElectionCandidacy['ballot_type'] {
  const key = normalize(value);
  if (!key) return fallback;
  if (['candidate', 'kandidatenstimmen', 'kandidatenergebnis'].includes(key)) return 'candidate';
  if (['firstvote', 'erststimme', 'erststimmen'].includes(key)) return 'first_vote';
  throw new Error('Stimmenart bitte als Kandidatenstimmen oder Erststimmen angeben.');
}

function districtFor(value: string, districts: HistoricalDistrict[]): HistoricalDistrict | null {
  const key = normalize(value);
  if (!key) return null;
  const matches = districts.filter(district => [district.district_number?.toString(), district.number_label, district.name]
    .some(candidate => candidate && normalize(String(candidate)) === key));
  if (matches.length > 1) throw new Error(`Wahlkreis „${value}“ ist nicht eindeutig.`);
  if (!matches[0]) throw new Error(`Wahlkreis „${value}“ ist in dieser Legislaturperiode nicht vorhanden.`);
  return matches[0];
}

/** Parse pasted spreadsheet rows without guessing personal identities across elections. */
export function parseCandidacyImport(
  text: string,
  districts: HistoricalDistrict[],
  defaultBallot: ElectionCandidacy['ballot_type'],
): CandidacyImportRow[] {
  if (!text.trim()) throw new Error('Bitte zuerst Tabellendaten einfügen oder eine CSV-Datei auswählen.');
  const table = parseDelimited(text, delimiterFor(text));
  if (table.length < 2) throw new Error('Die Tabelle braucht eine Kopfzeile und mindestens eine Datenzeile.');
  const headers = table[0].map(normalize);
  const columns = headers.map(header => headerKeys.get(header) || '');
  for (const required of ['district', 'name', 'party']) {
    if (!columns.includes(required)) throw new Error('Die Kopfzeile braucht mindestens Wahlkreis-Nr, Name und Partei.');
  }
  if (table.length - 1 > 1000) throw new Error('Bitte höchstens 1000 Kandidaturzeilen gleichzeitig importieren.');
  return table.slice(1).map((cells, index) => {
    const get = (key: string) => {
      const column = columns.indexOf(key);
      return column >= 0 ? cells[column]?.trim() || '' : '';
    };
    const errors: string[] = [];
    const personName = get('name');
    const party = get('party');
    if (!personName) errors.push('Name fehlt.');
    if (!party) errors.push('Partei fehlt.');
    const read = <T,>(callback: () => T): T | null => {
      try { return callback(); }
      catch (error) { errors.push(error instanceof Error ? error.message : 'Ungültiger Wert.'); return null; }
    };
    const district = read(() => districtFor(get('district'), districts));
    const votes = read(() => integer(get('votes'), 'Stimmen', 0));
    const voteShare = read(() => decimal(get('share')));
    const districtRank = read(() => integer(get('rank'), 'Wahlkreisplatz', 1));
    const listPosition = read(() => integer(get('list'), 'Listenplatz', 1));
    const result = read(() => outcome(get('outcome'))) || 'unknown';
    const ballotType = read(() => ballot(get('ballot'), defaultBallot)) || defaultBallot;
    if (!district && (votes !== null || voteShare !== null || districtRank !== null || result === 'direct')) errors.push('Persönliche Ergebnisse und Direktgewinne brauchen einen Wahlkreis.');
    return {
      line: index + 2,
      districtId: district?.id || null,
      districtLabel: district ? `${district.district_number ?? district.number_label ?? '–'}: ${district.name}` : get('district') || 'Ohne Wahlkreis',
      personName, party, votes, voteShare, districtRank, listPosition, ballotType, outcome: result, errors,
    };
  });
}
