import { useState, useEffect, useMemo, useCallback } from "react";
import { debugConsole } from '@/utils/debugConsole';
import { useUserPreference } from "@/hooks/useUserPreference";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format, parseISO, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval } from "date-fns";
import { de } from "date-fns/locale";
import { Clock, Plus, ExternalLink, TrendingUp, Calendar, Play, Pause, Square, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTimeEntryReminder } from "@/hooks/useTimeEntryReminder";
import { ARBZG_MAX_DAILY_WORK_MINUTES, checkArbzgDay, elapsedWorkedMinutes, requiredPauseForSpan, summarizeArbzgDay } from "@/features/timetracking/arbzg";
import { cn } from "@/lib/utils";
import { useVacationReminders } from "@/hooks/useVacationReminders";
import { useResolvedUserRole } from "@/hooks/useResolvedUserRole";
import { useTenant } from "@/hooks/useTenant";
import {
  calculateWeeklyTarget,
  WEEK_TARGET_ABSENCE_TYPES,
  type PublicHolidayRow,
  type WeeklyAbsence,
} from "@/features/timetracking/weeklyTarget";
import { notify } from "@/lib/notify";

interface TimeEntryRow {
  id: string;
  work_date: string;
  started_at: string | null;
  ended_at: string | null;
  minutes: number | null;
  pause_minutes?: number | null;
  arbzg_pause_minutes?: number | null;
  notes: string | null;
}

interface EmployeeSettingsRow {
  hours_per_week: number;
  hours_per_month: number;
  days_per_month: number;
  days_per_week: number;
  /** Monday-first individual workday plan. */
  workdays: boolean[] | null;
}

interface ClockData {
  clockIn: string;
  date: string;
  pauseStart: string | null;
  pauseTotal: number;
  updatedAt: number;
}

const CLOCK_STORAGE_TTL_MS = 18 * 60 * 60 * 1000;

