import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useNavigate } from "react-router-dom";
import { annualRoutineAction, routineMonth } from "@/features/automation/annualRoutines";
import { annualTaskStatus } from "@/features/timetracking/annualTaskRules";
import type { AutomationRuleRecordView } from "./automationShared";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pencil, Play, Plus } from "lucide-react";
import { ErrorState, LoadingState, EmptyState } from "@/components/ui-patterns";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

const MONTHS = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
export function AnnualRoutinesOverview({ rules, onEdit, onRun, onNew, canEdit, runningRuleId }: { rules: AutomationRuleRecordView[]; onEdit: (rule: AutomationRuleRecordView) => void; onRun: (rule: AutomationRuleRecordView) => void; onNew: () => void; canEdit: boolean; runningRuleId: string | null }) {
  const { currentTenant } = useTenant();
  const navigate = useNavigate();
  const [confirmRule, setConfirmRule] = useState<AutomationRuleRecordView | null>(null);
  const year = new Date().getFullYear();
  const { data: records = [], isLoading, error, refetch } = useQuery({
    queryKey: ["annual-routines", currentTenant?.id, year], enabled: Boolean(currentTenant?.id), staleTime: 60_000,
    queryFn: async () => {
      if (!currentTenant) return [];
      const annual = await supabase.from("annual_tasks").select("id,due_month,due_day,automation_rule_id").eq("tenant_id", currentTenant.id);
      if (annual.error) throw annual.error;
      if (!annual.data.length) return [];
      const completions = await supabase.from("annual_task_completions").select("annual_task_id,completed_at,linked_task_id").in("annual_task_id", annual.data.map(item => item.id)).eq("year", year);
      if (completions.error) throw completions.error;
      return annual.data.map(item => ({ ...item, completion: completions.data.find(c => c.annual_task_id === item.id) }));
    },
  });
  if (isLoading) return <LoadingState variant="list" rows={3} />;
  if (error) return <ErrorState title="Jahresstatus konnte nicht geladen werden" onRetry={() => void refetch()} />;
  const routines = rules.filter(rule => annualRoutineAction(rule));
  return <section className="space-y-lg">
    <div className="flex flex-wrap items-center justify-between gap-sm"><h2 className="text-h2">Jahresroutinen {year}</h2><Button onClick={onNew} disabled={!canEdit}><Plus className="mr-xs h-4 w-4" />Neue Jahresroutine</Button></div>
    {!routines.length && <EmptyState title="Keine Jahresroutinen" />}
    <div className="grid gap-lg sm:grid-cols-2 xl:grid-cols-3">{MONTHS.map((month, index) => <section key={month} className="min-w-0 border-t pt-sm">
      <h3 className="section-label mb-sm">{month}</h3>
      <div className="space-y-sm">{routines.filter(rule => routineMonth(rule) === index + 1).map(rule => {
        const record = records.find(item => item.automation_rule_id === rule.id);
        const action = annualRoutineAction(rule);
        const status = record ? annualTaskStatus(record, year, record.completion?.completed_at) : "upcoming";
        const linkedTask = record?.completion?.linked_task_id;
        return <article key={rule.id} className="space-y-sm rounded-md border p-md">
          <p className="text-body font-medium break-words">{rule.name}</p>
          <div className="flex flex-wrap gap-xs"><Badge variant={status === "overdue" ? "destructive" : "outline"}>{status === "completed" ? "Erledigt" : linkedTask ? "In Bearbeitung" : status === "overdue" ? "Überfällig" : status === "due" ? "Heute fällig" : "Anstehend"}</Badge><Badge variant="secondary">{action?.payload?.system_function ? "Systemaktion" : "Büroaufgabe"}</Badge><Badge variant="outline">{!rule.enabled ? "Pausiert" : rule.trigger_type === "manual" ? "Manuell" : "Automatisch"}</Badge></div>
          <p className="text-caption text-muted-foreground">{rule.trigger_config.month_end === "true" ? "Monatsende" : `${rule.trigger_config.day}. ${month}`} · {rule.trigger_config.hour}:00 Uhr</p>
          <div className="flex flex-wrap gap-xs"><Button variant="ghost" size="sm" onClick={() => onEdit(rule)} disabled={!canEdit}><Pencil className="mr-xs h-3 w-3" />Bearbeiten</Button>{linkedTask ? <Button variant="outline" size="sm" onClick={() => navigate(`/mywork?tab=tasks&highlight=${linkedTask}`)}>Aufgabe öffnen</Button> : <Button variant="outline" size="sm" disabled={!canEdit || !rule.enabled || status === "completed" || runningRuleId !== null} onClick={() => action?.payload?.system_function ? setConfirmRule(rule) : onRun(rule)}><Play className="mr-xs h-3 w-3" />Ausführen</Button>}</div>
        </article>;
      })}</div>
    </section>)}</div>
    <AlertDialog open={confirmRule !== null} onOpenChange={open => { if (!open) setConfirmRule(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{confirmRule?.name} ausführen?</AlertDialogTitle><AlertDialogDescription>Diese Systemaktion verändert die Personaldaten des Büros für {year}. Sie wird höchstens einmal pro Jahr ausgeführt.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Abbrechen</AlertDialogCancel><AlertDialogAction onClick={() => { if (confirmRule) onRun(confirmRule); setConfirmRule(null); }}>Ausführen</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </section>;
}