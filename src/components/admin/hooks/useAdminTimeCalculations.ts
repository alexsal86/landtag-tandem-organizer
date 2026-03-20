import { useMemo } from "react";
import { format, eachDayOfInterval, isWeekend } from "date-fns";
import { useCombinedTimeEntries, type CombinedTimeEntry } from "@/hooks/useCombinedTimeEntries";
import type { Employee, TimeEntry, LeaveRequest, Correction, PublicHoliday } from "../types";

interface UseAdminTimeCalculationsOptions {
  selectedEmployee: Employee | undefined;
  timeEntries: TimeEntry[];
  leaveRequests: LeaveRequest[];
  corrections: Correction[];
  holidays: PublicHoliday[];
  monthStart: Date;
  monthEnd: Date;
}

export function useAdminTimeCalculations({
  selectedEmployee,
  timeEntries,
  leaveRequests,
  corrections,
  holidays,
  monthStart,
  monthEnd,
}: UseAdminTimeCalculationsOptions) {
  const hoursPerWeek = selectedEmployee?.hours_per_week || 39.5;
  const daysPerWeek = selectedEmployee?.days_per_week || 5;
  const dailyHours = hoursPerWeek / daysPerWeek;
  const dailyMinutes = Math.round(dailyHours * 60);
  const hasIncompleteSettings =
    selectedEmployee && (!selectedEmployee.hours_per_week || !selectedEmployee.days_per_week);

  const sickLeaves = useMemo(() => leaveRequests.filter((l) => l.type === "sick"), [leaveRequests]);
  const vacationLeaves = useMemo(
    () => leaveRequests.filter((l) => l.type === "vacation"),
    [leaveRequests]
  );
  const medicalLeaves = useMemo(
    () => leaveRequests.filter((l) => l.type === "medical"),
    [leaveRequests]
  );
  const overtimeLeaves = useMemo(
    () => leaveRequests.filter((l) => l.type === "overtime_reduction"),
    [leaveRequests]
  );

  const combinedEntries = useCombinedTimeEntries({
    entries: timeEntries,
    sickLeaves,
    vacationLeaves,
    medicalLeaves,
    overtimeLeaves,
    holidays: holidays.map((h) => ({ id: h.id, holiday_date: h.holiday_date, name: h.name })),
    monthStart,
    monthEnd,
    dailyMinutes,
  });

  const workdaysInMonth = useMemo(() => {
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
    const holidayDates = new Set(holidays.map((h) => h.holiday_date));
    return days.filter((d) => !isWeekend(d) && !holidayDates.has(format(d, "yyyy-MM-dd"))).length;
  }, [monthStart, monthEnd, holidays]);

  const monthlyTargetMinutes = useMemo(
    () => Math.round(dailyHours * workdaysInMonth * 60),
    [dailyHours, workdaysInMonth]
  );

  const workedMinutes = useMemo(
    () =>
      combinedEntries
        .filter((e) => e.entry_type === "work")
        .reduce((sum, e) => sum + (e.minutes || 0), 0),
    [combinedEntries]
  );

  const creditMinutes = useMemo(
    () =>
      combinedEntries
        .filter((e) => ["sick", "vacation", "medical"].includes(e.entry_type))
        .reduce((sum, e) => sum + (e.minutes || 0), 0),
    [combinedEntries]
  );

  const overtimeReductionMinutes = useMemo(
    () =>
      combinedEntries
        .filter((e) => e.entry_type === "overtime_reduction")
        .reduce((sum, e) => sum + (e.minutes || 0), 0),
    [combinedEntries]
  );

  const totalCorrectionMinutes = useMemo(
    () => corrections.reduce((sum, c) => sum + c.correction_minutes, 0),
    [corrections]
  );

  const actualAfterEntryById = useMemo(() => {
    const actualTypes = new Set<CombinedTimeEntry["entry_type"]>(["work", "sick", "vacation", "medical"]);
    const byEntryId = new Map<string, number>();

    const sortedDescending = [...combinedEntries].sort((a, b) => {
      const aDateTime = a.started_at
        ? new Date(a.started_at).getTime()
        : new Date(`${a.work_date}T00:00:00`).getTime();
      const bDateTime = b.started_at
        ? new Date(b.started_at).getTime()
        : new Date(`${b.work_date}T00:00:00`).getTime();
      if (aDateTime !== bDateTime) return bDateTime - aDateTime;
      return b.id.localeCompare(a.id);
    });

    const totalActualAll = sortedDescending
      .filter((e) => actualTypes.has(e.entry_type))
      .reduce((sum, e) => sum + (e.minutes || 0), 0);

    let runningActual = totalActualAll;
    sortedDescending.forEach((entry) => {
      byEntryId.set(entry.id, runningActual);
      if (actualTypes.has(entry.entry_type)) {
        runningActual -= entry.minutes || 0;
      }
    });

    return byEntryId;
  }, [combinedEntries]);

  const totalActual = workedMinutes + creditMinutes;
  const balanceMinutes = totalActual - monthlyTargetMinutes;

  return {
    dailyHours,
    dailyMinutes,
    hasIncompleteSettings,
    combinedEntries,
    workdaysInMonth,
    monthlyTargetMinutes,
    workedMinutes,
    creditMinutes,
    overtimeReductionMinutes,
    totalCorrectionMinutes,
    actualAfterEntryById,
    totalActual,
    balanceMinutes,
  };
}
