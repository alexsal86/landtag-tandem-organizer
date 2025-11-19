import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
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
  created_at: string;
  updated_at: string;
}

interface EmployeeSettingsRow {
  user_id: string;
  admin_id: string | null;
  hours_per_month: number;
  days_per_month: number;
  annual_vacation_days: number;
  carry_over_days: number;
  employment_start_date: string | null;
  contract_file_path: string | null;
}

interface LeaveRow {
  id: string;
  type: "vacation" | "sick" | "other";
  start_date: string;
  end_date: string;
  status: string;
  reason: string | null;
  created_at: string;
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
  changed_by: string | null;
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
  
  // Form states
  const [entryDate, setEntryDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [pauseMinutes, setPauseMinutes] = useState("30");
  const [notes, setNotes] = useState("");

  // Data states
  const [entries, setEntries] = useState<TimeEntryRow[]>([]);
  const [employeeSettings, setEmployeeSettings] = useState<EmployeeSettingsRow | null>(null);
  const [vacationLeaves, setVacationLeaves] = useState<LeaveRow[]>([]);
  const [sickLeaves, setSickLeaves] = useState<LeaveRow[]>([]);
  const [holidays, setHolidays] = useState<HolidayRow[]>([]);

  // Edit/History states
  const [editingEntry, setEditingEntry] = useState<TimeEntryRow | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [historyEntry, setHistoryEntry] = useState<TimeEntryRow | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);
  const [showYearlyLeaves, setShowYearlyLeaves] = useState(false);

