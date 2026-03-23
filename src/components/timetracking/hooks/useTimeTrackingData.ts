import { useCallback, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { debugConsole } from '@/utils/debugConsole';
import { useCombinedTimeEntries } from "@/hooks/useCombinedTimeEntries";
import { useYearlyBalance } from "@/hooks/useYearlyBalance";
import { calculateVacationBalance } from "@/utils/vacationCalculations";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, parseISO, getYear } from "date-fns";
import { toast } from "sonner";
import type { TimeEntryRow, EmployeeSettingsRow, LeaveRow, HolidayRow } from "../types";

interface TimeTrackingBaseData {
  entries: TimeEntryRow[];
  employeeSettings: EmployeeSettingsRow | null;
  vacationLeaves: LeaveRow[];
  sickLeaves: LeaveRow[];
  medicalLeaves: LeaveRow[];
  overtimeLeaves: LeaveRow[];
  holidays: HolidayRow[];
  pendingLeaves: LeaveRow[];
}

async function fetchTimeTrackingBaseData(userId: string, selectedMonth: Date): Promise<TimeTrackingBaseData> {
  const monthStart = startOfMonth(selectedMonth);
  const monthEnd = endOfMonth(selectedMonth);
  const year = selectedMonth.getFullYear();

  supabase.functions.invoke("sync-holidays", { body: { year } }).catch(console.error);

  const [e, s, v, sick, medical, overtime, h, pending] = await Promise.all([
    supabase.from("time_entries").select("*, edited_by, edited_at, edit_reason").eq("user_id", userId).gte("work_date", format(monthStart, "yyyy-MM-dd")).lte("work_date", format(monthEnd, "yyyy-MM-dd")).order("work_date", { ascending: false }),
    supabase.from("employee_settings").select("*, carry_over_expires_at").eq("user_id", userId).single(),
    supabase.from("leave_requests").select("*").eq("user_id", userId).eq("type", "vacation").in("status", ["approved", "pending", "rejected"]).gte("start_date", `${year}-01-01`).lte("end_date", `${year}-12-31`).order("start_date"),
    supabase.from("leave_requests").select("*").eq("user_id", userId).eq("type", "sick").in("status", ["pending", "approved", "rejected"]).gte("start_date", `${year}-01-01`).lte("end_date", `${year}-12-31`).order("start_date"),
    supabase.from("leave_requests").select("*").eq("user_id", userId).eq("type", "medical").in("status", ["pending", "approved", "rejected"]).gte("start_date", `${year}-01-01`).lte("end_date", `${year}-12-31`).order("start_date"),
    supabase.from("leave_requests").select("*").eq("user_id", userId).eq("type", "overtime_reduction").in("status", ["pending", "approved", "rejected"]).gte("start_date", `${year}-01-01`).lte("end_date", `${year}-12-31`).order("start_date"),
    supabase.from("public_holidays").select("*").gte("holiday_date", `${year}-01-01`).lte("holiday_date", `${year}-12-31`).order("holiday_date"),
    supabase.from("leave_requests").select("*").eq("user_id", userId).eq("status", "pending").order("start_date"),
  ]);

  if (e.error) throw e.error;
  if (s.error) throw s.error;
  if (v.error) throw v.error;
  if (sick.error) throw sick.error;
  if (medical.error) throw medical.error;
  if (overtime.error) throw overtime.error;
  if (h.error) throw h.error;
  if (pending.error) throw pending.error;

  return {
    entries: e.data || [],
    employeeSettings: s.data,
    vacationLeaves: v.data || [],
    sickLeaves: sick.data || [],
    medicalLeaves: medical.data || [],
    overtimeLeaves: overtime.data || [],
    holidays: h.data || [],
    pendingLeaves: pending.data || [],
  };
}

