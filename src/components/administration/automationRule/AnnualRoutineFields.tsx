import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TenantUserSelect } from "../TenantUserSelect";
import { SYSTEM_ROUTINES } from "@/features/automation/annualRoutines";
import type { ActionItem } from "./types";

export function AnnualRoutineFields({ action, onChange }: { action: ActionItem; onChange: (patch: Partial<ActionItem>) => void }) {
  return <div className="space-y-md">
    <div className="space-y-xs"><Label>Routine</Label>
      <Select value={action.systemFunction || "office"} disabled={Boolean(action.annualTaskId && action.systemFunction)} onValueChange={value => onChange({ systemFunction: value === "office" ? "" : value })}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent><SelectItem value="office">Büroaufgabe übergeben</SelectItem>{SYSTEM_ROUTINES.map(item => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
      </Select>
    </div>
    <div className="space-y-xs"><Label>Titel der Jahresaufgabe</Label><Input value={action.title} onChange={event => onChange({ title: event.target.value })} /></div>
    <div className="space-y-xs"><Label>Beschreibung</Label><Input value={action.message} onChange={event => onChange({ message: event.target.value })} /></div>
    <div className="space-y-xs"><Label>Kategorie</Label><Select value={action.routineCategory || "admin"} onValueChange={routineCategory => onChange({ routineCategory })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{[{ value: "admin", label: "Mandat & Büro" }, { value: "employee", label: "Personal" }, { value: "calendar", label: "Planung" }, { value: "system", label: "System" }].map(item => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select></div>
    {!action.systemFunction && <div className="space-y-xs"><Label>Zuständige Person</Label><TenantUserSelect value={action.taskAssignees} onValueChange={taskAssignees => onChange({ taskAssignees })} placeholder="Büroleitung (Standard)" /></div>}
  </div>;
}