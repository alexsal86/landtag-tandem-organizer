import { useState, useEffect } from "react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { debugConsole } from "@/utils/debugConsole";
import type { TimeEntry, LeaveRequest, Correction, PublicHoliday } from "../types";

interface UseAdminMonthDataOptions {
  selectedUserId: string;
  currentMonth: Date;
  isAdmin: boolean;
}

export function useAdminMonthData({ selectedUserId, currentMonth, isAdmin }: UseAdminMonthDataOptions) {
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [corrections, setCorrections] = useState<Correction[]>([]);
  const [holidays, setHolidays] = useState<PublicHoliday[]>([]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);

  useEffect(() => {
    if (selectedUserId && isAdmin) {
      loadMonthData();
    }
  }, [selectedUserId, currentMonth, isAdmin]);

  const loadMonthData = async () => {
    if (!selectedUserId) return;

    try {
      const year = currentMonth.getFullYear();
      const [entriesRes, leavesRes, correctionsRes, holidaysRes] = await Promise.all([
        supabase
          .from("time_entries")
          .select("*")
          .eq("user_id", selectedUserId)
          .gte("work_date", format(monthStart, "yyyy-MM-dd"))
          .lte("work_date", format(monthEnd, "yyyy-MM-dd"))
          .order("work_date", { ascending: true }),
        supabase
          .from("leave_requests")
          .select(
            "id, user_id, type, status, start_date, end_date, reason, medical_reason, start_time, end_time, minutes_counted, created_at"
          )
          .eq("user_id", selectedUserId)
          .gte("start_date", `${year}-01-01`)
          .lte("end_date", `${year}-12-31`)
          .order("start_date", { ascending: false }),
        supabase
          .from("time_entry_corrections")
          .select("*")
          .eq("user_id", selectedUserId)
          .order("created_at", { ascending: false }),
        supabase
          .from("public_holidays")
          .select("id, holiday_date, name")
          .gte("holiday_date", format(monthStart, "yyyy-MM-dd"))
          .lte("holiday_date", format(monthEnd, "yyyy-MM-dd")),
      ]);

      setTimeEntries(entriesRes.data || []);
      setLeaveRequests(leavesRes.data || []);
      setCorrections(correctionsRes.data || []);
      setHolidays(holidaysRes.data || []);
    } catch (error) {
      debugConsole.error("Error loading month data:", error);
    }
  };

  return { timeEntries, leaveRequests, corrections, holidays, monthStart, monthEnd, loadMonthData };
}
