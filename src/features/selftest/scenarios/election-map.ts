import { candidacyPeriodLabel } from '@/features/election-analysis/deputyParticipation';
import { compareParliamentParties } from '@/features/election-analysis/seatDistributionModel';
import { deputyTenureCoverage } from '@/features/election-analysis/deputyTenure';
import { deputyElectionResultBars, type DeputyElectionResultData } from '@/features/election-analysis/deputyElectionResult';
import { candidacyResultOrigin, candidateMandateLabel, candidateOutcomeLabel, candidateResultConflict, type LinkedCandidateResult } from '@/features/election-history/candidateResults';
import { portraitCrop, portraitSource, isDeputyPortrait } from '@/features/election-history/portrait';
import { canConfirmDeputySelection, connectedDeputyMandates, deputyHistoryAction } from '@/features/election-history/deputySelection';
import { projectHistoricalDistricts } from '@/features/election-history/mapProjection';
import { HISTORICAL_DISTRICTS_1952 } from '@/utils/electoralGeometryCatalog';
import { parseElectoralManifest } from '@/utils/electoralTopology';
import { ELECTORAL_DISTRICT_MANIFESTS } from '@/utils/electoralDistrictAsset';
import { electoralGeometryYear } from '@/utils/electoralTopology';
import { withHistoricalDistrictNames } from '@/features/election-history/historicalDistrictNames';
import { sourceHistoricalDistrictName, isReconstructedBoundary } from '@/utils/electoralGeometryCatalog';
import { confirmedPeriodGeometryYear, withPeriodGeometry } from '@/features/election-history/periodGeometry';
import type { ElectionHistoryData, ElectionPeriod } from '@/features/election-history/types';
import { hasRenderableBoundary, searchElectionDistricts, timeTravelOrder, timeTravelPeriodAt } from '@/features/election-districts/mapModel';
import type { TestScenario } from '../types';

