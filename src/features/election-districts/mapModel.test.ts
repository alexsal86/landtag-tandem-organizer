import { describe, expect, it } from 'vitest';
import { hasRenderableBoundary, partyFilterForPeriod, searchElectionDistricts, timeTravelOrder, timeTravelPeriodAt } from './mapModel';
import { geometryToMorphPolygons, interpolateMorph, planMorph, projectPosition, resampleRing, unprojectPosition } from './morphGeometry';
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

  it('behält die Parteifilter-Auswahl beim Wechsel der Legislaturperiode', () => {
    expect([...partyFilterForPeriod(null, ['CDU', 'SPD'], 1952)].sort()).toEqual(['CDU', 'Ohne Direktmandat', 'SPD']);
    expect([...partyFilterForPeriod(null, ['CDU', 'SPD'], 2026)].sort()).toEqual(['CDU', 'SPD']);
    const chosen = new Set(['SPD']);
    expect(partyFilterForPeriod(chosen, ['CDU', 'AfD'], 2026)).toBe(chosen);
  });

  it('paart Wahlkreise nur über Namen oder Fläche und morpht sonst nicht', () => {
    const square = (size: number, x = 0, y = 0): [number, number][] =>
      [[x, y], [x + size, y], [x + size, y + size], [x, y + size]];
    const shape = (key: string, name: string, polygons: [number, number][][][]) => ({ key, name, multi: false, polygons });

    const morphed = planMorph([shape('1', 'Bruchsal', [[square(10)]])], [shape('1', 'Bruchsal', [[square(20)]])]);
    expect(morphed.fadeKeys).toEqual([]);
    expect(morphed.pairs).toHaveLength(1);
    const pair = morphed.pairs[0];
    expect(pair.from[0][0]).toHaveLength(4);
    expect(interpolateMorph(pair, 0, 8)[0][0][2][0]).toBeCloseTo(10, 6);
    expect(interpolateMorph(pair, 1, 8)[0][0][2][0]).toBeCloseTo(20, 6);

    // Gleiche Nummer, anderer Name, keine gemeinsame Fläche: Reform, kein Morph.
    expect(planMorph([shape('37', 'Mannheim III', [[square(10)]])],
      [shape('37', 'Wiesloch', [[square(10, 50, 50)]])]).fadeKeys).toEqual(['37']);

    // Gleicher Name (auch bei anderer Nummer) oder klar überlappende Fläche paart.
    expect(planMorph([shape('37', ' Bruchsal ', [[square(10)]])],
      [shape('41', 'bruchsal', [[square(20, 1, 1)]])]).pairs.map(entry => entry.key)).toEqual(['41']);
    expect(planMorph([shape('1', 'Stuttgart I', [[square(10)]])],
      [shape('2', 'Stuttgart-Nord', [[square(10, 1, 1)]])]).pairs.map(entry => entry.key)).toEqual(['2']);

    // Splits/Merges und das Punktbudget blenden über.
    expect(planMorph([shape('1', 'Bruchsal', [[square(10)], [square(5)]])],
      [shape('1', 'Bruchsal', [[square(20)]])]).fadeKeys).toEqual(['1']);
    expect(planMorph([shape('1', 'Bruchsal', [[square(10)]])],
      [shape('1', 'Bruchsal', [[square(20)]])], { maxTotalPoints: 1 }).pairs).toEqual([]);
  });

  it('resampelt Ringe auf gleiche Punktzahl und projiziert verlustfrei', () => {
    const ring: [number, number][] = [[0, 0], [4, 0], [4, 4], [0, 4]];
    expect(resampleRing(ring, 16)).toHaveLength(16);
    expect(resampleRing(ring, 4)).toEqual(ring);
    const [lng, lat] = unprojectPosition(projectPosition([9.18, 48.78], 8), 8);
    expect(lng).toBeCloseTo(9.18, 9);
    expect(lat).toBeCloseTo(48.78, 9);
    expect(geometryToMorphPolygons({ type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1]]] })?.multi).toBe(false);
    expect(geometryToMorphPolygons({ type: 'Polygon', coordinates: [[[0, 0], [1, 'x'], [1, 1]]] })).toBeNull();
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
