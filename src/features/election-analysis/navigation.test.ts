import { describe, expect, it } from 'vitest';
import { analysisDestination, districtProfileUrl, dataPillars, normalizeAnalysisParams, resolveAnalysisNavigation } from './navigation';
import { sectionLabels } from './model';

const route = (query: string) => resolveAnalysisNavigation(new URLSearchParams(query));

describe('Vier Säulen der Wahlanalyse', () => {
  it('ordnet jede primäre Ansicht genau einer Säule zu und hält Prüfungen aus der Hauptnavigation', () => {
    const views = dataPillars.flatMap(pillar => pillar.sections);
    expect(dataPillars.map(pillar => pillar.id)).toEqual(['land', 'wahlkreise', 'parlament', 'simulation']);
    expect(new Set(views).size).toBe(views.length);
    expect(new Set([...views, 'quality', 'sources', 'turnout-trend'])).toEqual(new Set(Object.keys(sectionLabels)));
    expect(views).not.toContain('quality');
    expect(views).not.toContain('sources');
  });

  it.each(dataPillars.flatMap(pillar => pillar.sections.map(section => [pillar.id, section] as const)))('öffnet %s / %s über neue und bisherige Links', (tab, section) => {
    expect(route(`dataTab=${tab}&sub=${section}`).section).toBe(section);
    expect(route(`analysisSection=${section}`).pillar.id).toBe(tab);
    const next = analysisDestination(new URLSearchParams('analysisYear=2021&analysisDistrict=37'), section);
    expect(next.get('dataTab')).toBe(tab);
    expect(next.get('sub')).toBe(section);
    expect(next.get('analysisSection')).toBe(section);
    expect(next.get('analysisYear')).toBe('2021');
    expect(next.get('analysisDistrict')).toBe('37');
  });

  it.each(dataPillars)('öffnet die Standardansicht von $id und behandelt unbekannte Ansichten', pillar => {
    expect(route(`dataTab=${pillar.id}`).section).toBe(pillar.sections[0]);
    expect(route(`dataTab=${pillar.id}&sub=unknown`).section).toBe(pillar.sections[0]);
  });

  it('erhält Beteiligung, Wanderungsmatrix, Forschung und alte Rechnerlinks', () => {
    expect(route('analysisSection=turnout')).toMatchObject({ section: 'history', showTurnout: true });
    expect(normalizeAnalysisParams(new URLSearchParams('analysisSection=flow-matrix')).get('analysisYear')).toBe('2006');
    expect(route('analysisSection=turnout-trend')).toMatchObject({ section: 'research', researchTool: 'turnout' });
    expect(route('analysisSection=research&researchTool=seats').section).toBe('seats');
    expect(route('dataTool=rechner').section).toBe('seats');
    for (const tool of ['typology', 'structure', 'flows', 'scenario', 'saved', 'municipal']) {
      expect(route(`analysisSection=research&researchTool=${tool}`)).toMatchObject({ section: 'research', researchTool: tool });
    }
  });

  it.each(['quality', 'sources'])('öffnet %s in der Fußzeile und erhält Jahr und Filter', check => {
    const next = normalizeAnalysisParams(new URLSearchParams(`analysisSection=${check}&analysisYear=1952&analysisParty=SPD`));
    expect(route(next.toString())).toMatchObject({ section: 'state', check });
    expect(next.get('analysisYear')).toBe('1952');
    expect(next.get('analysisParty')).toBe('SPD');
    const closed = analysisDestination(next, 'profile');
    expect(route(closed.toString())).toMatchObject({ section: 'profile', check: null });
  });

  it('verlinkt Mandate nur innerhalb derselben unterstützten Wahl mit eindeutiger Nummer', () => {
    expect(districtProfileUrl(2021, '37')).toContain('analysisYear=2021&analysisDistrict=37');
    expect(districtProfileUrl(1952, 'NW 37')).toBeNull();
    expect(districtProfileUrl(1988, '37')).toContain('analysisYear=1988&analysisDistrict=37');
    expect(districtProfileUrl(null, '37')).toBeNull();
    expect(districtProfileUrl(2021, 'Wiesloch')).toBeNull();
    expect(districtProfileUrl(2021, '71')).toBeNull();
  });

  it('normalisiert stabil und verhindert widersprüchliche Säulen/Unteransichten', () => {
    const next = normalizeAnalysisParams(new URLSearchParams('dataTab=land&sub=profile&analysisSection=state&analysisDistrict=37'));
    expect(next.get('dataTab')).toBe('wahlkreise');
    expect(next.get('analysisSection')).toBe('profile');
    expect(normalizeAnalysisParams(next).toString()).toBe(next.toString());
    expect(route('dataTab=invalid&sub=invalid').section).toBe('state');
    expect(route('analysisSection=toString').section).toBe('state');
    expect(analysisDestination(new URLSearchParams('researchTool=seats'), 'research').has('researchTool')).toBe(false);
  });
});
