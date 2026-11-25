import { describe, expect, it } from 'vitest';
import { hasRenderableBoundary, searchElectionDistricts, timeTravelOrder, timeTravelPeriodAt } from './mapModel';
import { electionMapScenario } from '@/features/selftest/scenarios/election-map';
import { runScenario } from '@/features/selftest/runner';

describe('Wahlkreiskarte', () => {
  it('führt die Such- und Grenzdatenregeln auch im Selbsttest-Center aus', async () => {
    const result = await runScenario(electionMapScenario, { tenantId: '', userId: '', onUpdate: () => {} });
    expect(result.status).toBe('ok');
    expect(result.steps).toHaveLength(electionMapScenario.steps.length);
    expect(result.steps.every(step => step.status === 'ok')).toBe(true);
  });

  it('findet Namen unabhängig von Großschreibung und hält gleichnamige Verwaltungsgrenzen aus der Suche', () => {
    const rows = [
      { id: 'a', district_name: 'Schwäbisch Gmünd', district_number: 25 },
      { id: 'b', district_name: 'Schwäbisch Hall', district_number: 22 },
      { id: 'c', district_name: 'Schwäbisch Hall', district_number: 22, district_type: 'verwaltungsgrenze' },
    ];
    expect(searchElectionDistricts(rows, ' SCHWÄBISCH ').map(row => row.id)).toEqual(['a', 'b']);
    expect(searchElectionDistricts(rows, '22').map(row => row.id)).toEqual(['b']);
    expect(searchElectionDistricts(rows, '2')).toEqual([]);
  });

  it('startet die Zeitreise bei der ältesten Periode und läuft dann aufwärts durch die Wahljahre', () => {
    const chronology = timeTravelOrder([
      { id: 'newest', election_year: 2026 },
      { id: 'oldest', election_year: 1952 },
      { id: 'unknown', election_year: null },
    ]);
    expect(chronology.map(period => period.id)).toEqual(['oldest', 'newest', 'unknown']);
    expect(timeTravelPeriodAt(chronology, 0)?.id).toBe('oldest');
    expect(timeTravelPeriodAt(chronology, 1)?.id).toBe('newest');
    expect(timeTravelPeriodAt(chronology, 2)?.id).toBe('unknown');
    expect(timeTravelPeriodAt(chronology, 3)?.id).toBe('oldest');
    expect(timeTravelPeriodAt([], 0)).toBeNull();
    expect(timeTravelPeriodAt([{ id: 'only' }], 0)).toBeNull();
  });

  it.each([null, [], [[[8, 48]]], [[[8, 48], [9, 48], [NaN, 49], [8, 48]]],
    [[[8, 48], [9, 48], [9, Infinity], [8, 48]]],
    [[[8, 48], [9, 48], ['9', 49], [8, 48]]],
    [[[3500000, 5400000], [3500100, 5400000], [3500100, 5400100], [3500000, 5400000]]],
  ].map(coordinates => ({ coordinates })))('weist unbrauchbare Polygonkoordinaten zurück: $coordinates', ({ coordinates }) => {
    expect(hasRenderableBoundary({ type: 'Polygon', coordinates })).toBe(false);
  });

  it('akzeptiert Multipolygone mit Löchern und optionaler Höhenkoordinate', () => {
    const ring = [[8, 48, 100], [9, 48, 100], [9, 49, 100], [8, 48, 100]];
    expect(hasRenderableBoundary({ type: 'MultiPolygon', coordinates: [[ring, ring], [ring]] })).toBe(true);
  });
});
