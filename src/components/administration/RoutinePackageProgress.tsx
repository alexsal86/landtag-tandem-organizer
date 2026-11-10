import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { notify } from '@/lib/notify';
import { useTenantUsers } from '@/hooks/useTenantUsers';
import { ROUTINE_STEP_KINDS } from '@/features/automation/officeRoutineTemplates';
import { TenantUserSelect } from './TenantUserSelect';
import { routineEntityLink, routineProgress, routineStepLabel, type RoutinePackage, type RoutinePackageStep } from '@/features/automation/routinePackages';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Loader2, RefreshCw } from 'lucide-react';

export function RoutinePackageProgress({ pkg, canEdit }: { pkg: RoutinePackage; canEdit: boolean }) {
  const client = useQueryClient();
  const { users } = useTenantUsers();
  const [confirmUpdate, setConfirmUpdate] = useState(false);
  const progress = routineProgress(pkg);
  const next = pkg.steps.find(step => step.status !== 'completed');
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const refresh = useMutation({
    mutationFn: async (stepId?: string) => {
      const result = await supabase.rpc('refresh_routine_package', { _run_id: pkg.id, ...(stepId ? { _retry_step_id: stepId } : {}) });
      if (result.error) throw result.error;
    },
    onSuccess: async () => { await Promise.all([client.invalidateQueries({ queryKey: ['routine-packages'] }), client.invalidateQueries({ queryKey: ['annual-routines'] })]); },
    onError: (error: Error) => notify.error('Ablauf konnte nicht aktualisiert werden', { description: error.message }),
  });
  const update = useMutation({
    mutationFn: async () => {
      const result = await supabase.rpc('update_waiting_routine_steps', { _run_id: pkg.id });
      if (result.error) throw result.error;
      return result.data;
    },
    onSuccess: async count => { notify.success(`${count} wartende Schritte aktualisiert`); await client.invalidateQueries({ queryKey: ['routine-packages'] }); },
    onError: (error: Error) => notify.error('Vorlage konnte nicht übernommen werden', { description: error.message }),
  });
  const busy = refresh.isPending || update.isPending;
  const eligible = pkg.steps.some(step => ['waiting','failed'].includes(step.status) && !step.entity_id && !step.approval_id);
  return <details className="mt-3 rounded-lg border bg-background p-3">
    <summary className="cursor-pointer text-sm font-medium">Ablauf {pkg.year}: {progress.completed} von {progress.total} erledigt{progress.failed > 0 && ` · ${progress.failed} fehlgeschlagen`}{progress.blocked > 0 && ` · ${progress.blocked} angehalten`}{next && !progress.failed && !progress.blocked && ` · ${routineStepLabel(next)}`}</summary>
    <div className="mt-3 space-y-3">
      <Progress value={progress.total ? progress.completed / progress.total * 100 : 0} aria-label={`${progress.completed} von ${progress.total} Schritten erledigt`} />
      <p className="text-xs text-muted-foreground">Dieser Ablauf verwendet die beim Start gespeicherte Vorlage. Termine und Abhängigkeiten werden alle 15 Minuten geprüft, auch über den Jahreswechsel. Bei pausierter Regel oder aktivem Kill-Switch ruht die Ausführung.</p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" disabled={!canEdit || busy} onClick={() => refresh.mutate(undefined)}>{refresh.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}Status prüfen und Ablauf fortsetzen</Button>
        {eligible && <Button type="button" size="sm" variant="outline" disabled={!canEdit || busy} onClick={() => setConfirmUpdate(true)}>Vorlage auf wartende Schritte anwenden</Button>}
      </div>
      <ol className="space-y-2">{pkg.steps.map(step => {
        const late = step.status !== 'completed' && step.due_day < today;
        const owner = users.find(user => user.id === step.assignee_id)?.display_name ?? 'Zugewiesene Person';
        return <li key={step.id} className="space-y-1 rounded-md border p-3 text-sm">
          <div className="flex flex-wrap items-center gap-2"><span className="font-medium">{step.position + 1}. {step.title}</span><Badge variant={step.status === 'failed' || step.status === 'blocked' ? 'destructive' : 'secondary'}>{routineStepLabel(step)}</Badge>{late && <Badge variant="outline" className="text-destructive">Frist überschritten</Badge>}</div>
          <p className="text-xs text-muted-foreground">{ROUTINE_STEP_KINDS.find(kind => kind.value === step.kind)?.label} · {owner} · Frist {new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin' }).format(new Date(`${step.due_day}T12:00:00Z`))}</p>
          {step.error_message && <p role="status" className="text-xs text-destructive">{step.error_message}</p>}
          <div className="flex flex-wrap items-center gap-3 text-xs">
            {step.entity_id && <Link className="underline underline-offset-2" to={routineEntityLink(step.kind, step.entity_id, pkg.task_id)}>Eintrag öffnen</Link>}
            {step.approval_id && <Link className="underline underline-offset-2" to={routineEntityLink('decision', step.approval_id, pkg.task_id)}>Freigabe öffnen</Link>}
            {step.status === 'failed' && !step.entity_id && <Button type="button" size="sm" variant="outline" disabled={!canEdit || busy} onClick={() => refresh.mutate(step.id)}>Diesen Schritt erneut versuchen</Button>}
          </div>
          {canEdit && step.status !== 'completed' && <StepReassignment step={step} />}
          {step.status === 'blocked' && <p className="text-xs text-muted-foreground">Eine Ablehnung wird nicht durch Wiederholen übergangen. Bitte die verknüpfte Entscheidung klären.</p>}
        </li>;
      })}</ol>
    </div>
    <AlertDialog open={confirmUpdate} onOpenChange={setConfirmUpdate}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Wartende Schritte aktualisieren?</AlertDialogTitle><AlertDialogDescription>Übernimmt die gespeicherte Vorlage nur für Schritte, die noch keinen Eintrag und keine Freigabe haben. Laufende und erledigte Schritte bleiben erhalten. Die Anzahl und Reihenfolge bereits gestarteter Schritte sowie der Abschluss des Pakets müssen unverändert bleiben. Neue Einträge werden erst beim nächsten Prüflauf oder über „Status prüfen“ angelegt.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Abbrechen</AlertDialogCancel><AlertDialogAction onClick={() => update.mutate()} disabled={busy}>Wartende Schritte aktualisieren</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </details>;
}

function StepReassignment({ step }: { step: RoutinePackageStep }) {
  const client = useQueryClient();
  const [assignee, setAssignee] = useState(step.assignee_id);
  const [approver, setApprover] = useState(step.approver_id ?? '');
  useEffect(() => { setAssignee(step.assignee_id); setApprover(step.approver_id ?? ''); }, [step.assignee_id, step.approver_id]);
  const mutation = useMutation({
    mutationFn: async () => {
      const result = await supabase.rpc('reassign_routine_step', { _step_id: step.id, _assignee_id: assignee, ...(approver ? { _approver_id: approver } : {}) });
      if (result.error) throw result.error;
    },
    onSuccess: async () => { notify.success('Zuständigkeit für diesen Ablauf geändert'); await client.invalidateQueries({ queryKey: ['routine-packages'] }); },
    onError: (error: Error) => notify.error('Zuständigkeit konnte nicht geändert werden', { description: error.message }),
  });
  return <details className="pt-2">
    <summary className="cursor-pointer text-xs underline underline-offset-2">Zuständigkeit ändern</summary>
    <fieldset className="mt-2 space-y-2" disabled={mutation.isPending}>
      <p className="text-xs text-muted-foreground">Ändert diesen laufenden Schritt und seinen Eintrag. Die Vorlage bleibt unverändert. Bei Entscheidungen ist das Ja der neu ausgewählten Person erforderlich.</p>
      <TenantUserSelect value={assignee} onValueChange={setAssignee} placeholder="Verantwortliche Person auswählen…" />
      {step.release === 'after_approval' && !step.entity_id && <><p className="text-xs font-medium">Freigebende Person</p><TenantUserSelect value={approver} onValueChange={setApprover} placeholder="Freigebende Person auswählen…" /></>}
      <Button type="button" size="sm" variant="outline" disabled={!assignee || mutation.isPending || (step.release === 'after_approval' && !approver)} onClick={() => mutation.mutate()}>Zuständigkeit übernehmen</Button>
    </fieldset>
  </details>;
}
