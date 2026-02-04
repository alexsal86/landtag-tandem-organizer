import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCombinedTimeEntries, CombinedTimeEntry } from "@/hooks/useCombinedTimeEntries";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { EmployeeInfoTab } from "./EmployeeInfoTab";
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, getYear } from "date-fns";
import { de } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Edit, Trash2, History, Calendar, Clock, AlertTriangle, Undo2, Stethoscope, Timer, TrendingUp } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { VacationHistoryDialog } from "./VacationHistoryDialog";
import { calculateVacationBalance } from "@/utils/vacationCalculations";

interface TimeEntryRow {
  id: string;
  work_date: string;
  started_at: string | null;
  ended_at: string | null;
  minutes: number | null;
  pause_minutes?: number;
  notes: string | null;
  edited_by?: string | null;
  edited_at?: string | null;
  edit_reason?: string | null;
}

interface EmployeeSettingsRow {
  user_id: string;
  hours_per_month: number;
  days_per_month: number;
  hours_per_week: number;
  days_per_week: number;
  annual_vacation_days: number;
  carry_over_days: number;
  carry_over_expires_at: string | null;
  employment_start_date: string | null;
}

interface LeaveRow {
  id: string;
  type: "vacation" | "sick" | "other" | "medical" | "overtime_reduction";
  start_date: string;
  end_date: string;
  status: string;
  reason: string | null;
  medical_reason?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  minutes_counted?: number | null;
}

interface HistoryRow {
  id: string;
  entry_date: string;
  started_at: string | null;
  ended_at: string | null;
  minutes: number | null;
  pause_minutes: number | null;
  notes: string | null;
  change_type: string;
  changed_at: string;
}

interface HolidayRow {
  id: string;
  holiday_date: string;
  name: string;
  is_nationwide?: boolean;
  state?: string | null;
}