export const electionMapScenario: TestScenario = {
  id: 'election-map', title: 'Wahlkreiskarte: Suche und Grenzdaten',
  description: 'Prüft die Such- und Geometrieregeln ohne Datenbankzugriffe.',
  touches: [], features: ['election-districts'],
  limitations: ['Die visuelle Ebenenreihenfolge und mobile Bedienung werden separat im Browser geprüft.'],
  steps: [
    { id: 'deputy-candidacy-without-tenure', label: 'Profilzeitleiste: erfolglose Wahlteilnahme bleibt von einer Mitgliedschaft getrennt', kind: 'logic', run: async () => {
      const coverage = deputyTenureCoverage({ starts_on: '1992-01-01', ends_on: '1996-01-01' }, [], '2026-11-18');
      return { ok: coverage.segments.length === 0 && candidacyPeriodLabel([{ outcome: 'not_elected' }]) === 'Kandidiert · nicht gewählt'
        && candidacyPeriodLabel([{ outcome: 'unknown' }]) === 'Kandidiert · Wahlausgang offen'
        && candidacyPeriodLabel([]) === 'Keine Mitgliedschaft',
        message: 'Erfolglose Kandidaturen sind eigene Wahlteilnahmen; unbekannte Ausgänge werden nicht als Niederlage bezeichnet und erzeugen keine gefüllte Mandatszeit.' };
    } },
    { id: 'deputy-parliament-party-order', label: 'Landes- und Profilgrafik ordnen Sitze in der vorgegebenen Parteienfolge', kind: 'logic', run: async () => {
      const parties = ['NPD','REP','AfD','CDU','FDP','GRÜNE','SPD'].sort(compareParliamentParties);
      if (parties.join(',') !== 'SPD,GRÜNE,FDP,CDU,AfD,REP,NPD') throw new Error('Historische Parteien müssen nach AfD stehen.');
      if (compareParliamentParties('AFD','REP') >= 0 || compareParliamentParties('SPD','GRÜNE') >= 0) throw new Error('Schreibweisen dürfen die räumliche Parteienfolge nicht ändern.');
      return { ok: true, message: 'Beide Sitzgrafiken verwenden dieselbe Parteienfolge einschließlich REP und NPD.' };
    } },
    { id: 'deputy-tenure-coverage', label: 'Mandatsbalken zeigen echte Teilzeiten, Lücken und keine zukünftige Mitgliedschaft', kind: 'logic', run: async () => {
      const period = { starts_on: '2026-01-01', ends_on: '2026-01-10' };
      const partial = deputyTenureCoverage(period, [{ starts_on: '2026-01-03', ends_on: '2026-01-06' }], '2026-01-20');
      if (partial.unknown || partial.segments[0]?.start !== 20 || partial.segments[0]?.width !== 40) throw new Error('Später Eintritt und früher Austritt müssen an der richtigen Balkenposition liegen.');
      const union = deputyTenureCoverage(period, [{ starts_on: '2026-01-01', ends_on: '2026-01-03' }, { starts_on: '2026-01-03', ends_on: '2026-01-05' }], '2026-01-20');
      if (union.segments.length !== 1 || union.segments[0].width !== 50) throw new Error('Überlappende Mandatsabschnitte dürfen nicht doppelt zählen.');
      const gaps = deputyTenureCoverage(period, [{ starts_on: '2026-01-01', ends_on: '2026-01-02' }, { starts_on: '2026-01-05', ends_on: '2026-01-06' }], '2026-01-20');
      if (gaps.segments.length !== 2 || gaps.segments[1].start !== 40) throw new Error('Unterbrechungen innerhalb einer Periode bleiben sichtbar.');
      const ongoing = deputyTenureCoverage(period, [period], '2026-01-05');
      const missing = deputyTenureCoverage(period, [{ starts_on: null, ends_on: '2026-01-10' }], '2026-01-20');
      if (ongoing.segments[0]?.width !== 50 || !missing.unknown || missing.segments.length) throw new Error('Zukünftige oder unbekannte Zeiten dürfen nicht als absolvierte Zeit erscheinen.');
      if (deputyTenureCoverage(period, [], '2026-01-20').segments.length) throw new Error('Eine Periode ohne Mitgliedschaft bleibt schraffiert.');
      return { ok: true, message: 'Teilzeiten, Überlappungen, Unterbrechungen und Datumsunsicherheit bleiben getrennt.' };
    } },
    { id: 'deputy-profile-election-bars', label: 'Profil zeigt eigene Kandidatur, bekannte Gegenkandidaturen und nur belegte Reststimmen', kind: 'logic', run: async () => {
      const source = { preliminary: false, data_release: 'same', notes: null };
      const sample: DeputyElectionResultData = { mandate_id: 'm', period_number: 18, ballot: 'first', entry_type: 'election', mandate_type: 'list', district_name: 'Wahlkreis',
        candidates: [{ ...source, id: 'c', name: 'Eigene Person', party: 'SPD', votes: 23, share: 23, is_own: true, source_url: null }],
        results: [{ ...source, party: 'SPD', votes: 23, share: 23 }, { ...source, party: 'CDU', votes: 28, share: 28 }, { ...source, party: 'FDP', votes: 15, share: 15 }],
        turnout: { valid_votes: 100, data_release: 'same', preliminary: false } };
      const bars = deputyElectionResultBars(sample);
      if (bars[0].label !== 'Eigene Person' || !bars[0].own || bars.find(row => row.key === 'residual')?.share !== 34 || bars.find(row => row.party === 'CDU')?.label !== 'CDU') throw new Error('Eigene Kandidatur und belegter Rest müssen korrekt erscheinen; Namen dürfen nicht erfunden werden.');
      if (deputyElectionResultBars({ ...sample, turnout: null }).some(row => row.key === 'residual') || deputyElectionResultBars({ ...sample, turnout: { ...sample.turnout!, data_release: 'other' } }).some(row => row.key === 'residual')) throw new Error('Ohne passenden Nenner/Datenstand gibt es keinen berechneten Rest.');
      const conflicting = deputyElectionResultBars({ ...sample, candidates: [{ ...sample.candidates[0], share: 24 }] });
      if (!conflicting[0].conflict || conflicting[0].share !== 24 || conflicting.some(row => row.key === 'residual')) throw new Error('Persönliche abweichende Ergebnisse bleiben erhalten und sperren den Rest.');
      const missing = deputyElectionResultBars({ ...sample, results: [], turnout: null, candidates: [{ ...sample.candidates[0], votes: null, share: null }] });
      if (missing[0].share !== null || !missing[0].own) throw new Error('Fehlende persönliche Ergebnisse bleiben unbekannt.');
      return { ok: true, message: 'Eigene Kandidatur, Partei-Fallback, unbekannte Werte und gemeinsamer Nenner werden getrennt behandelt.' };
    } },
    { id: 'assembled-candidacy-result-provenance', label: 'Automatische Ergebnisübernahme bewahrt manuelle Zahlen und fehlende Werte', kind: 'logic', run: async () => {
      const automatic = { votes: 100, vote_share: 20.12345, result_origin: 'district_result', result_snapshot: { votes: 100, share: 20.12345 } };
      if (candidacyResultOrigin(automatic) !== 'automatic') throw new Error('Vollständig übernommene Werte müssen als automatisch erkennbar sein.');
      if (candidacyResultOrigin({ ...automatic, votes: 101 }) !== 'mixed' || candidacyResultOrigin({ ...automatic, result_snapshot: { share: 20.12345 } }) !== 'mixed') throw new Error('Geänderte oder zuvor persönlich eingetragene Stimmen bleiben manuell.');
      if (candidacyResultOrigin({ votes: null, vote_share: null }) !== 'missing' || candidacyResultOrigin({ votes: 0, vote_share: 0 }) !== 'manual') throw new Error('Fehlende Werte und echte Nullergebnisse sind verschieden.');
      if (candidacyResultOrigin({ ...automatic, votes: null, result_snapshot: { share: 20.12345 } }) !== 'automatic') throw new Error('Ein belegter Anteil braucht keine erfundene absolute Stimmenzahl.');
      return { ok: true, message: 'Feldherkunft und fünf Nachkommastellen bleiben erhalten; manuelle Zahlen werden nicht zu automatischen Werten.' };
    } },
    { id: 'candidate-result-conflicts', label: 'Persönliche Ergebnisse und zugeordnete Wahlkreisergebnisse bleiben getrennt', kind: 'logic', run: async () => {
      const row: LinkedCandidateResult = { candidacy_id: 'c', person_id: 'p', person_name: 'Person', party: 'SPD', votes: 100, vote_share: 20, ballot_type: 'candidate', outcome: 'not_elected', mandate_entry_type: null, next_mandate_period: null, result_notes: null, source_url: null, link_status: 'linked', district_result: { ballot: 'single', votes: 100, share: 20, preliminary: true, data_release: null, notes: null } };
      if (candidateResultConflict(row) || candidateResultConflict({ ...row, votes: null, vote_share: null })) throw new Error('Gleiche oder fehlende persönliche Werte sind keine Konflikte.');
      if (!candidateResultConflict({ ...row, votes: 101 }) || !candidateResultConflict({ ...row, vote_share: 20.1 })) throw new Error('Abweichende Stimmen und Anteile müssen sichtbar bleiben.');
      if (candidateOutcomeLabel(row) !== 'Bei dieser Wahlbewerbung ohne Mandat'
        || candidateMandateLabel({ ...row, mandate_entry_type: 'succession' }) !== 'In dieser Wahlperiode nachgerückt'
        || candidateMandateLabel({ ...row, next_mandate_period: 5 }) !== 'Mandat ab der 5. Wahlperiode erfasst') {
        throw new Error('Die Wahlbewerbung, Nachrücken und spätere Mandate müssen getrennt erkennbar bleiben.');
      }
      if (candidateResultConflict({ ...row, link_status: 'ambiguous', votes: 101 }) || candidateResultConflict({ ...row, district_result: null })) throw new Error('Ohne eindeutige Verknüpfung darf kein Vergleich behauptet werden.');
      return { ok: true, message: 'Konflikte sind sichtbar; fehlende Werte bleiben unbekannt.' };
    } },
    { id: 'deputy-portrait-crop', label: 'Porträtausschnitt füllt den 3:4-Rahmen; sichere Bildnachweise bleiben an ihrer Mandatsverbindung', kind: 'logic', run: async () => {
      for (const [width, height] of [[1200, 600], [400, 1600], [100, 100]]) {
        for (const zoom of [1, 4]) {
          const crop = portraitCrop(width, height, zoom, 10000, -10000);
          if (crop.sourceX < -0.001 || crop.sourceY < -0.001 || crop.sourceX + crop.sourceWidth > width + 0.001 || crop.sourceY + crop.sourceHeight > height + 0.001 || Math.abs(crop.sourceWidth / crop.sourceHeight - 0.75) > 0.001) throw new Error('Der Ausschnitt muss bei jedem Zoom im Bild bleiben und den Rahmen vollständig füllen.');
        }
      }
      if (portraitSource({ label: 'Quelle', url: 'javascript:alert(1)', author: '', license: '' })) throw new Error('Quellen dürfen keine aktiven URL-Schemata enthalten.');
      const id = '11111111-1111-4111-8111-111111111111';
      const metadata = { schemaVersion: 1, connectionId: id, version: id, image: 'portrait-0123456789abcdef.webp', thumbnail: 'thumb-0123456789abcdef.webp', source: { label: 'Landtag', url: 'https://www.landtag-bw.de/', author: '', license: '' }, updatedAt: '2026-11-16' };
      if (!isDeputyPortrait(metadata, id) || isDeputyPortrait({ ...metadata, image: '../anderes-bild.webp' }, id) || isDeputyPortrait(metadata, '22222222-2222-4222-8222-222222222222')) throw new Error('Bildnachweise dürfen weder die Verbindung noch den öffentlichen Bildordner wechseln.');
      return { ok: true, message: '3:4-Ausschnitte bleiben im Bild; Quellen-URLs und feste Bildpfade werden validiert.' };
    } },
    { id: 'completed-deputy-history', label: 'Zusammengefasste Personen öffnen eine chronologische Übersicht ohne weitere Bestätigungsaufforderung', kind: 'logic', run: async () => {
      if (deputyHistoryAction(0) !== 'Ansehen' || deputyHistoryAction(2) !== 'Mandatszeiten verbinden') throw new Error('Vollständige Mandatshistorien dürfen nicht erneut zum Verbinden auffordern.');
      return { ok: true, message: 'Vollständige Historien öffnen als Leseansicht; offene Einträge bleiben bearbeitbar.' };
    } },
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
    { id: 'time-travel-order', label: 'Zeitreise beginnt bei der ältesten Periode und folgt den Wahljahren', kind: 'logic', run: async () => {
      const periods = [
        { id: 'p18', election_year: 2026 },
        { id: 'p1', election_year: 1952 },
        { id: 'p11', election_year: 1992 },
        { id: 'unknown-year', election_year: null },
      ];
      const chronology = timeTravelOrder(periods);
      return { ok: chronology.map(period => period.id).join(',') === 'p1,p11,p18,unknown-year'
        && timeTravelPeriodAt(chronology, 0)?.id === 'p1'
        && timeTravelPeriodAt(chronology, 1)?.id === 'p11'
        && timeTravelPeriodAt(chronology, 3)?.id === 'unknown-year'
        && timeTravelPeriodAt(chronology, 4)?.id === 'p1'
        && timeTravelPeriodAt([], 0) === null
        && timeTravelPeriodAt([{ id: 'only' }], 0) === null,
        message: 'Die Zeitreise beginnt bei der ältesten Periode, läuft aufwärts durch die Wahljahre und wiederholt keine einzelne Periode.' };
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
