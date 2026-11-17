import type { Ballot } from './types';
import type { WorkbookAudit } from './stateHistoryModel';
import type { StoredScenario } from './research/workspaceTypes';

/** PostgreSQL CHECK-constrained text arrives as string in generated database types. */
export function analysisBallot(value: string): Ballot {
  if (value === 'single' || value === 'first' || value === 'second') return value;
  throw new Error('Unbekannte Stimmenart im Analysedatensatz.');
}
export function withAnalysisBallot<T extends { ballot: string }>(row: T) {
  return { ...row, ballot: analysisBallot(row.ballot) };
}
export function withScenarioModel<T extends { ballot: string; model_version: string }>(row: T): T & { ballot: Ballot; model_version: StoredScenario['model_version'] } {
  const model_version = row.model_version;
  if (model_version !== 'shares-v1' && model_version !== 'bw-lwg-2026-v1') {
    throw new Error('Unbekannte Szenario-Modellversion.');
  }
  return { ...withAnalysisBallot(row), model_version };
}
export function scenarioVisibility(value: string): 'private' | 'tenant' {
  if (value === 'private' || value === 'tenant') return value;
  throw new Error('Unbekannte Szenario-Sichtbarkeit.');
}
export function withAuditStatus<T extends { section: string; status: string }>(row: T): T & Pick<WorkbookAudit, 'section' | 'status'> {
  const section = row.section;
  const status = row.status;
  if (section !== 'state' && section !== 'flows' && section !== 'totals' && section !== 'matrix') {
    throw new Error('Unbekannter Bereich im Quellenprotokoll.');
  }
  if (status !== 'added' && status !== 'matched' && status !== 'conflict') {
    throw new Error('Unbekannter Status im Quellenprotokoll.');
  }
  return { ...row, section, status };
}
