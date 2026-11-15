import { withHistoricalDistrictNames } from '@/features/election-history/historicalDistrictNames';
import { sourceHistoricalDistrictName, isReconstructedBoundary } from '@/utils/electoralGeometryCatalog';
import { confirmedPeriodGeometryYear, withPeriodGeometry } from '@/features/election-history/periodGeometry';
import type { ElectionHistoryData, ElectionPeriod } from '@/features/election-history/types';
import { hasRenderableBoundary, searchElectionDistricts } from '@/features/election-districts/mapModel';
import type { TestScenario } from '../types';

export const electionMapScenario: TestScenario = {
  id: 'election-map', title: 'Wahlkreiskarte: Suche und Grenzdaten',
  description: 'Prüft die Such- und Geometrieregeln ohne Datenbankzugriffe.',
  touches: [], features: ['election-districts'],
  limitations: ['Die visuelle Ebenenreihenfolge und mobile Bedienung werden separat im Browser geprüft.'],
  steps: [
    { id: 'historical-geometry-confirmation', label: 'Historische Geometrie nur nach Bestätigung und nur für die gewählte Periode', kind: 'logic', run: async () => {
      const period: ElectionPeriod = { id: 'p', number: 18, name: '2026', election_year: 2026,
        election_date: null, starts_on: null, ends_on: null, is_current: false, is_published: true,
        source_url: null, notes: null, boundary_geometry_year: 2021, boundary_geometry_confirmed: true };
      const shape = { type: 'Polygon' as const, coordinates: [[[8, 48], [9, 48], [9, 49], [8, 48]]] };
      const district = { id: 'd', period_id: 'p', district_number: 1, number_label: null, boundaries: null,
        name: 'Wahlkreis', boundary_note: null, source_url: null };
      const data: ElectionHistoryData = { periods: [period], districts: [district, { ...district, id: 'other', period_id: 'other' },
        { ...district, id: 'individual', boundaries: shape }, { ...district, id: 'missing', district_number: null }], people: [], mandates: [], candidacies: [] };
      const geometry = { type: 'FeatureCollection' as const, features: [{ type: 'Feature' as const, properties: { Nummer: '1' }, geometry: shape }] };
      const resolved = withPeriodGeometry(data, 'p', geometry);
      const historical = withHistoricalDistrictNames({ ...data, periods: [{ ...period, election_year: 1972 }], districts: [{ ...district, district_number: 37, name: 'Wiesloch' }] });
      return { ok: confirmedPeriodGeometryYear(period) === 2021
        && confirmedPeriodGeometryYear({ ...period, boundary_geometry_confirmed: false }) === null
        && confirmedPeriodGeometryYear({ ...period, election_year: 2006, boundary_geometry_year: 2006 }) === 2006
        && confirmedPeriodGeometryYear({ ...period, election_year: 2011, boundary_geometry_year: 2011 }) === 2011
        && confirmedPeriodGeometryYear({ ...period, election_year: 2006, boundary_geometry_year: 2011 }) === null
        && confirmedPeriodGeometryYear({ ...period, election_year: 1964, boundary_geometry_year: 1968 }) === 1968
        && confirmedPeriodGeometryYear({ ...period, election_year: 1964, boundary_geometry_year: 1972 }) === null
        && confirmedPeriodGeometryYear({ ...period, election_year: 1968, boundary_geometry_year: 1972 }) === null
        && [1976, 1980, 1984].every(year => confirmedPeriodGeometryYear({ ...period, election_year: year, boundary_geometry_year: 1988 }) === 1988)
        && confirmedPeriodGeometryYear({ ...period, election_year: 1972, boundary_geometry_year: 1988 }) === null
        && confirmedPeriodGeometryYear({ ...period, election_year: 1976, boundary_geometry_year: 1976 }) === null
        && [1968, 1972, 1988, 1992, 1996, 2001].every(year => confirmedPeriodGeometryYear({ ...period, election_year: year, boundary_geometry_year: year }) === year)
        && confirmedPeriodGeometryYear({ ...period, election_year: 1992, boundary_geometry_year: 2001 }) === null
        && confirmedPeriodGeometryYear({ ...period, election_year: 1952 }) === null
        && confirmedPeriodGeometryYear({ ...period, boundary_geometry_year: 2016 }) === null
        && resolved.districts[0].boundaries === shape && resolved.districts[1].boundaries === null
        && resolved.districts[2] === data.districts[2] && resolved.districts[3].boundaries === null
        && sourceHistoricalDistrictName(1964, 37) === 'Bruchsal' && sourceHistoricalDistrictName(1968, 37) === 'Bruchsal'
        && sourceHistoricalDistrictName(1968, 33) === 'Mannheim-Stadt III' && sourceHistoricalDistrictName(1968, 5) === 'Stuttgart V'
        && isReconstructedBoundary(1964) && isReconstructedBoundary(1968)
        && sourceHistoricalDistrictName(1972, 37) === 'Bruchsal' && sourceHistoricalDistrictName(1972, 33) === 'Mannheim-Stadt III'
        && sourceHistoricalDistrictName(1972, 5) === 'Stuttgart V' && sourceHistoricalDistrictName(1984, 37) === 'Mannheim III'
        && sourceHistoricalDistrictName(1992, 37) === null && isReconstructedBoundary(1972) && !isReconstructedBoundary(1988)
        && historical.districts[0].name === 'Bruchsal' && historical.districts[0].id === district.id && historical.districts[0].district_number === 37
        && data.districts[0].boundaries === null
        && withPeriodGeometry({ ...data, periods: [{ ...period, boundary_geometry_confirmed: false }] }, 'p', geometry).districts[0].boundaries === null,
        message: 'Keine ungeprüften Grenzstände; 2026 nutzt bestätigt 2021. Einzelumrisse, fremde Perioden und fehlende Nummern bleiben unverändert.' };
    } },
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
