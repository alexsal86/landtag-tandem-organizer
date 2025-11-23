import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths } from "date-fns";
import { de } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Edit, Trash2, History, Calendar } from "lucide-react";
import { calculateVacationBalance } from "@/utils/vacationCalculations";

interface TimeEntryRow {
  id: string;
  work_date: string;
  started_at: string | null;
  ended_at: string | null;
  minutes: number | null;
  pause_minutes?: number;
  notes: string | null;
}

interface EmployeeSettingsRow {
  user_id: string;
  hours_per_month: number;
  days_per_month: number;
  annual_vacation_days: number;
  carry_over_days: number;
  employment_start_date: string | null;
}

interface LeaveRow {
  id: string;
  type: "vacation" | "sick" | "other";
  start_date: string;
  end_date: string;
  status: string;
  reason: string | null;
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

  const monthStart = startOfMonth(selectedMonth);
  const monthEnd = endOfMonth(selectedMonth);

  useEffect(() => { if (user) loadData(); }, [user, selectedMonth]);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const year = selectedMonth.getFullYear();
      const [e, s, v, sick, h] = await Promise.all([
        supabase.from("time_entries").select("*").eq("user_id", user.id).gte("work_date", format(monthStart, "yyyy-MM-dd")).lte("work_date", format(monthEnd, "yyyy-MM-dd")).order("work_date", { ascending: false }),
        supabase.from("employee_settings").select("*").eq("user_id", user.id).single(),
        supabase.from("leave_requests").select("*").eq("user_id", user.id).eq("type", "vacation").in("status", ["approved", "pending", "rejected"]).gte("start_date", `${year}-01-01`).lte("end_date", `${year}-12-31`).order("start_date"),
        supabase.from("leave_requests").select("*").eq("user_id", user.id).eq("type", "sick").in("status", ["pending", "approved", "rejected"]).gte("start_date", `${year}-01-01`).lte("end_date", `${year}-12-31`).order("start_date"),
        supabase.from("public_holidays").select("*").gte("holiday_date", `${year}-01-01`).lte("holiday_date", `${year}-12-31`).order("holiday_date"),
      ]);
      setEntries(e.data || []); setEmployeeSettings(s.data); setVacationLeaves(v.data || []); setSickLeaves(sick.data || []); setHolidays(h.data || []);
    } catch (error: any) { toast.error("Fehler: " + error.message); } finally { setLoading(false); }
  };

  const dailyHours = employeeSettings ? employeeSettings.hours_per_month / employeeSettings.days_per_month : 8;
  const vacationBalance = useMemo(() => {
    if (!employeeSettings) return { totalEntitlement: 0, taken: 0, remaining: 0 };
    return calculateVacationBalance({ annualVacationDays: employeeSettings.annual_vacation_days, carryOverDays: employeeSettings.carry_over_days, employmentStartDate: employeeSettings.employment_start_date, approvedVacationLeaves: vacationLeaves.filter(l => l.status === "approved").map(l => ({ start_date: l.start_date, end_date: l.end_date })), currentYear: selectedMonth.getFullYear() });
  }, [employeeSettings, vacationLeaves, selectedMonth]);

  const monthlyTotals = useMemo(() => {
    const worked = entries.reduce((s, e) => s + (e.minutes || 0), 0);
    const sick = sickLeaves.reduce((s, l) => {
      if (l.status !== "approved") return s;
      const days = eachDayOfInterval({ start: parseISO(l.start_date), end: parseISO(l.end_date) }).filter(d => d >= monthStart && d <= monthEnd && d.getDay() !== 0 && d.getDay() !== 6).length;
      return s + days * dailyHours * 60;
    }, 0);
    const workingDays = eachDayOfInterval({ start: monthStart, end: monthEnd }).filter(d => d.getDay() !== 0 && d.getDay() !== 6 && !holidays.some(h => h.holiday_date === format(d, "yyyy-MM-dd"))).length;
    const target = workingDays * dailyHours * 60;
    return { worked, sick, target, difference: worked + sick - target, workingDays };
  }, [entries, sickLeaves, holidays, monthStart, monthEnd, dailyHours]);

  const projectionTotals = useMemo(() => {
    const today = new Date();
    const isCurrentMonth = today.getFullYear() === selectedMonth.getFullYear() && today.getMonth() === selectedMonth.getMonth();
    if (!isCurrentMonth) return null;
    const effectiveEndDate = today > monthEnd ? monthEnd : today;
    const workedDaysSoFar = eachDayOfInterval({ start: monthStart, end: effectiveEndDate }).filter(d => d.getDay() !== 0 && d.getDay() !== 6 && !holidays.some(h => h.holiday_date === format(d, "yyyy-MM-dd"))).length;
    const targetSoFar = workedDaysSoFar * dailyHours * 60;
    const workedSoFar = entries.filter(e => parseISO(e.work_date) <= today).reduce((s, e) => s + (e.minutes || 0), 0);
    const sickSoFar = sickLeaves.filter(l => l.status === "approved").reduce((s, l) => {
      const days = eachDayOfInterval({ start: parseISO(l.start_date), end: parseISO(l.end_date) }).filter(d => d >= monthStart && d <= effectiveEndDate && d.getDay() !== 0 && d.getDay() !== 6).length;
      return s + days * dailyHours * 60;
    }, 0);
    const actualSoFar = workedSoFar + sickSoFar;
    return { workedDaysSoFar, targetSoFar, actualSoFar, differenceSoFar: actualSoFar - targetSoFar };
  }, [entries, sickLeaves, holidays, monthStart, monthEnd, selectedMonth, dailyHours]);

  const validateDailyLimit = async (workDate: string, grossMin: number, excludeId?: string) => {
    if (!user) return;
    const { data } = await supabase.from("time_entries").select("id, started_at, ended_at").eq("user_id", user.id).eq("work_date", workDate);
    const total = data?.reduce((s, e) => e.id === excludeId || !e.started_at || !e.ended_at ? s : s + (new Date(e.ended_at).getTime() - new Date(e.started_at).getTime()) / 60000, 0) || 0;
    if (total + grossMin > 600) throw new Error(`An diesem Tag bereits ${Math.floor(total / 60)}:${(total % 60).toString().padStart(2, '0')} Stunden erfasst. Maximal 10 Stunden pro Tag erlaubt.`);
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

  const fmt = (m: number) => `${m < 0 ? "-" : ""}${Math.floor(Math.abs(m) / 60)}:${(Math.abs(m) % 60).toString().padStart(2, "0")}`;

  const getStatusBadge = (status: string) => {
    const config = {
      approved: { variant: "default" as const, label: "✓ Genehmigt", className: "bg-green-100 text-green-800 border-green-200" },
      pending: { variant: "secondary" as const, label: "⏳ Ausstehend", className: "bg-yellow-100 text-yellow-800 border-yellow-200" },
      rejected: { variant: "destructive" as const, label: "✗ Abgelehnt", className: "bg-red-100 text-red-800 border-red-200" },
    };
    const { label, className } = config[status as keyof typeof config] || config.pending;
    return <Badge className={className}>{label}</Badge>;
  };

  if (loading) return <div className="p-4">Lädt...</div>;
  if (!employeeSettings) return <div className="p-4">Keine Einstellungen.</div>;

  return (
    <div className="container mx-auto p-4 space-y-6">
      <Card><CardHeader className="flex flex-row items-center justify-between space-y-0"><Button variant="outline" size="icon" onClick={() => setSelectedMonth(subMonths(selectedMonth, 1))}><ChevronLeft className="h-4 w-4" /></Button><CardTitle className="text-2xl">{format(selectedMonth, "MMMM yyyy", { locale: de })}</CardTitle><Button variant="outline" size="icon" onClick={() => setSelectedMonth(addMonths(selectedMonth, 1))}><ChevronRight className="h-4 w-4" /></Button></CardHeader></Card>
      <Tabs defaultValue="time-tracking"><TabsList className="grid w-full grid-cols-2"><TabsTrigger value="time-tracking">Zeiterfassung</TabsTrigger><TabsTrigger value="leave-requests">Urlaub & Krankmeldungen</TabsTrigger></TabsList>
        <TabsContent value="time-tracking" className="space-y-6">
          <div className="grid grid-cols-4 gap-4">
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Gearbeitet</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{fmt(monthlyTotals.worked)}</div></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Krank</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{fmt(monthlyTotals.sick)}</div></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Soll/Ist ({monthlyTotals.workingDays} AT)</CardTitle></CardHeader><CardContent><div className="space-y-1"><div className="text-sm text-muted-foreground">Soll: {fmt(monthlyTotals.target)}</div><div className="text-sm text-muted-foreground">Ist: {fmt(monthlyTotals.worked + monthlyTotals.sick)}</div><div className={`text-lg font-bold ${monthlyTotals.difference >= 0 ? "text-green-600" : "text-red-600"}`}>Diff: {fmt(monthlyTotals.difference)}</div></div></CardContent></Card>
            {projectionTotals && <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Hochrechnung ({projectionTotals.workedDaysSoFar}/{monthlyTotals.workingDays} AT)</CardTitle></CardHeader><CardContent><div className="space-y-1"><div className="text-sm text-muted-foreground">Soll: {fmt(projectionTotals.targetSoFar)}</div><div className="text-sm text-muted-foreground">Ist: {fmt(projectionTotals.actualSoFar)}</div><div className={`text-lg font-bold ${projectionTotals.differenceSoFar >= 0 ? "text-green-600" : "text-red-600"}`}>Diff: {fmt(projectionTotals.differenceSoFar)}</div></div></CardContent></Card>}
          </div>
          <Card><CardHeader><CardTitle>Neue Zeiterfassung</CardTitle></CardHeader><CardContent><form onSubmit={onSubmit} className="space-y-4"><div className="grid grid-cols-5 gap-4"><div><Label>Datum</Label><Input type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)} required /></div><div><Label>Start</Label><Input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} required /></div><div><Label>Ende</Label><Input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} required /></div><div><Label>Pause (Min)</Label><Input type="number" value={pauseMinutes} onChange={e => setPauseMinutes(e.target.value)} min="0" /></div><div className="flex items-end"><Button type="submit" className="w-full">Erfassen</Button></div></div><div><Label>Notizen</Label><Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional" /></div></form></CardContent></Card>
          <Card><CardHeader><CardTitle>Zeiteinträge</CardTitle></CardHeader><CardContent><Table><TableHeader><TableRow><TableHead>Datum</TableHead><TableHead>Start</TableHead><TableHead>Ende</TableHead><TableHead>Pause</TableHead><TableHead>Brutto</TableHead><TableHead>Netto</TableHead><TableHead>Notizen</TableHead></TableRow></TableHeader><TableBody>{entries.map(e => { const g = e.started_at && e.ended_at ? Math.round((new Date(e.ended_at).getTime() - new Date(e.started_at).getTime()) / 60000) : 0; return (<TableRow key={e.id}><TableCell>{format(parseISO(e.work_date), "dd.MM.yyyy")}</TableCell><TableCell>{e.started_at ? format(parseISO(e.started_at), "HH:mm") : "-"}</TableCell><TableCell>{e.ended_at ? format(parseISO(e.ended_at), "HH:mm") : "-"}</TableCell><TableCell>{e.pause_minutes || 0} Min</TableCell><TableCell>{fmt(g)}</TableCell><TableCell>{fmt(e.minutes || 0)}</TableCell><TableCell>{e.notes || "-"}</TableCell></TableRow>); })}</TableBody></Table></CardContent></Card>
        </TabsContent>
        <TabsContent value="leave-requests" className="space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <Card><CardHeader><CardTitle>Urlaub beantragen</CardTitle></CardHeader><CardContent className="space-y-4"><div className="grid grid-cols-2 gap-4"><div><Label>Von</Label><Input type="date" value={vacationStartDate} onChange={e => setVacationStartDate(e.target.value)} /></div><div><Label>Bis</Label><Input type="date" value={vacationEndDate} onChange={e => setVacationEndDate(e.target.value)} /></div></div><div><Label>Grund</Label><Textarea value={vacationReason} onChange={e => setVacationReason(e.target.value)} placeholder="Optional" /></div><Button onClick={handleRequestVacation}>Urlaub beantragen</Button></CardContent></Card>
            <Card><CardHeader><CardTitle>Urlaubskonto {selectedMonth.getFullYear()}</CardTitle><CardDescription>Anspruch: {vacationBalance.totalEntitlement} | Genommen: {vacationBalance.taken} | Verbleibend: {vacationBalance.remaining}</CardDescription></CardHeader><CardContent>{vacationLeaves.length === 0 ? <p className="text-sm text-muted-foreground">Keine Urlaubsanträge vorhanden</p> : <Table><TableHeader><TableRow><TableHead>Von</TableHead><TableHead>Bis</TableHead><TableHead>Tage</TableHead><TableHead>Grund</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>{vacationLeaves.map(v => { const d = eachDayOfInterval({ start: parseISO(v.start_date), end: parseISO(v.end_date) }).filter(d => d.getDay() !== 0 && d.getDay() !== 6).length; return (<TableRow key={v.id}><TableCell>{format(parseISO(v.start_date), "dd.MM.yyyy")}</TableCell><TableCell>{format(parseISO(v.end_date), "dd.MM.yyyy")}</TableCell><TableCell>{d}</TableCell><TableCell>{v.reason || "-"}</TableCell><TableCell>{getStatusBadge(v.status)}</TableCell></TableRow>); })}</TableBody></Table>}</CardContent></Card>
          </div>
          <div className="grid grid-cols-2 gap-6">
            <Card><CardHeader><CardTitle>Krankmeldung</CardTitle></CardHeader><CardContent className="space-y-4"><div className="grid grid-cols-2 gap-4"><div><Label>Von</Label><Input type="date" value={sickStartDate} onChange={e => setSickStartDate(e.target.value)} /></div><div><Label>Bis</Label><Input type="date" value={sickEndDate} onChange={e => setSickEndDate(e.target.value)} /></div></div><div><Label>Notizen</Label><Textarea value={sickNotes} onChange={e => setSickNotes(e.target.value)} placeholder="Optional" /></div><Button onClick={handleReportSick}>Krankmeldung einreichen</Button></CardContent></Card>
            <Card><CardHeader><CardTitle>Krankmeldungen {selectedMonth.getFullYear()}</CardTitle></CardHeader><CardContent>{sickLeaves.length === 0 ? <p className="text-sm text-muted-foreground">Keine Krankmeldungen vorhanden</p> : <Table><TableHeader><TableRow><TableHead>Von</TableHead><TableHead>Bis</TableHead><TableHead>Tage</TableHead><TableHead>Notizen</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>{sickLeaves.map(s => { const d = eachDayOfInterval({ start: parseISO(s.start_date), end: parseISO(s.end_date) }).filter(d => d.getDay() !== 0 && d.getDay() !== 6).length; return (<TableRow key={s.id}><TableCell>{format(parseISO(s.start_date), "dd.MM.yyyy")}</TableCell><TableCell>{format(parseISO(s.end_date), "dd.MM.yyyy")}</TableCell><TableCell>{d}</TableCell><TableCell>{s.reason || "-"}</TableCell><TableCell>{getStatusBadge(s.status)}</TableCell></TableRow>); })}</TableBody></Table>}</CardContent></Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
