import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, endOfMonth, eachDayOfInterval, parseISO } from "date-fns";
import { MonthlyBreakdown, YearlyBalanceResult, EmployeeSettingsBase } from "@/types/timeTracking";

/**
 * Shared hook to compute the yearly overtime balance for a given user.
 * Uses AbortController to prevent race conditions when userId or year changes rapidly.
 */
export function useYearlyBalance(
  userId: string | null,
  year: number,
  employeeSettings: EmployeeSettingsBase | null
): YearlyBalanceResult & { refetch: () => void } {
  const [yearlyBalance, setYearlyBalance] = useState<number>(0);
  const [yearlyBreakdown, setYearlyBreakdown] = useState<MonthlyBreakdown[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(
    async (signal: AbortSignal) => {
      if (!userId || !employeeSettings) return;

      setLoading(true);
      try {
        const today = new Date();
        const yearStart = new Date(year, 0, 1);
        const yearEnd = new Date(year, 11, 31);
        const effectiveEnd = today < yearEnd ? today : yearEnd;

        const [entriesRes, leavesRes, holidaysRes, correctionsRes] = await Promise.all([
          supabase
            .from("time_entries")
            .select("minutes, work_date")
            .eq("user_id", userId)
            .gte("work_date", format(yearStart, "yyyy-MM-dd"))
            .lte("work_date", format(effectiveEnd, "yyyy-MM-dd")),
          supabase
            .from("leave_requests")
            .select("type, start_date, end_date")
            .eq("user_id", userId)
            .eq("status", "approved")
            .gte("start_date", format(yearStart, "yyyy-MM-dd"))
            .lte("end_date", format(effectiveEnd, "yyyy-MM-dd")),
          supabase
            .from("public_holidays")
            .select("holiday_date")
            .gte("holiday_date", format(yearStart, "yyyy-MM-dd"))
            .lte("holiday_date", format(effectiveEnd, "yyyy-MM-dd")),
          supabase
            .from("time_entry_corrections")
            .select("correction_minutes")
            .eq("user_id", userId),
        ]);

        // Abort check after all fetches complete
        if (signal.aborted) return;

        const hoursPerWeek = employeeSettings.hours_per_week || 39.5;
        const daysPerWeek = employeeSettings.days_per_week || 5;
        const dailyMin = Math.round((hoursPerWeek / daysPerWeek) * 60);

        const holidayDates = new Set((holidaysRes.data || []).map((h) => h.holiday_date));

        const monthlyBreakdown: MonthlyBreakdown[] = [];
        const currentMonthIndex = effectiveEnd.getMonth();

        for (let m = 0; m <= currentMonthIndex; m++) {
          const mStart = new Date(year, m, 1);
          const mEnd = endOfMonth(mStart);
          const mEffectiveEnd = mEnd > effectiveEnd ? effectiveEnd : mEnd;

          // Work days in this month (excluding weekends and holidays)
          const monthDays = eachDayOfInterval({ start: mStart, end: mEffectiveEnd });
          const monthWorkDays = monthDays.filter(
            (d) => d.getDay() !== 0 && d.getDay() !== 6 && !holidayDates.has(format(d, "yyyy-MM-dd"))
          );
          const monthTarget = monthWorkDays.length * dailyMin;

          // Absence dates for this month
          const monthAbsenceDates = new Set<string>();
          (leavesRes.data || []).forEach((leave) => {
            if (["sick", "vacation", "overtime_reduction", "medical"].includes(leave.type)) {
              try {
                eachDayOfInterval({
                  start: parseISO(leave.start_date),
                  end: parseISO(leave.end_date),
                })
                  .filter(
                    (d) =>
                      d.getMonth() === m &&
                      d.getFullYear() === year &&
                      d <= mEffectiveEnd
                  )
                  .forEach((d) => monthAbsenceDates.add(format(d, "yyyy-MM-dd")));
              } catch {
                // ignore invalid date ranges
              }
            }
          });

          // Worked minutes excluding holidays and absence days (avoids double-counting)
          const monthWorked = (entriesRes.data || [])
            .filter((e) => {
              const d = parseISO(e.work_date);
              const dateStr = format(d, "yyyy-MM-dd");
              return (
                d.getMonth() === m &&
                d.getFullYear() === year &&
                !holidayDates.has(dateStr) &&
                !monthAbsenceDates.has(dateStr)
              );
            })
            .reduce((sum, e) => sum + (e.minutes || 0), 0);

          // Credit minutes: absence days that are actual work days (not holidays or weekends)
          const monthCredit =
            [...monthAbsenceDates]
              .filter((d) => !holidayDates.has(d))
              .filter((d) => {
                const date = parseISO(d);
                return date.getDay() !== 0 && date.getDay() !== 6;
              }).length * dailyMin;

          const monthBalance = monthWorked + monthCredit - monthTarget;

          monthlyBreakdown.push({
            month: mStart,
            workedMinutes: monthWorked,
            creditMinutes: monthCredit,
            targetMinutes: monthTarget,
            balance: monthBalance,
          });
        }

        if (signal.aborted) return;

        // Corrections are applied to the YEARLY total only – not to monthly balance
        const correctionsTotal = (correctionsRes.data || []).reduce(
          (sum, c) => sum + c.correction_minutes,
          0
        );

        const totalBalance =
          monthlyBreakdown.reduce((sum, mb) => sum + mb.balance, 0) + correctionsTotal;

        setYearlyBreakdown(monthlyBreakdown);
        setYearlyBalance(totalBalance);
      } catch (error) {
        if (!signal.aborted) {
          console.error("useYearlyBalance: Error loading yearly balance:", error);
        }
      } finally {
        if (!signal.aborted) {
          setLoading(false);
        }
      }
    },
    [userId, year, employeeSettings]
  );

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => {
      controller.abort();
    };
  }, [load]);

  const refetch = useCallback(() => {
    const controller = new AbortController();
    load(controller.signal);
  }, [load]);

  return { yearlyBalance, yearlyBreakdown, loading, refetch };
}
