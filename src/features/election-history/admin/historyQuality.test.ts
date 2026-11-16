import { describe, expect, it } from 'vitest';
import { mandateQualityIssues } from './historyQuality';
import type { HistoricalMandate } from '../types';

const mandate: HistoricalMandate = {
  id: 'm-1', period_id: 'p-1', person_id: null, person_name: 'Ada Beispiel', district_id: null,
  candidacy_id: null, party: 'GRÜNE', mandate_type: 'direct', entry_type: 'succession',
  starts_on: null, ends_on: null, start_from_period: true, end_from_period: false,
  original_mandate: null, party_label: null, left_early: false, source_url: null, notes: null,
};

describe('Mandatsqualität', () => {
  it('markiert fehlenden Wahlkreis, eigenes Nachrückerdatum, Identität und Quelle getrennt', () => {
    expect(mandateQualityIssues(mandate)).toEqual([
      'Direktmandat ohne Wahlkreis',
      'Nachrücker ohne eigenes Eintrittsdatum',
      'Personenverbindung offen',
      'Quelle fehlt',
    ]);
  });

  it('akzeptiert einen vollständig belegten Nachrücker ohne erfundene Periodenübernahme', () => {
    expect(mandateQualityIssues({ ...mandate, district_id: 'd-1', starts_on: '2024-05-01', start_from_period: false, connection_id: 'c-1', source_url: 'https://example.org' })).toEqual([]);
  });
});
