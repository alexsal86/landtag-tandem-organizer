import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { 
  format, parseISO, startOfMonth, endOfMonth, addMonths, subMonths, 
  eachDayOfInterval, isWeekend, getYear 
} from "date-fns";
import { de } from "date-fns/locale";
import { 
  ChevronLeft, ChevronRight, Clock, Calendar, TrendingUp, 
  Edit, AlertCircle, CheckCircle, XCircle, Undo2, Plus
} from "lucide-react";
import { AdminTimeEntryEditor, AdminEditData } from "@/components/AdminTimeEntryEditor";

interface Employee {
  user_id: string;
  display_name: string | null;
  hours_per_week: number;
  days_per_week: number;
}

interface TimeEntry {
  id: string;
  user_id: string;
  work_date: string;
  started_at: string | null;
  ended_at: string | null;
  minutes: number | null;
  pause_minutes: number;
  notes: string | null;
  edited_by: string | null;
  edited_at: string | null;
  edit_reason: string | null;
}

interface LeaveRequest {
  id: string;
  user_id: string;
  type: string;
  status: string;
  start_date: string;
  end_date: string;
  reason: string | null;
  created_at: string;
}

interface Correction {
  id: string;
  user_id: string;
  correction_date: string;
  correction_minutes: number;
  reason: string;
  created_by: string;
  created_at: string;
  creator_name?: string;
}

interface PublicHoliday {
  date: string;
  name: string;
}