export function MyWorkTimeTrackingTab() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { isEmployee } = useResolvedUserRole();
  const { currentTenant } = useTenant();
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<TimeEntryRow[]>([]);
  const [employeeSettings, setEmployeeSettings] = useState<EmployeeSettingsRow | null>(null);
  const [holidays, setHolidays] = useState<PublicHolidayRow[]>([]);
  const [absences, setAbsences] = useState<WeeklyAbsence[]>([]);

  // Check for missing time entries and remind user
  useTimeEntryReminder(user?.id ?? null);
  useVacationReminders();

  // Form state
  const [entryDate, setEntryDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState(() => format(new Date(), "HH:mm"));
  // Pause enthält nur tatsächlich genommene Pausen; die Pflichtpause wird nicht vorbelegt.
  const [pauseMinutes, setPauseMinutes] = useState("0");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Stempeluhr – single persisted state object
  const [clockData, setClockData] = useUserPreference<ClockData | null>("timetracking_clock", null);

  // Derived clock states
  const [clockedIn, setClockedIn] = useState<string | null>(null);
  const [clockedInDate, setClockedInDate] = useState<string | null>(null);
  const [pauseStart, setPauseStart] = useState<string | null>(null);
  const [totalPauseMinutes, setTotalPauseMinutes] = useState(0);
  // Tickt nur während laufender Stempeluhr, damit die Pausenpflicht sichtbar bleibt.
  const [clockNow, setClockNow] = useState(() => new Date());

  const clearClockData = useCallback(() => {
    setClockedIn(null);
    setClockedInDate(null);
    setPauseStart(null);
    setTotalPauseMinutes(0);
    setClockData(null);
  }, [setClockData]);

  // Beim Mount: Gespeicherte Stempelzeit laden
  useEffect(() => {
    if (!clockData) return;
    const isExpired = Date.now() - clockData.updatedAt > CLOCK_STORAGE_TTL_MS;
    const today = format(new Date(), "yyyy-MM-dd");

    if (clockData.clockIn && clockData.date === today && !isExpired) {
      setClockedIn(clockData.clockIn);
      setClockedInDate(clockData.date);
      setStartTime(clockData.clockIn);
      if (clockData.pauseStart) setPauseStart(clockData.pauseStart);
      if (clockData.pauseTotal) {
        setTotalPauseMinutes(clockData.pauseTotal);
        setPauseMinutes(clockData.pauseTotal.toString());
      }
    } else if (clockData.clockIn && (clockData.date !== today || isExpired)) {
      clearClockData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only on mount

  useEffect(() => {
    if (!clockedIn) return;
    setClockNow(new Date());
    const interval = setInterval(() => setClockNow(new Date()), 30_000);
    return () => clearInterval(interval);
  }, [clockedIn]);

  const handleClockIn = () => {
    const now = format(new Date(), "HH:mm");
    const today = format(new Date(), "yyyy-MM-dd");
    setClockedIn(now);
    setClockedInDate(today);
    setStartTime(now);
    setEntryDate(today);
    setTotalPauseMinutes(0);
    setPauseMinutes("0");
    setClockData({ clockIn: now, date: today, pauseStart: null, pauseTotal: 0, updatedAt: Date.now() });
    notify.success(`Arbeit begonnen um ${now}`);
  };

  const handlePauseStart = () => {
    const now = format(new Date(), "HH:mm");
    setPauseStart(now);
    setClockData(prev => prev ? { ...prev, pauseStart: now, updatedAt: Date.now() } : prev);
    notify.info(`Pause begonnen um ${now}`);
  };

  const handlePauseEnd = () => {
    if (!pauseStart) return;
    
    const pauseStartTime = new Date(`1970-01-01T${pauseStart}:00`);
    const now = new Date();
    const pauseEndTime = new Date(`1970-01-01T${format(now, "HH:mm")}:00`);
    const minutes = Math.round((pauseEndTime.getTime() - pauseStartTime.getTime()) / 60000);
    
    const newTotal = totalPauseMinutes + minutes;
    setTotalPauseMinutes(newTotal);
    setPauseMinutes(newTotal.toString());
    setPauseStart(null);
    
    setClockData(prev => prev ? { ...prev, pauseStart: null, pauseTotal: newTotal, updatedAt: Date.now() } : prev);
    
    notify.success(`Pause beendet (+${minutes} Min)`);
  };

  const handleClockOut = () => {
    const now = format(new Date(), "HH:mm");
    setEndTime(now);
    const workedMinutes = clockedIn ? elapsedWorkedMinutes(clockedIn, pauseStart, totalPauseMinutes) : 0;
    // Pausenpflicht des Tages: bereits gespeicherte Einträge zählen mit.
    const todayKey = clockedInDate ?? format(new Date(), "yyyy-MM-dd");
    const savedToday = entries.filter(entry => entry.work_date === todayKey);
    const savedWorked = savedToday.reduce((sum, entry) => sum + Math.max(0, entry.minutes ?? 0), 0);
    const savedPause = savedToday.reduce((sum, entry) => sum + Math.max(0, entry.pause_minutes ?? 0), 0);
    const arbzg = checkArbzgDay({
      workedMinutes: savedWorked + workedMinutes,
      pauseMinutes: savedPause + totalPauseMinutes,
    });
    if (arbzg.missingPauseMinutes > 0) {
      notify.warning(`Pausenpflicht: ${arbzg.requiredPauseMinutes} Min Pause vorgeschrieben, erfasst sind ${totalPauseMinutes} Min`);
    }
    notify.success(`Feierabend um ${now} - Bitte Eintrag speichern`);
  };

  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
  const monthStart = startOfMonth(today);
  const monthEnd = endOfMonth(today);
  const todayKey = format(today, "yyyy-MM-dd");
  const weekStartKey = format(weekStart, "yyyy-MM-dd");
  const weekEndKey = format(weekEnd, "yyyy-MM-dd");

  useEffect(() => {
    if (user) {
      checkRoleAndLoad();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEmployee, user, currentTenant?.id]);

  // Realtime subscription
  useEffect(() => {
    if (!user?.id) return;
    let timeout: ReturnType<typeof setTimeout> | null = null;
    const scheduleRefresh = () => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => { timeout = null; void checkRoleAndLoad(); }, 250);
    };
    const channel = supabase
      .channel(`my-work-time-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "time_entries", filter: `user_id=eq.${user.id}` }, scheduleRefresh)
      .subscribe();
    return () => {
      if (timeout) clearTimeout(timeout);
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const checkRoleAndLoad = async () => {
    if (!user) return;

    try {
      if (!isEmployee) {
        setEmployeeSettings(null);
        setEntries([]);
        setLoading(false);
        return;
      }

      // Load settings and entries
      const [settingsRes, weekEntriesRes, monthEntriesRes, holidaysRes, absencesRes] = await Promise.all([
        supabase.from("employee_settings").select("hours_per_week, hours_per_month, days_per_month, days_per_week, workdays").eq("user_id", user.id).single(),
        supabase.from("time_entries").select("id, user_id, work_date, minutes, notes, started_at, ended_at, pause_minutes, arbzg_pause_minutes, edit_reason, edited_at, edited_by, created_at, updated_at").eq("user_id", user.id)
          .gte("work_date", format(weekStart, "yyyy-MM-dd"))
          .lte("work_date", format(weekEnd, "yyyy-MM-dd"))
          .order("work_date", { ascending: false }),
        supabase.from("time_entries").select("id, minutes").eq("user_id", user.id)
          .gte("work_date", format(monthStart, "yyyy-MM-dd"))
          .lte("work_date", format(monthEnd, "yyyy-MM-dd")),
        currentTenant?.id
          ? supabase.from("public_holidays").select("holiday_date, state, is_nationwide")
              .eq("tenant_id", currentTenant.id)
              .gte("holiday_date", weekStartKey)
              .lte("holiday_date", weekEndKey)
          : Promise.resolve({ data: [] as PublicHolidayRow[], error: null }),
        supabase.from("leave_requests").select("start_date, end_date")
          .eq("user_id", user.id)
          .in("type", [...WEEK_TARGET_ABSENCE_TYPES])
          .eq("status", "approved")
          .lte("start_date", weekEndKey)
          .gte("end_date", weekStartKey),
      ]);

      setEmployeeSettings(settingsRes.data);
      setEntries(weekEntriesRes.data || []);
      setHolidays((holidaysRes.data as PublicHolidayRow[] | null) ?? []);
      setAbsences((absencesRes.data as WeeklyAbsence[] | null) ?? []);
    } catch (error) {
      debugConsole.error("Error loading time tracking data:", error);
    } finally {
      setLoading(false);
    }
  };

  const weeklyWorked = useMemo(() => {
    return entries.reduce((sum, e) => sum + (e.minutes || 0), 0);
  }, [entries]);

  // Soll wie im Team-Tab: individueller Arbeitsplan statt voller Wochenstunden,
  // Feiertage und genehmigte Abwesenheiten senken das Soll.
  const fullWeekTarget = useMemo(() => calculateWeeklyTarget({
    hoursPerWeek: employeeSettings?.hours_per_week ?? null,
    daysPerWeek: employeeSettings?.days_per_week ?? null,
    workdays: employeeSettings?.workdays ?? null,
    weekStart: weekStartKey,
    today: weekEndKey,
    holidays,
    absences,
  }), [employeeSettings, weekStartKey, weekEndKey, holidays, absences]);

  const targetToDate = useMemo(() => calculateWeeklyTarget({
    hoursPerWeek: employeeSettings?.hours_per_week ?? null,
    daysPerWeek: employeeSettings?.days_per_week ?? null,
    workdays: employeeSettings?.workdays ?? null,
    weekStart: weekStartKey,
    today: todayKey,
    holidays,
    absences,
  }), [employeeSettings, weekStartKey, todayKey, holidays, absences]);

  const weeklyTarget = fullWeekTarget.targetMinutes;

  // Die Pausenpflicht gilt für den gesamten Tag: fehlende Ruhepausen werden aus
  // allen Einträgen des Tages berechnet und nie von der Arbeitszeit abgezogen.
  const missingByDate = useMemo(() => {
    const map = new Map<string, number>();
    for (const date of new Set(entries.map(entry => entry.work_date))) {
      map.set(date, summarizeArbzgDay(entries.filter(entry => entry.work_date === date)).missingPauseMinutes);
    }
    return map;
  }, [entries]);

  const liveWorkedMinutes = clockedIn
    ? elapsedWorkedMinutes(clockedIn, pauseStart, totalPauseMinutes, clockNow)
    : 0;
  // Die Pausenpflicht gilt für den ganzen Arbeitstag, nicht nur für die laufende Schicht.
  const liveDayKey = clockedInDate ?? format(clockNow, "yyyy-MM-dd");
  const liveSaved = entries.filter(entry => entry.work_date === liveDayKey);
  const liveArbzg = checkArbzgDay({
    workedMinutes: liveSaved.reduce((sum, entry) => sum + Math.max(0, entry.minutes ?? 0), 0) + liveWorkedMinutes,
    pauseMinutes: liveSaved.reduce((sum, entry) => sum + Math.max(0, entry.pause_minutes ?? 0), 0) + totalPauseMinutes,
  });

  const formSpanMinutes = useMemo(() => {
    if (!startTime || !endTime) return null;
    const start = new Date(`${entryDate}T${startTime}`);
    const end = new Date(`${entryDate}T${endTime}`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) return null;
    return Math.round((end.getTime() - start.getTime()) / 60000);
  }, [endTime, entryDate, startTime]);

  const suggestedPauseMinutes = formSpanMinutes === null ? 0 : requiredPauseForSpan(formSpanMinutes);
  const enteredPauseMinutes = parseInt(pauseMinutes) || 0;
  const formArbzg = formSpanMinutes === null
    ? null
    : checkArbzgDay({ workedMinutes: Math.max(0, formSpanMinutes - enteredPauseMinutes), pauseMinutes: enteredPauseMinutes });

  const loadDayEntries = async (workDate: string) => {
    if (!user) return [];
    const { data, error } = await supabase
      .from("time_entries")
      .select("started_at, ended_at, pause_minutes")
      .eq("user_id", user.id)
      .eq("work_date", workDate);
    if (error) throw error;
    return data ?? [];
  };

  const formatDuration = (min: number) => `${Math.floor(min / 60)}:${(min % 60).toString().padStart(2, '0')}`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !startTime || !endTime) {
      notify.error("Bitte alle Felder ausfüllen");
      return;
    }

    const start = new Date(`${entryDate}T${startTime}`);
    const end = new Date(`${entryDate}T${endTime}`);
    
    if (end <= start) {
      notify.error("Endzeit muss nach Startzeit liegen");
      return;
    }

    const gross = Math.round((end.getTime() - start.getTime()) / 60000);
    // Nur tatsächlich genommene Pausen zählen und werden von der Arbeitszeit abgezogen.
    const recordedPause = Math.min(Math.max(0, parseInt(pauseMinutes) || 0), gross);

    setIsSubmitting(true);
    try {
      // Die Pausenpflicht gilt für den gesamten Arbeitstag, nicht für den einzelnen Eintrag.
      const day = summarizeArbzgDay([
        ...(await loadDayEntries(entryDate)),
        { started_at: start.toISOString(), ended_at: end.toISOString(), pause_minutes: recordedPause },
      ]);

      if (day.workedMinutes > ARBZG_MAX_DAILY_WORK_MINUTES) {
        throw new Error(
          `Maximal 10:00 Stunden Arbeitszeit pro Tag (ohne Pausen). Mit diesem Eintrag: ${formatDuration(day.workedMinutes)}.`,
        );
      }

      const { error } = await supabase.from("time_entries").insert([{
        user_id: user.id,
        work_date: entryDate,
        started_at: start.toISOString(),
        ended_at: end.toISOString(),
        minutes: gross - recordedPause,
        pause_minutes: recordedPause,
        // Eine rechnerisch ergänzte Pause ersetzt keine tatsächlich genommene Pause.
        arbzg_pause_minutes: 0,
        notes: notes || null,
      }]);

      if (error) throw error;

      if (day.missingPauseMinutes > 0) {
        notify.warning(
          `Zeiteintrag gespeichert – Pausenpflicht: ${day.requiredPauseMinutes} Min am Tag, erfasst ${recordedPause} Min. ` +
          `${day.missingPauseMinutes} Min fehlen; Klärungsbedarf für die Büroleitung ist vermerkt.`,
        );
      } else {
        notify.success("Zeiteintrag gespeichert");
      }
      // Stempeluhr-Daten nach erfolgreichem Speichern löschen
      clearClockData();
      setStartTime("");
      setEndTime(format(new Date(), "HH:mm"));
      setPauseMinutes("0");
      setNotes("");
      checkRoleAndLoad();
    } catch (error: unknown) {
      notify.error(error instanceof Error ? error.message : "Fehler beim Speichern");
    } finally {
      setIsSubmitting(false);
    }
  };

  const fmt = (m: number) => `${m < 0 ? "-" : ""}${Math.floor(Math.abs(m) / 60)}:${(Math.abs(m) % 60).toString().padStart(2, "0")}`;

  const getProgressColor = () => {
    const percentage = (weeklyWorked / weeklyTarget) * 100;
    if (percentage < 50) return "text-destructive";
    if (percentage < 80) return "text-palette-orange";
    if (percentage <= 100) return "text-palette-green";
    return "text-palette-blue"; // Überstunden
  };

  if (loading) {
    return (
      <div className="space-y-4 p-4">
        <div className="h-32 bg-muted animate-pulse rounded-lg" />
        <div className="h-48 bg-muted animate-pulse rounded-lg" />
      </div>
    );
  }

  if (!isEmployee) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
        <p className="text-lg font-medium">Zeiterfassung</p>
        <p className="text-sm mt-1">Nur für Mitarbeiter verfügbar</p>
        <Button 
          variant="outline" 
          className="mt-4"
          onClick={() => navigate("/employee")}
        >
          <ExternalLink className="h-4 w-4 mr-2" />
          Zur Team-Übersicht
        </Button>
      </div>
    );
  }

  if (!employeeSettings) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
        <p className="text-lg font-medium">Keine Einstellungen</p>
        <p className="text-sm mt-1">Bitte wenden Sie sich an Ihren Administrator.</p>
      </div>
    );
  }

  const difference = weeklyWorked - weeklyTarget;
  // Anteiliges Soll bis heute – identisch mit dem Soll im Team-Tab.
  const proportionalDifference = weeklyWorked - targetToDate.targetMinutes;

  return (
    <div className="space-y-6">
      <Tabs defaultValue="erfassen" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="erfassen">Erfassen</TabsTrigger>
          <TabsTrigger value="auswertung">Auswertung</TabsTrigger>
        </TabsList>
        <TabsContent value="auswertung" className="mt-0 space-y-6">
      {/* Wochenübersicht */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Diese Woche
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getProgressColor()}`}>
              {fmt(weeklyWorked)}
            </div>
            <p className="text-xs text-muted-foreground">
              von {fmt(weeklyTarget)} Stunden
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Saldo (anteilig)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${proportionalDifference >= 0 ? "text-palette-green" : "text-destructive"}`}>
              {proportionalDifference >= 0 ? "+" : ""}{fmt(proportionalDifference)}
            </div>
            <p className="text-xs text-muted-foreground">
              Soll bis {format(today, "EEEE", { locale: de })}: {fmt(targetToDate.targetMinutes)} h
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Wochensaldo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${difference >= 0 ? "text-palette-green" : "text-destructive"}`}>
              {difference >= 0 ? "+" : ""}{fmt(difference)}
            </div>
            <p className="text-xs text-muted-foreground">
              Vollständige Woche
            </p>
          </CardContent>
        </Card>
      </div>
        </TabsContent>

        <TabsContent value="erfassen" className="mt-0 space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Stempeluhr */}
        <Card className={clockedIn ? "border-primary/50 bg-primary/5" : ""}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Play className="h-5 w-5" />
                Stempeluhr
              </CardTitle>
              {clockedIn && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (window.confirm('Stempeluhr abbrechen?')) clearClockData();
                  }}
                  className="h-8 px-2 text-muted-foreground hover:text-destructive"
                >
                  <X className="h-4 w-4 mr-1" />
                  Abbrechen
                </Button>
              )}
            </div>
            <CardDescription>
              {clockedIn ? "Arbeitszeit läuft..." : "Automatisch Start- und Endzeit erfassen"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!clockedIn ? (
              <Button onClick={handleClockIn} className="w-full" size="lg">
                <Play className="h-5 w-5 mr-2" />
                Arbeit beginnen
              </Button>
            ) : pauseStart ? (
              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-palette-amber/10 border border-palette-amber/30 text-center">
                  <div className="text-sm text-palette-amber">In Pause seit</div>
                  <div className="text-2xl font-bold text-palette-amber">{pauseStart}</div>
                </div>
                <Button onClick={handlePauseEnd} className="w-full" variant="outline" size="lg">
                  <Play className="h-5 w-5 mr-2" />
                  Pause beenden
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div className="p-3 rounded-lg bg-muted/50">
                    <div className="text-xs text-muted-foreground">Arbeitsbeginn</div>
                    <div className="text-xl font-bold">{clockedIn}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <div className="text-xs text-muted-foreground">Pausenzeit</div>
                    <div className="text-xl font-bold">{totalPauseMinutes} Min</div>
                  </div>
                </div>
                <div className="space-y-1 rounded-lg border bg-muted/30 p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Arbeitszeit bisher</span>
                    <span className="font-semibold">{fmt(liveWorkedMinutes)} h</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Pausenpflicht (ArbZG)</span>
                    <span className={cn("font-semibold", liveArbzg.missingPauseMinutes > 0 ? "text-destructive" : "text-muted-foreground")}>
                      {liveArbzg.requiredPauseMinutes > 0 ? `${liveArbzg.requiredPauseMinutes} Min` : "keine"}
                    </span>
                  </div>
                  {liveArbzg.missingPauseMinutes > 0 && (
                    <p className="text-xs text-destructive">
                      Noch {liveArbzg.missingPauseMinutes} Min Pause offen – bitte Pause starten.
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Button onClick={handlePauseStart} variant="outline" size="lg">
                    <Pause className="h-5 w-5 mr-2" />
                    Pause
                  </Button>
                  <Button onClick={handleClockOut} size="lg">
                    <Square className="h-5 w-5 mr-2" />
                    Feierabend
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Schnelleingabe */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Zeit erfassen
            </CardTitle>
            <CardDescription>
              {clockedIn ? "Formular ist vorausgefüllt - nach Feierabend speichern" : "Manuell Zeiteintrag hinzufügen"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Datum</Label>
                  <Input
                    type="date"
                    value={entryDate}
                    onChange={(e) => setEntryDate(e.target.value)}
                    max={format(new Date(), "yyyy-MM-dd")}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="time-pause">Pause (Min)</Label>
                  <Input
                    id="time-pause"
                    type="number"
                    value={pauseMinutes}
                    onChange={(e) => setPauseMinutes(e.target.value)}
                    min="0"
                    max="120"
                  />
                  {formSpanMinutes !== null && (
                    suggestedPauseMinutes > 0 ? (
                      <p className={cn("text-xs", formArbzg && formArbzg.missingPauseMinutes > 0 ? "text-destructive" : "text-muted-foreground")}>
                        {formArbzg && formArbzg.missingPauseMinutes > 0 ? (
                          <>
                            Pausenpflicht (ArbZG): {suggestedPauseMinutes} Min. Es fehlen{" "}
                            {formArbzg.missingPauseMinutes} Min – sie werden als Klärungsbedarf vermerkt und{" "}
                            nicht von der Arbeitszeit abgezogen.
                          </>
                        ) : (
                          <>ArbZG: {suggestedPauseMinutes} Min Pause vorgeschrieben und erfasst.</>
                        )}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">Bis 6 h Arbeitszeit ist keine Pause vorgeschrieben.</p>
                    )
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start</Label>
                  <Input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Ende</Label>
                  <Input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Notizen (optional)</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="z.B. Projektarbeit, Meeting..."
                  rows={2}
                />
              </div>

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? "Speichern..." : "Eintrag speichern"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Letzte Einträge */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg">Diese Woche</CardTitle>
              <CardDescription>
                {format(weekStart, "dd.MM.", { locale: de })} - {format(weekEnd, "dd.MM.yyyy", { locale: de })}
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate("/time")}>
              <ExternalLink className="h-4 w-4 mr-2" />
              Alle Einträge
            </Button>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[280px]">
              {entries.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Keine Einträge diese Woche</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Datum</TableHead>
                      <TableHead>Zeit</TableHead>
                      <TableHead className="text-right">Pause</TableHead>
                      <TableHead className="text-right">Stunden</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entries.map((entry, index) => {
                      // Die Pausenpflicht gilt für den Tag: Kennzeichnung einmal am Tag, nicht je Eintrag.
                      const firstForDay = entries.findIndex(item => item.work_date === entry.work_date) === index;
                      const missingPause = missingByDate.get(entry.work_date) ?? 0;
                      return (
                      <TableRow key={entry.id}>
                        <TableCell className="font-medium">
                          <div className="flex flex-col items-start gap-1">
                            <span>{format(parseISO(entry.work_date), "EEE, dd.MM.", { locale: de })}</span>
                            {firstForDay && missingPause > 0 && (
                              <Badge variant="outline" className="rounded-full border-0 bg-palette-amber/10 px-1.5 py-0 text-[10px] font-sans text-palette-amber" title="Klärungsbedarf am Tag (ArbZG) – die geleistete Arbeitszeit bleibt unverändert, die fehlende Pause wird nicht abgezogen.">
                                Pausenpflicht offen: {missingPause} Min
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {entry.started_at && entry.ended_at ? (
                            <>
                              {format(parseISO(entry.started_at), "HH:mm")} - {format(parseISO(entry.ended_at), "HH:mm")}
                            </>
                          ) : "-"}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {entry.pause_minutes ?? 0} Min
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {fmt(entry.minutes || 0)}
                        </TableCell>
                      </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
