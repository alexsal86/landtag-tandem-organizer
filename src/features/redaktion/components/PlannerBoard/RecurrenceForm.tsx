import { Repeat } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type RecurrenceFrequency = "weekly" | "monthly";

export interface RecurrenceState {
  enabled: boolean;
  frequency: RecurrenceFrequency;
  weekday: number; // 0=So, 1=Mo, ... 6=Sa (only for weekly)
  count: number;
  time: string; // HH:MM
}

export const DEFAULT_RECURRENCE: RecurrenceState = {
  enabled: false,
  frequency: "weekly",
  weekday: 4, // Donnerstag
  count: 4,
  time: "18:00",
};

const WEEKDAYS = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

interface RecurrenceFormProps {
  value: RecurrenceState;
  onChange: (next: RecurrenceState) => void;
  baseDate: string; // yyyy-MM-dd
}

export function RecurrenceForm({ value, onChange, baseDate }: RecurrenceFormProps) {
  return (
    <div className="space-y-3 rounded-md border p-3">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-2">
          <Repeat className="h-4 w-4" /> Als Serie planen
        </Label>
        <Switch
          checked={value.enabled}
          onCheckedChange={(enabled) => onChange({ ...value, enabled })}
        />
      </div>

      {value.enabled && (
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <Label>Häufigkeit</Label>
            <Select
              value={value.frequency}
              onValueChange={(v) => onChange({ ...value, frequency: v as RecurrenceFrequency })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="weekly">Wöchentlich</SelectItem>
                <SelectItem value="monthly">Monatlich</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {value.frequency === "weekly" && (
            <div className="space-y-1">
              <Label>Wochentag</Label>
              <Select
                value={String(value.weekday)}
                onValueChange={(v) => onChange({ ...value, weekday: Number(v) })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {WEEKDAYS.map((name, idx) => (
                    <SelectItem key={idx} value={String(idx)}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1">
            <Label>Anzahl Wiederholungen</Label>
            <Input
              type="number"
              min={1}
              max={26}
              value={value.count}
              onChange={(e) => onChange({ ...value, count: Math.max(1, Math.min(26, Number(e.target.value) || 1)) })}
            />
          </div>

          <div className="space-y-1">
            <Label>Uhrzeit</Label>
            <Input
              type="time"
              value={value.time}
              onChange={(e) => onChange({ ...value, time: e.target.value })}
            />
          </div>

          <p className="md:col-span-2 text-xs text-muted-foreground">
            Erzeugt {value.count} verknüpfte Drafts ab {baseDate || "(Datum oben wählen)"}, {value.frequency === "weekly" ? `jeden ${WEEKDAYS[value.weekday]}` : "monatlich am gleichen Tag"}, {value.time} Uhr.
          </p>
        </div>
      )}
    </div>
  );
}

export function expandRecurrence(state: RecurrenceState, baseDate: string): string[] {
  if (!state.enabled || !baseDate) return [baseDate].filter(Boolean);
  const [hours, minutes] = state.time.split(":").map(Number);
  const start = new Date(`${baseDate}T${state.time}:00`);
  if (Number.isNaN(start.getTime())) return [];

  if (state.frequency === "weekly") {
    // Adjust start to next requested weekday (>= base date)
    const diff = (state.weekday - start.getDay() + 7) % 7;
    start.setDate(start.getDate() + diff);
    const out: string[] = [];
    for (let i = 0; i < state.count; i += 1) {
      const d = new Date(start);
      d.setDate(start.getDate() + i * 7);
      d.setHours(hours, minutes, 0, 0);
      out.push(d.toISOString());
    }
    return out;
  }

  // monthly
  const out: string[] = [];
  for (let i = 0; i < state.count; i += 1) {
    const d = new Date(start);
    d.setMonth(start.getMonth() + i);
    d.setHours(hours, minutes, 0, 0);
    out.push(d.toISOString());
  }
  return out;
}