  const monthStart = startOfMonth(selectedMonth);
  const monthEnd = endOfMonth(selectedMonth);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user, selectedMonth]);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);

    try {
      // Load time entries for selected month
      const { data: entriesData, error: entriesError } = await supabase
        .from("time_entries")
        .select("*")
        .eq("user_id", user.id)
        .gte("work_date", format(monthStart, "yyyy-MM-dd"))
        .lte("work_date", format(monthEnd, "yyyy-MM-dd"))
        .order("work_date", { ascending: false });

      if (entriesError) throw entriesError;
      setEntries(entriesData || []);

      // Load employee settings
      const { data: settingsData, error: settingsError } = await supabase
        .from("employee_settings")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (settingsError && settingsError.code !== "PGRST116") throw settingsError;
      setEmployeeSettings(settingsData);

      // Load all approved leave requests for vacation calculation
      const { data: leavesData, error: leavesError } = await supabase
        .from("leave_requests")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "approved")
        .order("start_date", { ascending: false });

      if (leavesError) throw leavesError;
      
      const vacations = (leavesData || []).filter((l) => l.type === "vacation");
      const sickDays = (leavesData || []).filter((l) => l.type === "sick");
      setVacationLeaves(vacations);
      setSickLeaves(sickDays);

      // Load holidays for the selected year
      const yearStart = `${selectedMonth.getFullYear()}-01-01`;
      const yearEnd = `${selectedMonth.getFullYear()}-12-31`;
      const { data: holidaysData, error: holidaysError } = await supabase
        .from("public_holidays")
        .select("*")
        .gte("holiday_date", yearStart)
        .lte("holiday_date", yearEnd)
        .order("holiday_date");

      if (holidaysError) throw holidaysError;
      setHolidays(holidaysData || []);
    } catch (error: any) {
      console.error("Error loading data:", error);
      toast.error("Fehler beim Laden der Daten: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const dailyHours = useMemo(() => {
    if (!employeeSettings) return 8;
    return employeeSettings.hours_per_month / employeeSettings.days_per_month;
  }, [employeeSettings]);

  // Calculate vacation balance
  const vacationBalance = useMemo(() => {
    if (!employeeSettings) return null;
    return calculateVacationBalance({
      annualVacationDays: employeeSettings.annual_vacation_days,
      carryOverDays: employeeSettings.carry_over_days,
      employmentStartDate: employeeSettings.employment_start_date,
      approvedVacationLeaves: vacationLeaves.map((v) => ({
        start_date: v.start_date,
        end_date: v.end_date,
      })),
      currentYear: new Date().getFullYear(),
    });
  }, [employeeSettings, vacationLeaves]);

  // Calculate monthly totals
  const monthlyTotals = useMemo(() => {
    const workedMinutes = entries.reduce((sum, entry) => sum + (entry.minutes || 0), 0);
    
    // Calculate sick hours for current month (only weekdays)
    const sickMinutes = sickLeaves.reduce((sum, leave) => {
      const start = parseISO(leave.start_date);
      const end = parseISO(leave.end_date);
      const daysInInterval = eachDayOfInterval({ start, end })
        .filter((d) => {
          const inMonth = d >= monthStart && d <= monthEnd;
          const isWeekday = d.getDay() !== 0 && d.getDay() !== 6;
          return inMonth && isWeekday;
        }).length;
      return sum + daysInInterval * dailyHours * 60;
    }, 0);

    // Calculate target hours (working days - holidays)
    const allDaysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
    const workingDays = allDaysInMonth.filter((d) => {
      const isWeekday = d.getDay() !== 0 && d.getDay() !== 6;
      const isHoliday = holidays.some((h) => h.holiday_date === format(d, "yyyy-MM-dd"));
      return isWeekday && !isHoliday;
    }).length;
    
    const targetMinutes = workingDays * dailyHours * 60;
    const actualMinutes = workedMinutes + sickMinutes;
    const differenceMinutes = actualMinutes - targetMinutes;

    return {
      worked: workedMinutes,
      sick: sickMinutes,
      actual: actualMinutes,
      target: targetMinutes,
      difference: differenceMinutes,
      workingDays,
    };
  }, [entries, sickLeaves, holidays, monthStart, monthEnd, dailyHours]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !startTime || !endTime) {
      toast.error("Bitte alle Pflichtfelder ausfüllen");
      return;
    }

    const start = new Date(`${entryDate}T${startTime}`);
    const end = new Date(`${entryDate}T${endTime}`);
    if (end <= start) {
      toast.error("Endzeit muss nach Startzeit liegen");
      return;
    }

    const grossMinutes = Math.round((end.getTime() - start.getTime()) / 60000);
    const pause = parseInt(pauseMinutes) || 0;
    const netMinutes = grossMinutes - pause;

    try {
      const { error } = await supabase.from("time_entries").insert({
        user_id: user.id,
        work_date: entryDate,
        started_at: start.toISOString(),
        ended_at: end.toISOString(),
        minutes: netMinutes,
        pause_minutes: pause,
        notes: notes || null,
      });

      if (error) throw error;

      toast.success("Zeiteintrag erfolgreich gespeichert");
      setStartTime("");
      setEndTime("");
      setPauseMinutes("30");
      setNotes("");
      loadData();
    } catch (error: any) {
      console.error("Error saving entry:", error);
      toast.error("Fehler beim Speichern: " + error.message);
    }
  };

  const handleEdit = (entry: TimeEntryRow) => {
    setEditingEntry(entry);
    setIsEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingEntry) return;

    try {
      const { error } = await supabase
        .from("time_entries")
        .update({
          work_date: editingEntry.work_date,
          started_at: editingEntry.started_at,
          ended_at: editingEntry.ended_at,
          pause_minutes: editingEntry.pause_minutes,
          notes: editingEntry.notes,
          // Recalculate minutes
          minutes: editingEntry.started_at && editingEntry.ended_at
            ? Math.round(
                (new Date(editingEntry.ended_at).getTime() -
                  new Date(editingEntry.started_at).getTime()) /
                  60000
              ) - (editingEntry.pause_minutes || 0)
            : editingEntry.minutes,
        })
        .eq("id", editingEntry.id);

      if (error) throw error;

      toast.success("Eintrag aktualisiert");
      setIsEditDialogOpen(false);
      setEditingEntry(null);
      loadData();
    } catch (error: any) {
      toast.error("Fehler beim Aktualisieren: " + error.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Eintrag wirklich löschen?")) return;

    try {
      const { error } = await supabase.from("time_entries").delete().eq("id", id);
      if (error) throw error;
      toast.success("Eintrag gelöscht");
      loadData();
    } catch (error: any) {
      toast.error("Fehler beim Löschen: " + error.message);
    }
  };

  const handleShowHistory = async (entry: TimeEntryRow) => {
    try {
      const { data, error } = await supabase
        .from("time_entry_history")
        .select("*")
        .eq("time_entry_id", entry.id)
        .order("changed_at", { ascending: false });

      if (error) throw error;
      setHistory(data || []);
      setHistoryEntry(entry);
      setIsHistoryDialogOpen(true);
    } catch (error: any) {
      toast.error("Fehler beim Laden der Historie: " + error.message);
    }
  };

  const formatMinutes = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}:${mins.toString().padStart(2, "0")}`;
  };

  if (loading) {
    return <div className="p-6">Lade Daten...</div>;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Zeiterfassung</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setSelectedMonth(subMonths(selectedMonth, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="font-semibold min-w-[150px] text-center">
            {format(selectedMonth, "MMMM yyyy", { locale: de })}
          </span>
          <Button variant="outline" size="icon" onClick={() => setSelectedMonth(addMonths(selectedMonth, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={() => setSelectedMonth(new Date())}>
            Heute
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Gearbeitet</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatMinutes(monthlyTotals.worked)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Krank</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatMinutes(monthlyTotals.sick)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Soll-Stunden</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatMinutes(monthlyTotals.target)}</div>
            <p className="text-xs text-muted-foreground">{monthlyTotals.workingDays} Arbeitstage</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Differenz</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${monthlyTotals.difference >= 0 ? "text-green-600" : "text-red-600"}`}>
              {monthlyTotals.difference >= 0 ? "+" : ""}
              {formatMinutes(Math.abs(monthlyTotals.difference))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Vacation Account */}
      {vacationBalance && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Urlaubskonto {new Date().getFullYear()}
              <Button variant="outline" size="sm" onClick={() => setShowYearlyLeaves(!showYearlyLeaves)}>
                <Calendar className="h-4 w-4 mr-2" />
                Alle Anträge
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Jahresanspruch</p>
                <p className="text-lg font-semibold">{vacationBalance.prorated} Tage</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Übertrag</p>
                <p className="text-lg font-semibold">{vacationBalance.carryOver} Tage</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Gesamt</p>
                <p className="text-lg font-semibold">{vacationBalance.totalEntitlement} Tage</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Genommen</p>
                <p className="text-lg font-semibold">{vacationBalance.taken} Tage</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Verbleibend</p>
                <p className="text-lg font-semibold text-primary">{vacationBalance.remaining} Tage</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* New Entry Form */}
      <Card>
        <CardHeader>
          <CardTitle>Neuer Zeiteintrag</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div>
                <Label htmlFor="entryDate">Datum</Label>
                <Input
                  id="entryDate"
                  type="date"
                  value={entryDate}
                  onChange={(e) => setEntryDate(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="startTime">Start</Label>
                <Input
                  id="startTime"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="endTime">Ende</Label>
                <Input
                  id="endTime"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="pauseMinutes">Pause (Min)</Label>
                <Input
                  id="pauseMinutes"
                  type="number"
                  value={pauseMinutes}
                  onChange={(e) => setPauseMinutes(e.target.value)}
                  min="0"
                />
              </div>
              <div>
                <Label htmlFor="notes">Notiz</Label>
                <Input id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
            </div>
            <Button type="submit">Eintrag hinzufügen</Button>
          </form>
        </CardContent>
      </Card>

      {/* Entries Table */}
      <Card>
        <CardHeader>
          <CardTitle>Zeiteinträge {format(selectedMonth, "MMMM yyyy", { locale: de })}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Datum</TableHead>
                <TableHead>Start</TableHead>
                <TableHead>Ende</TableHead>
                <TableHead>Brutto</TableHead>
                <TableHead>Pause</TableHead>
                <TableHead>Netto</TableHead>
                <TableHead>Notiz</TableHead>
                <TableHead>Erfasst am</TableHead>
                <TableHead>Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground">
                    Keine Einträge für diesen Monat
                  </TableCell>
                </TableRow>
              ) : (
                entries.map((entry) => {
                  const gross =
                    entry.started_at && entry.ended_at
                      ? Math.round(
                          (new Date(entry.ended_at).getTime() - new Date(entry.started_at).getTime()) / 60000
                        )
                      : 0;
                  const pause = entry.pause_minutes || 0;
                  const net = entry.minutes || 0;
                  return (
                    <TableRow key={entry.id}>
                      <TableCell>{format(parseISO(entry.entry_date), "dd.MM.yyyy")}</TableCell>
                      <TableCell>
                        {entry.started_at ? format(parseISO(entry.started_at), "HH:mm") : "-"}
                      </TableCell>
                      <TableCell>{entry.ended_at ? format(parseISO(entry.ended_at), "HH:mm") : "-"}</TableCell>
                      <TableCell>{formatMinutes(gross)}</TableCell>
                      <TableCell>{formatMinutes(pause)}</TableCell>
                      <TableCell className="font-semibold">{formatMinutes(net)}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{entry.notes || "-"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {format(parseISO(entry.created_at), "dd.MM. HH:mm")}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(entry)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(entry.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleShowHistory(entry)}>
                            <History className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
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
          {editingEntry && (
            <div className="space-y-4">
              <div>
                <Label>Datum</Label>
                <Input
                  type="date"
                  value={editingEntry.entry_date}
                  onChange={(e) => setEditingEntry({ ...editingEntry, entry_date: e.target.value })}
                />
              </div>
              <div>
                <Label>Start</Label>
                <Input
                  type="time"
                  value={editingEntry.started_at ? format(parseISO(editingEntry.started_at), "HH:mm") : ""}
                  onChange={(e) => {
                    const newStart = `${editingEntry.entry_date}T${e.target.value}`;
                    setEditingEntry({ ...editingEntry, started_at: new Date(newStart).toISOString() });
                  }}
                />
              </div>
              <div>
                <Label>Ende</Label>
                <Input
                  type="time"
                  value={editingEntry.ended_at ? format(parseISO(editingEntry.ended_at), "HH:mm") : ""}
                  onChange={(e) => {
                    const newEnd = `${editingEntry.entry_date}T${e.target.value}`;
                    setEditingEntry({ ...editingEntry, ended_at: new Date(newEnd).toISOString() });
                  }}
                />
              </div>
              <div>
                <Label>Pause (Min)</Label>
                <Input
                  type="number"
                  value={editingEntry.pause_minutes || 0}
                  onChange={(e) => setEditingEntry({ ...editingEntry, pause_minutes: parseInt(e.target.value) })}
                />
              </div>
              <div>
                <Label>Notiz</Label>
                <Input
                  value={editingEntry.notes || ""}
                  onChange={(e) => setEditingEntry({ ...editingEntry, notes: e.target.value })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleSaveEdit}>Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={isHistoryDialogOpen} onOpenChange={setIsHistoryDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              Versionshistorie {historyEntry && `- ${format(parseISO(historyEntry.entry_date), "dd.MM.yyyy")}`}
            </DialogTitle>
          </DialogHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Änderung</TableHead>
                <TableHead>Datum</TableHead>
                <TableHead>Start</TableHead>
                <TableHead>Ende</TableHead>
                <TableHead>Pause</TableHead>
                <TableHead>Netto</TableHead>
                <TableHead>Notiz</TableHead>
                <TableHead>Geändert am</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.map((h) => (
                <TableRow key={h.id}>
                  <TableCell>
                    <span
                      className={`px-2 py-1 rounded text-xs ${
                        h.change_type === "deleted" ? "bg-red-100 text-red-800" : "bg-blue-100 text-blue-800"
                      }`}
                    >
                      {h.change_type === "deleted" ? "Gelöscht" : "Aktualisiert"}
                    </span>
                  </TableCell>
                  <TableCell>{format(parseISO(h.entry_date), "dd.MM.yyyy")}</TableCell>
                  <TableCell>{h.started_at ? format(parseISO(h.started_at), "HH:mm") : "-"}</TableCell>
                  <TableCell>{h.ended_at ? format(parseISO(h.ended_at), "HH:mm") : "-"}</TableCell>
                  <TableCell>{formatMinutes(h.pause_minutes || 0)}</TableCell>
                  <TableCell>{formatMinutes(h.minutes || 0)}</TableCell>
                  <TableCell className="max-w-[150px] truncate">{h.notes || "-"}</TableCell>
                  <TableCell className="text-xs">{format(parseISO(h.changed_at), "dd.MM. HH:mm")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>

      {/* Yearly Leaves Dialog */}
      <Dialog open={showYearlyLeaves} onOpenChange={setShowYearlyLeaves}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Alle Urlaubsanträge {new Date().getFullYear()}</DialogTitle>
          </DialogHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Von</TableHead>
                <TableHead>Bis</TableHead>
                <TableHead>Tage</TableHead>
                <TableHead>Grund</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vacationLeaves
                .filter((l) => new Date(l.start_date).getFullYear() === new Date().getFullYear())
                .map((leave) => {
                  const days = eachDayOfInterval({
                    start: parseISO(leave.start_date),
                    end: parseISO(leave.end_date),
                  }).filter((d) => d.getDay() !== 0 && d.getDay() !== 6).length;
                  return (
                    <TableRow key={leave.id}>
                      <TableCell>{format(parseISO(leave.start_date), "dd.MM.yyyy")}</TableCell>
                      <TableCell>{format(parseISO(leave.end_date), "dd.MM.yyyy")}</TableCell>
                      <TableCell>{days}</TableCell>
                      <TableCell>{leave.reason || "-"}</TableCell>
                      <TableCell>
                        <span className="px-2 py-1 rounded text-xs bg-green-100 text-green-800">
                          {leave.status}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>
    </div>
  );
}
