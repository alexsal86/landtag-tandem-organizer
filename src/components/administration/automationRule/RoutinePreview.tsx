import { editorPlanYear } from './editorModel';
import type { WizardForm } from './types';
import { previewRoutine, ROUTINE_DEADLINES, ROUTINE_RELEASES, validateRoutineWorkflow } from '@/features/automation/routineWorkflow';
import { ROUTINE_STEP_KINDS, validateOfficeRoutine } from '@/features/automation/officeRoutineTemplates';
import { useTenantUsers } from '@/hooks/useTenantUsers';

const dateLabel = (date: string) => new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Berlin' }).format(new Date(`${date}T12:00:00Z`));
export function RoutinePreview({ form }: { form: WizardForm }) {
  const { users } = useTenantUsers();
  const actions = form.actions.filter(action => action.type === 'run_annual_routine');
  const year = editorPlanYear(form);
  if (!actions.length) return null;
  return <section className="space-y-3 rounded-lg border bg-muted/30 p-4" aria-label="Vorschau der Jahresroutine">
    <h3 className="font-medium">Das wird diese Routine auslösen</h3>
    <p className="text-xs text-muted-foreground">Planvorschau für {year}{form.triggerType === 'schedule' ? ' anhand des nächsten automatischen Starts' : ' für eine manuelle Ausführung'}. Ein manueller Sofortstart verwendet immer das laufende Jahr; Fristen können dann bereits vergangen sein.</p>
    {actions.map((action, index) => {
      if (action.systemFunction) return <p key={index} className="text-sm">Systemaktion: {action.title}. Wird höchstens einmal pro Jahr ausgeführt.</p>;
      const problem = validateOfficeRoutine(action) || validateRoutineWorkflow(action);
      if (problem) return <p key={index} role="alert" className="text-sm text-destructive">{problem}</p>;
      try {
        const plan = previewRoutine(action, form.schedule, year);
        const owner = (id: string) => users.find(user => user.id === id)?.display_name || (id ? 'Ausgewählte Person' : users.find(user => user.id === action.taskAssignees)?.display_name || 'Zuständige Person des Pakets (standardmäßig Büroleitung)');
        const counts = ROUTINE_STEP_KINDS.map(kind => ({ label: kind.label, count: plan.steps.filter(step => step.kind === kind.value).length })).filter(item => item.count);
        return <div key={index} className="space-y-3 text-sm">
          <p><strong>{action.title || 'Aufgabenpaket'}</strong>: Start {dateLabel(plan.start)}, Abschluss {dateLabel(plan.finish)}.</p>
          <p>{counts.length ? counts.map(item => `${item.count} × ${item.label}`).join(' · ') : 'Eine Büroaufgabe ohne weitere Schritte.'}{plan.steps.some(step => step.release === 'after_approval') && ` · ${plan.steps.filter(step => step.release === 'after_approval').length} zusätzliche Freigabeentscheidung(en)`}</p>
          <ol className="space-y-2">{plan.steps.map((step, stepIndex) => <li key={stepIndex} className="rounded-md border bg-background p-3">
            <p className="font-medium">{stepIndex + 1}. {step.title}</p>
            <p className="text-xs text-muted-foreground">{ROUTINE_STEP_KINDS.find(kind => kind.value === step.kind)?.label} · Frist {step.due ? dateLabel(step.due) : 'entsteht nach Abschluss des Bezugsschritts'}</p>
            <p className="text-xs">Start: {ROUTINE_RELEASES.find(mode => mode.value === step.release)?.label} · Verantwortlich: {owner(step.assignee)}</p>
            {step.deadline_basis !== 'finish' && <p className="text-xs">Bezug: {ROUTINE_DEADLINES.find(item => item.value === step.deadline_basis)?.label} · Abstand {step.deadline_offset} Kalendertage</p>}
            {step.use_deputy && <p className="text-xs text-muted-foreground">Bei genehmigter Abwesenheit übernimmt die hinterlegte Stellvertretung.</p>}
            {step.release === 'after_previous' && <p className="text-xs">Wartet auf „{plan.steps[stepIndex - 1]?.title}“.</p>}
            {step.release === 'after_approval' && <p className="text-xs">Freigabe durch: {owner(step.approver)}. Erst Zustimmung, dann Erstellung.</p>}
            {step.clamped && <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">Der gewünschte Vorlauf liegt vor dem Paketstart. Die Frist wird auf den Starttag begrenzt.</p>}
            {step.release !== 'package_start' && <p className="text-xs text-muted-foreground">Bei später Freigabe bleibt die geplante Frist sichtbar und kann bereits überfällig sein.</p>}
          </li>)}</ol>
          <p className="text-xs text-muted-foreground">Fehlgeschlagene Schritte können einzeln wiederholt werden. Bereits erzeugte Einträge werden dabei nicht erneut angelegt.</p>
        </div>;
      } catch (error) { return <p key={index} role="alert" className="text-sm text-destructive">{error instanceof Error ? error.message : 'Bitte Zeitplan und Schritte vervollständigen.'}</p>; }
    })}
  </section>;
}
