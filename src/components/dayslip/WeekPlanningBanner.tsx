import { useCallback, useMemo, useState } from "react";
import { Calendar, Plus, Trash2, X } from "lucide-react";

type RecurringTemplate = {
  id: string;
  text: string;
  weekday: string;
};

const WEEK_PLAN_KEY = "day-slip-week-plan-v1";

interface WeekPlan {
  weekStartKey: string;
  applied: boolean;
  dismissed: boolean;
  days: Record<string, string[]>;
}

const PLAN_DAYS = [
  { key: "monday", label: "Mo", dayOffset: 0 },
  { key: "tuesday", label: "Di", dayOffset: 1 },
  { key: "wednesday", label: "Mi", dayOffset: 2 },
  { key: "thursday", label: "Do", dayOffset: 3 },
  { key: "friday", label: "Fr", dayOffset: 4 },
] as const;

function getMondayKey(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return toDayKey(d);
}

function toDayKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addDays(dayKey: string, offset: number): string {
  const d = new Date(`${dayKey}T12:00:00`);
  d.setDate(d.getDate() + offset);
  return toDayKey(d);
}

function loadWeekPlan(): WeekPlan | null {
  try {
    const raw = localStorage.getItem(WEEK_PLAN_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveWeekPlan(plan: WeekPlan) {
  try {
    localStorage.setItem(WEEK_PLAN_KEY, JSON.stringify(plan));
  } catch { /* ignore */ }
}

interface WeekPlanningBannerProps {
  recurringItems: RecurringTemplate[];
  onApplyPlan: (days: Record<string, string[]>) => void;
}

export function WeekPlanningBanner({ recurringItems, onApplyPlan }: WeekPlanningBannerProps) {
  const today = new Date();
  const isMonday = today.getDay() === 1;
  const mondayKey = getMondayKey(today);

  const existingPlan = useMemo(() => loadWeekPlan(), []);
  const alreadyHandled = existingPlan?.weekStartKey === mondayKey && (existingPlan.applied || existingPlan.dismissed);

  const [showBanner, setShowBanner] = useState(isMonday && !alreadyHandled);
  const [planningMode, setPlanningMode] = useState(false);
  const [planDays, setPlanDays] = useState<Record<string, string[]>>(() => {
    // Pre-fill with recurring items
    const days: Record<string, string[]> = {};
    PLAN_DAYS.forEach(({ key, dayOffset }) => {
      const dayKey = addDays(mondayKey, dayOffset);
      const items = recurringItems
        .filter((item) => item.weekday === "all" || item.weekday === key)
        .map((item) => item.text);
      days[dayKey] = items;
    });
    return days;
  });
  const [newItemDrafts, setNewItemDrafts] = useState<Record<string, string>>({});

  const dismiss = useCallback(() => {
    setShowBanner(false);
    setPlanningMode(false);
    const plan: WeekPlan = { weekStartKey: mondayKey, applied: false, dismissed: true, days: {} };
    saveWeekPlan(plan);
  }, [mondayKey]);

  const applyPlan = useCallback(() => {
    const plan: WeekPlan = { weekStartKey: mondayKey, applied: true, dismissed: false, days: planDays };
    saveWeekPlan(plan);
    onApplyPlan(planDays);
    setShowBanner(false);
    setPlanningMode(false);
  }, [mondayKey, planDays, onApplyPlan]);

  const addItem = (dayKey: string) => {
    const text = (newItemDrafts[dayKey] ?? "").trim();
    if (!text) return;
    setPlanDays((prev) => ({
      ...prev,
      [dayKey]: [...(prev[dayKey] ?? []), text],
    }));
    setNewItemDrafts((prev) => ({ ...prev, [dayKey]: "" }));
  };

  const removeItem = (dayKey: string, index: number) => {
    setPlanDays((prev) => ({
      ...prev,
      [dayKey]: (prev[dayKey] ?? []).filter((_, i) => i !== index),
    }));
  };

  if (!showBanner) return null;

  if (planningMode) {
    return (
      <div className="border-b border-primary/20 bg-primary/5 px-3 py-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            <Calendar className="h-4 w-4" /> Woche vorplanen
          </p>
          <button type="button" className="rounded p-1 hover:bg-muted" onClick={dismiss}>
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="grid grid-cols-5 gap-1.5 mb-2">
          {PLAN_DAYS.map(({ label, dayOffset }) => {
            const dayKey = addDays(mondayKey, dayOffset);
            const items = planDays[dayKey] ?? [];
            const draft = newItemDrafts[dayKey] ?? "";

            return (
              <div key={dayKey} className="min-h-[80px]">
                <p className="mb-1 text-center text-[10px] font-semibold text-muted-foreground uppercase">
                  {label}
                </p>
                <div className="space-y-0.5">
                  {items.map((item, idx) => (
                    <div key={idx} className="group flex items-center gap-0.5 rounded border border-border/40 bg-background/60 px-1 py-0.5 text-[10px] leading-tight">
                      <span className="flex-1 truncate">{item}</span>
                      <button
                        type="button"
                        className="hidden group-hover:block rounded p-0.5 text-destructive/60 hover:text-destructive"
                        onClick={() => removeItem(dayKey, idx)}
                      >
                        <Trash2 className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="mt-0.5 flex gap-0.5">
                  <input
                    className="h-5 flex-1 min-w-0 rounded border border-border/40 bg-background px-1 text-[10px]"
                    placeholder="+"
                    value={draft}
                    onChange={(e) => setNewItemDrafts((prev) => ({ ...prev, [dayKey]: e.target.value }))}
                    onKeyDown={(e) => { if (e.key === "Enter") addItem(dayKey); }}
                  />
                  <button
                    type="button"
                    className="rounded border border-border/40 px-0.5 hover:bg-muted"
                    onClick={() => addItem(dayKey)}
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        <button
          type="button"
          className="w-full rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20"
          onClick={applyPlan}
        >
          Wochenplan übernehmen
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between border-b border-primary/20 bg-primary/5 px-4 py-2 text-sm">
      <div className="flex items-center gap-2">
        <Calendar className="h-4 w-4 text-primary" />
        <div>
          <p className="font-medium text-sm">Neue Woche starten?</p>
          <p className="text-xs text-muted-foreground">Plane deine Woche vor.</p>
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          className="rounded border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/20"
          onClick={() => setPlanningMode(true)}
        >
          Planen
        </button>
        <button type="button" className="rounded p-1 hover:bg-muted" onClick={dismiss}>
          <X className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </div>
    </div>
  );
}

/**
 * Check if the current day has a week plan to inject, and return lines for it.
 * Call this when opening a day to inject planned items.
 */
export function getWeekPlanForDay(dayKey: string): string[] | null {
  try {
    const raw = localStorage.getItem(WEEK_PLAN_KEY);
    if (!raw) return null;
    const plan: WeekPlan = JSON.parse(raw);
    if (!plan.applied || !plan.days[dayKey]) return null;
    return plan.days[dayKey];
  } catch { return null; }
}
