import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCombinedTimeEntries } from "@/hooks/useCombinedTimeEntries";
import { useYearlyBalance } from "@/hooks/useYearlyBalance";
import { calculateVacationBalance } from "@/utils/vacationCalculations";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, parseISO, getYear } from "date-fns";
import { toast } from "sonner";
import type { TimeEntryRow, EmployeeSettingsRow, LeaveRow, HolidayRow } from "../types";

export function useTimeTrackingData(userId: string | null, selectedMonth: Date) {
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<TimeEntryRow[]>([]);
  const [employeeSettings, setEmployeeSettings] = useState<EmployeeSettingsRow | null>(null);
  const [vacationLeaves, setVacationLeaves] = useState<LeaveRow[]>([]);
  const [sickLeaves, setSickLeaves] = useState<LeaveRow[]>([]);
  const [medicalLeaves, setMedicalLeaves] = useState<LeaveRow[]>([]);
  const [overtimeLeaves, setOvertimeLeaves] = useState<LeaveRow[]>([]);
  const [holidays, setHolidays] = useState<HolidayRow[]>([]);
  const [pendingLeaves, setPendingLeaves] = useState<LeaveRow[]>([]);

  const monthStart = startOfMonth(selectedMonth);
  const monthEnd = endOfMonth(selectedMonth);

  const loadData = async () => {
    if (!userId) return;
    setLoading(true);
    try {
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
      setEntries(e.data || []);
      setEmployeeSettings(s.data);
      setVacationLeaves(v.data || []);
      setSickLeaves(sick.data || []);
      setMedicalLeaves(medical.data || []);
      setOvertimeLeaves(overtime.data || []);
      setHolidays(h.data || []);
      setPendingLeaves(pending.data || []);
    } catch (error: unknown) {
      toast.error("Fehler: " + (error instanceof Error ? error.message : String(error)));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userId) loadData();
  }, [userId, selectedMonth]);

  const hoursPerWeek = employeeSettings?.hours_per_week || 39.5;
  const daysPerWeek = employeeSettings?.days_per_week || 5;
  const dailyHours = hoursPerWeek / daysPerWeek;
  const dailyMinutes = Math.round(dailyHours * 60);

  const combinedEntries = useCombinedTimeEntries({
    entries, sickLeaves, vacationLeaves, medicalLeaves, overtimeLeaves, holidays, monthStart, monthEnd, dailyMinutes,
  });

  const { yearlyBalance, yearlyBreakdown, loading: loadingYearlyBalance } = useYearlyBalance(
    userId, getYear(selectedMonth), employeeSettings,
  );

  const vacationBalance = useMemo(() => {
    if (!employeeSettings) return {
      totalEntitlement: 0, taken: 0, remaining: 0, carryOver: 0, carryOverRemaining: 0,
      carryOverExpiresAt: null, carryOverExpired: false, newVacationRemaining: 0,
      prorated: 0, annual: 0, carryOverUsed: 0, newVacationUsed: 0,
    };
    return calculateVacationBalance({
      annualVacationDays: employeeSettings.annual_vacation_days,
      carryOverDays: employeeSettings.carry_over_days,
      employmentStartDate: employeeSettings.employment_start_date,
      approvedVacationLeaves: vacationLeaves.filter(l => l.status === "approved").map(l => ({ start_date: l.start_date, end_date: l.end_date })),
      currentYear: selectedMonth.getFullYear(),
      carryOverExpiresAt: employeeSettings.carry_over_expires_at,
    });
  }, [employeeSettings, vacationLeaves, selectedMonth]);

  const monthlyTotals = useMemo(() => {
    const holidayDates = new Set(holidays.map(h => h.holiday_date));
    const sickDates = new Set<string>();
    sickLeaves.filter(l => l.status === "approved").forEach(leave => {
      try {
        eachDayOfInterval({ start: parseISO(leave.start_date), end: parseISO(leave.end_date) })
          .filter(d => d >= monthStart && d <= monthEnd && d.getDay() !== 0 && d.getDay() !== 6)
          .forEach(d => sickDates.add(format(d, "yyyy-MM-dd")));
      } catch (e) { console.error("Error processing sick dates:", e); }
    });
    const vacationDates = new Set<string>();
    vacationLeaves.filter(l => l.status === "approved").forEach(leave => {
      try {
        eachDayOfInterval({ start: parseISO(leave.start_date), end: parseISO(leave.end_date) })
          .filter(d => d >= monthStart && d <= monthEnd && d.getDay() !== 0 && d.getDay() !== 6)
          .forEach(d => vacationDates.add(format(d, "yyyy-MM-dd")));
      } catch (e) { console.error("Error processing vacation dates:", e); }
    });
    const overtimeDates = new Set<string>();
    overtimeLeaves.filter(l => l.status === "approved").forEach(leave => {
      try {
        eachDayOfInterval({ start: parseISO(leave.start_date), end: parseISO(leave.end_date) })
          .filter(d => d >= monthStart && d <= monthEnd && d.getDay() !== 0 && d.getDay() !== 6)
          .forEach(d => overtimeDates.add(format(d, "yyyy-MM-dd")));
      } catch (e) { console.error("Error processing overtime dates:", e); }
    });

    const worked = entries.reduce((s, e) => {
      const dateStr = e.work_date;
      if (holidayDates.has(dateStr) || sickDates.has(dateStr) || vacationDates.has(dateStr) || overtimeDates.has(dateStr)) return s;
      return s + (e.minutes || 0);
    }, 0);

    const sickMinutes = [...sickDates].filter(d => !holidayDates.has(d)).length * dailyMinutes;
    const vacationMinutes = [...vacationDates].filter(d => !holidayDates.has(d) && !sickDates.has(d)).length * dailyMinutes;
    const overtimeMinutes = [...overtimeDates].filter(d => !holidayDates.has(d) && !sickDates.has(d) && !vacationDates.has(d)).length * dailyMinutes;
    const holidayCount = [...holidayDates].filter(d => {
      try { const date = parseISO(d); return date >= monthStart && date <= monthEnd && date.getDay() !== 0 && date.getDay() !== 6; } catch { return false; }
    }).length;
    const medicalMinutes = medicalLeaves.filter(l => l.status === "approved").filter(l => {
      try { const d = parseISO(l.start_date); return d >= monthStart && d <= monthEnd; } catch { return false; }
    }).reduce((s, l) => s + (l.minutes_counted || dailyMinutes), 0);

    const totalCredit = sickMinutes + vacationMinutes + medicalMinutes;
    const workingDays = eachDayOfInterval({ start: monthStart, end: monthEnd })
      .filter(d => d.getDay() !== 0 && d.getDay() !== 6 && !holidayDates.has(format(d, "yyyy-MM-dd"))).length;
    const target = Math.round(workingDays * dailyMinutes);
    const totalActual = worked + totalCredit;

    return { worked, credit: totalCredit, sickMinutes, vacationMinutes, overtimeMinutes, holidayCount, medicalMinutes, target, difference: totalActual - target, workingDays, totalActual };
  }, [entries, sickLeaves, vacationLeaves, overtimeLeaves, medicalLeaves, holidays, monthStart, monthEnd, dailyMinutes]);

  const projectionTotals = useMemo(() => {
    const today = new Date();
    const isCurrentMonth = today.getFullYear() === selectedMonth.getFullYear() && today.getMonth() === selectedMonth.getMonth();
    if (!isCurrentMonth) return null;

    const effectiveEndDate = today > monthEnd ? monthEnd : today;
    const holidayDates = new Set(holidays.map(h => h.holiday_date));
    const workedDaysSoFar = eachDayOfInterval({ start: monthStart, end: effectiveEndDate })
      .filter(d => d.getDay() !== 0 && d.getDay() !== 6 && !holidayDates.has(format(d, "yyyy-MM-dd"))).length;
    const targetSoFar = Math.round(workedDaysSoFar * dailyMinutes);

    const creditSoFar = combinedEntries.filter(e => { try { return parseISO(e.work_date) <= today; } catch { return false; } })
      .filter(e => ["sick", "vacation", "medical"].includes(e.entry_type)).reduce((s, e) => s + (e.minutes || 0), 0);
    const workedSoFar = combinedEntries.filter(e => { try { return parseISO(e.work_date) <= today && e.entry_type === "work"; } catch { return false; } })
      .reduce((s, e) => s + (e.minutes || 0), 0);
    const actualSoFar = workedSoFar + creditSoFar;

    return { workedDaysSoFar, targetSoFar, actualSoFar, differenceSoFar: actualSoFar - targetSoFar, workedSoFar, creditSoFar };
  }, [combinedEntries, holidays, monthStart, monthEnd, selectedMonth, dailyMinutes]);

  return {
    loading, entries, employeeSettings, vacationLeaves, sickLeaves, medicalLeaves, overtimeLeaves,
    holidays, pendingLeaves, combinedEntries, yearlyBalance, yearlyBreakdown, loadingYearlyBalance,
    vacationBalance, monthlyTotals, projectionTotals, dailyMinutes, loadData,
  };
}
