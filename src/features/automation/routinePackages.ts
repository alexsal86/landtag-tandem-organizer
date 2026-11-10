import type { RoutineRelease } from './routineWorkflow';
export interface RoutinePackageStep {
  id: string; run_id: string; position: number; title: string; kind: string; release: RoutineRelease;
  assignee_id: string; approver_id: string | null; due_day: string;
  status: 'waiting' | 'active' | 'completed' | 'blocked' | 'failed';
  entity_id: string | null; approval_id: string | null; error_message: string | null; attempts: number;
}
export interface RoutinePackage {
  id: string; rule_id: string; year: number; task_id: string; start_day: string; finish_day: string;
  steps: RoutinePackageStep[];
}
export function routineStepLabel(step: Pick<RoutinePackageStep, 'status' | 'release'>) {
  if (step.status === 'waiting') return ({ package_start: 'Wartet auf Start', scheduled: 'Wartet auf Termin', after_previous: 'Wartet auf vorherigen Schritt', after_approval: 'Wartet auf Freigabe' })[step.release];
  return ({ active: 'In Bearbeitung', completed: 'Erledigt', blocked: 'Angehalten', failed: 'Fehlgeschlagen' })[step.status];
}
export function routineEntityLink(kind: string, id: string, parentTask: string) {
  if (kind === 'decision') return `/mywork?tab=decisions&highlight=${id}`;
  if (kind === 'case' || kind === 'jour_fixe') return `/vorgaenge/${id}`;
  return `/mywork?tab=tasks&highlight=${kind === 'subtask' ? parentTask : id}`;
}
export function routineProgress(pkg: RoutinePackage) {
  return { total: pkg.steps.length, completed: pkg.steps.filter(step => step.status === 'completed').length,
    failed: pkg.steps.filter(step => step.status === 'failed').length,
    blocked: pkg.steps.filter(step => step.status === 'blocked').length };
}
