import { hasRenderableBoundary, searchElectionDistricts } from '@/features/election-districts/mapModel';
import type { TestScenario } from '../types';

export const electionMapScenario: TestScenario = {
  id: 'election-map', title: 'Wahlkreiskarte: Suche und Grenzdaten',
  description: 'Prüft die Such- und Geometrieregeln ohne Datenbankzugriffe.',
  touches: [], features: ['election-districts'],
  limitations: ['Die visuelle Ebenenreihenfolge und mobile Bedienung werden separat im Browser geprüft.'],
  steps: [
    { id: 'search', label: 'Wahlkreise nach Name oder exakter Nummer finden', kind: 'logic', run: async () => {
      const districts = [
        { district_number: 1, district_name: 'Stuttgart I', district_type: 'wahlkreis' },
        { district_number: 11, district_name: 'Geislingen', district_type: 'wahlkreis' },
        { district_number: 1, district_name: 'Stuttgart Verwaltung', district_type: 'verwaltungsgrenze' },
      ];
      return { ok: searchElectionDistricts(districts, ' STUTTGART ').length === 1
        && searchElectionDistricts(districts, '1').length === 1
        && searchElectionDistricts(districts, '11')[0]?.district_name === 'Geislingen'
        && searchElectionDistricts(districts, 'unbekannt').length === 0
        && searchElectionDistricts(districts, ' ').length === 0,
        message: 'Suche berücksichtigt Namen, exakte Nummern und trennt Verwaltungsgrenzen.' };
    } },
    { id: 'boundaries', label: 'Fehlende, leere und projizierte Grenzdaten erkennen', kind: 'logic', run: async () => {
      const ring = [[8, 48], [9, 48], [9, 49], [8, 48]];
      return { ok: hasRenderableBoundary({ type: 'Polygon', coordinates: [ring] })
        && hasRenderableBoundary({ type: 'MultiPolygon', coordinates: [[ring]] })
        && !hasRenderableBoundary(null)
        && !hasRenderableBoundary({ type: 'Polygon', coordinates: [] })
        && !hasRenderableBoundary({ type: 'Polygon', coordinates: [[[3500000, 5400000]]] })
        && !hasRenderableBoundary({ type: 'MultiPolygon', coordinates: [[ring], []] }),
        message: 'Nur nutzbare WGS84-Polygone werden gezeichnet; Datenlücken bleiben erkennbar.' };
    } },
  ],
};
