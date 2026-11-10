import { OFFICE_ROUTINE_TEMPLATES } from '@/features/automation/officeRoutineTemplates';
import { annualRoutineAction } from '@/features/automation/annualRoutines';
import type { AutomationRuleRecordView } from './automationShared';
import { Button } from '@/components/ui/button';
import { CalendarDays, ListChecks } from 'lucide-react';
export function OfficeRoutineTemplates({ rules,onUse,onEdit,canEdit }: { rules:AutomationRuleRecordView[];onUse:(id:string)=>void;onEdit:(rule:AutomationRuleRecordView)=>void;canEdit:boolean }) {
  return <section aria-label="Vorlagen fürs Bürojahr" className="my-5 rounded-xl border bg-card p-4">
    <h3 className="font-semibold">Vorlagen fürs Bürojahr</h3><p className="mt-1 text-sm text-muted-foreground">Vorlage auswählen, Zuständigkeit und Termine prüfen und im Regel-Assistenten speichern. Jede Ausführung legt ein Aufgabenpaket mit Arbeitsschritten an. Ist der Planungsbeginn schon vorbei, starte das Paket für dieses Jahr mit „Ausführen“.</p>
    <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{OFFICE_ROUTINE_TEMPLATES.map(template=>{
      const existing=rules.find(rule=>annualRoutineAction(rule)?.payload?.office_template_id===template.id);
      return <div key={template.id} className="flex flex-col rounded-lg border p-3"><h4 className="text-sm font-semibold">{template.name}</h4><p className="mt-1 flex-1 text-xs text-muted-foreground">{template.description}</p><p className="my-3 flex items-center gap-1 text-xs text-muted-foreground"><ListChecks className="h-3 w-3" />{template.steps.split('\n').length} Arbeitsschritte{template.confirmAnnually&&<><CalendarDays className="ml-2 h-3 w-3" />jährlich bestätigen</>}</p><Button variant="outline" size="sm" disabled={!canEdit} onClick={()=>existing?onEdit(existing):onUse(template.id)}>{existing?'Eingerichtete Routine bearbeiten':'Vorlage übernehmen'}</Button></div>;
    })}</div>
  </section>;
}
