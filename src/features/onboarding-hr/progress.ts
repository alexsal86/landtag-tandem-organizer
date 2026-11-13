export type HrPhase = "before_start" | "first_week" | "probation_or_end";
export type HrEvidence = "none" | "gdpr" | "handover";
export interface HrStepMeta {
  phase: HrPhase;
  is_mandatory: boolean;
  anchor: "start" | "end";
  offset_days: number;
  evidence: HrEvidence;
}
export interface HrProgressItem extends Partial<HrStepMeta> {
  id: string;
  status?: string;
  due_day?: string | null;
}
export const HR_PHASES: Record<HrPhase, string> = {
  before_start: "Vor dem ersten Tag",
  first_week: "Erste Woche",
  probation_or_end: "Probezeit / Abschluss",
};
export const defaultHrMeta = (): HrStepMeta => ({
  phase: "first_week",
  is_mandatory: true,
  anchor: "start",
  offset_days: 0,
  evidence: "none",
});
/** ISO calendar days, matching the package runner; no business-day adjustment. */
export function hrDueDay(anchor: string, offset: number): string {
  const day = new Date(`${anchor}T12:00:00Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(anchor) ||
    !Number.isFinite(day.getTime()) ||
    day.toISOString().slice(0, 10) !== anchor ||
    !Number.isInteger(offset) ||
    Math.abs(offset) > 365
  )
    throw new Error("Ungültige Frist.");
  day.setUTCDate(day.getUTCDate() + offset);
  return day.toISOString().slice(0, 10);
}
export function hrProgress(items: readonly HrProgressItem[]) {
  const count = (mandatory: boolean) => {
    const subset = items.filter((i) => Boolean(i.is_mandatory) === mandatory);
    const done = subset.filter((i) => i.status === "completed").length;
    return {
      done,
      total: subset.length,
      percent: subset.length ? Math.round((done / subset.length) * 100) : 0,
    };
  };
  return { mandatory: count(true), optional: count(false) };
}
export function overdueMandatory(
  items: readonly HrProgressItem[],
  startDate: string,
  today: string,
) {
  return items
    .filter(
      (i) =>
        i.is_mandatory &&
        i.status !== "completed" &&
        (i.due_day ??
          (i.anchor === "end"
            ? null
            : hrDueDay(startDate, i.offset_days ?? 0))) !== null,
    )
    .filter(
      (i) => (i.due_day ?? hrDueDay(startDate, i.offset_days ?? 0)) < today,
    )
    .sort(
      (a, b) =>
        (a.due_day ?? hrDueDay(startDate, a.offset_days ?? 0)).localeCompare(
          b.due_day ?? hrDueDay(startDate, b.offset_days ?? 0),
        ) || a.id.localeCompare(b.id),
    );
}
export function upcomingDeparture(
  endDate: string | null,
  today: string,
  withinDays = 30,
) {
  return (
    !!endDate && endDate >= today && endDate <= hrDueDay(today, withinDays)
  );
}
export function canViewHr(
  role: string | null | undefined,
  viewer: string,
  subject: string,
) {
  return (
    ["abgeordneter", "bueroleitung"].includes(role ?? "") || viewer === subject
  );
}
