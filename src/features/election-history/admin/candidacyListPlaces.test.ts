import { describe, expect, it } from 'vitest';
import { candidacyListPlacement, type CandidacyStateListPlace } from './candidacyListPlaces';
import { historyWorkspaceTab, historyWorkspaceTabs } from './workspaceNavigation';

const candidate = { person_id: 'person', period_id: 'p18', party: 'GRÜNE', list_position: null };
const place: CandidacyStateListPlace = { id: 'entry', list_id: 'list', person_id: 'person', period_id: 'p18', party: 'GRÜNE', position: 7, source_url: 'https://example.org/list' };

describe('Listenplätze bei Kandidaturergebnissen', () => {
  it('zeigt einen bestätigten Listenplatz derselben Person, Periode und Partei mit Herkunft', () => {
    expect(candidacyListPlacement(candidate, [place])).toEqual({ position: 7, roster: place, ambiguous: false, conflict: false });
    expect(candidate.list_position).toBeNull();
    expect(candidacyListPlacement(candidate, [place, place]).position).toBe(7);
  });
  it('übernimmt weder Namen noch Plätze anderer Personen, Parteien oder Wahlen', () => {
    for (const other of [{ ...place, person_id: 'namesake' }, { ...place, period_id: 'p17' }, { ...place, party: 'CDU' }, { ...place, position: 0 }]) {
      expect(candidacyListPlacement(candidate, [other])).toMatchObject({ position: null, roster: null });
    }
    expect(candidacyListPlacement(candidate, []).position).toBeNull();
  });
  it('erhält manuelle Werte und macht Abweichungen ausdrücklich sichtbar', () => {
    const recorded = { ...candidate, list_position: 3 };
    expect(candidacyListPlacement(recorded, [place])).toMatchObject({ position: 3, conflict: true });
    expect(candidacyListPlacement(recorded, [{ ...place, position: 3 }]).conflict).toBe(false);
    expect(recorded.list_position).toBe(3);
  });
  it('wählt bei mehreren passenden Listeneinträgen keinen Platz aus', () => {
    const ambiguous = [place, { ...place, id: 'other', position: 8 }];
    expect(candidacyListPlacement(candidate, ambiguous)).toMatchObject({ position: null, ambiguous: true });
    expect(candidacyListPlacement({ ...candidate, list_position: 3 }, ambiguous)).toMatchObject({ position: 3, ambiguous: true });
  });
});

describe('Wahldaten-Werkbank', () => {
  it('gruppiert Ergebnisse und Landeslisten, hält alle anderen Ansichten und das Register zuletzt', () => {
    expect(historyWorkspaceTab('state_lists')).toBe('candidacies');
    expect(historyWorkspaceTab('issues')).toBe('issues');
    expect(historyWorkspaceTabs.map(tab => tab.id)).toEqual(['periods', 'districts', 'mandates', 'candidacies', 'factions', 'quality', 'sources', 'issues', 'deputies']);
  });
});
