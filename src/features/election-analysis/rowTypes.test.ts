import { describe, expect, it } from 'vitest';
import { analysisBallot, scenarioVisibility, withAnalysisBallot, withAuditStatus, withScenarioModel } from './rowTypes';

describe('Typisierte Datenbankübergänge der Wahlanalyse', () => {
  it('erhält Originalwerte, Nullwerte, Datenstände und zusätzliche Felder', () => {
    const row = { ballot: 'second', model_version: 'bw-lwg-2026-v1', votes: 12345, share: null, data_release: 'final', preliminary: false };
    expect(withScenarioModel(row)).toEqual(row);
    expect(withAnalysisBallot({ ballot: 'single', votes: 0 })).toEqual({ ballot: 'single', votes: 0 });
    expect(withAuditStatus({ section: 'totals', status: 'conflict', existing: 12345 })).toEqual({ section: 'totals', status: 'conflict', existing: 12345 });
    expect(scenarioVisibility('tenant')).toBe('tenant');
    expect(scenarioVisibility('private')).toBe('private');
  });
  it('deutet unbekannte Datenbankwerte nicht stillschweigend um', () => {
    expect(() => analysisBallot('invalid')).toThrow('Stimmenart');
    expect(() => withScenarioModel({ ballot: 'first', model_version: 'unknown' })).toThrow('Modellversion');
    expect(() => scenarioVisibility('public')).toThrow('Sichtbarkeit');
    expect(() => withAuditStatus({ section: 'unknown', status: 'matched' })).toThrow('Bereich');
    expect(() => withAuditStatus({ section: 'state', status: 'unknown' })).toThrow('Status');
  });
});
