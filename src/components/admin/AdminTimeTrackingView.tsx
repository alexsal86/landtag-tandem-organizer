import { useState, useEffect, useMemo } from "react";
import { useYearlyBalance } from "@/hooks/useYearlyBalance";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
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
import { useCombinedTimeEntries, CombinedTimeEntry } from "@/hooks/useCombinedTimeEntries";
import { 
  format, parseISO, startOfMonth, endOfMonth, addMonths, subMonths, 
  eachDayOfInterval, isWeekend, getYear 
} from "date-fns";
import { de } from "date-fns/locale";
import { 
  ChevronLeft, ChevronRight, Clock, Calendar, TrendingUp, Gift,
  Edit, AlertCircle, CheckCircle, XCircle, Undo2, Plus
} from "lucide-react";
import { AdminTimeEntryEditor, AdminEditData, EntryType } from "@/components/AdminTimeEntryEditor";

interface Employee {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
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
  medical_reason?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  minutes_counted?: number | null;
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
  id: string;
  holiday_date: string;
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
  
  // Editor state - supports both time entries and combined entries (for absences)
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);
  const [editingCombinedEntry, setEditingCombinedEntry] = useState<CombinedTimeEntry | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  // Correction dialog state
  const [correctionDialogOpen, setCorrectionDialogOpen] = useState(false);
  const [correctionMinutes, setCorrectionMinutes] = useState("");
  const [correctionReason, setCorrectionReason] = useState("");
  
  // Create entry dialog state
  const [createEntryDialogOpen, setCreateEntryDialogOpen] = useState(false);
  const [newEntryDate, setNewEntryDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [newEntryStartTime, setNewEntryStartTime] = useState("09:00");
  const [newEntryEndTime, setNewEntryEndTime] = useState("17:00");
  const [newEntryPause, setNewEntryPause] = useState("30");
  const [newEntryType, setNewEntryType] = useState<EntryType>("work");
  const [newEntryReason, setNewEntryReason] = useState("");
  
  // Yearly balance – shared hook with AbortController (race condition safe)
  const [showBreakdownDialog, setShowBreakdownDialog] = useState(false);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);

  const getInitials = (name: string | null) => {
    if (!name) return "?";
    return name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("");
  };

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
        supabase.from("profiles").select("user_id, display_name, avatar_url").in("user_id", employeeIds),
        supabase.from("employee_settings").select("user_id, hours_per_week, days_per_week").in("user_id", employeeIds),
      ]);

      const profileMap = new Map(profilesRes.data?.map(p => [p.user_id, p]) || []);
      const settingsMap = new Map(settingsRes.data?.map(s => [s.user_id, s]) || []);

      const emps: Employee[] = employeeIds.map(uid => ({
        user_id: uid,
        display_name: profileMap.get(uid)?.display_name || "Unbekannt",
        avatar_url: profileMap.get(uid)?.avatar_url || null,
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
          .select("id, user_id, type, status, start_date, end_date, reason, medical_reason, start_time, end_time, minutes_counted, created_at")
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
      console.error("Error loading month data:", error);
    }
  };

  const selectedEmployee = useMemo(() => 
    employees.find(e => e.user_id === selectedUserId),
    [employees, selectedUserId]
  );

  // Safe calculation with fallback to prevent NaN when settings are incomplete
  const hoursPerWeek = selectedEmployee?.hours_per_week || 39.5;
  const daysPerWeek = selectedEmployee?.days_per_week || 5;
  const dailyHours = hoursPerWeek / daysPerWeek;
  const dailyMinutes = Math.round(dailyHours * 60);
  
  // Check if employee has incomplete settings
  const hasIncompleteSettings = selectedEmployee && (!selectedEmployee.hours_per_week || !selectedEmployee.days_per_week);

  // Helper function for type labels
  const getTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
      work: 'Arbeit',
      vacation: 'Urlaub',
      sick: 'Krankheit',
      overtime_reduction: 'Überstundenabbau',
    };
    return labels[type] || type;
  };

  // useYearlyBalance hook – replaces inline loadYearlyBalance (race-condition safe)
  const {
    yearlyBalance,
    yearlyBreakdown,
    loading: loadingYearlyBalance,
    refetch: refetchYearlyBalance,
  } = useYearlyBalance(
    selectedUserId || null,
    getYear(currentMonth),
    selectedEmployee ?? null
  );

  const validateDailyLimit = async (workDate: string, grossMinutes: number, excludeEntryId?: string) => {
    if (!selectedUserId) return;

    const { data, error } = await supabase
      .from("time_entries")
      .select("id, started_at, ended_at")
      .eq("user_id", selectedUserId)
      .eq("work_date", workDate);

    if (error) throw error;

    const alreadyLogged = (data || []).reduce((sum, entry) => {
      if (entry.id === excludeEntryId || !entry.started_at || !entry.ended_at) return sum;
      const duration = Math.round((new Date(entry.ended_at).getTime() - new Date(entry.started_at).getTime()) / 60000);
      return sum + duration;
    }, 0);

    if (alreadyLogged + grossMinutes > 600) {
      throw new Error(
        `Maximal 10:00 Stunden pro Tag erlaubt. Bereits erfasst: ${fmt(alreadyLogged)}. Mit diesem Eintrag: ${fmt(alreadyLogged + grossMinutes)}.`
      );
    }
  };

  // Create new entry (work or absence)
  const handleCreateEntry = async () => {
    if (!user || !selectedUserId) return;
    setIsSaving(true);
    
    try {
      if (newEntryType === 'work') {
        // Create work time entry
        const start = new Date(`${newEntryDate}T${newEntryStartTime}`);
        const end = new Date(`${newEntryDate}T${newEntryEndTime}`);
        
        if (end <= start) {
          toast.error("Endzeit muss nach Startzeit liegen");
          setIsSaving(false);
          return;
        }
        
        const grossMinutes = Math.round((end.getTime() - start.getTime()) / 60000);
        const pause = parseInt(newEntryPause) || 0;

        if (pause < 0) {
          toast.error("Die Pause darf nicht negativ sein");
          setIsSaving(false);
          return;
        }

        if (pause > grossMinutes) {
          toast.error("Die Pause darf nicht länger als die Arbeitszeit sein");
          setIsSaving(false);
          return;
        }

        await validateDailyLimit(newEntryDate, grossMinutes);

        const netMinutes = grossMinutes - pause;
        
        const { error } = await supabase.from("time_entries").insert({
          user_id: selectedUserId,
          work_date: newEntryDate,
          started_at: start.toISOString(),
          ended_at: end.toISOString(),
          minutes: netMinutes,
          pause_minutes: pause,
          notes: newEntryReason || null,
          edited_by: user.id,
          edited_at: new Date().toISOString(),
          edit_reason: newEntryReason || "Admin-Eintrag",
        });
        
        if (error) throw error;
        toast.success("Zeiteintrag erstellt");
      } else {
        // Create absence
        const { error } = await supabase.from("leave_requests").insert({
          user_id: selectedUserId,
          type: newEntryType,
          start_date: newEntryDate,
          end_date: newEntryDate,
          status: "approved",
          reason: newEntryReason || `Admin-Eintrag: ${getTypeLabel(newEntryType)}`,
        });
        
        if (error) throw error;
        toast.success(`${getTypeLabel(newEntryType)} erstellt`);
      }
      
      setCreateEntryDialogOpen(false);
      resetNewEntryForm();
      loadMonthData();
      refetchYearlyBalance();
    } catch (error: any) {
      toast.error(error.message || "Fehler beim Erstellen");
    } finally {
      setIsSaving(false);
    }
  };

  const resetNewEntryForm = () => {
    setNewEntryDate(format(new Date(), "yyyy-MM-dd"));
    setNewEntryStartTime("09:00");
    setNewEntryEndTime("17:00");
    setNewEntryPause("30");
    setNewEntryType("work");
    setNewEntryReason("");
  };

  // Filter leaves by type for combined entries
  const sickLeaves = useMemo(() => 
    leaveRequests.filter(l => l.type === 'sick'),
    [leaveRequests]
  );
  const vacationLeaves = useMemo(() => 
    leaveRequests.filter(l => l.type === 'vacation'),
    [leaveRequests]
  );
  const medicalLeaves = useMemo(() => 
    leaveRequests.filter(l => l.type === 'medical'),
    [leaveRequests]
  );
  const overtimeLeaves = useMemo(() => 
    leaveRequests.filter(l => l.type === 'overtime_reduction'),
    [leaveRequests]
  );

  // Combined entries using the same hook as employee view
  const combinedEntries = useCombinedTimeEntries({
    entries: timeEntries,
    sickLeaves,
    vacationLeaves,
    medicalLeaves,
    overtimeLeaves,
    holidays: holidays.map(h => ({ id: h.id, holiday_date: h.holiday_date, name: h.name })),
    monthStart,
    monthEnd,
    dailyMinutes,
  });

  // Calculate workdays in month (excluding weekends and holidays)
  const workdaysInMonth = useMemo(() => {
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
    const holidayDates = new Set(holidays.map(h => h.holiday_date));
    return days.filter(d => !isWeekend(d) && !holidayDates.has(format(d, "yyyy-MM-dd"))).length;
  }, [monthStart, monthEnd, holidays]);

  // Monthly target in minutes
  const monthlyTargetMinutes = useMemo(() => 
    Math.round(dailyHours * workdaysInMonth * 60),
    [dailyHours, workdaysInMonth]
  );

  // Worked minutes this month (ONLY actual work, not absences)
  const workedMinutes = useMemo(() => 
    combinedEntries
      .filter(e => e.entry_type === 'work')
      .reduce((sum, e) => sum + (e.minutes || 0), 0),
    [combinedEntries]
  );

  // Credit minutes (absences that count towards target - WITHOUT holidays, they reduce the target)
  const creditMinutes = useMemo(() => 
    combinedEntries
      .filter(e => ['sick', 'vacation', 'medical', 'overtime_reduction'].includes(e.entry_type))
      .reduce((sum, e) => sum + (e.minutes || 0), 0),
    [combinedEntries]
  );

  // Corrections total for this user (all time)
  const totalCorrectionMinutes = useMemo(() => 
    corrections.reduce((sum, c) => sum + c.correction_minutes, 0),
    [corrections]
  );

  // Running "Gesamt-Ist" AFTER each entry (inclusive – shows cumulative total including the current entry)
  const actualAfterEntryById = useMemo(() => {
    const actualTypes = new Set<CombinedTimeEntry['entry_type']>(['work', 'sick', 'vacation', 'medical']);
    const byEntryId = new Map<string, number>();

    const sortedChronologically = [...combinedEntries].sort((a, b) => {
      const aDateTime = a.started_at ? new Date(a.started_at).getTime() : new Date(`${a.work_date}T00:00:00`).getTime();
      const bDateTime = b.started_at ? new Date(b.started_at).getTime() : new Date(`${b.work_date}T00:00:00`).getTime();
      if (aDateTime !== bDateTime) return aDateTime - bDateTime;
      return a.id.localeCompare(b.id);
    });

    let runningActual = 0;

    sortedChronologically.forEach((entry) => {
      if (actualTypes.has(entry.entry_type)) {
        runningActual += entry.minutes || 0;
      }
      byEntryId.set(entry.id, runningActual);
    });

    return byEntryId;
  }, [combinedEntries]);

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

      const grossMinutes = Math.round((end.getTime() - start.getTime()) / 60000);

      if (data.pause_minutes < 0) {
        toast.error("Die Pause darf nicht negativ sein");
        return;
      }

      if (data.pause_minutes > grossMinutes) {
        toast.error("Die Pause darf nicht länger als die Arbeitszeit sein");
        return;
      }

      await validateDailyLimit(data.work_date, grossMinutes, entryId);

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

  // Handle type change for combined entries (work <-> absence conversions)
  // Uses resilient error handling for network issues
  const handleTypeChange = async (
    entryId: string,
    newType: EntryType,
    reason: string,
    leaveId?: string
  ) => {
    if (!user || !selectedUserId) return;
    setIsSaving(true);

    const entry = editingCombinedEntry;
    if (!entry) {
      toast.error("Kein Eintrag ausgewählt");
      setIsSaving(false);
      return;
    }

    const originalType = entry.entry_type;
    
    // Extract correct leave_id - use passed leaveId first, then entry.leave_id
    const actualLeaveId = leaveId || entry.leave_id;
    
    // For work entries, the ID is the direct UUID
    const actualWorkEntryId = originalType === 'work' ? entryId : null;

    try {
      if (originalType === 'work' && newType !== 'work') {
        // Work → Absence: Delete time_entry, create leave_request
        if (!actualWorkEntryId) throw new Error("Keine gültige Arbeitszeit-ID");
        
        const { error: deleteError } = await supabase
          .from("time_entries")
          .delete()
          .eq("id", actualWorkEntryId);
        
        // Resilient handling: ignore network errors, they may have succeeded server-side
        if (deleteError && !deleteError.message?.includes('fetch')) {
          throw deleteError;
        }

        const { error: insertError } = await supabase
          .from("leave_requests")
          .insert({
            user_id: selectedUserId,
            type: newType,
            start_date: entry.work_date,
            end_date: entry.work_date,
            status: "approved",
            reason: `Admin-Umwandlung: ${reason}`,
          });
        
        if (insertError && !insertError.message?.includes('fetch')) {
          throw insertError;
        }

        toast.success(`Eintrag zu ${getTypeLabel(newType)} umgewandelt`);

      } else if (originalType !== 'work' && newType === 'work') {
        // Absence → Work: Delete leave_request
        if (!actualLeaveId) throw new Error("Keine gültige Abwesenheits-ID");
        
        const { error } = await supabase
          .from("leave_requests")
          .delete()
          .eq("id", actualLeaveId);
        
        if (error && !error.message?.includes('fetch')) {
          throw error;
        }
        
        toast.info("Abwesenheit entfernt. Mitarbeiter muss Arbeitszeit manuell erfassen.");

      } else if (originalType !== 'work' && newType !== 'work' && originalType !== newType) {
        // Absence → different Absence (e.g., vacation → overtime_reduction)
        if (!actualLeaveId) throw new Error("Keine gültige Abwesenheits-ID");
        
        const { error } = await supabase
          .from("leave_requests")
          .update({
            type: newType,
            reason: `Umgewandelt von ${getTypeLabel(originalType)}: ${reason}`,
          })
          .eq("id", actualLeaveId);
        
        if (error && !error.message?.includes('fetch')) {
          throw error;
        }
        
        toast.success("Eintragstyp geändert");
      }

      // Close dialogs
      setEditingCombinedEntry(null);
      setEditingEntry(null);
      
      // Delayed reload for resilient handling
      setTimeout(() => loadMonthData(), 500);
      
    } catch (error: any) {
      console.error("Type change error:", error);
      toast.error(error.message || "Fehler bei der Typänderung");
      // On network errors, still reload data to verify
      if (error.message?.includes('fetch')) {
        setTimeout(() => loadMonthData(), 500);
      }
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

  const totalActual = workedMinutes + creditMinutes;
  // BUG FIX: Corrections are yearly, not monthly – they must NOT be added to monthly balance.
  // They are already included in yearlyBalance from useYearlyBalance hook.
  const balanceMinutes = totalActual - monthlyTargetMinutes;

  return (
    <div className="space-y-6">
      {/* Header with employee picker and month navigation */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="w-full">
          <div className="flex flex-wrap gap-2">
            {employees.map((employee) => {
              const isSelected = selectedUserId === employee.user_id;

              return (
                <Button
                  key={employee.user_id}
                  variant={isSelected ? "default" : "outline"}
                  className="h-auto px-3 py-2"
                  onClick={() => setSelectedUserId(employee.user_id)}
                >
                  <div className="flex items-center gap-2">
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={employee.avatar_url || undefined} alt={employee.display_name || "Mitarbeiter"} />
                      <AvatarFallback className="text-[10px]">{getInitials(employee.display_name)}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm">{employee.display_name}</span>
                  </div>
                </Button>
              );
            })}
          </div>
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

      {/* Warning if employee settings are incomplete */}
      {hasIncompleteSettings && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>{selectedEmployee?.display_name}</strong> hat keine vollständigen Arbeitszeit-Einstellungen. 
            Die Berechnungen verwenden Standardwerte (39,5h/Woche, 5 Tage). 
            Bitte die Einstellungen im Team-Bereich vervollständigen.
          </AlertDescription>
        </Alert>
      )}

      {/* Yearly balance card with breakdown button */}
      <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-primary flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Überstundensaldo {getYear(currentMonth)}
            </CardTitle>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setShowBreakdownDialog(true)}
              className="text-xs"
            >
              Aufschlüsselung anzeigen
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loadingYearlyBalance ? (
            <div className="space-y-2">
              <div className="h-8 w-32 bg-muted animate-pulse rounded" />
              <div className="h-4 w-48 bg-muted animate-pulse rounded" />
            </div>
          ) : (
          <div className="flex items-baseline gap-4">
            <div className={`text-3xl font-bold ${yearlyBalance >= 0 ? "text-green-600" : "text-destructive"}`}>
              {yearlyBalance >= 0 ? "+" : ""}{fmt(yearlyBalance)}
            </div>
            {totalCorrectionMinutes !== 0 && (
              <span className="text-sm text-muted-foreground">
                (inkl. {totalCorrectionMinutes >= 0 ? "+" : ""}{fmt(totalCorrectionMinutes)} Korrekturen)
              </span>
            )}
          </div>
          )}
          <p className="text-xs text-muted-foreground mt-1">
            Summe aller Monate bis heute
          </p>
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

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
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
              Gearbeitet
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{fmt(workedMinutes)}</div>
            <p className="text-xs text-muted-foreground">
              {combinedEntries.filter(e => e.entry_type === 'work').length} Arbeitstage
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Gift className="h-4 w-4" />
              Gutschriften
            </CardTitle>
          </CardHeader>
          <CardContent>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="cursor-help">
                    <div className="text-2xl font-bold text-blue-600">+{fmt(creditMinutes)}</div>
                    <p className="text-xs text-muted-foreground">
                      Urlaub, Krankheit, etc.
                    </p>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                  <div className="space-y-1 text-xs">
                    {combinedEntries.filter(e => e.entry_type === 'holiday').length > 0 && (
                      <div className="flex justify-between gap-4">
                        <span>🎉 Feiertage:</span>
                        <span>{combinedEntries.filter(e => e.entry_type === 'holiday').length} Tage (kein Soll)</span>
                      </div>
                    )}
                    {combinedEntries.filter(e => e.entry_type === 'sick').length > 0 && (
                      <div className="flex justify-between gap-4">
                        <span>🤒 Krankheit:</span>
                        <span>{combinedEntries.filter(e => e.entry_type === 'sick').length} Tage</span>
                      </div>
                    )}
                    {combinedEntries.filter(e => e.entry_type === 'vacation').length > 0 && (
                      <div className="flex justify-between gap-4">
                        <span>🏖️ Urlaub:</span>
                        <span>{combinedEntries.filter(e => e.entry_type === 'vacation').length} Tage</span>
                      </div>
                    )}
                    {combinedEntries.filter(e => e.entry_type === 'overtime_reduction').length > 0 && (
                      <div className="flex justify-between gap-4">
                        <span>⏰ Überstundenabbau:</span>
                        <span>{combinedEntries.filter(e => e.entry_type === 'overtime_reduction').length} Tage</span>
                      </div>
                    )}
                    {combinedEntries.filter(e => e.entry_type === 'medical').length > 0 && (
                      <div className="flex justify-between gap-4">
                        <span>🏥 Arzttermine:</span>
                        <span>{combinedEntries.filter(e => e.entry_type === 'medical').length}</span>
                      </div>
                    )}
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Monatssaldo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${balanceMinutes >= 0 ? "text-green-600" : "text-destructive"}`}>
              {balanceMinutes >= 0 ? "+" : ""}{fmt(balanceMinutes)}
            </div>
            <p className="text-xs text-muted-foreground">
              Gesamt-Ist: {fmt(totalActual)}
              {totalCorrectionMinutes !== 0 && (
                <span className="block">Korrekturen: {totalCorrectionMinutes >= 0 ? "+" : ""}{fmt(totalCorrectionMinutes)}</span>
              )}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Aktionen
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button 
              variant="default" 
              size="sm" 
              onClick={() => setCreateEntryDialogOpen(true)}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              Eintrag erstellen
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setCorrectionDialogOpen(true)}
              className="w-full"
            >
              <TrendingUp className="h-4 w-4 mr-2" />
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
              <CardDescription>Alle Einträge inkl. Abwesenheiten für diesen Monat</CardDescription>
            </CardHeader>
            <CardContent>
              {combinedEntries.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>Keine Einträge in diesem Monat</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Datum</TableHead>
                        <TableHead>Typ</TableHead>
                        <TableHead>Gesamt-Ist</TableHead>
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
                      {combinedEntries.map(entry => {
                        const grossMinutes = entry.started_at && entry.ended_at
                          ? Math.round((new Date(entry.ended_at).getTime() - new Date(entry.started_at).getTime()) / 60000)
                          : entry.minutes || 0;
                        
                        return (
                          <TableRow key={entry.id} className={entry.type_class}>
                            <TableCell className="font-medium">
                              {format(parseISO(entry.work_date), "EEE, dd.MM.", { locale: de })}
                            </TableCell>
                            <TableCell>
                              {entry.type_label ? (
                                <Badge variant="outline" className="text-xs whitespace-nowrap">
                                  {entry.type_icon} {entry.type_label}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground text-xs">Arbeit</span>
                              )}
                            </TableCell>
                            <TableCell className="font-mono">
                              {fmt(actualAfterEntryById.get(entry.id) || 0)}
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
                              {entry.edited_by && entry.entry_type === 'work' && (
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
                              {(entry.entry_type === 'work' || ['vacation', 'sick', 'overtime_reduction'].includes(entry.entry_type)) && (
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={() => {
                                    // For work entries, also find the original time entry
                                    if (entry.entry_type === 'work') {
                                      const original = timeEntries.find(e => e.id === entry.id);
                                      if (original) setEditingEntry(original);
                                    }
                                    // Always set the combined entry for type change support
                                    setEditingCombinedEntry(entry);
                                  }}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
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

      {/* Edit entry dialog - supports both work entries and absences with type change */}
      {editingCombinedEntry && (
        <AdminTimeEntryEditor
          entry={{
            id: editingEntry?.id || editingCombinedEntry.id,
            work_date: editingCombinedEntry.work_date,
            started_at: editingEntry?.started_at || editingCombinedEntry.started_at,
            ended_at: editingEntry?.ended_at || editingCombinedEntry.ended_at,
            minutes: editingEntry?.minutes || editingCombinedEntry.minutes,
            pause_minutes: editingEntry?.pause_minutes || editingCombinedEntry.pause_minutes || 0,
            notes: editingEntry?.notes || editingCombinedEntry.notes,
            user_name: selectedEmployee?.display_name || "Mitarbeiter",
            edited_by: editingEntry?.edited_by,
            edited_at: editingEntry?.edited_at,
            edit_reason: editingEntry?.edit_reason,
            leave_id: editingCombinedEntry.leave_id,
          }}
          isOpen={!!editingCombinedEntry}
          onClose={() => {
            setEditingEntry(null);
            setEditingCombinedEntry(null);
          }}
          onSave={handleSaveEntry}
          onTypeChange={handleTypeChange}
          isLoading={isSaving}
          currentEntryType={editingCombinedEntry.entry_type as EntryType}
          allowTypeChange={true}
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

      {/* Create entry dialog */}
      <Dialog open={createEntryDialogOpen} onOpenChange={setCreateEntryDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Eintrag für {selectedEmployee?.display_name} erstellen</DialogTitle>
            <DialogDescription>
              Erstellen Sie einen neuen Zeit- oder Abwesenheitseintrag.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="grid gap-2">
              <Label>Eintragstyp</Label>
              <select
                value={newEntryType}
                onChange={(e) => setNewEntryType(e.target.value as EntryType)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="work">📋 Arbeit</option>
                <option value="vacation">🏖️ Urlaub</option>
                <option value="sick">🤒 Krankheit</option>
                <option value="overtime_reduction">⏰ Überstundenabbau</option>
              </select>
            </div>
            
            <div className="grid gap-2">
              <Label>Datum</Label>
              <Input
                type="date"
                value={newEntryDate}
                onChange={(e) => setNewEntryDate(e.target.value)}
              />
            </div>
            
            {newEntryType === 'work' && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Start</Label>
                    <Input
                      type="time"
                      value={newEntryStartTime}
                      onChange={(e) => setNewEntryStartTime(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Ende</Label>
                    <Input
                      type="time"
                      value={newEntryEndTime}
                      onChange={(e) => setNewEntryEndTime(e.target.value)}
                    />
                  </div>
                </div>
                
                <div className="grid gap-2">
                  <Label>Pause (Minuten)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="120"
                    value={newEntryPause}
                    onChange={(e) => setNewEntryPause(e.target.value)}
                  />
                </div>
              </>
            )}
            
            <div className="grid gap-2">
              <Label>Notizen/Grund</Label>
              <Textarea
                value={newEntryReason}
                onChange={(e) => setNewEntryReason(e.target.value)}
                placeholder={newEntryType === 'work' 
                  ? "z.B. Nachträgliche Erfassung..." 
                  : "z.B. Nachträgliche Genehmigung..."}
                rows={2}
              />
            </div>
            
            <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5" />
                <p className="text-sm text-blue-800">
                  Dieser Eintrag wird als Admin-Eintrag gekennzeichnet und ist für den Mitarbeiter sichtbar.
                </p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateEntryDialogOpen(false)} disabled={isSaving}>
              Abbrechen
            </Button>
            <Button onClick={handleCreateEntry} disabled={isSaving}>
              {isSaving ? "Erstellen..." : "Eintrag erstellen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Yearly breakdown dialog */}
      <Dialog open={showBreakdownDialog} onOpenChange={setShowBreakdownDialog}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Überstunden-Aufschlüsselung {getYear(currentMonth)}</DialogTitle>
            <DialogDescription>
              Monatliche Entwicklung des Überstundensaldos für {selectedEmployee?.display_name}
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
                  {totalCorrectionMinutes !== 0 && (
                    <TableRow className="border-t-2">
                      <TableCell colSpan={4} className="font-medium">
                        Korrekturen (gesamt)
                      </TableCell>
                      <TableCell className={`text-right font-medium ${totalCorrectionMinutes >= 0 ? "text-green-600" : "text-destructive"}`}>
                        {totalCorrectionMinutes >= 0 ? "+" : ""}{fmt(totalCorrectionMinutes)}
                      </TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  )}
                  <TableRow className="bg-muted/50 font-bold">
                    <TableCell colSpan={4}>Gesamt {getYear(currentMonth)}</TableCell>
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
                <li><strong>Gutschriften:</strong> Urlaub, Krankheit, Arzttermine (zählen als gearbeitet)</li>
                <li><strong>Überstundenabbau:</strong> Reduziert den Überstundensaldo</li>
                <li><strong>Saldo:</strong> Gearbeitet + Gutschriften − Soll − Überstundenabbau</li>
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
