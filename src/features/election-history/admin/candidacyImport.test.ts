import { describe, expect, it } from 'vitest';
import { parseCandidacyImport } from './candidacyImport';
import type { HistoricalDistrict } from '../types';

const districts: HistoricalDistrict[] = [
  { id: 'd-1', period_id: 'p-1', district_number: 36, number_label: null, name: 'Nürtingen', boundaries: null, boundary_note: null, source_url: null },
  { id: 'd-2', period_id: 'p-1', district_number: 37, number_label: null, name: 'Wiesloch', boundaries: null, boundary_note: null, source_url: null },
];

describe('Kandidatenimport', () => {
  it('übernimmt Excel-Zeilen mit deutschen Zahlen und ordnet nur bekannte Wahlkreise zu', () => {
    const rows = parseCandidacyImport(
      'Wahlkreis-Nr\tName\tPartei\tStimmen\tProzent\tPlatz\tGewählt\n36\tAda Beispiel\tGRÜNE\t12.345\t42,5\t1\tdirekt\n37\tBen Beispiel\tCDU\t10.000\t40,0\t2\tnein',
      districts,
      'candidate',
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ districtId: 'd-1', votes: 12345, voteShare: 42.5, districtRank: 1, outcome: 'direct', errors: [] });
    expect(rows[1]).toMatchObject({ districtId: 'd-2', votes: 10000, outcome: 'not_elected', errors: [] });
  });

  it('weist Ergebnisse ohne Wahlkreis und unklare Gewinner zurück', () => {
    const rows = parseCandidacyImport(
      'Wahlkreis-Nr;Name;Partei;Stimmen;Gewählt\n;Listenperson;GRÜNE;1200;ja\n99;Unbekannt;CDU;;;direkt',
      districts,
      'candidate',
    );
    expect(rows[0].errors).toContain('Persönliche Ergebnisse und Direktgewinne brauchen einen Wahlkreis.');
    expect(rows[0].errors).toContain('Wahlausgang bitte als direkt, liste, nein oder offen angeben.');
    expect(rows[1].errors.some(error => error.includes('nicht vorhanden'))).toBe(true);
  });

  it('unterstützt reine Listenkandidaturen ausdrücklich ohne persönlichen Wahlkreiswert', () => {
    const [row] = parseCandidacyImport('Wahlkreis-Nr;Name;Partei;Listenplatz;Gewählt\n;Listenperson;GRÜNE;4;liste', districts, 'first_vote');
    expect(row).toMatchObject({ districtId: null, listPosition: 4, outcome: 'list', ballotType: 'first_vote', errors: [] });
  });
});
