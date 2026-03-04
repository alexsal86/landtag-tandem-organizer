import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays, eachDayOfInterval, isWeekend, parseISO } from "date-fns";
import { toast } from "sonner";

/**
 * Checks for missing time entries on workdays and notifies the user.
 * - After `softDays` missing workdays: shows a toast reminder
 * - After `hardDays` missing workdays: sends a persistent notification via RPC
 * Runs once per session (tracked via sessionStorage).
 */
export function useTimeEntryReminder(
  userId: string | null,
  options: { softDays?: number; hardDays?: number } = {}
) {
  const { softDays = 3, hardDays = 7 } = options;
  const hasRun = useRef(false);

  useEffect(() => {
    if (!userId || hasRun.current) return;

    const sessionKey = `time_entry_reminder_${userId}`;
    if (sessionStorage.getItem(sessionKey)) return;

    hasRun.current = true;
    sessionStorage.setItem(sessionKey, "1");

    checkMissingEntries(userId, softDays, hardDays);
  }, [userId, softDays, hardDays]);
}

async function checkMissingEntries(userId: string, softDays: number, hardDays: number) {
  try {
    const today = new Date();
    const checkFrom = subDays(today, hardDays + 2); // extra buffer for weekends

    // Get workdays in range (exclude weekends)
    const allDays = eachDayOfInterval({ start: checkFrom, end: subDays(today, 1) })
      .filter(d => !isWeekend(d));

    if (allDays.length === 0) return;

    const dateStrings = allDays.map(d => format(d, "yyyy-MM-dd"));

    // Fetch existing entries and holidays in parallel
    const [entriesRes, holidaysRes, leavesRes] = await Promise.all([
      supabase
        .from("time_entries")
        .select("work_date")
        .eq("user_id", userId)
        .in("work_date", dateStrings),
      supabase
        .from("public_holidays")
        .select("holiday_date")
        .in("holiday_date", dateStrings),
      supabase
        .from("leave_requests")
        .select("start_date, end_date")
        .eq("user_id", userId)
        .eq("status", "approved")
        .gte("end_date", dateStrings[0])
        .lte("start_date", dateStrings[dateStrings.length - 1]),
    ]);

    const entryDates = new Set((entriesRes.data || []).map(e => e.work_date));
    const holidayDates = new Set((holidaysRes.data || []).map(h => h.holiday_date));

    // Build set of leave-covered dates
    const leaveDates = new Set<string>();
    (leavesRes.data || []).forEach(l => {
      try {
        eachDayOfInterval({ start: parseISO(l.start_date), end: parseISO(l.end_date) })
          .forEach(d => leaveDates.add(format(d, "yyyy-MM-dd")));
      } catch { /* ignore */ }
    });

    // Missing = workday with no entry, no holiday, no leave
    const missingDates = dateStrings.filter(
      d => !entryDates.has(d) && !holidayDates.has(d) && !leaveDates.has(d)
    );

    if (missingDates.length === 0) return;

    if (missingDates.length >= hardDays) {
      // Send persistent notification
      try {
        await supabase.rpc("create_notification" as any, {
          user_id_param: userId,
          title_param: "Fehlende Zeiteinträge",
          message_param: `Du hast ${missingDates.length} Arbeitstage ohne Zeiteintrag. Bitte trage deine Arbeitszeiten nach.`,
          type_param: "time_tracking",
          priority_param: "high",
          data_param: JSON.stringify({ missing_dates: missingDates.slice(0, 10) }),
        });
      } catch {
        // RPC might not exist – fall through to toast
      }
      toast.warning(
        `Du hast ${missingDates.length} Arbeitstage ohne Zeiteintrag. Bitte trage deine Arbeitszeiten zeitnah nach.`,
        { duration: 10000 }
      );
    } else if (missingDates.length >= softDays) {
      toast.info(
        `Erinnerung: Du hast ${missingDates.length} Arbeitstage ohne Zeiteintrag.`,
        { duration: 8000 }
      );
    }
  } catch (error) {
    console.error("useTimeEntryReminder: Error checking missing entries:", error);
  }
}
