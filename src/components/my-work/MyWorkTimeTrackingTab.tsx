import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format, parseISO, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval } from "date-fns";
import { de } from "date-fns/locale";
import { Clock, Plus, ExternalLink, TrendingUp, Calendar } from "lucide-react";
import { useNavigate } from "react-router-dom";

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
  hours_per_week: number;
  hours_per_month: number;
  days_per_month: number;
  days_per_week: number;
}

export function MyWorkTimeTrackingTab() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<TimeEntryRow[]>([]);
  const [employeeSettings, setEmployeeSettings] = useState<EmployeeSettingsRow | null>(null);
  const [isEmployee, setIsEmployee] = useState(false);

  // Form state
  const [entryDate, setEntryDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [pauseMinutes, setPauseMinutes] = useState("30");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
  const monthStart = startOfMonth(today);
  const monthEnd = endOfMonth(today);

  useEffect(() => {
    if (user) {
      checkRoleAndLoad();
    }
  }, [user]);

  const checkRoleAndLoad = async () => {
    if (!user) return;

    try {
      // Check if user is an employee
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();

      const employeeRoles = ["mitarbeiter", "praktikant", "bueroleitung"];
      const userIsEmployee = roleData && employeeRoles.includes(roleData.role);
      setIsEmployee(!!userIsEmployee);

      if (!userIsEmployee) {
        setLoading(false);
        return;
      }

      // Load settings and entries
      const [settingsRes, weekEntriesRes, monthEntriesRes] = await Promise.all([
        supabase.from("employee_settings").select("hours_per_week, hours_per_month, days_per_month, days_per_week").eq("user_id", user.id).single(),
        supabase.from("time_entries").select("*").eq("user_id", user.id)
          .gte("work_date", format(weekStart, "yyyy-MM-dd"))
          .lte("work_date", format(weekEnd, "yyyy-MM-dd"))
          .order("work_date", { ascending: false }),
        supabase.from("time_entries").select("id, minutes").eq("user_id", user.id)
          .gte("work_date", format(monthStart, "yyyy-MM-dd"))
          .lte("work_date", format(monthEnd, "yyyy-MM-dd")),
      ]);

      setEmployeeSettings(settingsRes.data);
      setEntries(weekEntriesRes.data || []);
    } catch (error) {
      console.error("Error loading time tracking data:", error);
    } finally {
      setLoading(false);
    }
  };

  const weeklyWorked = useMemo(() => {
    return entries.reduce((sum, e) => sum + (e.minutes || 0), 0);
  }, [entries]);

  const weeklyTarget = useMemo(() => {
    if (!employeeSettings) return 40 * 60;
    return employeeSettings.hours_per_week * 60;
  }, [employeeSettings]);

  const dailyHours = useMemo(() => {
    if (!employeeSettings) return 7.9;
    // Tägliche Arbeitszeit = Wochenstunden / Arbeitstage pro Woche
    return employeeSettings.hours_per_week / (employeeSettings.days_per_week || 5);
  }, [employeeSettings]);

  const validateDailyLimit = async (workDate: string, grossMin: number) => {
    if (!user) return;
    const { data } = await supabase
      .from("time_entries")
      .select("id, started_at, ended_at")
      .eq("user_id", user.id)
      .eq("work_date", workDate);

    const total = data?.reduce((s, e) => {
      if (!e.started_at || !e.ended_at) return s;
      return s + (new Date(e.ended_at).getTime() - new Date(e.started_at).getTime()) / 60000;
    }, 0) || 0;

    if (total + grossMin > 600) {
      const formatTime = (min: number) => `${Math.floor(min / 60)}:${(min % 60).toString().padStart(2, '0')}`;
      throw new Error(`Maximal 10 Stunden pro Tag. Bereits ${formatTime(total)} erfasst.`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !startTime || !endTime) {
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

    setIsSubmitting(true);
    try {
      await validateDailyLimit(entryDate, gross);

      const { error } = await supabase.from("time_entries").insert({
        user_id: user.id,
        work_date: entryDate,
        started_at: start.toISOString(),
        ended_at: end.toISOString(),
        minutes: gross - pause,
        pause_minutes: pause,
        notes: notes || null,
      });

      if (error) throw error;

      toast.success("Zeiteintrag gespeichert");
      setStartTime("");
      setEndTime("");
      setPauseMinutes("30");
      setNotes("");
      checkRoleAndLoad();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const fmt = (m: number) => `${m < 0 ? "-" : ""}${Math.floor(Math.abs(m) / 60)}:${(Math.abs(m) % 60).toString().padStart(2, "0")}`;

  const getProgressColor = () => {
    const percentage = (weeklyWorked / weeklyTarget) * 100;
    if (percentage < 50) return "text-destructive";
    if (percentage < 80) return "text-orange-500";
    if (percentage <= 100) return "text-green-600";
    return "text-blue-600"; // Überstunden
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
  const dayOfWeek = today.getDay() === 0 ? 7 : today.getDay();
  const workDaysPassed = Math.min(dayOfWeek, 5);
  const proportionalTarget = (weeklyTarget / 5) * workDaysPassed;
  const proportionalDifference = weeklyWorked - proportionalTarget;

  return (
    <div className="space-y-6">
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
            <div className={`text-2xl font-bold ${proportionalDifference >= 0 ? "text-green-600" : "text-destructive"}`}>
              {proportionalDifference >= 0 ? "+" : ""}{fmt(proportionalDifference)}
            </div>
            <p className="text-xs text-muted-foreground">
              Stand: {format(today, "EEEE", { locale: de })}
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
            <div className={`text-2xl font-bold ${difference >= 0 ? "text-green-600" : "text-destructive"}`}>
              {difference >= 0 ? "+" : ""}{fmt(difference)}
            </div>
            <p className="text-xs text-muted-foreground">
              Vollständige Woche
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Schnelleingabe */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Zeit erfassen
            </CardTitle>
            <CardDescription>
              Neuen Zeiteintrag hinzufügen
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
                  <Label>Pause (Min)</Label>
                  <Input
                    type="number"
                    value={pauseMinutes}
                    onChange={(e) => setPauseMinutes(e.target.value)}
                    min="0"
                    max="120"
                  />
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
                      <TableHead className="text-right">Stunden</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entries.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="font-medium">
                          {format(parseISO(entry.work_date), "EEE, dd.MM.", { locale: de })}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {entry.started_at && entry.ended_at ? (
                            <>
                              {format(parseISO(entry.started_at), "HH:mm")} - {format(parseISO(entry.ended_at), "HH:mm")}
                            </>
                          ) : "-"}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {fmt(entry.minutes || 0)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
