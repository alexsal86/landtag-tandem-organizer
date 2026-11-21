import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FieldIssue, useRuleValidation } from "./RuleValidationContext";
import type { ActionItem } from "./types";

export function TaskPackageFields({ action, index, onChange }: {
  action: ActionItem;
  index: number;
  onChange: (patch: Partial<ActionItem>) => void;
}) {
  const { field } = useRuleValidation();
  const prefix = `actions.${index}`;
  return <div className="space-y-3 rounded-md border border-dashed p-3">
    <p className="text-xs text-muted-foreground">Der Regelname wird als Pakettitel verwendet. Beim Start wählt die ausführende Person den Starttag; Fristen werden relativ dazu berechnet.</p>
    <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
      <div className="space-y-1">
        <Label htmlFor={`package-first-step-${index}`}>Erster Stafetten-Schritt *</Label>
        <Input id={`package-first-step-${index}`} {...field(`${prefix}.packageFirstStep`)} value={action.packageFirstStep} onChange={(event) => onChange({ packageFirstStep: event.target.value })} placeholder="z. B. Tagesordnung sichten" />
        <FieldIssue name={`${prefix}.packageFirstStep`} />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`package-due-${index}`}>Gesamtfrist in Tagen *</Label>
        <Input id={`package-due-${index}`} {...field(`${prefix}.packageDueInDays`)} type="number" min={0} max={365} value={action.packageDueInDays} onChange={(event) => onChange({ packageDueInDays: event.target.value })} />
        <FieldIssue name={`${prefix}.packageDueInDays`} />
      </div>
    </div>
    <div className="space-y-1">
      <Label htmlFor={`package-subtasks-${index}`}>Unteraufgaben</Label>
      <Textarea id={`package-subtasks-${index}`} {...field(`${prefix}.packageSubtasks`)} rows={7} value={action.packageSubtasks} onChange={(event) => onChange({ packageSubtasks: event.target.value })} placeholder={"1 | Tagesordnung sichten\n3 | Fraktionsabstimmung vorbereiten"} />
      <p className="text-xs text-muted-foreground">Eine Zeile je Unteraufgabe: <strong>Tage | Titel</strong>. Leer lassen, wenn nur die Hauptaufgabe entstehen soll.</p>
      <FieldIssue name={`${prefix}.packageSubtasks`} />
    </div>
  </div>;
}