export function AdminTimeTrackingView() {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [corrections, setCorrections] = useState<Correction[]>([]);
  const [holidays, setHolidays] = useState<PublicHoliday[]>([]);
  
  // Editor state
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  // Correction dialog state
  const [correctionDialogOpen, setCorrectionDialogOpen] = useState(false);
  const [correctionMinutes, setCorrectionMinutes] = useState("");
  const [correctionReason, setCorrectionReason] = useState("");

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);

  // Load employees on mount
  useEffect(() => {
    loadEmployees();
  }, [currentTenant]);

  // Load data when employee or month changes
  useEffect(() => {
    if (selectedUserId) {
      loadMonthData();
    }
  }, [selectedUserId, currentMonth]);

  const loadEmployees = async () => {
    if (!currentTenant) return;
    
    try {
      // Get users with employee roles in tenant
      const { data: memberships } = await supabase
        .from('user_tenant_memberships')
        .select('user_id')
        .eq('tenant_id', currentTenant.id)
        .eq('is_active', true);

      if (!memberships?.length) {
        setEmployees([]);
        setLoading(false);
        return;
      }

      const userIds = memberships.map(m => m.user_id);

      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", userIds);

      const employeeIds = (roles || [])
        .filter(r => ["mitarbeiter", "praktikant", "bueroleitung"].includes(r.role))
        .map(r => r.user_id);

      if (employeeIds.length === 0) {
        setEmployees([]);
        setLoading(false);
        return;
      }

      const [profilesRes, settingsRes] = await Promise.all([
        supabase.from("profiles").select("user_id, display_name").in("user_id", employeeIds),
        supabase.from("employee_settings").select("user_id, hours_per_week, days_per_week").in("user_id", employeeIds),
      ]);

      const profileMap = new Map(profilesRes.data?.map(p => [p.user_id, p]) || []);
      const settingsMap = new Map(settingsRes.data?.map(s => [s.user_id, s]) || []);

      const emps: Employee[] = employeeIds.map(uid => ({
        user_id: uid,
        display_name: profileMap.get(uid)?.display_name || "Unbekannt",
        hours_per_week: settingsMap.get(uid)?.hours_per_week || 39.5,
        days_per_week: settingsMap.get(uid)?.days_per_week || 5,
      }));

      setEmployees(emps);
      if (emps.length > 0 && !selectedUserId) {
        setSelectedUserId(emps[0].user_id);
      }
    } catch (error) {
      console.error("Error loading employees:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadMonthData = async () => {
    if (!selectedUserId) return;
    
    try {
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
          .select("id, user_id, type, status, start_date, end_date, reason, created_at")
          .eq("user_id", selectedUserId)
          .order("start_date", { ascending: false }),
        supabase
          .from("time_entry_corrections")
          .select("*")
          .eq("user_id", selectedUserId)
          .order("created_at", { ascending: false }),
        supabase
          .from("public_holidays")
          .select("holiday_date, name")
          .gte("holiday_date", format(monthStart, "yyyy-MM-dd"))
          .lte("holiday_date", format(monthEnd, "yyyy-MM-dd")),
      ]);

      setTimeEntries(entriesRes.data || []);
      setLeaveRequests(leavesRes.data || []);
      setCorrections(correctionsRes.data || []);
      // Map holiday_date to date for consistency
      setHolidays((holidaysRes.data || []).map((h: any) => ({ date: h.holiday_date, name: h.name })));
    } catch (error) {
      console.error("Error loading month data:", error);
    }
  };

  const selectedEmployee = useMemo(() => 
    employees.find(e => e.user_id === selectedUserId),
    [employees, selectedUserId]
  );

  const dailyHours = useMemo(() => {
    if (!selectedEmployee) return 7.9;
    return selectedEmployee.hours_per_week / (selectedEmployee.days_per_week || 5);
  }, [selectedEmployee]);

  // Calculate workdays in month (excluding weekends and holidays)
  const workdaysInMonth = useMemo(() => {
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
    const holidayDates = new Set(holidays.map(h => h.date));
    return days.filter(d => !isWeekend(d) && !holidayDates.has(format(d, "yyyy-MM-dd"))).length;
  }, [monthStart, monthEnd, holidays]);

  // Monthly target in minutes
  const monthlyTargetMinutes = useMemo(() => 
    Math.round(dailyHours * workdaysInMonth * 60),
    [dailyHours, workdaysInMonth]
  );

  // Worked minutes this month
  const workedMinutes = useMemo(() => 
    timeEntries.reduce((sum, e) => sum + (e.minutes || 0), 0),
    [timeEntries]
  );

  // Corrections total for this user (all time)
  const totalCorrectionMinutes = useMemo(() => 
    corrections.reduce((sum, c) => sum + c.correction_minutes, 0),
    [corrections]
  );

  const fmt = (m: number) => {
    const sign = m < 0 ? "-" : "";
    const absM = Math.abs(m);
    return `${sign}${Math.floor(absM / 60)}:${(absM % 60).toString().padStart(2, "0")}`;
  };

  const handleEditEntry = (entry: TimeEntry) => {
    setEditingEntry(entry);
  };

  const handleSaveEntry = async (entryId: string, data: AdminEditData) => {
    if (!user) return;
    setIsSaving(true);
    
    try {
      const start = new Date(`${data.work_date}T${data.started_at}`);
      const end = new Date(`${data.work_date}T${data.ended_at}`);
      
      if (end <= start) {
        toast.error("Endzeit muss nach Startzeit liegen");
        return;
      }

      const { error } = await supabase
        .from("time_entries")
        .update({
          work_date: data.work_date,
          started_at: start.toISOString(),
          ended_at: end.toISOString(),
          pause_minutes: data.pause_minutes,
          notes: data.notes,
          edited_by: user.id,
          edited_at: new Date().toISOString(),
          edit_reason: data.edit_reason,
        })
        .eq("id", entryId);

      if (error) throw error;

      toast.success("Zeiteintrag aktualisiert");
      setEditingEntry(null);
      loadMonthData();
    } catch (error: any) {
      toast.error(error.message || "Fehler beim Speichern");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddCorrection = async () => {
    if (!user || !selectedUserId || !correctionReason.trim()) return;
    
    const minutes = parseInt(correctionMinutes);
    if (isNaN(minutes)) {
      toast.error("Bitte gültige Minutenzahl eingeben");
      return;
    }

    try {
      const { error } = await supabase
        .from("time_entry_corrections")
        .insert({
          user_id: selectedUserId,
          correction_minutes: minutes,
          reason: correctionReason,
          created_by: user.id,
        });

      if (error) throw error;

      toast.success("Korrektur hinzugefügt");
      setCorrectionDialogOpen(false);
      setCorrectionMinutes("");
      setCorrectionReason("");
      loadMonthData();
    } catch (error: any) {
      toast.error(error.message || "Fehler beim Speichern der Korrektur");
    }
  };

  const getLeaveTypeBadge = (type: string) => {
    switch (type) {
      case "vacation":
        return <Badge className="bg-blue-100 text-blue-800 border-blue-200">🏖️ Urlaub</Badge>;
      case "sick":
        return <Badge className="bg-orange-100 text-orange-800 border-orange-200">🤒 Krank</Badge>;
      case "medical":
        return <Badge className="bg-purple-100 text-purple-800 border-purple-200">🏥 Arzttermin</Badge>;
      case "overtime_reduction":
        return <Badge className="bg-amber-100 text-amber-800 border-amber-200">⏰ Überstundenabbau</Badge>;
      default:
        return <Badge variant="outline">Sonstiges</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" /> Genehmigt</Badge>;
      case "rejected":
        return <Badge className="bg-red-100 text-red-800"><XCircle className="h-3 w-3 mr-1" /> Abgelehnt</Badge>;
      case "pending":
        return <Badge className="bg-yellow-100 text-yellow-800"><AlertCircle className="h-3 w-3 mr-1" /> Offen</Badge>;
      case "cancel_requested":
        return <Badge className="bg-orange-100 text-orange-800"><Undo2 className="h-3 w-3 mr-1" /> Stornierung</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 p-4">
        <div className="h-32 bg-muted animate-pulse rounded-lg" />
        <div className="h-64 bg-muted animate-pulse rounded-lg" />
      </div>
    );
  }

  if (employees.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
        <p className="text-lg font-medium">Keine Mitarbeiter gefunden</p>
      </div>
    );
  }

  const balanceMinutes = workedMinutes - monthlyTargetMinutes + totalCorrectionMinutes;

  return (
    <div className="space-y-6">
      {/* Header with employee selector and month navigation */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex items-center gap-4">
          <Select value={selectedUserId} onValueChange={setSelectedUserId}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Mitarbeiter wählen" />
            </SelectTrigger>
            <SelectContent>
              {employees.map(e => (
                <SelectItem key={e.user_id} value={e.user_id}>
                  {e.display_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[140px] text-center font-medium">
            {format(currentMonth, "MMMM yyyy", { locale: de })}
          </span>
          <Button variant="outline" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Soll (dynamisch)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{fmt(monthlyTargetMinutes)}</div>
            <p className="text-xs text-muted-foreground">
              {workdaysInMonth} Arbeitstage × {dailyHours.toFixed(1)}h
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Ist
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{fmt(workedMinutes)}</div>
            <p className="text-xs text-muted-foreground">
              {timeEntries.length} Einträge
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Saldo (inkl. Korrekturen)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${balanceMinutes >= 0 ? "text-green-600" : "text-destructive"}`}>
              {balanceMinutes >= 0 ? "+" : ""}{fmt(balanceMinutes)}
            </div>
            {totalCorrectionMinutes !== 0 && (
              <p className="text-xs text-muted-foreground">
                Korrekturen: {totalCorrectionMinutes >= 0 ? "+" : ""}{fmt(totalCorrectionMinutes)}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Aktionen
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setCorrectionDialogOpen(true)}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              Korrektur hinzufügen
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for entries, absences, corrections */}
      <Tabs defaultValue="entries" className="space-y-4">
        <TabsList>
          <TabsTrigger value="entries">Zeiteinträge</TabsTrigger>
          <TabsTrigger value="absences">Abwesenheiten</TabsTrigger>
          <TabsTrigger value="corrections">Korrekturen</TabsTrigger>
        </TabsList>

        <TabsContent value="entries">
          <Card>
            <CardHeader>
              <CardTitle>Zeiteinträge {format(currentMonth, "MMMM yyyy", { locale: de })}</CardTitle>
              <CardDescription>Alle Zeiteinträge des Mitarbeiters für diesen Monat</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                {timeEntries.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>Keine Einträge in diesem Monat</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Datum</TableHead>
                        <TableHead>Start</TableHead>
                        <TableHead>Ende</TableHead>
                        <TableHead>Brutto</TableHead>
                        <TableHead>Pause</TableHead>
                        <TableHead>Netto</TableHead>
                        <TableHead>Notizen</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {timeEntries.map(entry => {
                        const grossMinutes = entry.started_at && entry.ended_at
                          ? Math.round((new Date(entry.ended_at).getTime() - new Date(entry.started_at).getTime()) / 60000)
                          : 0;
                        
                        return (
                          <TableRow key={entry.id}>
                            <TableCell className="font-medium">
                              {format(parseISO(entry.work_date), "EEE, dd.MM.", { locale: de })}
                            </TableCell>
                            <TableCell>
                              {entry.started_at ? format(parseISO(entry.started_at), "HH:mm") : "-"}
                            </TableCell>
                            <TableCell>
                              {entry.ended_at ? format(parseISO(entry.ended_at), "HH:mm") : "-"}
                            </TableCell>
                            <TableCell className="font-mono">{fmt(grossMinutes)}</TableCell>
                            <TableCell className="text-muted-foreground">{entry.pause_minutes}m</TableCell>
                            <TableCell className="font-mono font-medium">{fmt(entry.minutes || 0)}</TableCell>
                            <TableCell className="max-w-[150px] truncate text-muted-foreground">
                              {entry.notes || "-"}
                            </TableCell>
                            <TableCell>
                              {entry.edited_by && (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                                        ✏️ Bearbeitet
                                      </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Bearbeitet am {entry.edited_at && format(parseISO(entry.edited_at), "dd.MM.yyyy HH:mm")}</p>
                                      {entry.edit_reason && <p>Grund: {entry.edit_reason}</p>}
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )}
                            </TableCell>
                            <TableCell>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => handleEditEntry(entry)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
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
        </TabsContent>

        <TabsContent value="absences">
          <Card>
            <CardHeader>
              <CardTitle>Abwesenheitshistorie</CardTitle>
              <CardDescription>Alle Urlaubs-, Krankheits- und sonstige Abwesenheitsanträge</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                {leaveRequests.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>Keine Abwesenheiten erfasst</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Typ</TableHead>
                        <TableHead>Zeitraum</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Notizen</TableHead>
                        <TableHead>Erstellt am</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {leaveRequests.map(req => (
                        <TableRow key={req.id}>
                          <TableCell>{getLeaveTypeBadge(req.type)}</TableCell>
                          <TableCell>
                            {format(parseISO(req.start_date), "dd.MM.yyyy")}
                            {req.end_date && req.end_date !== req.start_date && (
                              <> – {format(parseISO(req.end_date), "dd.MM.yyyy")}</>
                            )}
                          </TableCell>
                          <TableCell>{getStatusBadge(req.status)}</TableCell>
                          <TableCell className="max-w-[200px] truncate text-muted-foreground">
                            {req.reason || "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="corrections">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Saldo-Korrekturen</CardTitle>
                <CardDescription>Administrative Korrekturen des Stundensaldos</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => setCorrectionDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Korrektur
              </Button>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                {corrections.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <TrendingUp className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>Keine Korrekturen vorhanden</p>
                    <p className="text-sm mt-2">
                      Hier können Sie Überstunden manuell korrigieren, z.B. auf Null setzen.
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Datum</TableHead>
                        <TableHead>Korrektur</TableHead>
                        <TableHead>Grund</TableHead>
                        <TableHead>Erstellt am</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {corrections.map(corr => (
                        <TableRow key={corr.id}>
                          <TableCell>{format(parseISO(corr.correction_date), "dd.MM.yyyy")}</TableCell>
                          <TableCell>
                            <Badge className={corr.correction_minutes >= 0 ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                              {corr.correction_minutes >= 0 ? "+" : ""}{fmt(corr.correction_minutes)}
                            </Badge>
                          </TableCell>
                          <TableCell>{corr.reason}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {format(parseISO(corr.created_at), "dd.MM.yyyy HH:mm")}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit entry dialog */}
      {editingEntry && (
        <AdminTimeEntryEditor
          entry={{
            ...editingEntry,
            user_name: selectedEmployee?.display_name || "Mitarbeiter",
          }}
          isOpen={!!editingEntry}
          onClose={() => setEditingEntry(null)}
          onSave={handleSaveEntry}
          isLoading={isSaving}
        />
      )}

      {/* Correction dialog */}
      <Dialog open={correctionDialogOpen} onOpenChange={setCorrectionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Saldo-Korrektur hinzufügen</DialogTitle>
            <DialogDescription>
              Korrigieren Sie den Stundensaldo für {selectedEmployee?.display_name}. 
              Positive Werte fügen Stunden hinzu, negative ziehen Stunden ab.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Korrektur (in Minuten)</Label>
              <Input
                type="number"
                value={correctionMinutes}
                onChange={e => setCorrectionMinutes(e.target.value)}
                placeholder="z.B. -120 für -2 Stunden"
              />
              <p className="text-xs text-muted-foreground">
                Um Überstunden auf Null zu setzen, geben Sie den negativen Wert des aktuellen Saldos ein.
              </p>
            </div>
            
            <div className="space-y-2">
              <Label>Grund der Korrektur <span className="text-destructive">*</span></Label>
              <Textarea
                value={correctionReason}
                onChange={e => setCorrectionReason(e.target.value)}
                placeholder="z.B. Überstundenabbau zum Jahresende, Korrektur nach Abstimmung..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCorrectionDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button 
              onClick={handleAddCorrection}
              disabled={!correctionMinutes || !correctionReason.trim()}
            >
              Korrektur speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
