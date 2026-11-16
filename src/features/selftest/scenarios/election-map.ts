import { canConfirmDeputySelection, connectedDeputyMandates } from '@/features/election-history/deputySelection';
import { projectHistoricalDistricts } from '@/features/election-history/mapProjection';
import { HISTORICAL_DISTRICTS_1952 } from '@/utils/electoralGeometryCatalog';
import { parseElectoralManifest } from '@/utils/electoralTopology';
import { ELECTORAL_DISTRICT_MANIFESTS } from '@/utils/electoralDistrictAsset';
import { electoralGeometryYear } from '@/utils/electoralTopology';
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
    { id: 'deputy-explicit-selection', label: 'Mandatsverbindungen bestätigen, erweitern und bei Datumskorrekturen erhalten', kind: 'logic', run: async () => {
      const rows = [{ id: 'first', person_id: null }, { id: 'second', person_id: null }, { id: 'linked', person_id: 'person' }, { id: 'other', person_id: 'different' }];
      if (canConfirmDeputySelection(rows, []) || canConfirmDeputySelection(rows, ['first'])) throw new Error('Eine Verbindung benötigt mehrere ausdrücklich ausgewählte Mandate.');
      if (!canConfirmDeputySelection(rows, ['first', 'second']) || !canConfirmDeputySelection(rows, ['first', 'linked'])) throw new Error('Neue und erweiterte Verbindungen müssen möglich sein.');
      if (canConfirmDeputySelection(rows, ['linked', 'other']) || canConfirmDeputySelection(rows, ['first', 'linked', 'other']) || canConfirmDeputySelection(rows, ['missing', 'first']) || canConfirmDeputySelection(rows, ['first', 'first'])) throw new Error('Verschiedene bestätigte Identitäten, fehlende oder doppelte Mandate dürfen nicht verbunden werden.');
      const linked = [{ id: 'six', person_id: null, connection_id: 'adam-history', ends_on: '1980-05-31' }, { id: 'seven', person_id: null, connection_id: 'adam-history', ends_on: '1984-05-31' }];
      if (canConfirmDeputySelection(linked, ['six', 'seven'])) throw new Error('Eine bestehende Verbindung benötigt keine erneute Bestätigung.');
      if (!canConfirmDeputySelection([...linked, { id: 'eight', person_id: null, connection_id: null, ends_on: null }], ['seven', 'eight'])) throw new Error('Eine Mandatsverbindung muss ohne Personenanlage erweiterbar sein.');
      const corrected = linked.map(row => row.id === 'seven' ? { ...row, ends_on: '1983-12-01' } : row);
      const connections = connectedDeputyMandates(corrected);
      if (connections.length !== 1 || connections[0].length !== 2 || connections[0][1].ends_on !== '1983-12-01' || connections[0].some(row => row.person_id !== null)) throw new Error('Datumskorrekturen müssen ohne erneute Bestätigung in der bestehenden Verbindung erscheinen.');
      return { ok: true, message: 'Verbindungen bleiben bei Zeitraumkorrekturen erhalten; getrennte bestätigte Identitäten sind geschützt.' };
    } },
    { id: 'regional-1952-source', label: '1952: 74 Quellen, regionale Nummern und keine technische Mandatszuordnung', kind: 'logic', run: async () => {
      const period: ElectionPeriod = { id: 'regional', number: 1, name: '1952', election_year: 1952, election_date: null,
        starts_on: null, ends_on: null, is_current: false, is_published: true, source_url: null, notes: null,
        boundary_geometry_year: 1952, boundary_geometry_confirmed: true };
      const shape = { type: 'Polygon' as const, coordinates: [[[8,48],[9,48],[9,49],[8,48]]] };
      const other = { type: 'Polygon' as const, coordinates: [[[9,48],[10,48],[10,49],[9,48]]] };
      const row = { period_id: period.id, district_number: null, number_label: null, boundaries: null, name: 'Quelle', boundary_note: null, source_url: null };
      const data: ElectionHistoryData = { periods: [period], people: [], candidacies: [], mandates: [{ id:'m', period_id:period.id,
        person_id:null, person_name:'Abgeordneter', original_mandate:null, party_label:null, left_early:false, district_id:'legacy', candidacy_id:null,
        party:'SPD', mandate_type:'direct', entry_type:'election', start_from_period:false, end_from_period:false, starts_on:null, ends_on:null, source_url:null, notes:null }],
        districts: [{ ...row, id:'legacy', district_number:46 }, { ...row, id:'north', geometry_source_key:'1952:NW:1' }, { ...row, id:'south', geometry_source_key:'1952:SB:1' }] };
      const geometry = { type:'FeatureCollection' as const, features: [
        { type:'Feature' as const, properties:{ Nummer:'1', Region:'NW', Nummer_historisch:1 }, geometry:shape },
        { type:'Feature' as const, properties:{ Nummer:'46', Region:'SB', Nummer_historisch:1 }, geometry:other },
      ] };
      const resolved = withHistoricalDistrictNames(withPeriodGeometry(data, period.id, geometry));
      const projected = projectHistoricalDistricts([], resolved, period.id);
      const districts = HISTORICAL_DISTRICTS_1952.map((d,i) => ({ shape:i.toString(16).padStart(64,'0'), package:`/data/geometry/shapes-${'a'.repeat(64)}.topojson`,
        properties:{ Nummer:String(d.technicalNumber), Nummer_technisch_1952:d.technicalNumber, Region:d.region, Nummer_historisch:d.historicalNumber } }));
      const manifest = parseElectoralManifest({ version:1, year:1952, districts },1952);
      let wrongRegion=false, wrongCount=false;
      try { parseElectoralManifest({ ...manifest, districts:[{ ...districts[0], properties:{...districts[0].properties,Region:'SB'} },...districts.slice(1)] },1952); } catch { wrongRegion=true; }
      try { parseElectoralManifest({ ...manifest, year:1960 },1960); } catch { wrongCount=true; }
      return { ok: manifest.districts.length===74 && wrongRegion && wrongCount && resolved.districts[0].boundaries===null
        && resolved.districts[1].boundaries===shape && resolved.districts[2].boundaries===other
        && resolved.districts[2].number_label==='SB 1' && projected.length===2 && projected.every(d => !d.representatives?.length)
        && searchElectionDistricts(projected,'SB1')[0]?.id==='south' && searchElectionDistricts(projected,'1').length===2
        && searchElectionDistricts(projected,'46').length===0 && resolved.mandates[0].district_id==='legacy',
        message:'Regionale Nummern sind eindeutig; technische 46 bindet kein Mandat an SB 1. Alle übrigen Jahre erwarten weiterhin 70 Wahlkreise.' };
    } },
    { id: 'district-detail-assets', label: 'Detailkarten teilen bestätigte Grenzstände ohne Ersatz für fehlende Jahre', kind: 'logic', run: async () => ({
      ok: [1952, 1956, 1960, 1964, 1968, 1972, 1976, 1980, 1984, 1988, 1992, 1996, 2001, 2006, 2011, 2016, 2021, 2026]
        .every(year => !!ELECTORAL_DISTRICT_MANIFESTS[electoralGeometryYear(year)!])
        && electoralGeometryYear(1952) === 1952
        && electoralGeometryYear(2026) === electoralGeometryYear(2021),
      message: 'Einzelformen sind für alle hinterlegten Grenzstände abrufbar; 1952 behält seine regionalen Quellenkennungen.'
    }) },
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
        && confirmedPeriodGeometryYear({ ...period, election_year: 1956, boundary_geometry_year: 1960 }) === 1960
        && confirmedPeriodGeometryYear({ ...period, election_year: 1956, boundary_geometry_year: 1968 }) === null
        && confirmedPeriodGeometryYear({ ...period, election_year: 1964, boundary_geometry_year: 1968 }) === 1968
        && confirmedPeriodGeometryYear({ ...period, election_year: 1964, boundary_geometry_year: 1972 }) === null
        && confirmedPeriodGeometryYear({ ...period, election_year: 1968, boundary_geometry_year: 1972 }) === null
        && [1976, 1980, 1984].every(year => confirmedPeriodGeometryYear({ ...period, election_year: year, boundary_geometry_year: 1988 }) === 1988)
        && confirmedPeriodGeometryYear({ ...period, election_year: 1972, boundary_geometry_year: 1988 }) === null
        && confirmedPeriodGeometryYear({ ...period, election_year: 1976, boundary_geometry_year: 1976 }) === null
        && [1960, 1968, 1972, 1988, 1992, 1996, 2001].every(year => confirmedPeriodGeometryYear({ ...period, election_year: year, boundary_geometry_year: year }) === year)
        && confirmedPeriodGeometryYear({ ...period, election_year: 1992, boundary_geometry_year: 2001 }) === null
        && confirmedPeriodGeometryYear({ ...period, election_year: 1952 }) === null
        && confirmedPeriodGeometryYear({ ...period, election_year: 1952, boundary_geometry_year: 1952 }) === 1952
        && confirmedPeriodGeometryYear({ ...period, boundary_geometry_year: 2016 }) === null
        && resolved.districts[0].boundaries === shape && resolved.districts[1].boundaries === null
        && resolved.districts[2] === data.districts[2] && resolved.districts[3].boundaries === null
        && sourceHistoricalDistrictName(1956, 37) === 'Bruchsal' && sourceHistoricalDistrictName(1960, 33) === 'Mannheim-Stadt III'
        && sourceHistoricalDistrictName(1960, 5) === 'Stuttgart V' && isReconstructedBoundary(1956) && isReconstructedBoundary(1960)
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
