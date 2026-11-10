import { useId } from "react";
import { ArrowDown, Flag, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { OFFICE_ROUTINE_TEMPLATES, parseRoutineSteps } from "@/features/automation/officeRoutineTemplates";

const STEP_SUGGESTIONS = [...new Set(OFFICE_ROUTINE_TEMPLATES.flatMap(template =>
  parseRoutineSteps(template.steps).map(step => step.title)
))];

export function RoutineStepsEditor({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const id = useId();
  const steps = value.split("\n").filter(line => line.trim()).map(line => {
    const separator = line.indexOf("|");
    return separator < 0
      ? { days: "0", title: line.trim() }
      : { days: line.slice(0, separator).trim(), title: line.slice(separator + 1).trimStart() };
  });
  const save = (next: typeof steps) => onChange(next.map(step => `${step.days} | ${step.title}`).join("\n"));
  const update = (index: number, patch: Partial<typeof steps[number]>) =>
    save(steps.map((step, i) => i === index ? { ...step, ...patch } : step));
  const sort = () => save([...steps].sort((a, b) => Number(b.days) - Number(a.days)));

  return (
    <TooltipProvider>
      <section className="space-y-3" aria-labelledby={`${id}-heading`}>
        <div>
          <h4 id={`${id}-heading`} className="text-sm font-medium">Ablauf des Aufgabenpakets</h4>
          <p className="text-xs text-muted-foreground">Die Tage vor Abschluss bestimmen die Reihenfolge. 0 bedeutet am Abschlusstag. Die Frist liegt frühestens am Planungsbeginn.</p>
        </div>
        {steps.length === 0 && <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">Noch keine Arbeitsschritte. Füge den ersten Schritt hinzu oder wähle eine Vorlage.</p>}
        <ol className="space-y-0" aria-label="Arbeitsschritte bis zum Abschluss">
          {steps.map((step, index) => (
            <li key={index}>
              <div className="flex items-start gap-3 rounded-lg border bg-background p-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{index + 1}</span>
                <div className="min-w-0 flex-1 space-y-3">
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="space-y-1">
                      <Label htmlFor={`${id}-days-${index}`} className="text-xs">Tage vor Abschluss</Label>
                      <Input id={`${id}-days-${index}`} type="number" min={0} max={365} step={1} className="w-24" value={step.days} onChange={event => update(index, { days: event.target.value })} onBlur={sort} />
                    </div>
                    <span className="pb-2 text-xs text-muted-foreground">{step.days === "0" ? "Am Abschlusstag" : `${step.days || "…"} Tage vorher`}</span>
                  </div>
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
        <Button type="button" variant="outline" size="sm" disabled={steps.length >= 20} onClick={() => save([...steps, { days: "0", title: "" }])}><Plus className="mr-2 h-4 w-4" />Arbeitsschritt hinzufügen</Button>
        <p className="text-xs text-muted-foreground">{steps.length}/20 Arbeitsschritte. Ohne Abschlussdatum und Schritte bleibt es eine einzelne Büroaufgabe.</p>
      </section>
    </TooltipProvider>
  );
}