export function TimeTrackingView() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [entryDate, setEntryDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [pauseMinutes, setPauseMinutes] = useState("30");
  const [notes, setNotes] = useState("");
  const [entries, setEntries] = useState<TimeEntryRow[]>([]);
  const [employeeSettings, setEmployeeSettings] = useState<EmployeeSettingsRow | null>(null);
  const [vacationLeaves, setVacationLeaves] = useState<LeaveRow[]>([]);
  const [sickLeaves, setSickLeaves] = useState<LeaveRow[]>([]);
  const [medicalLeaves, setMedicalLeaves] = useState<LeaveRow[]>([]);
  const [overtimeLeaves, setOvertimeLeaves] = useState<LeaveRow[]>([]);
  const [holidays, setHolidays] = useState<HolidayRow[]>([]);
  const [editingEntry, setEditingEntry] = useState<TimeEntryRow | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [historyEntry, setHistoryEntry] = useState<TimeEntryRow | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);
  const [showYearlyLeaves, setShowYearlyLeaves] = useState(false);
  const [vacationStartDate, setVacationStartDate] = useState("");
  const [vacationEndDate, setVacationEndDate] = useState("");
  const [vacationReason, setVacationReason] = useState("");
  const [sickStartDate, setSickStartDate] = useState("");
  const [sickEndDate, setSickEndDate] = useState("");
  const [sickNotes, setSickNotes] = useState("");
  const [vacationHistoryOpen, setVacationHistoryOpen] = useState(false);
  const [pendingLeaves, setPendingLeaves] = useState<LeaveRow[]>([]);
  
  // Medical appointment states
  const [medicalDate, setMedicalDate] = useState("");
  const [medicalStartTime, setMedicalStartTime] = useState("");
  const [medicalEndTime, setMedicalEndTime] = useState("");
  const [medicalReason, setMedicalReason] = useState<string>("acute");
  const [medicalNotes, setMedicalNotes] = useState("");
  
  // Overtime reduction states
  const [overtimeStartDate, setOvertimeStartDate] = useState("");
  const [overtimeEndDate, setOvertimeEndDate] = useState("");
  const [overtimeReason, setOvertimeReason] = useState("");
  
  // Yearly balance state with monthly breakdown
  const [yearlyBalance, setYearlyBalance] = useState<number>(0);
  const [yearlyBreakdown, setYearlyBreakdown] = useState<{
    month: Date;
    workedMinutes: number;
    creditMinutes: number;
    targetMinutes: number;
    balance: number;
  }[]>([]);
  const [loadingYearlyBalance, setLoadingYearlyBalance] = useState(false);
  const [showBreakdownDialog, setShowBreakdownDialog] = useState(false);

  const monthStart = startOfMonth(selectedMonth);
  const monthEnd = endOfMonth(selectedMonth);

  useEffect(() => { if (user) loadData(); }, [user, selectedMonth]);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const year = selectedMonth.getFullYear();
      
      // Sync holidays for current year (fire and forget)
      supabase.functions.invoke('sync-holidays', { body: { year } }).catch(console.error);
      
      const [e, s, v, sick, medical, overtime, h, pending] = await Promise.all([
        supabase.from("time_entries").select("*, edited_by, edited_at, edit_reason").eq("user_id", user.id).gte("work_date", format(monthStart, "yyyy-MM-dd")).lte("work_date", format(monthEnd, "yyyy-MM-dd")).order("work_date", { ascending: false }),
        supabase.from("employee_settings").select("*, carry_over_expires_at").eq("user_id", user.id).single(),
        supabase.from("leave_requests").select("*").eq("user_id", user.id).eq("type", "vacation").in("status", ["approved", "pending", "rejected"]).gte("start_date", `${year}-01-01`).lte("end_date", `${year}-12-31`).order("start_date"),
        supabase.from("leave_requests").select("*").eq("user_id", user.id).eq("type", "sick").in("status", ["pending", "approved", "rejected"]).gte("start_date", `${year}-01-01`).lte("end_date", `${year}-12-31`).order("start_date"),
        supabase.from("leave_requests").select("*").eq("user_id", user.id).eq("type", "medical").in("status", ["pending", "approved", "rejected"]).gte("start_date", `${year}-01-01`).lte("end_date", `${year}-12-31`).order("start_date"),
        supabase.from("leave_requests").select("*").eq("user_id", user.id).eq("type", "overtime_reduction").in("status", ["pending", "approved", "rejected"]).gte("start_date", `${year}-01-01`).lte("end_date", `${year}-12-31`).order("start_date"),
        supabase.from("public_holidays").select("*").gte("holiday_date", `${year}-01-01`).lte("holiday_date", `${year}-12-31`).order("holiday_date"),
        supabase.from("leave_requests").select("*").eq("user_id", user.id).eq("status", "pending").order("start_date"),
      ]);
      setEntries(e.data || []); 
      setEmployeeSettings(s.data); 
      setVacationLeaves(v.data || []); 
      setSickLeaves(sick.data || []); 
      setMedicalLeaves(medical.data || []);
      setOvertimeLeaves(overtime.data || []);
      setHolidays(h.data || []);
      setPendingLeaves(pending.data || []);
    } catch (error: any) { toast.error("Fehler: " + error.message); } finally { setLoading(false); }
  };

  // Load yearly balance with monthly breakdown
  const loadYearlyBalance = async () => {
    if (!user || !employeeSettings) return;
    setLoadingYearlyBalance(true);
    try {
      const currentYear = getYear(selectedMonth);
      const yearStart = new Date(currentYear, 0, 1);
      const today = new Date();
      
      const [entriesRes, leavesRes, holidaysRes, correctionsRes] = await Promise.all([
        supabase.from("time_entries").select("minutes, work_date").eq("user_id", user.id).gte("work_date", format(yearStart, "yyyy-MM-dd")).lte("work_date", format(today, "yyyy-MM-dd")),
        supabase.from("leave_requests").select("type, start_date, end_date").eq("user_id", user.id).eq("status", "approved").gte("start_date", format(yearStart, "yyyy-MM-dd")).lte("end_date", format(today, "yyyy-MM-dd")),
        supabase.from("public_holidays").select("holiday_date").gte("holiday_date", format(yearStart, "yyyy-MM-dd")).lte("holiday_date", format(today, "yyyy-MM-dd")),
        supabase.from("time_entry_corrections").select("correction_minutes").eq("user_id", user.id),
      ]);
      
      // Safe calculation with fallback to prevent NaN
      const hoursPerWeek = employeeSettings.hours_per_week || 39.5;
      const daysPerWeek = employeeSettings.days_per_week || 5;
      const dailyMin = Math.round((hoursPerWeek / daysPerWeek) * 60);
      const holidayDates = new Set((holidaysRes.data || []).map(h => h.holiday_date));
      
      // Build per-month data
      const monthlyBreakdown: {
        month: Date;
        workedMinutes: number;
        creditMinutes: number;
        targetMinutes: number;
        balance: number;
      }[] = [];
      
      const currentMonthIndex = today.getMonth();
      
      for (let m = 0; m <= currentMonthIndex; m++) {
        const mStart = new Date(currentYear, m, 1);
        const mEnd = endOfMonth(mStart);
        const mEffectiveEnd = mEnd > today ? today : mEnd;
        
        // Work days in this month
        const monthDays = eachDayOfInterval({ start: mStart, end: mEffectiveEnd });
        const monthWorkDays = monthDays.filter(d => 
          d.getDay() !== 0 && d.getDay() !== 6 && !holidayDates.has(format(d, "yyyy-MM-dd"))
        );
        const monthTarget = monthWorkDays.length * dailyMin;
        
        // Calculate absence dates for this month FIRST (needed for worked filter)
        const monthAbsenceDates = new Set<string>();
        (leavesRes.data || []).forEach(leave => {
          if (['sick', 'vacation', 'overtime_reduction', 'medical'].includes(leave.type)) {
            try {
              eachDayOfInterval({ start: parseISO(leave.start_date), end: parseISO(leave.end_date) })
                .filter(d => d.getMonth() === m && d.getFullYear() === currentYear && d <= mEffectiveEnd)
                .forEach(d => monthAbsenceDates.add(format(d, 'yyyy-MM-dd')));
            } catch {}
          }
        });
        
        // Worked minutes in this month - EXCLUDE holidays and absence days
        const monthWorked = (entriesRes.data || [])
          .filter(e => {
            const d = parseISO(e.work_date);
            const dateStr = format(d, 'yyyy-MM-dd');
            // Exclude: other months, holidays, and absence days (to avoid double counting with credits)
            return d.getMonth() === m && 
                   d.getFullYear() === currentYear &&
                   !holidayDates.has(dateStr) &&
                   !monthAbsenceDates.has(dateStr);
          })
          .reduce((sum, e) => sum + (e.minutes || 0), 0);
        
        // monthAbsenceDates already calculated above (before worked calculation)
        
        // Credit minutes for this month
        const monthCredit = [...monthAbsenceDates]
          .filter(d => !holidayDates.has(d))
          .filter(d => {
            const date = parseISO(d);
            return date.getDay() !== 0 && date.getDay() !== 6;
          })
          .length * dailyMin;
        
        const monthBalance = monthWorked + monthCredit - monthTarget;
        
        monthlyBreakdown.push({
          month: mStart,
          workedMinutes: monthWorked,
          creditMinutes: monthCredit,
          targetMinutes: monthTarget,
          balance: monthBalance,
        });
      }
      
      setYearlyBreakdown(monthlyBreakdown);
      
      // Corrections total
      const correctionsTotal = (correctionsRes.data || []).reduce((sum, c) => sum + c.correction_minutes, 0);
      
      // Total balance = sum of monthly balances + corrections
      const totalBalance = monthlyBreakdown.reduce((sum, mb) => sum + mb.balance, 0) + correctionsTotal;
      setYearlyBalance(totalBalance);
      
    } catch (error) {
      console.error("Error loading yearly balance:", error);
    } finally {
      setLoadingYearlyBalance(false);
    }
  };

  useEffect(() => { if (user && employeeSettings) loadYearlyBalance(); }, [user, employeeSettings, selectedMonth]);

  // Tägliche Arbeitszeit = Wochenstunden / Arbeitstage pro Woche
  // z.B. 39,5h / 5 Tage = 7,9h (7 Std. 54 Min.) pro Tag
  // Safe calculation with fallback to prevent NaN when settings are incomplete
  const hoursPerWeek = employeeSettings?.hours_per_week || 39.5;
  const daysPerWeek = employeeSettings?.days_per_week || 5;
  const dailyHours = hoursPerWeek / daysPerWeek;
  const dailyMinutes = Math.round(dailyHours * 60);
  
  // Combined time entries with leaves and holidays
  const combinedEntries = useCombinedTimeEntries({
    entries,
    sickLeaves,
    vacationLeaves,
    medicalLeaves,
    overtimeLeaves,
    holidays,
    monthStart,
    monthEnd,
    dailyMinutes,
  });
  const vacationBalance = useMemo(() => {
    if (!employeeSettings) return { 
      totalEntitlement: 0, 
      taken: 0, 
      remaining: 0, 
      carryOver: 0, 
      carryOverRemaining: 0, 
      carryOverExpiresAt: null, 
      carryOverExpired: false, 
      newVacationRemaining: 0,
      prorated: 0,
      annual: 0,
      carryOverUsed: 0,
      newVacationUsed: 0,
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
    // Datum-Sets für Ausschluss erstellen
    const holidayDates = new Set(holidays.map(h => h.holiday_date));
    
    const sickDates = new Set<string>();
    sickLeaves.filter(l => l.status === 'approved').forEach(leave => {
      try {
        eachDayOfInterval({ start: parseISO(leave.start_date), end: parseISO(leave.end_date) })
          .filter(d => d >= monthStart && d <= monthEnd && d.getDay() !== 0 && d.getDay() !== 6)
          .forEach(d => sickDates.add(format(d, 'yyyy-MM-dd')));
      } catch (e) { console.error('Error processing sick dates:', e); }
    });
    
    const vacationDates = new Set<string>();
    vacationLeaves.filter(l => l.status === 'approved').forEach(leave => {
      try {
        eachDayOfInterval({ start: parseISO(leave.start_date), end: parseISO(leave.end_date) })
          .filter(d => d >= monthStart && d <= monthEnd && d.getDay() !== 0 && d.getDay() !== 6)
          .forEach(d => vacationDates.add(format(d, 'yyyy-MM-dd')));
      } catch (e) { console.error('Error processing vacation dates:', e); }
    });
    
    const overtimeDates = new Set<string>();
    overtimeLeaves.filter(l => l.status === 'approved').forEach(leave => {
      try {
        eachDayOfInterval({ start: parseISO(leave.start_date), end: parseISO(leave.end_date) })
          .filter(d => d >= monthStart && d <= monthEnd && d.getDay() !== 0 && d.getDay() !== 6)
          .forEach(d => overtimeDates.add(format(d, 'yyyy-MM-dd')));
      } catch (e) { console.error('Error processing overtime dates:', e); }
    });
    
    // NUR echte Arbeitstage zählen (keine Feiertage/Urlaub/Krank/Überstundenabbau)
    const worked = entries.reduce((s, e) => {
      const dateStr = e.work_date;
      if (holidayDates.has(dateStr)) return s;
      if (sickDates.has(dateStr)) return s;
      if (vacationDates.has(dateStr)) return s;
      if (overtimeDates.has(dateStr)) return s;
      return s + (e.minutes || 0);
    }, 0);
    
    // Gutschriften berechnen (ohne Doppelzählung bei Feiertagen)
    const sickMinutes = [...sickDates]
      .filter(d => !holidayDates.has(d))
      .length * dailyMinutes;
    
    const vacationMinutes = [...vacationDates]
      .filter(d => !holidayDates.has(d) && !sickDates.has(d))
      .length * dailyMinutes;
    
    const overtimeMinutes = [...overtimeDates]
      .filter(d => !holidayDates.has(d) && !sickDates.has(d) && !vacationDates.has(d))
      .length * dailyMinutes;
    
    // Feiertage reduzieren das Soll, werden NICHT als Gutschrift gezählt
    const holidayCount = [...holidayDates]
      .filter(d => {
        try {
          const date = parseISO(d);
          return date >= monthStart && date <= monthEnd && date.getDay() !== 0 && date.getDay() !== 6;
        } catch { return false; }
      }).length;
    
    // Arzttermine (mit tatsächlicher Dauer, falls erfasst)
    const medicalMinutes = medicalLeaves
      .filter(l => l.status === 'approved')
      .filter(l => {
        try {
          const d = parseISO(l.start_date);
          return d >= monthStart && d <= monthEnd;
        } catch { return false; }
      })
      .reduce((s, l) => s + (l.minutes_counted || dailyMinutes), 0);
    
    // Gesamte Gutschrift (OHNE Feiertage - diese reduzieren bereits das Soll)
    const totalCredit = sickMinutes + vacationMinutes + overtimeMinutes + medicalMinutes;
    
    // Arbeitstage im Monat (ohne Wochenenden und Feiertage)
    const workingDays = eachDayOfInterval({ start: monthStart, end: monthEnd })
      .filter(d => d.getDay() !== 0 && d.getDay() !== 6 && !holidayDates.has(format(d, "yyyy-MM-dd")))
      .length;
    
    const target = Math.round(workingDays * dailyMinutes);
    const totalActual = worked + totalCredit;
    
    return {
      worked,
      credit: totalCredit,
      sickMinutes,
      vacationMinutes,
      overtimeMinutes,
      holidayCount, // Anzahl der Feiertage (nur zur Anzeige, keine Minuten)
      medicalMinutes,
      target,
      difference: totalActual - target,
      workingDays,
      totalActual,
    };
  }, [entries, sickLeaves, vacationLeaves, overtimeLeaves, medicalLeaves, holidays, monthStart, monthEnd, dailyMinutes]);

  const projectionTotals = useMemo(() => {
    const today = new Date();
    const isCurrentMonth = today.getFullYear() === selectedMonth.getFullYear() && today.getMonth() === selectedMonth.getMonth();
    if (!isCurrentMonth) return null;
    
    const effectiveEndDate = today > monthEnd ? monthEnd : today;
    const holidayDates = new Set(holidays.map(h => h.holiday_date));
    
    // Arbeitstage bis heute
    const workedDaysSoFar = eachDayOfInterval({ start: monthStart, end: effectiveEndDate })
      .filter(d => d.getDay() !== 0 && d.getDay() !== 6 && !holidayDates.has(format(d, "yyyy-MM-dd")))
      .length;
    const targetSoFar = Math.round(workedDaysSoFar * dailyMinutes);
    
    // Gutschriften bis heute aus combinedEntries
    const creditSoFar = combinedEntries
      .filter(e => {
        try {
          return parseISO(e.work_date) <= today;
        } catch { return false; }
      })
      .filter(e => ['sick', 'vacation', 'overtime_reduction', 'medical'].includes(e.entry_type))
      .reduce((s, e) => s + (e.minutes || 0), 0);
    
    // Gearbeitete Minuten bis heute (nur echte Arbeit)
    const workedSoFar = combinedEntries
      .filter(e => {
        try {
          return parseISO(e.work_date) <= today && e.entry_type === 'work';
        } catch { return false; }
      })
      .reduce((s, e) => s + (e.minutes || 0), 0);
    
    const actualSoFar = workedSoFar + creditSoFar;
    
    return { workedDaysSoFar, targetSoFar, actualSoFar, differenceSoFar: actualSoFar - targetSoFar, workedSoFar, creditSoFar };
  }, [combinedEntries, holidays, monthStart, monthEnd, selectedMonth, dailyMinutes]);

  const validateDailyLimit = async (workDate: string, grossMin: number, excludeId?: string) => {
    if (!user) return;
    const { data } = await supabase.from("time_entries").select("id, started_at, ended_at").eq("user_id", user.id).eq("work_date", workDate);
    const total = data?.reduce((s, e) => e.id === excludeId || !e.started_at || !e.ended_at ? s : s + (new Date(e.ended_at).getTime() - new Date(e.started_at).getTime()) / 60000, 0) || 0;
    
    if (total + grossMin > 600) {
      const formatTime = (min: number) => `${Math.floor(min / 60)}:${(min % 60).toString().padStart(2, '0')}`;
      
      if (total > 0) {
        throw new Error(`Bereits ${formatTime(total)} Stunden erfasst. Mit diesem Eintrag (${formatTime(grossMin)}) wären es ${formatTime(total + grossMin)} Stunden. Maximal 10 Stunden pro Tag erlaubt.`);
      } else {
        throw new Error(`Der Eintrag dauert ${formatTime(grossMin)} Stunden. Maximal 10 Stunden pro Tag erlaubt.`);
      }
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !startTime || !endTime) { toast.error("Bitte alle Felder ausfüllen"); return; }
    const start = new Date(`${entryDate}T${startTime}`), end = new Date(`${entryDate}T${endTime}`);
    if (end <= start) { toast.error("Endzeit nach Startzeit"); return; }
    const gross = Math.round((end.getTime() - start.getTime()) / 60000), pause = parseInt(pauseMinutes) || 0;
    try {
      await validateDailyLimit(entryDate, gross);
      await supabase.from("time_entries").insert({ user_id: user.id, work_date: entryDate, started_at: start.toISOString(), ended_at: end.toISOString(), minutes: gross - pause, pause_minutes: pause, notes: notes || null });
      toast.success("Gespeichert"); setStartTime(""); setEndTime(""); setPauseMinutes("30"); setNotes(""); loadData();
    } catch (error: any) { toast.error(error.message); }
  };

  const handleRequestVacation = async () => {
    if (!user || !vacationStartDate || !vacationEndDate) { toast.error("Bitte beide Felder"); return; }
    try { await supabase.from("leave_requests").insert({ user_id: user.id, type: "vacation", start_date: vacationStartDate, end_date: vacationEndDate, reason: vacationReason || null, status: "pending" }); toast.success("Urlaubsantrag eingereicht"); setVacationStartDate(""); setVacationEndDate(""); setVacationReason(""); loadData(); } catch (error: any) { toast.error(error.message); }
  };

  const handleReportSick = async () => {
    if (!user || !sickStartDate || !sickEndDate) { toast.error("Bitte beide Felder"); return; }
    try { await supabase.from("leave_requests").insert({ user_id: user.id, type: "sick", start_date: sickStartDate, end_date: sickEndDate, reason: sickNotes || null, status: "pending" }); toast.success("Krankmeldung eingereicht"); setSickStartDate(""); setSickEndDate(""); setSickNotes(""); loadData(); } catch (error: any) { toast.error(error.message); }
  };

  const handleReportMedical = async () => {
    if (!user || !medicalDate || !medicalStartTime || !medicalEndTime) {
      toast.error("Bitte alle Felder ausfüllen");
      return;
    }
    
    const [startH, startM] = medicalStartTime.split(':').map(Number);
    const [endH, endM] = medicalEndTime.split(':').map(Number);
    const minutesCounted = (endH * 60 + endM) - (startH * 60 + startM);
    
    if (minutesCounted <= 0) {
      toast.error("Endzeit muss nach Startzeit liegen");
      return;
    }
    
    try {
      const { data, error } = await supabase.from("leave_requests").insert({
        user_id: user.id,
        type: "medical",
        start_date: medicalDate,
        end_date: medicalDate,
        medical_reason: medicalReason,
        start_time: medicalStartTime,
        end_time: medicalEndTime,
        minutes_counted: minutesCounted,
        reason: medicalNotes || null,
        status: "pending",
      }).select();
      
      if (error) throw error;
      
      toast.success("Arzttermin eingereicht");
      setMedicalDate("");
      setMedicalStartTime("");
      setMedicalEndTime("");
      setMedicalReason("acute");
      setMedicalNotes("");
      loadData();
    } catch (error: any) {
      console.error("Medical appointment error:", error);
      toast.error(error.message);
    }
  };

  const handleRequestOvertimeReduction = async () => {
    if (!user || !overtimeStartDate || !overtimeEndDate) {
      toast.error("Bitte beide Datumsfelder ausfüllen");
      return;
    }
    
    const days = eachDayOfInterval({ 
      start: parseISO(overtimeStartDate), 
      end: parseISO(overtimeEndDate) 
    }).filter(d => d.getDay() !== 0 && d.getDay() !== 6).length;
    
    if (days === 0) {
      toast.error("Bitte mindestens einen Werktag auswählen");
      return;
    }
    
    try {
      const { data, error } = await supabase.from("leave_requests").insert({
        user_id: user.id,
        type: "overtime_reduction",
        start_date: overtimeStartDate,
        end_date: overtimeEndDate,
        reason: overtimeReason || null,
        status: "pending",
      }).select();
      
      if (error) throw error;
      
      toast.success("Überstundenabbau beantragt");
      setOvertimeStartDate("");
      setOvertimeEndDate("");
      setOvertimeReason("");
      loadData();
    } catch (error: any) {
      console.error("Overtime reduction error:", error);
      toast.error(error.message);
    }
  };

  const getMedicalReasonLabel = (reason: string | null | undefined) => {
    const labels: Record<string, string> = {
      acute: 'Akuter Arztbesuch',
      specialist: 'Facharzttermin',
      follow_up: 'Nachsorge',
      pregnancy: 'Schwangerschaft',
    };
    return labels[reason || ''] || reason || '-';
  };

  const handleEditEntry = (entry: TimeEntryRow) => {
    setEditingEntry(entry);
    setEntryDate(entry.work_date);
    setStartTime(entry.started_at ? format(parseISO(entry.started_at), "HH:mm") : "");
    setEndTime(entry.ended_at ? format(parseISO(entry.ended_at), "HH:mm") : "");
    setPauseMinutes((entry.pause_minutes || 30).toString());
    setNotes(entry.notes || "");
    setIsEditDialogOpen(true);
  };

  const handleUpdateEntry = async () => {
    if (!user || !editingEntry || !startTime || !endTime) {
      toast.error("Bitte alle Felder ausfüllen");
      return;
    }

    const start = new Date(`${entryDate}T${startTime}`);
    const end = new Date(`${entryDate}T${endTime}`);
    
    if (end <= start) {
      toast.error("Endzeit muss nach Startzeit liegen");
      return;
    }

    const gross = Math.round((end.getTime() - start.getTime()) / 60000);
    const pause = parseInt(pauseMinutes) || 0;

    try {
      await validateDailyLimit(entryDate, gross, editingEntry.id);

      const { data, error } = await supabase
        .from("time_entries")
        .update({
          work_date: entryDate,
          started_at: start.toISOString(),
          ended_at: end.toISOString(),
          minutes: gross - pause,
          pause_minutes: pause,
          notes: notes || null,
        })
        .eq("id", editingEntry.id)
        .eq("user_id", user.id)
        .select();

      if (error) throw error;
      
      if (!data || data.length === 0) {
        toast.error("Keine Berechtigung zum Bearbeiten dieses Eintrags");
        return;
      }

      toast.success("Eintrag aktualisiert");
      setIsEditDialogOpen(false);
      setEditingEntry(null);
      setStartTime("");
      setEndTime("");
      setPauseMinutes("30");
      setNotes("");
      loadData();
    } catch (error: any) {
      console.error("Update error:", error);
      toast.error(error.message);
    }
  };

  const handleDeleteEntry = async (entryId: string) => {
    if (!confirm("Eintrag wirklich löschen?")) return;

    try {
      const { data, error } = await supabase
        .from("time_entries")
        .delete()
        .eq("id", entryId)
        .eq("user_id", user!.id)
        .select();

      if (error) throw error;
      
      if (!data || data.length === 0) {
        toast.warning("Eintrag wurde möglicherweise bereits gelöscht");
      } else {
        toast.success("Eintrag gelöscht");
      }
      loadData();
    } catch (error: any) {
      console.error("Delete error:", error);
      toast.error("Fehler beim Löschen: " + error.message);
    }
  };

  const fmt = (m: number) => `${m < 0 ? "-" : ""}${Math.floor(Math.abs(m) / 60)}:${(Math.abs(m) % 60).toString().padStart(2, "0")}`;

  const getStatusBadge = (status: string) => {
    const config = {
      approved: { variant: "default" as const, label: "✓ Genehmigt", className: "bg-green-100 text-green-800 border-green-200" },
      pending: { variant: "secondary" as const, label: "⏳ Ausstehend", className: "bg-yellow-100 text-yellow-800 border-yellow-200" },
      rejected: { variant: "destructive" as const, label: "✗ Abgelehnt", className: "bg-red-100 text-red-800 border-red-200" },
      cancel_requested: { variant: "outline" as const, label: "↩ Stornierung angefragt", className: "bg-amber-50 text-amber-700 border-amber-300" },
      cancelled: { variant: "secondary" as const, label: "✗ Storniert", className: "bg-gray-100 text-gray-600 border-gray-200" },
    };
    const { label, className } = config[status as keyof typeof config] || config.pending;
    return <Badge className={className}>{label}</Badge>;
  };

  // Hilfsfunktion zum Entfernen von Kalendereinträgen
  const removeLeaveCalendarEntry = async (leave: LeaveRow, type: 'vacation' | 'sick' | 'medical' | 'overtime_reduction') => {
    if (!user) return;
    
    try {
      const { data: userProfile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("user_id", user.id)
        .single();

      const userName = userProfile?.display_name || "Mitarbeiter";
      
      const titleMap = {
        vacation: `Urlaub von ${userName}`,
        sick: `Krankheit: ${userName}`,
        medical: `Arzttermin: ${userName}`,
        overtime_reduction: `Überstundenabbau: ${userName}`,
      };
      
      await supabase
        .from("appointments")
        .delete()
        .eq("category", type)
        .ilike("title", `%${userName}%`)
        .gte("start_time", new Date(leave.start_date).toISOString());
        
    } catch (error) {
      console.error("Error removing calendar entry:", error);
    }
  };

  const handleCancelVacationRequest = async (leaveId: string) => {
    if (!window.confirm('Möchten Sie diesen Urlaubsantrag wirklich stornieren?')) return;
    
    try {
      const leave = vacationLeaves.find(v => v.id === leaveId);
      if (!leave) {
        toast.error("Antrag nicht gefunden");
        return;
      }
      
      // For pending requests: set directly to cancelled
      // For approved requests: set to cancel_requested (admin must confirm)
      const newStatus = leave.status === 'pending' ? 'cancelled' : 'cancel_requested';
      
      const { data, error } = await supabase
        .from("leave_requests")
        .update({ status: newStatus as any })
        .eq("id", leaveId)
        .eq("user_id", user?.id)
        .select()
        .single();

      if (error) {
        console.error('Cancel request error:', error);
        throw error;
      }
      
      // Bei direkter Stornierung (pending): Kalendereintrag entfernen
      if (newStatus === 'cancelled') {
        await removeLeaveCalendarEntry(leave, 'vacation');
      }
      
      toast.success(
        newStatus === 'cancelled' 
          ? "Urlaubsantrag storniert" 
          : "Stornierungsanfrage gesendet - Wartet auf Genehmigung"
      );
      loadData();
    } catch (error: any) {
      console.error('Error cancelling vacation request:', error);
      toast.error(`Fehler beim Stornieren: ${error?.message || 'Unbekannter Fehler'}`);
    }
  };

  // Arzttermin stornieren
  const handleCancelMedicalRequest = async (leaveId: string) => {
    if (!window.confirm('Möchten Sie diesen Arzttermin wirklich stornieren?')) return;
    
    try {
      const leave = medicalLeaves.find(m => m.id === leaveId);
      if (!leave) {
        toast.error("Termin nicht gefunden");
        return;
      }
      
      const newStatus = leave.status === 'pending' ? 'cancelled' : 'cancel_requested';
      
      const { error } = await supabase
        .from("leave_requests")
        .update({ status: newStatus as any })
        .eq("id", leaveId)
        .eq("user_id", user?.id);

      if (error) throw error;
      
      if (newStatus === 'cancelled') {
        await removeLeaveCalendarEntry(leave, 'medical');
      }
      
      toast.success(
        newStatus === 'cancelled' 
          ? "Arzttermin storniert" 
          : "Stornierungsanfrage gesendet"
      );
      loadData();
    } catch (error: any) {
      console.error('Error cancelling medical request:', error);
      toast.error("Fehler beim Stornieren");
    }
  };

  // Überstundenabbau stornieren
  const handleCancelOvertimeRequest = async (leaveId: string) => {
    if (!window.confirm('Möchten Sie diesen Überstundenabbau wirklich stornieren?')) return;
    
    try {
      const leave = overtimeLeaves.find(o => o.id === leaveId);
      if (!leave) {
        toast.error("Antrag nicht gefunden");
        return;
      }
      
      const newStatus = leave.status === 'pending' ? 'cancelled' : 'cancel_requested';
      
      const { error } = await supabase
        .from("leave_requests")
        .update({ status: newStatus as any })
        .eq("id", leaveId)
        .eq("user_id", user?.id);

      if (error) throw error;
      
      if (newStatus === 'cancelled') {
        await removeLeaveCalendarEntry(leave, 'overtime_reduction');
      }
      
      toast.success(
        newStatus === 'cancelled' 
          ? "Überstundenabbau storniert" 
          : "Stornierungsanfrage gesendet"
      );
      loadData();
    } catch (error: any) {
      console.error('Error cancelling overtime request:', error);
      toast.error("Fehler beim Stornieren");
    }
  };

  if (loading) return <div className="p-4">Lädt...</div>;
  if (!employeeSettings) return <div className="p-4">Keine Einstellungen.</div>;

  return (
    <div className="container mx-auto p-4 space-y-6">
      <Card>
        <CardHeader className="space-y-4">
          <div className="flex items-center justify-between">
            <Button variant="outline" size="icon" onClick={() => setSelectedMonth(subMonths(selectedMonth, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <CardTitle className="text-2xl">{format(selectedMonth, "MMMM yyyy", { locale: de })}</CardTitle>
            <Button variant="outline" size="icon" onClick={() => setSelectedMonth(addMonths(selectedMonth, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {Array.from({ length: 12 }, (_, i) => {
              const monthDate = new Date(selectedMonth.getFullYear(), i, 1);
              const isSelected = i === selectedMonth.getMonth();
              return (
                <Button
                  key={i}
                  variant={isSelected ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedMonth(monthDate)}
                  className={`min-w-[60px] ${isSelected ? "font-bold" : ""}`}
                >
                  {format(monthDate, "MMM", { locale: de })}
                </Button>
              );
            })}
          </div>
        </CardHeader>
      </Card>
      <Tabs defaultValue="time-tracking">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="time-tracking">Zeiterfassung</TabsTrigger>
          <TabsTrigger value="leave-requests">Urlaub & Krankmeldungen</TabsTrigger>
          <TabsTrigger value="employee-info">Mitarbeiter-Info</TabsTrigger>
        </TabsList>
        <TabsContent value="time-tracking" className="space-y-6">
          {/* Yearly balance card with breakdown */}
          <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-primary flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Mein Überstundensaldo {getYear(selectedMonth)}
                </CardTitle>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setShowBreakdownDialog(true)}
                  className="text-xs"
                >
                  Aufschlüsselung
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className={`text-3xl font-bold ${yearlyBalance >= 0 ? "text-green-600" : "text-destructive"}`}>
                {yearlyBalance >= 0 ? "+" : ""}{fmt(yearlyBalance)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Summe aller Monate bis heute</p>
              {yearlyBreakdown.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {yearlyBreakdown.map((mb, idx) => (
                    <TooltipProvider key={idx}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge 
                            variant={mb.balance >= 0 ? "default" : "destructive"}
                            className={`cursor-help ${mb.balance >= 0 ? "bg-green-100 text-green-700 hover:bg-green-200" : ""}`}
                          >
                            {format(mb.month, "MMM", { locale: de })}: {mb.balance >= 0 ? "+" : ""}{fmt(mb.balance)}
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="text-xs">
                          <div className="space-y-1">
                            <div className="font-medium">{format(mb.month, "MMMM yyyy", { locale: de })}</div>
                            <div className="flex justify-between gap-4">
                              <span>Soll:</span>
                              <span>{fmt(mb.targetMinutes)}</span>
                            </div>
                            <div className="flex justify-between gap-4">
                              <span>Gearbeitet:</span>
                              <span>{fmt(mb.workedMinutes)}</span>
                            </div>
                            <div className="flex justify-between gap-4">
                              <span>Gutschriften:</span>
                              <span>+{fmt(mb.creditMinutes)}</span>
                            </div>
                            <div className="flex justify-between gap-4 font-medium border-t pt-1">
                              <span>Saldo:</span>
                              <span className={mb.balance >= 0 ? "text-green-600" : "text-destructive"}>
                                {mb.balance >= 0 ? "+" : ""}{fmt(mb.balance)}
                              </span>
                            </div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="h-full">
              <CardHeader>
                <CardTitle>Zeitübersicht {format(selectedMonth, "MMMM yyyy", { locale: de })}</CardTitle>
                <CardDescription>{monthlyTotals.workingDays} Arbeitstage</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 font-semibold text-sm">
                    <span>📊</span>
                    <span>MONATSBILANZ</span>
                  </div>
                  <div className="pl-6 space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Gearbeitet:</span>
                      <span className="font-mono">{fmt(monthlyTotals.worked)}</span>
                    </div>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex justify-between cursor-help">
                            <span className="text-muted-foreground">Gutschriften:</span>
                            <span className="font-mono text-blue-600">+{fmt(monthlyTotals.credit)}</span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="left" className="max-w-xs">
                          <div className="space-y-1 text-xs">
                            {monthlyTotals.holidayCount > 0 && (
                              <div className="flex justify-between gap-4">
                                <span>🎉 Feiertage:</span>
                                <span className="font-mono">{monthlyTotals.holidayCount} Tage (kein Soll)</span>
                              </div>
                            )}
                            {monthlyTotals.sickMinutes > 0 && (
                              <div className="flex justify-between gap-4">
                                <span>🤒 Krankheit:</span>
                                <span className="font-mono">{fmt(monthlyTotals.sickMinutes)}</span>
                              </div>
                            )}
                            {monthlyTotals.vacationMinutes > 0 && (
                              <div className="flex justify-between gap-4">
                                <span>🏖️ Urlaub:</span>
                                <span className="font-mono">{fmt(monthlyTotals.vacationMinutes)}</span>
                              </div>
                            )}
                            {monthlyTotals.overtimeMinutes > 0 && (
                              <div className="flex justify-between gap-4">
                                <span>⏰ Überstundenabbau:</span>
                                <span className="font-mono">{fmt(monthlyTotals.overtimeMinutes)}</span>
                              </div>
                            )}
                            {monthlyTotals.medicalMinutes > 0 && (
                              <div className="flex justify-between gap-4">
                                <span>🏥 Arzttermine:</span>
                                <span className="font-mono">{fmt(monthlyTotals.medicalMinutes)}</span>
                              </div>
                            )}
                            {monthlyTotals.credit === 0 && (
                              <p className="text-muted-foreground">Keine Gutschriften in diesem Monat</p>
                            )}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <div className="flex justify-between border-t pt-1 mt-1">
                      <span className="font-medium">Gesamt (Ist):</span>
                      <span className="font-mono font-bold">{fmt(monthlyTotals.totalActual)}</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 font-semibold text-sm">
                    <span>🎯</span>
                    <span>SOLL/IST VERGLEICH</span>
                  </div>
                  <div className="pl-6 space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Monatssoll:</span>
                      <span className="font-mono">{fmt(monthlyTotals.target)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className={monthlyTotals.difference >= 0 ? "text-green-600" : "text-red-600"}>Differenz:</span>
                      <span className={`font-mono font-bold ${monthlyTotals.difference >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {monthlyTotals.difference >= 0 ? "+" : ""}{fmt(Math.abs(monthlyTotals.difference))}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Status:</span>
                      <span className="font-mono">{monthlyTotals.target > 0 ? Math.round(monthlyTotals.totalActual / monthlyTotals.target * 100) : 0}% erfüllt</span>
                    </div>
                  </div>
                </div>
                {projectionTotals && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 font-semibold text-sm">
                      <span>⏱️</span>
                      <span>HOCHRECHNUNG BIS HEUTE</span>
                    </div>
                    <div className="pl-6 space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Soll ({projectionTotals.workedDaysSoFar}/{monthlyTotals.workingDays} AT):</span>
                        <span className="font-mono">{fmt(projectionTotals.targetSoFar)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Gearbeitet:</span>
                        <span className="font-mono">{fmt(projectionTotals.workedSoFar || 0)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">+ Gutschriften:</span>
                        <span className="font-mono text-blue-600">+{fmt(projectionTotals.creditSoFar || 0)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className={projectionTotals.differenceSoFar >= 0 ? "text-green-600" : "text-red-600"}>Differenz:</span>
                        <span className={`font-mono font-bold ${projectionTotals.differenceSoFar >= 0 ? "text-green-600" : "text-red-600"}`}>
                          {projectionTotals.differenceSoFar >= 0 ? "+" : ""}{fmt(Math.abs(projectionTotals.differenceSoFar))}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
            <Card className="h-full">
              <CardHeader>
                <CardTitle>Neue Zeiterfassung</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={onSubmit} className="space-y-4">
                  <div className="grid grid-cols-5 gap-4">
                    <div><Label>Datum</Label><Input type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)} required /></div>
                    <div><Label>Start</Label><Input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} required /></div>
                    <div><Label>Ende</Label><Input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} required /></div>
                    <div><Label>Pause (Min)</Label><Input type="number" value={pauseMinutes} onChange={e => setPauseMinutes(e.target.value)} min="0" /></div>
                    <div className="flex items-end"><Button type="submit" className="w-full">Erfassen</Button></div>
                  </div>
                  <div><Label>Notizen</Label><Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional" /></div>
                </form>
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Zeiteinträge</CardTitle>
              <CardDescription>Arbeitszeit, Urlaub, Krankheit und Feiertage</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Datum</TableHead>
                    <TableHead>Typ</TableHead>
                    <TableHead>Start</TableHead>
                    <TableHead>Ende</TableHead>
                    <TableHead>Pause</TableHead>
                    <TableHead>Brutto</TableHead>
                    <TableHead>Netto</TableHead>
                    <TableHead>Notizen</TableHead>
                    <TableHead className="text-right">Aktionen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {combinedEntries.map(entry => {
                    const gross = entry.started_at && entry.ended_at 
                      ? Math.round((new Date(entry.ended_at).getTime() - new Date(entry.started_at).getTime()) / 60000)
                      : entry.minutes || 0;
                    
                    return (
                      <TableRow key={entry.id} className={entry.type_class}>
                        <TableCell>
                          {entry.type_icon && <span className="mr-1">{entry.type_icon}</span>}
                          {format(parseISO(entry.work_date), "dd.MM.yyyy")}
                        </TableCell>
                        <TableCell>
                          {entry.type_label ? (
                            <Badge variant="outline" className="text-xs">{entry.type_label}</Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">Arbeit</span>
                          )}
                        </TableCell>
                        <TableCell>{entry.started_at ? format(parseISO(entry.started_at), "HH:mm") : "-"}</TableCell>
                        <TableCell>{entry.ended_at ? format(parseISO(entry.ended_at), "HH:mm") : "-"}</TableCell>
                        <TableCell>{entry.pause_minutes || 0} Min</TableCell>
                        <TableCell>{fmt(gross)}</TableCell>
                        <TableCell>{fmt(entry.minutes || 0)}</TableCell>
                        <TableCell className="max-w-[200px]">
                          <div className="flex items-center gap-2">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="block truncate cursor-help">
                                    {entry.notes || "-"}
                                  </span>
                                </TooltipTrigger>
                                {entry.notes && entry.notes.length > 30 && (
                                  <TooltipContent className="max-w-md whitespace-pre-wrap">
                                    {entry.notes}
                                  </TooltipContent>
                                )}
                              </Tooltip>
                            </TooltipProvider>
                            {entry.edited_by && entry.edited_at && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-300 dark:border-blue-800 shrink-0">
                                      ✏️
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="font-medium">Bearbeitet von Admin</p>
                                    <p className="text-xs text-muted-foreground">
                                      {format(parseISO(entry.edited_at), "dd.MM.yyyy HH:mm")}
                                    </p>
                                    {entry.edit_reason && (
                                      <p className="text-xs mt-1">Grund: {entry.edit_reason}</p>
                                    )}
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {entry.is_editable && entry.entry_type === 'work' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEditEntry(entry as TimeEntryRow)}
                                title="Bearbeiten"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            )}
                            {entry.is_deletable && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteEntry(entry.id)}
                                title="Löschen"
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {combinedEntries.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                        Keine Einträge in diesem Monat
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Edit Dialog */}
          <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Zeiteintrag bearbeiten</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Datum</Label>
                    <Input
                      type="date"
                      value={entryDate}
                      onChange={e => setEntryDate(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label>Start</Label>
                    <Input
                      type="time"
                      value={startTime}
                      onChange={e => setStartTime(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <Label>Ende</Label>
                    <Input
                      type="time"
                      value={endTime}
                      onChange={e => setEndTime(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <Label>Pause (Min)</Label>
                    <Input
                      type="number"
                      value={pauseMinutes}
                      onChange={e => setPauseMinutes(e.target.value)}
                      min="0"
                    />
                  </div>
                </div>
                <div>
                  <Label>Notizen</Label>
                  <Textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Optional"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  Abbrechen
                </Button>
                <Button onClick={handleUpdateEntry}>
                  Speichern
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

        </TabsContent>
        <TabsContent value="leave-requests" className="space-y-6">
          {/* Pending Requests Alert */}
          {pendingLeaves.length > 0 && (
            <Card className="border-yellow-300 bg-yellow-50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2 text-yellow-800">
                  <Clock className="h-4 w-4" />
                  Ausstehende Anträge ({pendingLeaves.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  {pendingLeaves.map(p => (
                    <li key={p.id} className="flex items-center gap-2">
                      <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300">
                        {p.type === 'vacation' ? '🏖️ Urlaub' : 
                         p.type === 'sick' ? '🤒 Krankheit' : 
                         p.type === 'medical' ? '🏥 Arzttermin' :
                         p.type === 'overtime_reduction' ? '⏰ Überstundenabbau' :
                         '📋 Sonstiges'}
                      </Badge>
                      <span>{format(parseISO(p.start_date), "dd.MM.yyyy")} - {format(parseISO(p.end_date), "dd.MM.yyyy")}</span>
                      <span className="text-muted-foreground">• Warten auf Genehmigung</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Urlaub beantragen</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Von</Label><Input type="date" value={vacationStartDate} onChange={e => setVacationStartDate(e.target.value)} /></div>
                  <div><Label>Bis</Label><Input type="date" value={vacationEndDate} onChange={e => setVacationEndDate(e.target.value)} /></div>
                </div>
                <div><Label>Grund</Label><Textarea value={vacationReason} onChange={e => setVacationReason(e.target.value)} placeholder="Optional" /></div>
                <Button onClick={handleRequestVacation}>Urlaub beantragen</Button>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Urlaubskonto {selectedMonth.getFullYear()}</CardTitle>
                    <CardDescription className="mt-1">
                      Anspruch: {vacationBalance.totalEntitlement} | Genommen: {vacationBalance.taken} | Verbleibend: {vacationBalance.remaining}
                    </CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setVacationHistoryOpen(true)}>
                    <History className="h-4 w-4 mr-1" />
                    Historie
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Resturlaub Anzeige */}
                {vacationBalance.carryOver > 0 && !vacationBalance.carryOverExpired && (
                  <div className="p-3 rounded-lg border border-amber-200 bg-amber-50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                        <span className="font-medium text-amber-800">Resturlaub aus {selectedMonth.getFullYear() - 1}</span>
                      </div>
                      <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300">
                        {vacationBalance.carryOverRemaining} von {vacationBalance.carryOver} Tagen übrig
                      </Badge>
                    </div>
                    <p className="text-xs text-amber-700 mt-1">
                      ⚠️ Verfällt am 31.03.{selectedMonth.getFullYear()} – Wird zuerst verbraucht!
                    </p>
                  </div>
                )}
                
                {vacationBalance.carryOverExpired && (
                  <div className="p-3 rounded-lg border border-red-200 bg-red-50">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-red-600" />
                      <span className="text-sm text-red-800">Resturlaub aus dem Vorjahr ist am 31.03. verfallen.</span>
                    </div>
                  </div>
                )}

                {/* Aufschlüsselung */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="p-3 rounded-lg bg-muted/50">
                    <div className="text-muted-foreground">Neuer Urlaub {selectedMonth.getFullYear()}</div>
                    <div className="font-semibold text-lg">{vacationBalance.newVacationRemaining} / {vacationBalance.prorated} Tage</div>
                  </div>
                  {vacationBalance.carryOver > 0 && !vacationBalance.carryOverExpired && (
                    <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
                      <div className="text-amber-700">Resturlaub</div>
                      <div className="font-semibold text-lg text-amber-800">{vacationBalance.carryOverRemaining} / {vacationBalance.carryOver} Tage</div>
                    </div>
                  )}
                </div>

                {/* Urlaubsliste */}
                {vacationLeaves.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Keine Urlaubsanträge vorhanden</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Von</TableHead>
                        <TableHead>Bis</TableHead>
                        <TableHead>Tage</TableHead>
                        <TableHead>Grund</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Aktion</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {vacationLeaves.map(v => { 
                        const d = eachDayOfInterval({ start: parseISO(v.start_date), end: parseISO(v.end_date) }).filter(d => d.getDay() !== 0 && d.getDay() !== 6).length;
                        const canCancel = (v.status === 'pending' || v.status === 'approved') && parseISO(v.start_date) > new Date();
                        const isCancelRequested = v.status === 'cancel_requested';
                        
                        return (
                          <TableRow key={v.id}>
                            <TableCell>{format(parseISO(v.start_date), "dd.MM.yyyy")}</TableCell>
                            <TableCell>{format(parseISO(v.end_date), "dd.MM.yyyy")}</TableCell>
                            <TableCell>{d}</TableCell>
                            <TableCell>{v.reason || "-"}</TableCell>
                            <TableCell>{getStatusBadge(v.status)}</TableCell>
                            <TableCell>
                              {canCancel && !isCancelRequested && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleCancelVacationRequest(v.id)}
                                  className="h-8 px-2 text-muted-foreground hover:text-destructive"
                                >
                                  <Undo2 className="h-4 w-4 mr-1" />
                                  Stornieren
                                </Button>
                              )}
                              {isCancelRequested && (
                                <span className="text-xs text-amber-600 flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  Wird geprüft
                                </span>
                              )}
                            </TableCell>
                          </TableRow>
                        ); 
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Krankmeldung</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Von</Label><Input type="date" value={sickStartDate} onChange={e => setSickStartDate(e.target.value)} /></div>
                  <div><Label>Bis</Label><Input type="date" value={sickEndDate} onChange={e => setSickEndDate(e.target.value)} /></div>
                </div>
                <div><Label>Notizen</Label><Textarea value={sickNotes} onChange={e => setSickNotes(e.target.value)} placeholder="Optional" /></div>
                <Button onClick={handleReportSick}>Krankmeldung einreichen</Button>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Krankmeldungen {selectedMonth.getFullYear()}</CardTitle>
              </CardHeader>
              <CardContent>
                {sickLeaves.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Keine Krankmeldungen vorhanden</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Von</TableHead>
                        <TableHead>Bis</TableHead>
                        <TableHead>Tage</TableHead>
                        <TableHead>Notizen</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sickLeaves.map(s => { 
                        const d = eachDayOfInterval({ start: parseISO(s.start_date), end: parseISO(s.end_date) }).filter(d => d.getDay() !== 0 && d.getDay() !== 6).length; 
                        return (
                          <TableRow key={s.id}>
                            <TableCell>{format(parseISO(s.start_date), "dd.MM.yyyy")}</TableCell>
                            <TableCell>{format(parseISO(s.end_date), "dd.MM.yyyy")}</TableCell>
                            <TableCell>{d}</TableCell>
                            <TableCell>{s.reason || "-"}</TableCell>
                            <TableCell>{getStatusBadge(s.status)}</TableCell>
                          </TableRow>
                        ); 
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
          
          {/* Medical Appointments Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Stethoscope className="h-5 w-5 text-purple-600" />
                  Arzttermin melden
                </CardTitle>
                <CardDescription>
                  Bezahlte Freistellung für akute Arztbesuche, Facharzttermine oder Nachsorge
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label>Datum</Label>
                    <Input 
                      type="date" 
                      value={medicalDate} 
                      onChange={e => setMedicalDate(e.target.value)} 
                    />
                  </div>
                  <div>
                    <Label>Von</Label>
                    <Input 
                      type="time" 
                      value={medicalStartTime} 
                      onChange={e => setMedicalStartTime(e.target.value)} 
                    />
                  </div>
                  <div>
                    <Label>Bis</Label>
                    <Input 
                      type="time" 
                      value={medicalEndTime} 
                      onChange={e => setMedicalEndTime(e.target.value)} 
                    />
                  </div>
                </div>
                <div>
                  <Label>Art des Termins</Label>
                  <Select value={medicalReason} onValueChange={setMedicalReason}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="acute">Akuter Arztbesuch (plötzliche Beschwerden)</SelectItem>
                      <SelectItem value="specialist">Unaufschiebbarer Facharzttermin</SelectItem>
                      <SelectItem value="follow_up">Nachsorge nach OP</SelectItem>
                      <SelectItem value="pregnancy">Schwangerschaftsvorsorge</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Notizen</Label>
                  <Textarea 
                    value={medicalNotes} 
                    onChange={e => setMedicalNotes(e.target.value)} 
                    placeholder="Optional" 
                  />
                </div>
                <Button onClick={handleReportMedical} className="w-full">
                  Arzttermin einreichen
                </Button>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Stethoscope className="h-5 w-5 text-purple-600" />
                  Arzttermine {selectedMonth.getFullYear()}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {medicalLeaves.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Keine Arzttermine vorhanden</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Datum</TableHead>
                        <TableHead>Zeit</TableHead>
                        <TableHead>Art</TableHead>
                        <TableHead>Dauer</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Aktion</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {medicalLeaves.map(m => {
                        const canCancel = (m.status === 'pending' || m.status === 'approved') && parseISO(m.start_date) > new Date();
                        const isCancelRequested = m.status === 'cancel_requested';
                        
                        return (
                          <TableRow key={m.id}>
                            <TableCell>{format(parseISO(m.start_date), "dd.MM.yyyy")}</TableCell>
                            <TableCell>
                              {m.start_time && m.end_time ? `${m.start_time} - ${m.end_time}` : "-"}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {getMedicalReasonLabel(m.medical_reason)}
                              </Badge>
                            </TableCell>
                            <TableCell>{fmt(m.minutes_counted || 0)}</TableCell>
                            <TableCell>{getStatusBadge(m.status)}</TableCell>
                            <TableCell>
                              {canCancel && !isCancelRequested && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleCancelMedicalRequest(m.id)}
                                  className="h-8 px-2 text-muted-foreground hover:text-destructive"
                                >
                                  <Undo2 className="h-4 w-4 mr-1" />
                                  Stornieren
                                </Button>
                              )}
                              {isCancelRequested && (
                                <span className="text-xs text-amber-600 flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  Wird geprüft
                                </span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
          
          {/* Overtime Reduction Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Timer className="h-5 w-5 text-amber-600" />
                  Überstundenabbau beantragen
                </CardTitle>
                <CardDescription>
                  Mehrstunden als freie Tage nehmen statt Urlaub
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Info Box */}
                <div className="p-3 rounded-lg bg-muted/50 text-sm">
                  <div className="flex justify-between">
                    <span>Überstundensaldo (gesamt):</span>
                    <span className={`font-mono font-bold ${yearlyBalance >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                      {yearlyBalance >= 0 ? '+' : ''}{fmt(yearlyBalance)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Jahressaldo inkl. aller Monate bis heute
                  </p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Von</Label>
                    <Input 
                      type="date" 
                      value={overtimeStartDate} 
                      onChange={e => setOvertimeStartDate(e.target.value)} 
                    />
                  </div>
                  <div>
                    <Label>Bis</Label>
                    <Input 
                      type="date" 
                      value={overtimeEndDate} 
                      onChange={e => setOvertimeEndDate(e.target.value)} 
                    />
                  </div>
                </div>
                <div>
                  <Label>Anmerkung</Label>
                  <Textarea 
                    value={overtimeReason} 
                    onChange={e => setOvertimeReason(e.target.value)} 
                    placeholder="Optional" 
                  />
                </div>
                <Button onClick={handleRequestOvertimeReduction} className="w-full">
                  Überstundenabbau beantragen
                </Button>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Timer className="h-5 w-5 text-amber-600" />
                  Überstundenabbau {selectedMonth.getFullYear()}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {overtimeLeaves.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Keine Überstundenabbau-Anträge vorhanden</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Von</TableHead>
                        <TableHead>Bis</TableHead>
                        <TableHead>Tage</TableHead>
                        <TableHead>Anmerkung</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Aktion</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {overtimeLeaves.map(o => {
                        const d = eachDayOfInterval({ 
                          start: parseISO(o.start_date), 
                          end: parseISO(o.end_date) 
                        }).filter(d => d.getDay() !== 0 && d.getDay() !== 6).length;
                        const canCancel = (o.status === 'pending' || o.status === 'approved') && parseISO(o.start_date) > new Date();
                        const isCancelRequested = o.status === 'cancel_requested';
                        
                        return (
                          <TableRow key={o.id}>
                            <TableCell>{format(parseISO(o.start_date), "dd.MM.yyyy")}</TableCell>
                            <TableCell>{format(parseISO(o.end_date), "dd.MM.yyyy")}</TableCell>
                            <TableCell>{d}</TableCell>
                            <TableCell>{o.reason || "-"}</TableCell>
                            <TableCell>{getStatusBadge(o.status)}</TableCell>
                            <TableCell>
                              {canCancel && !isCancelRequested && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleCancelOvertimeRequest(o.id)}
                                  className="h-8 px-2 text-muted-foreground hover:text-destructive"
                                >
                                  <Undo2 className="h-4 w-4 mr-1" />
                                  Stornieren
                                </Button>
                              )}
                              {isCancelRequested && (
                                <span className="text-xs text-amber-600 flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  Wird geprüft
                                </span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
          
          {/* Vacation History Dialog */}
          <VacationHistoryDialog 
            open={vacationHistoryOpen} 
            onOpenChange={setVacationHistoryOpen} 
          />
        </TabsContent>

        <TabsContent value="employee-info" className="space-y-6">
          <EmployeeInfoTab employeeSettings={employeeSettings} />
        </TabsContent>
      </Tabs>
      {/* Yearly breakdown dialog */}
      <Dialog open={showBreakdownDialog} onOpenChange={setShowBreakdownDialog}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Überstunden-Aufschlüsselung {getYear(selectedMonth)}</DialogTitle>
            <DialogDescription>
              Monatliche Entwicklung deines Überstundensaldos
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <ScrollArea className="h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Monat</TableHead>
                    <TableHead className="text-right">Soll</TableHead>
                    <TableHead className="text-right">Gearbeitet</TableHead>
                    <TableHead className="text-right">Gutschriften</TableHead>
                    <TableHead className="text-right">Saldo</TableHead>
                    <TableHead className="text-right">Kumuliert</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {yearlyBreakdown.map((mb, idx) => {
                    const cumulative = yearlyBreakdown.slice(0, idx + 1).reduce((sum, m) => sum + m.balance, 0);
                    return (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">
                          {format(mb.month, "MMMM", { locale: de })}
                        </TableCell>
                        <TableCell className="text-right">{fmt(mb.targetMinutes)}</TableCell>
                        <TableCell className="text-right">{fmt(mb.workedMinutes)}</TableCell>
                        <TableCell className="text-right text-blue-600">+{fmt(mb.creditMinutes)}</TableCell>
                        <TableCell className={`text-right font-medium ${mb.balance >= 0 ? "text-green-600" : "text-destructive"}`}>
                          {mb.balance >= 0 ? "+" : ""}{fmt(mb.balance)}
                        </TableCell>
                        <TableCell className={`text-right font-bold ${cumulative >= 0 ? "text-green-600" : "text-destructive"}`}>
                          {cumulative >= 0 ? "+" : ""}{fmt(cumulative)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  <TableRow className="bg-muted/50 font-bold">
                    <TableCell colSpan={4}>Gesamt {getYear(selectedMonth)}</TableCell>
                    <TableCell className={`text-right ${yearlyBalance >= 0 ? "text-green-600" : "text-destructive"}`}>
                      {yearlyBalance >= 0 ? "+" : ""}{fmt(yearlyBalance)}
                    </TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </ScrollArea>
            
            <div className="bg-muted/50 rounded-md p-3 text-sm">
              <p className="font-medium mb-1">Legende:</p>
              <ul className="text-muted-foreground space-y-1 text-xs">
                <li><strong>Soll:</strong> Arbeitstage im Monat × tägliche Arbeitszeit (ohne Feiertage)</li>
                <li><strong>Gearbeitet:</strong> Tatsächlich erfasste Arbeitszeit</li>
                <li><strong>Gutschriften:</strong> Urlaub, Krankheit, Überstundenabbau</li>
                <li><strong>Saldo:</strong> Gearbeitet + Gutschriften − Soll</li>
                <li><strong>Kumuliert:</strong> Laufende Summe aller Monats-Salden</li>
              </ul>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBreakdownDialog(false)}>
              Schließen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
