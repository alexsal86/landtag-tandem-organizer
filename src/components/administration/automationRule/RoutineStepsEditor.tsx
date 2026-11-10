import { draftStepSettings, defaultStepSetting, ROUTINE_RELEASES, type RoutineStepSetting } from "@/features/automation/routineWorkflow";
import { TenantUserSelect } from "../TenantUserSelect";
import { useId } from "react";
import { ArrowDown, Flag, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { OFFICE_ROUTINE_TEMPLATES, parseRoutineSteps, ROUTINE_STEP_KINDS, routineStepKinds } from "@/features/automation/officeRoutineTemplates";

const STEP_SUGGESTIONS = [...new Set(OFFICE_ROUTINE_TEMPLATES.flatMap(template =>
  parseRoutineSteps(template.steps).map(step => step.title)
))];

export function RoutineStepsEditor({ value, kinds, settings, onChange }: { value: string; kinds?: string; settings?: string; onChange: (value: string, kinds: string, settings: string) => void }) {
  const id = useId();
  const stepKinds = routineStepKinds(kinds, value.split("\n").filter(line => line.trim()).length);
  const stepSettings = draftStepSettings(settings, stepKinds.length);
  const steps = value.split("\n").filter(line => line.trim()).map((line, index) => {
    const kind = stepKinds[index];
    const setting = stepSettings[index];
    const separator = line.indexOf("|");
    return separator < 0
      ? { days: "0", title: line.trim(), kind, setting }
      : { days: line.slice(0, separator).trim(), title: line.slice(separator + 1).trimStart(), kind, setting };
  });
  const save = (next: typeof steps) => onChange(next.map(step => `${step.days} | ${step.title}`).join("\n"), JSON.stringify(next.map(step => step.kind)), JSON.stringify(next.map(step => step.setting)));
  const update = (index: number, patch: Partial<typeof steps[number]>) =>
    save(steps.map((step, i) => i === index ? { ...step, ...patch } : step));
  const updateSetting = (index: number, patch: Partial<RoutineStepSetting>) => update(index, { setting: { ...steps[index].setting, ...patch } });
  const sort = () => save([...steps].sort((a, b) => Number(b.days) - Number(a.days)));

  return (
    <TooltipProvider>
      <section className="space-y-3" aria-labelledby={`${id}-heading`}>
        <div>
          <h4 id={`${id}-heading`} className="text-sm font-medium">Ablauf des Aufgabenpakets</h4>
          <p className="text-xs text-muted-foreground">Jeder Schritt hat einen eigenen Start und eine verantwortliche Person. Eine Freigabe startet den Schritt erst nach einer ausdrücklichen Zustimmung. Die Tage vor Abschluss bestimmen die Reihenfolge. 0 bedeutet am Abschlusstag. Die Frist liegt frühestens am Planungsbeginn.</p>
        </div>
        {steps.length === 0 && <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">Noch keine Arbeitsschritte. Füge den ersten Schritt hinzu oder wähle eine Vorlage.</p>}
        {steps.some((step, index) => index > 0 && Number(step.days) > Number(steps[index - 1].days)) && <p role="status" className="text-xs text-amber-700 dark:text-amber-300">Die Termine sind noch nicht in zeitlicher Reihenfolge. Bitte vor dem Speichern „Nach Zeitpunkt sortieren“ wählen; die Einstellungen bleiben beim jeweiligen Schritt.</p>}
        <ol className="space-y-0" aria-label="Arbeitsschritte bis zum Abschluss">
          {steps.map((step, index) => (
            <li key={index}>
              <div className="flex items-start gap-3 rounded-lg border bg-background p-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{index + 1}</span>
                <div className="min-w-0 flex-1 space-y-3">
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="space-y-1">
                      <Label htmlFor={`${id}-days-${index}`} className="text-xs">Tage vor Abschluss</Label>
                      <Input id={`${id}-days-${index}`} type="number" min={0} max={365} step={1} className="w-24" value={step.days} onChange={event => update(index, { days: event.target.value })} />
                    </div>
                    <span className="pb-2 text-xs text-muted-foreground">{step.days === "0" ? "Am Abschlusstag" : `${step.days || "…"} Tage vorher`}</span>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`${id}-kind-${index}`} className="text-xs">Was soll entstehen?</Label>
                    <Select value={step.kind} onValueChange={kind => update(index, { kind })}>
                      <SelectTrigger id={`${id}-kind-${index}`}><SelectValue /></SelectTrigger>
                      <SelectContent>{ROUTINE_STEP_KINDS.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
                    </Select>
                    {step.kind === "jour_fixe" && <p className="text-xs text-muted-foreground">Wird als Vorgang für die Jour-fixe-Agenda vorgemerkt.</p>}
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`${id}-release-${index}`} className="text-xs">Wann startet dieser Schritt?</Label>
                    <Select value={step.setting.release} onValueChange={release => updateSetting(index, { release: release as RoutineStepSetting['release'] })}>
                      <SelectTrigger id={`${id}-release-${index}`}><SelectValue /></SelectTrigger>
                      <SelectContent>{ROUTINE_RELEASES.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
                    </Select>
                    {step.setting.release === 'scheduled' && <p className="text-xs text-muted-foreground">Wird am angegebenen Tag automatisch angelegt; die Prüfung erfolgt alle 15 Minuten.</p>}
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Verantwortlich{step.kind === 'decision' ? ' / entscheidet' : ''}</Label>
                    <TenantUserSelect value={step.setting.assignee} onValueChange={assignee => updateSetting(index, { assignee })} placeholder="Zuständige Person des Pakets übernehmen" />
                    {step.setting.assignee && <Button type="button" size="sm" variant="ghost" onClick={() => updateSetting(index, { assignee: '' })}>Vom Paket übernehmen</Button>}
                  </div>
                  {step.setting.release === 'after_approval' && <div className="space-y-1">
                    <Label className="text-xs">Wer gibt diesen Schritt frei? *</Label>
                    <TenantUserSelect value={step.setting.approver} onValueChange={approver => updateSetting(index, { approver })} placeholder="Freigebende Person auswählen…" />
                    <p className="text-xs text-muted-foreground">Erstellt eine separate Ja/Nein-Entscheidung. Eine Ablehnung blockiert den Schritt.</p>
                  </div>}
                  <div className="space-y-1">
                    <Label htmlFor={`${id}-title-${index}`} className="text-xs">Was ist zu tun?</Label>
                    <Input id={`${id}-title-${index}`} value={step.title} maxLength={500} placeholder="Eigene Aufgabe eingeben…" onChange={event => update(index, { title: event.target.value.replace(/[\r\n]/g, " ") })} />
                  </div>
                  <Select value="" onValueChange={title => update(index, { title })}>
                    <SelectTrigger aria-label={`Aufgabenvorschlag für Schritt ${index + 1} auswählen`}><SelectValue placeholder="Aufgabe aus Vorschlägen auswählen…" /></SelectTrigger>
                    <SelectContent>{STEP_SUGGESTIONS.map(title => <SelectItem key={title} value={title}>{title}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button type="button" variant="ghost" size="icon" className="shrink-0 text-destructive" aria-label={`Schritt ${index + 1} entfernen`} onClick={() => save(steps.filter((_, i) => i !== index))}><Trash2 className="h-4 w-4" /></Button>
                  </TooltipTrigger>
                  <TooltipContent>Arbeitsschritt entfernen</TooltipContent>
                </Tooltip>
              </div>
              <div className="ml-3 flex h-7 items-center border-l-2 border-primary/20 pl-3" aria-hidden="true"><ArrowDown className="h-4 w-4 text-muted-foreground" /></div>
            </li>
          ))}
        </ol>
        {steps.length > 0 && <div className="flex items-center gap-2 rounded-md bg-muted p-3 text-sm font-medium"><Flag className="h-4 w-4 text-primary" />Abschluss des Aufgabenpakets</div>}
        <Button type="button" variant="ghost" size="sm" onClick={sort} disabled={steps.length < 2}>Nach Zeitpunkt sortieren</Button>
        <Button type="button" variant="outline" size="sm" disabled={steps.length >= 20} onClick={() => save([...steps, { days: "0", title: "", kind: "subtask", setting: defaultStepSetting() }])}><Plus className="mr-2 h-4 w-4" />Arbeitsschritt hinzufügen</Button>
        <p className="text-xs text-muted-foreground">{steps.length}/20 Arbeitsschritte. Ohne Abschlussdatum und Schritte bleibt es eine einzelne Büroaufgabe.</p>
      </section>
    </TooltipProvider>
  );
}