export function useMyWorkTimeTrackingData(userId: string | null, selectedMonth: Date) {
  const queryClient = useQueryClient();
  const monthStart = startOfMonth(selectedMonth);
  const monthEnd = endOfMonth(selectedMonth);
  const queryKey = ["my-work-time-tracking", userId, format(selectedMonth, "yyyy-MM")];

  const { data: baseData, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: () => fetchTimeTrackingBaseData(userId!, selectedMonth),
    enabled: !!userId,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  const data = baseData ?? {
    entries: [],
    employeeSettings: null,
    vacationLeaves: [],
    sickLeaves: [],
    medicalLeaves: [],
    overtimeLeaves: [],
    holidays: [],
    pendingLeaves: [],
  };

  const hoursPerWeek = data.employeeSettings?.hours_per_week || 39.5;
  const daysPerWeek = data.employeeSettings?.days_per_week || 5;
  const dailyHours = hoursPerWeek / daysPerWeek;
  const dailyMinutes = Math.round(dailyHours * 60);

  const combinedEntries = useCombinedTimeEntries({
    entries: data.entries,
    sickLeaves: data.sickLeaves,
    vacationLeaves: data.vacationLeaves,
    medicalLeaves: data.medicalLeaves,
    overtimeLeaves: data.overtimeLeaves,
    holidays: data.holidays,
    monthStart,
    monthEnd,
    dailyMinutes,
  });

  const { yearlyBalance, yearlyBreakdown, loading: loadingYearlyBalance } = useYearlyBalance(
    userId,
    getYear(selectedMonth),
    data.employeeSettings,
  );

  const vacationBalance = useMemo(() => {
    if (!data.employeeSettings) {
      return {
        totalEntitlement: 0, taken: 0, remaining: 0, carryOver: 0, carryOverRemaining: 0,
        carryOverExpiresAt: null, carryOverExpired: false, newVacationRemaining: 0,
        prorated: 0, annual: 0, carryOverUsed: 0, newVacationUsed: 0,
      };
    }
    return calculateVacationBalance({
      annualVacationDays: data.employeeSettings.annual_vacation_days,
      carryOverDays: data.employeeSettings.carry_over_days,
      employmentStartDate: data.employeeSettings.employment_start_date,
      approvedVacationLeaves: data.vacationLeaves.filter((l) => l.status === "approved").map((l) => ({ start_date: l.start_date, end_date: l.end_date })),
      currentYear: selectedMonth.getFullYear(),
      carryOverExpiresAt: data.employeeSettings.carry_over_expires_at,
    });
  }, [data.employeeSettings, data.vacationLeaves, selectedMonth]);

  const monthlyTotals = useMemo(() => {
    const holidayDates = new Set(data.holidays.map((h) => h.holiday_date));
    const sickDates = new Set<string>();
    data.sickLeaves.filter((l) => l.status === "approved").forEach((leave) => {
      try {
        eachDayOfInterval({ start: parseISO(leave.start_date), end: parseISO(leave.end_date) })
          .filter((d) => d >= monthStart && d <= monthEnd && d.getDay() !== 0 && d.getDay() !== 6)
          .forEach((d) => sickDates.add(format(d, "yyyy-MM-dd")));
      } catch (e) { debugConsole.error("Error processing sick dates:", e); }
    });
    const vacationDates = new Set<string>();
    data.vacationLeaves.filter((l) => l.status === "approved").forEach((leave) => {
      try {
        eachDayOfInterval({ start: parseISO(leave.start_date), end: parseISO(leave.end_date) })
          .filter((d) => d >= monthStart && d <= monthEnd && d.getDay() !== 0 && d.getDay() !== 6)
          .forEach((d) => vacationDates.add(format(d, "yyyy-MM-dd")));
      } catch (e) { debugConsole.error("Error processing vacation dates:", e); }
    });
    const overtimeDates = new Set<string>();
    data.overtimeLeaves.filter((l) => l.status === "approved").forEach((leave) => {
      try {
        eachDayOfInterval({ start: parseISO(leave.start_date), end: parseISO(leave.end_date) })
          .filter((d) => d >= monthStart && d <= monthEnd && d.getDay() !== 0 && d.getDay() !== 6)
          .forEach((d) => overtimeDates.add(format(d, "yyyy-MM-dd")));
      } catch (e) { debugConsole.error("Error processing overtime dates:", e); }
    });

    const worked = data.entries.reduce((s, entry) => {
      const dateStr = entry.work_date;
      if (holidayDates.has(dateStr) || sickDates.has(dateStr) || vacationDates.has(dateStr) || overtimeDates.has(dateStr)) return s;
      return s + (entry.minutes || 0);
    }, 0);

    const sickMinutes = [...sickDates].filter((d) => !holidayDates.has(d)).length * dailyMinutes;
    const vacationMinutes = [...vacationDates].filter((d) => !holidayDates.has(d) && !sickDates.has(d)).length * dailyMinutes;
    const overtimeMinutes = [...overtimeDates].filter((d) => !holidayDates.has(d) && !sickDates.has(d) && !vacationDates.has(d)).length * dailyMinutes;
    const holidayCount = [...holidayDates].filter((d) => {
      try { const date = parseISO(d); return date >= monthStart && date <= monthEnd && date.getDay() !== 0 && date.getDay() !== 6; } catch { return false; }
    }).length;
    const medicalMinutes = data.medicalLeaves.filter((l) => l.status === "approved").filter((l) => {
      try { const d = parseISO(l.start_date); return d >= monthStart && d <= monthEnd; } catch { return false; }
    }).reduce((s, l) => s + (l.minutes_counted || dailyMinutes), 0);

    const totalCredit = sickMinutes + vacationMinutes + medicalMinutes;
    const workingDays = eachDayOfInterval({ start: monthStart, end: monthEnd })
      .filter((d) => d.getDay() !== 0 && d.getDay() !== 6 && !holidayDates.has(format(d, "yyyy-MM-dd"))).length;
    const target = Math.round(workingDays * dailyMinutes);
    const totalActual = worked + totalCredit;

    return { worked, credit: totalCredit, sickMinutes, vacationMinutes, overtimeMinutes, holidayCount, medicalMinutes, target, difference: totalActual - target, workingDays, totalActual };
  }, [dailyMinutes, data.entries, data.holidays, data.medicalLeaves, data.overtimeLeaves, data.sickLeaves, data.vacationLeaves, monthEnd, monthStart]);

  const projectionTotals = useMemo(() => {
    const today = new Date();
    const isCurrentMonth = today.getFullYear() === selectedMonth.getFullYear() && today.getMonth() === selectedMonth.getMonth();
    if (!isCurrentMonth) return null;

    const effectiveEndDate = today > monthEnd ? monthEnd : today;
    const holidayDates = new Set(data.holidays.map((h) => h.holiday_date));
    const workedDaysSoFar = eachDayOfInterval({ start: monthStart, end: effectiveEndDate })
      .filter((d) => d.getDay() !== 0 && d.getDay() !== 6 && !holidayDates.has(format(d, "yyyy-MM-dd"))).length;
    const targetSoFar = Math.round(workedDaysSoFar * dailyMinutes);

    const creditSoFar = combinedEntries.filter((entry) => { try { return parseISO(entry.work_date) <= today; } catch { return false; } })
      .filter((entry) => ["sick", "vacation", "medical"].includes(entry.entry_type)).reduce((s, entry) => s + (entry.minutes || 0), 0);
    const workedSoFar = combinedEntries.filter((entry) => { try { return parseISO(entry.work_date) <= today && entry.entry_type === "work"; } catch { return false; } })
      .reduce((s, entry) => s + (entry.minutes || 0), 0);
    const actualSoFar = workedSoFar + creditSoFar;

    return { workedDaysSoFar, targetSoFar, actualSoFar, differenceSoFar: actualSoFar - targetSoFar, workedSoFar, creditSoFar };
  }, [combinedEntries, dailyMinutes, data.holidays, monthEnd, monthStart, selectedMonth]);

  useEffect(() => {
    if (!userId) return;

    let timeout: ReturnType<typeof setTimeout> | null = null;
    const scheduleRefresh = () => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => {
        timeout = null;
        queryClient.invalidateQueries({ queryKey: ["my-work-time-tracking", userId] });
      }, 250);
    };

    const channel = supabase
      .channel(`my-work-time-tracking-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "time_entries", filter: `user_id=eq.${userId}` }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "leave_requests", filter: `user_id=eq.${userId}` }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "employee_settings", filter: `user_id=eq.${userId}` }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "public_holidays" }, scheduleRefresh)
      .subscribe();

    return () => {
      if (timeout) clearTimeout(timeout);
      supabase.removeChannel(channel);
    };
  }, [queryClient, userId]);

  const loadData = useCallback(async () => {
    const result = await refetch();
    if (result.error) {
      toast.error("Fehler: " + (result.error instanceof Error ? result.error.message : String(result.error)));
    }
    return result.data;
  }, [refetch]);

  return {
    data: {
      ...data,
      combinedEntries,
      yearlyBalance,
      yearlyBreakdown,
      loadingYearlyBalance,
      vacationBalance,
      monthlyTotals,
      projectionTotals,
      dailyMinutes,
    },
    ...data,
    combinedEntries,
    yearlyBalance,
    yearlyBreakdown,
    loadingYearlyBalance,
    vacationBalance,
    monthlyTotals,
    projectionTotals,
    dailyMinutes,
    isLoading,
    loading: isLoading,
    error: (error as Error | null) ?? null,
    refetch: loadData,
    loadData,
  };
}

export const useTimeTrackingData = useMyWorkTimeTrackingData;
