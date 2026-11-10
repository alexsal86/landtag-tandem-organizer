import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TenantUserSelect } from "../TenantUserSelect";
import { SYSTEM_ROUTINES } from "@/features/automation/annualRoutines";
import { ROUTINE_CATEGORIES } from "./constants";
import type { ActionItem } from "./types";

export function AnnualRoutineFields({ action, onChange }: { action: ActionItem; onChange: (patch: Partial<ActionItem>) => void }) {
  return <div className="space-y-md">
    <div className="space-y-xs"><Label>Routine</Label>
      <Select value={action.systemFunction || "office"} disabled={Boolean(action.annualTaskId && action.systemFunction)} onValueChange={value => onChange({ systemFunction: value === "office" ? "" : value, ...(value !== "office" ? {officeTemplateId:"",routineDeadlineMonth:"",routineDeadlineDay:"",routineSteps:"",routineRequiresConfirmation:false,routineConfirmedYear:""}: {}) })}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent><SelectItem value="office">Büroaufgabe übergeben</SelectItem>{SYSTEM_ROUTINES.map(item => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
      </Select>
    </div>
    <div className="space-y-xs"><Label>Titel der Jahresaufgabe</Label><Input value={action.title} onChange={event => onChange({ title: event.target.value })} /></div>
    <div className="space-y-xs"><Label>Beschreibung</Label><Textarea value={action.message} onChange={event => onChange({ message: event.target.value })} /></div>
    <div className="space-y-xs"><Label>Kategorie</Label><Select value={action.routineCategory || "admin"} onValueChange={routineCategory => onChange({ routineCategory })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{ROUTINE_CATEGORIES.map(item => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select></div>
    {!action.systemFunction && <div className="space-y-3 rounded-lg border p-3">
      <p className="text-sm font-medium">Aufgabenpaket und Abschluss</p>
      <p className="text-xs text-muted-foreground">Der jährliche Zeitplan startet die Planung. Der Abschluss kann später liegen, auch im Folgejahr. Änderungen gelten für neu gestartete Pakete.</p>
      <div className="grid grid-cols-2 gap-3"><div><Label htmlFor={`routine-end-month-${action.annualTaskId||'new'}`}>Abschlussmonat</Label><Input id={`routine-end-month-${action.annualTaskId||'new'}`} type="number" min={1} max={12} value={action.routineDeadlineMonth||''} onChange={event=>onChange({routineDeadlineMonth:event.target.value,routineConfirmedYear:''})} /></div>
      <div><Label htmlFor={`routine-end-day-${action.annualTaskId||'new'}`}>Abschlusstag</Label><Input id={`routine-end-day-${action.annualTaskId||'new'}`} type="number" min={1} max={31} value={action.routineDeadlineDay||''} onChange={event=>onChange({routineDeadlineDay:event.target.value,routineConfirmedYear:''})} /></div></div>
      <div><Label htmlFor={`routine-steps-${action.annualTaskId||'new'}`}>Arbeitsschritte</Label><Textarea id={`routine-steps-${action.annualTaskId||'new'}`} rows={6} value={action.routineSteps||''} onChange={event=>onChange({routineSteps:event.target.value})} placeholder="14 | Druck bestellen" /><p className="mt-1 text-xs text-muted-foreground">Pro Zeile: Tage vor Abschluss | Arbeitsschritt. Die Frist liegt frühestens am Planungsbeginn. Ohne Abschlussdatum und Schritte bleibt es eine einzelne Büroaufgabe.</p></div>
      <div className="flex items-center justify-between gap-3"><Label htmlFor={`routine-confirm-required-${action.annualTaskId||'new'}`}>Termine jährlich bestätigen</Label><Switch id={`routine-confirm-required-${action.annualTaskId||'new'}`} checked={Boolean(action.routineRequiresConfirmation)} onCheckedChange={checked=>onChange({routineRequiresConfirmation:checked,routineConfirmedYear:''})} /></div>
      {action.routineRequiresConfirmation && <label className="flex items-start gap-2 text-sm"><input className="mt-1" type="checkbox" checked={action.routineConfirmedYear===new Intl.DateTimeFormat('en',{timeZone:'Europe/Berlin',year:'numeric'}).format(new Date())} onChange={event=>onChange({routineConfirmedYear:event.target.checked?new Intl.DateTimeFormat('en',{timeZone:'Europe/Berlin',year:'numeric'}).format(new Date()):''})} />Ich habe Planungsbeginn und Abschluss mit dem tatsächlichen Zeitplan dieses Jahres abgeglichen. Ohne Bestätigung wartet die Ausführung.</label>}
    </div>}
    {!action.systemFunction && <div className="space-y-xs"><Label>Zuständige Person</Label><TenantUserSelect value={action.taskAssignees} onValueChange={taskAssignees => onChange({ taskAssignees })} placeholder="Büroleitung (Standard)" /></div>}
  </div>;
}