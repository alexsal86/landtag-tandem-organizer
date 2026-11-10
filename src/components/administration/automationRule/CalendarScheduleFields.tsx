import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { WizardForm } from "./types";
import { DEFAULT_FORM } from "./constants";
import { nextCalendarOccurrence, validateCalendarSchedule } from "@/features/automation/calendarSchedule";

export function CalendarScheduleFields({ form, onChange }: { form: WizardForm; onChange: (schedule: NonNullable<WizardForm["schedule"]>) => void }) {
  const schedule = form.schedule ?? DEFAULT_FORM.schedule;
  const officePackage=form.actions.some(action=>action.type==="run_annual_routine" && (action.routineDeadlineMonth || action.routineSteps));
  if (!schedule) return null;
  const update = (patch: Partial<typeof schedule>) => onChange({ ...schedule, ...patch });
  const calendar = schedule.schedule_kind !== "interval";
  const next = calendar ? nextCalendarOccurrence(schedule, new Date()) : null;
  const error = calendar ? validateCalendarSchedule(schedule) : null;
  return <div className="space-y-sm">
    <Label>Wiederholung</Label>
    <Select value={schedule.schedule_kind} onValueChange={value => update({ schedule_kind: value, ...(value === "quarterly" ? { month_end: "true" } : {}) })}>
      <SelectTrigger aria-label="Wiederholung"><SelectValue /></SelectTrigger>
      <SelectContent>{[["interval", "Minutenintervall"], ["annual", "Jährlicher Stichtag"], ["monthly", "Monatlich"], ["quarterly", "Quartalsende"]].map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
    </Select>
    {!calendar ? <><Label htmlFor="schedule-minutes">Intervall (Minuten)</Label><Input id="schedule-minutes" type="number" min={60} value={schedule.minutes_interval} onChange={e => update({ minutes_interval: e.target.value })} /></> : <>
      <div className="grid grid-cols-2 gap-sm">
        {schedule.schedule_kind === "annual" && <div><Label htmlFor="schedule-month">{officePackage ? "Startmonat" : "Monat"}</Label><Input id="schedule-month" type="number" min={1} max={12} value={schedule.month} onChange={e => update({ month: e.target.value })} /></div>}
        <div><Label htmlFor="schedule-day">{officePackage ? "Starttag" : "Tag"}</Label><Input id="schedule-day" type="number" min={1} max={31} disabled={schedule.month_end === "true"} value={schedule.day} onChange={e => update({ day: e.target.value })} /></div>
        <div><Label htmlFor="schedule-hour">Uhrzeit (Berlin)</Label><Input id="schedule-hour" type="number" min={0} max={23} value={schedule.hour} onChange={e => update({ hour: e.target.value })} /></div>
      </div>
      <div className="flex items-center justify-between"><Label htmlFor="schedule-end">Letzter Tag des Monats</Label><Switch id="schedule-end" checked={schedule.month_end === "true"} onCheckedChange={checked => update({ month_end: String(checked) })} /></div>
      {error && <p className="text-caption text-destructive">{error}</p>}
      {next && <p className="text-caption text-muted-foreground">{officePackage ? "Nächster Planungsbeginn" : "Nächster Stichtag"}: {next.toLocaleString("de-DE", { timeZone: "Europe/Berlin" })}</p>}
    </>}
  </div>;
}