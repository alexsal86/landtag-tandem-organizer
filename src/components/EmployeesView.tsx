import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { startOfYear, endOfYear, eachDayOfInterval, isWeekend, formatDistanceToNow, differenceInDays, format } from "date-fns";
import { de } from "date-fns/locale";
import { Calendar, AlertCircle, History, BarChart3, RefreshCcw } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { EmployeeMeetingRequestDialog } from "./EmployeeMeetingRequestDialog";
import { EmployeeMeetingScheduler } from "./EmployeeMeetingScheduler";
import { EmployeeMeetingHistory } from "./EmployeeMeetingHistory";
import { EmployeeMeetingRequestManager } from "./EmployeeMeetingRequestManager";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { EmployeeYearlyStatsView } from "./EmployeeYearlyStatsView";
import { AnnualTasksView } from "./AnnualTasksView";

// Types derived from DB schema
type LeaveType = "vacation" | "sick" | "other";
type LeaveStatus = "pending" | "approved" | "rejected";

type EmployeeSettingsRow = {
  user_id: string;
  hours_per_week: number;
  timezone: string;
  workdays: boolean[];
  admin_id?: string | null;
  annual_vacation_days: number;
  employment_start_date: string | null;
  hours_per_month: number;
  days_per_month: number;
  days_per_week: number;
  last_meeting_date?: string | null;
  meeting_interval_months?: number;
  next_meeting_reminder_days?: number;
};

type Profile = {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
};

type LeaveRow = {
  id?: string;
  user_id: string;
  type: LeaveType;
  status: LeaveStatus;
  start_date: string; // ISO date
  end_date?: string;
};

type PendingLeaveRequest = {
  id: string;
  user_id: string;
  user_name: string;
  type: LeaveType;
  start_date: string;
  end_date: string;
  status: LeaveStatus;
};

type Employee = EmployeeSettingsRow & Profile & {
  next_meeting_due?: string | null;
  open_meeting_requests?: number;
  last_meeting_id?: string | null;
};

type LeaveAgg = {
  counts: Record<LeaveType, number>;
  lastDates: Partial<Record<LeaveType, string>>;
  approved: Record<LeaveType, number>;
  pending: Record<LeaveType, number>;
};

// History Popover Component
function EmployeeHistoryPopover({ userId }: { userId: string }) {
  const [history, setHistory] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const loadHistory = async () => {
    if (loading || history.length > 0) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('employee_settings_history')
        .select('*')
        .eq('user_id', userId)
        .order('valid_from', { ascending: false });

      if (error) throw error;
      setHistory(data || []);
    } catch (error) {
      console.error('Error loading history:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open && history.length === 0) {
      loadHistory();
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
          <History className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96">
        <div className="space-y-3">
          <h4 className="font-medium text-sm">Änderungshistorie</h4>
          {loading ? (
            <p className="text-xs text-muted-foreground">Lade Historie...</p>
          ) : history.length === 0 ? (
            <p className="text-xs text-muted-foreground">Keine Änderungen vorhanden</p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {history.map(h => {
                const percentage = Math.round((h.hours_per_week / 39.5) * 100);
                const isCurrent = !h.valid_until;
                
                return (
                  <div key={h.id} className={`flex justify-between items-start border-b pb-2 ${isCurrent ? 'bg-accent/30 -mx-2 px-2 rounded' : ''}`}>
                    <div className="space-y-0.5">
                      <div className="font-medium text-sm">
                        {h.hours_per_week}h/Woche ({percentage}%)
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(h.valid_from), "dd.MM.yyyy", { locale: de })} - 
                        {h.valid_until ? format(new Date(h.valid_until), "dd.MM.yyyy", { locale: de }) : "heute"}
                      </div>
                      {h.change_reason && (
                        <div className="text-xs text-muted-foreground italic">
                          {h.change_reason}
                        </div>
                      )}
                    </div>
                    <Badge variant={isCurrent ? "default" : "secondary"} className="text-xs">
                      {isCurrent ? "Aktuell" : "Alt"}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function EmployeesView() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [leaves, setLeaves] = useState<Record<string, LeaveAgg>>({});
  const [pendingLeaves, setPendingLeaves] = useState<PendingLeaveRequest[]>([]);
  const [sickDays, setSickDays] = useState<Record<string, number>>({});
  const [schedulerOpen, setSchedulerOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<{ id: string; name: string } | null>(null);
  const [requestManagerOpen, setRequestManagerOpen] = useState(false);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const [yearlyStatsOpen, setYearlyStatsOpen] = useState(false);
  const [showAnnualTasks, setShowAnnualTasks] = useState(false);

  // Self-view state for non-admin users
  const [selfSettings, setSelfSettings] = useState<EmployeeSettingsRow | null>(null);
  const [selfLeaveAgg, setSelfLeaveAgg] = useState<LeaveAgg | null>(null);
  const [selfProfile, setSelfProfile] = useState<Profile | null>(null);
  const [selfLastMeetingId, setSelfLastMeetingId] = useState<string | null>(null);

  // SEO basics
  useEffect(() => {
    document.title = "Mitarbeiterverwaltung | Admin Dashboard";
    const canonical = document.createElement("link");
    canonical.setAttribute("rel", "canonical");
    canonical.setAttribute("href", window.location.href);
    document.head.appendChild(canonical);

    const meta = document.createElement("meta");
    meta.setAttribute("name", "description");
    meta.setAttribute(
      "content",
      "Admin-Übersicht: Mitarbeiter, Stunden pro Woche sowie Krank- und Urlaubsanträge verwalten."
    );
    document.head.appendChild(meta);

    return () => {
      document.head.removeChild(canonical);
      document.head.removeChild(meta);
    };
  }, []);

  // Admin check
  useEffect(() => {
    if (!user) return;
    const run = async () => {
      const { data, error } = await supabase.rpc("is_admin", { _user_id: user.id });
      if (error) console.error(error);
      setIsAdmin(!!data);
    };
    run();
  }, [user]);

  // Load employees and leave data
  useEffect(() => {
    const load = async () => {
      if (!user || !currentTenant) return;
      setLoading(true);
      try {
        // Get users for current tenant first
        const { data: tenantMemberships } = await supabase
          .from('user_tenant_memberships')
          .select('user_id')
          .eq('tenant_id', currentTenant.id)
          .eq('is_active', true);

        if (!tenantMemberships?.length) {
          setEmployees([]);
          setLeaves({});
          setPendingLeaves([]);
          setLoading(false);
          return;
        }

        const tenantUserIds = tenantMemberships.map(m => m.user_id);

        // Get roles for tenant users and filter for employee roles
        const { data: roles, error: rErr } = await supabase
          .from("user_roles")
          .select("user_id, role")
          .in("user_id", tenantUserIds);
        if (rErr) throw rErr;

        const managedIds = (roles || [])
          .filter((r: any) => ["mitarbeiter", "praktikant", "bueroleitung"].includes(r.role))
          .map((r: any) => r.user_id);

        if (managedIds.length === 0) {
          setEmployees([]);
          setLeaves({});
          setPendingLeaves([]);
          setLoading(false);
          return;
        }

        const [profilesRes, settingsRes, leaveRes, pendingRes, sickRes, meetingRequestsRes, lastMeetingsRes] = await Promise.all([
          supabase.from("profiles").select("user_id, display_name, avatar_url").in("user_id", managedIds),
          supabase
            .from("employee_settings")
            .select("user_id, hours_per_week, timezone, workdays, admin_id, annual_vacation_days, employment_start_date, hours_per_month, days_per_month, days_per_week, last_meeting_date, meeting_interval_months, next_meeting_reminder_days")
            .in("user_id", managedIds),
          supabase
            .from("leave_requests")
            .select("user_id, type, status, start_date")
            .in("user_id", managedIds),
          supabase
            .from("leave_requests")
            .select("id, user_id, type, status, start_date, end_date")
            .eq("status", "pending")
            .in("user_id", managedIds),
          supabase
            .from("sick_days")
            .select("user_id")
            .in("user_id", managedIds),
          supabase
            .from("employee_meeting_requests")
            .select("employee_id")
            .eq("status", "pending")
            .in("employee_id", managedIds),
          supabase
            .from("employee_meetings")
            .select("id, employee_id, meeting_date")
            .in("employee_id", managedIds)
            .order("meeting_date", { ascending: false }),
        ]);
        if (sickRes.error) throw sickRes.error;
        if (profilesRes.error) throw profilesRes.error;
        if (settingsRes.error) throw settingsRes.error;
        if (leaveRes.error) throw leaveRes.error;
        if (pendingRes.error) throw pendingRes.error;
        if (meetingRequestsRes.error) throw meetingRequestsRes.error;
        if (lastMeetingsRes.error) throw lastMeetingsRes.error;

        const profileMap = new Map<string, Profile>();
        (profilesRes.data as Profile[] | null)?.forEach((p) => profileMap.set(p.user_id, p));

        const settingsMap = new Map<string, EmployeeSettingsRow>();
        (settingsRes.data as any[] | null)?.forEach((s) => settingsMap.set(s.user_id, s as EmployeeSettingsRow));

        // Map last meeting per employee
        const lastMeetingMap = new Map<string, string>();
        (lastMeetingsRes.data || []).forEach((m: any) => {
          if (!lastMeetingMap.has(m.employee_id)) {
            lastMeetingMap.set(m.employee_id, m.id);
          }
        });

        // Count open meeting requests per employee
        const meetingRequestCounts: Record<string, number> = {};
        (meetingRequestsRes.data || []).forEach((req: any) => {
          meetingRequestCounts[req.employee_id] = (meetingRequestCounts[req.employee_id] || 0) + 1;
        });

        // Set total pending requests count
        setPendingRequestsCount((meetingRequestsRes.data || []).length);

        const joined: Employee[] = managedIds.map((uid) => {
          const s = settingsMap.get(uid);
          const p = profileMap.get(uid);
          
          // Calculate next meeting due date
          let next_meeting_due: string | null = null;
          if (s?.last_meeting_date && s?.meeting_interval_months) {
            const lastMeeting = new Date(s.last_meeting_date);
            const nextDue = new Date(lastMeeting);
            nextDue.setMonth(nextDue.getMonth() + s.meeting_interval_months);
            next_meeting_due = nextDue.toISOString();
          }
          
          return {
            user_id: uid,
            hours_per_week: s?.hours_per_week ?? 40,
            timezone: s?.timezone ?? "Europe/Berlin",
            workdays: s?.workdays ?? [true, true, true, true, true, false, false],
            display_name: p?.display_name ?? null,
            avatar_url: p?.avatar_url ?? null,
            admin_id: (s as any)?.admin_id ?? null,
            annual_vacation_days: s?.annual_vacation_days ?? 30,
            employment_start_date: s?.employment_start_date ?? null,
            hours_per_month: s?.hours_per_month ?? 160,
            days_per_month: s?.days_per_month ?? 20,
            days_per_week: s?.days_per_week ?? 5,
            last_meeting_date: s?.last_meeting_date ?? null,
            meeting_interval_months: s?.meeting_interval_months ?? 3,
            next_meeting_reminder_days: s?.next_meeting_reminder_days ?? 14,
            next_meeting_due,
            open_meeting_requests: meetingRequestCounts[uid] || 0,
            last_meeting_id: lastMeetingMap.get(uid) || null,
          } as Employee;
        });
        setEmployees(joined);

        // Abwesenheiten aggregieren mit Arbeitstagen (RLS erlaubt nur Zugriff auf zugewiesene Nutzer)
        const agg: Record<string, LeaveAgg> = {};
        const initAgg = (): LeaveAgg => ({
          counts: { vacation: 0, sick: 0, other: 0 },
          approved: { vacation: 0, sick: 0, other: 0 },
          pending: { vacation: 0, sick: 0, other: 0 },
          lastDates: {},
        });

        // Get full leave data with end dates for all users
        const { data: fullLeaveData } = await supabase
          .from("leave_requests")
          .select("user_id, type, status, start_date, end_date")
          .in("user_id", managedIds)
          .gte("start_date", startOfYear(new Date()).toISOString())
          .lte("end_date", endOfYear(new Date()).toISOString());

        (fullLeaveData || []).forEach((lr: any) => {
          if (!agg[lr.user_id]) agg[lr.user_id] = initAgg();
          
          const workingDays = lr.end_date ? calculateWorkingDays(lr.start_date, lr.end_date) : 1;
          
          // Benutze Arbeitstage für die Berechnung
          if (lr.status === "approved") {
            agg[lr.user_id].approved[lr.type] += workingDays;
          }
          if (lr.status === "pending") {
            agg[lr.user_id].pending[lr.type] += workingDays;
          }
          agg[lr.user_id].counts[lr.type] += workingDays;
          
          const curr = agg[lr.user_id].lastDates[lr.type];
          if (!curr || new Date(lr.start_date) > new Date(curr)) {
            agg[lr.user_id].lastDates[lr.type] = lr.start_date;
          }
        });

        setLeaves(agg);

        // Count sick days per user
        const sickCount: Record<string, number> = {};
        (sickRes.data || []).forEach((sick: any) => {
          sickCount[sick.user_id] = (sickCount[sick.user_id] || 0) + 1;
        });
        setSickDays(sickCount);

        // Pending leave requests mit User-Namen
        const pendingWithNames: PendingLeaveRequest[] = (pendingRes.data || []).map((req: any) => ({
          id: req.id,
          user_id: req.user_id,
          user_name: profileMap.get(req.user_id)?.display_name || "Unbekannt",
          type: req.type,
          start_date: req.start_date,
          end_date: req.end_date,
          status: req.status,
        }));
        setPendingLeaves(pendingWithNames);
      } catch (e: any) {
        console.error(e);
        toast({
          title: "Fehler beim Laden",
          description: e?.message ?? "Daten konnten nicht geladen werden.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [user, currentTenant, toast]);


  // Load self data for non-admin users who are actual employees
  useEffect(() => {
    // Only try to load employee settings for users who are not admins
    if (!user || isAdmin) return;
    
    // First check if this user actually has employee settings before showing warnings
    const checkEmployeeStatus = async () => {
      const { data: hasSettings } = await supabase
        .from('employee_settings')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle();
      
      // If no employee settings exist, this user is likely the main representative (Abgeordneter)
      if (!hasSettings) {
        console.log('User is main representative (Abgeordneter) - no employee settings needed');
        // Just load profile without showing error messages
        loadProfileOnly();
        return;
      }
      
      // If settings exist, this is an actual employee - load full employee data
      loadEmployeeData();
    };
    
    const loadProfileOnly = async () => {
      try {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("user_id, display_name, avatar_url")
          .eq("user_id", user.id)
          .single();
        
        setSelfProfile(profileData as Profile || null);
        console.log('Loaded profile for main representative:', profileData);
      } catch (error) {
        console.error('Error loading profile:', error);
      }
    };
    
    const loadEmployeeData = async () => {
      setLoading(true);
      try {
        const [settingsRes, profileRes, leavesRes, lastMeetingRes] = await Promise.all([
          supabase
            .from("employee_settings")
            .select("user_id, hours_per_week, timezone, workdays, days_per_week, annual_vacation_days, employment_start_date, last_meeting_date")
            .eq("user_id", user.id)
            .maybeSingle(),
          supabase
            .from("profiles")
            .select("user_id, display_name, avatar_url")
            .eq("user_id", user.id)
            .single(),
          supabase
            .from("leave_requests")
            .select("id, type, status, start_date, end_date")
            .eq("user_id", user.id)
            .gte("start_date", startOfYear(new Date()).toISOString())
            .lte("end_date", endOfYear(new Date()).toISOString()),
          supabase
            .from("employee_meetings")
            .select("id")
            .eq("employee_id", user.id)
            .order("meeting_date", { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);

        // FORCE REFRESH: Check if data exists now
        const freshCheck = await supabase
          .from("employee_settings")
          .select("user_id, hours_per_week, days_per_week, annual_vacation_days, employment_start_date")
          .eq("user_id", user.id)
          .maybeSingle();
        
        console.log('=== DEBUGGING FOR USER ===');
        console.log('User ID:', user.id);
        console.log('User Email:', user.email);
        console.log('Fresh check result:', freshCheck.data);
        console.log('Original settings result:', settingsRes.data);
        console.log('Profile loaded:', profileRes.data);
        console.log('Leave requests loaded:', leavesRes.data?.length || 0, 'requests');
        console.log('=== END DEBUG ===');

        if (settingsRes.error) {
          console.error("Error loading employee settings:", settingsRes.error);
          toast({
            title: "Fehler",
            description: "Fehler beim Laden der Mitarbeitereinstellungen",
            variant: "destructive",
          });
          return;
        }

        if (profileRes.error) {
          console.error("Error loading profile:", profileRes.error);
          toast({
            title: "Fehler",
            description: "Fehler beim Laden des Profils",
            variant: "destructive",
          });
          return;
        }

        if (leavesRes.error) {
          console.error("Error loading leave requests:", leavesRes.error);
          toast({
            title: "Fehler",
            description: "Fehler beim Laden der Urlaubsanträge",
            variant: "destructive",
          });
          return;
        }

        // Debug missing settings - Updated message
        if (!settingsRes.data) {
          console.warn('IMPORTANT: No employee settings found for user:', user.id, user.email);
          console.warn('If admin has just entered data, try refreshing the page');
          toast({
            title: "Keine Mitarbeitereinstellungen",
            description: "Falls der Administrator soeben Daten eingetragen hat, laden Sie die Seite neu (F5).",
            variant: "destructive",
          });
        } else {
          console.log('SUCCESS: Employee settings found:', settingsRes.data);
          toast({
            title: "Daten geladen",
            description: "Mitarbeitereinstellungen erfolgreich geladen.",
          });
        }

        setSelfSettings((settingsRes.data as EmployeeSettingsRow) || null);
        setSelfProfile((profileRes.data as Profile) || null);
        setSelfLastMeetingId(lastMeetingRes.data?.id || null);

                  const agg: LeaveAgg = {
           counts: { vacation: 0, sick: 0, other: 0 },
           approved: { vacation: 0, sick: 0, other: 0 },
           pending: { vacation: 0, sick: 0, other: 0 },
           lastDates: {},
         };
         
         // Get full leave data with end dates for calculation
         const { data: fullLeaveData } = await supabase
           .from("leave_requests")
           .select("type, status, start_date, end_date")
           .eq("user_id", user.id)
           .gte("start_date", startOfYear(new Date()).toISOString())
           .lte("end_date", endOfYear(new Date()).toISOString());
         
         (fullLeaveData || []).forEach((lr: any) => {
           const workingDays = lr.end_date ? calculateWorkingDays(lr.start_date, lr.end_date) : 1;
           
           // Benutze Arbeitstage für die Berechnung statt einfacher Zählung
           if (lr.status === "approved") {
             agg.approved[lr.type] += workingDays;
           }
           if (lr.status === "pending") {
             agg.pending[lr.type] += workingDays;
           }
           agg.counts[lr.type] += workingDays;
           
           const curr = agg.lastDates[lr.type];
           if (!curr || new Date(lr.start_date) > new Date(curr)) {
             agg.lastDates[lr.type] = lr.start_date;
           }
         });
        setSelfLeaveAgg(agg);
      } catch (e: any) {
        console.error(e);
        toast({
          title: "Fehler beim Laden",
          description: e?.message ?? "Eigene Daten konnten nicht geladen werden.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };
    
    checkEmployeeStatus();
  }, [user, isAdmin, toast]);

  // Berechne Arbeitstage zwischen zwei Daten (exklusive Wochenenden)
  const calculateWorkingDays = (startDate: string, endDate: string): number => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    const days = eachDayOfInterval({ start, end });
    return days.filter(day => !isWeekend(day)).length;
  };

  // Erstelle Kalendereintrag für genehmigten Urlaub
  const createVacationCalendarEntry = async (leaveRequest: PendingLeaveRequest, userId: string) => {
    try {
      const { data: userProfile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("user_id", userId)
        .single();

      const { data: tenantData } = await supabase
        .from("user_tenant_memberships")
        .select("tenant_id")
        .eq("user_id", user?.id)
        .eq("is_active", true)
        .limit(1)
        .single();

      if (!tenantData) {
        console.error("No tenant found for user");
        return;
      }

      const userName = userProfile?.display_name || "Mitarbeiter";
      const workingDays = calculateWorkingDays(leaveRequest.start_date, leaveRequest.end_date);
      
      // First, try to update existing request entry
      const { data: existingEntry } = await supabase
        .from("appointments")
        .select("id")
        .eq("title", `Anfrage Urlaub von ${userName}`)
        .eq("start_time", new Date(leaveRequest.start_date).toISOString())
        .eq("category", "vacation_request")
        .single();

      if (existingEntry) {
        // Update existing entry to approved status
        await supabase
          .from("appointments")
          .update({
            title: `Urlaub von ${userName}`,
            description: `Urlaubsantrag genehmigt (${workingDays} Arbeitstage)`,
            category: "vacation",
            status: "confirmed"
          })
          .eq("id", existingEntry.id);
      } else {
        // Create new entry if none exists
        await supabase
          .from("appointments")
          .insert({
            user_id: user?.id,
            tenant_id: tenantData.tenant_id,
            start_time: new Date(leaveRequest.start_date).toISOString(),
            end_time: new Date(leaveRequest.end_date + "T23:59:59").toISOString(),
            title: `Urlaub von ${userName}`,
            description: `Urlaubsantrag genehmigt (${workingDays} Arbeitstage)`,
            category: "vacation",
            priority: "medium",
            status: "confirmed",
            is_all_day: true
          });
      }
    } catch (error) {
      console.error("Fehler beim Erstellen des Kalendereintrags:", error);
    }
  };

  // Urlaubsantrag freigeben/ablehnen
  const handleLeaveAction = async (leaveId: string, action: "approved" | "rejected") => {
    try {
      const leaveRequest = pendingLeaves.find(req => req.id === leaveId);
      
      const { error } = await supabase
        .from("leave_requests")
        .update({ status: action })
        .eq("id", leaveId);

      if (error) throw error;

      if (leaveRequest) {
        const { data: userProfile } = await supabase
          .from("profiles")
          .select("display_name")
          .eq("user_id", leaveRequest.user_id)
          .single();

        const userName = userProfile?.display_name || "Mitarbeiter";

        if (action === "approved") {
          // Bei Genehmigung: Kalendereintrag aktualisieren
          await createVacationCalendarEntry(leaveRequest, leaveRequest.user_id);
        } else {
          // Bei Ablehnung: Ursprünglichen Antragseintrag löschen
          await supabase
            .from("appointments")
            .delete()
            .eq("title", `Anfrage Urlaub von ${userName}`)
            .eq("start_time", new Date(leaveRequest.start_date).toISOString())
            .eq("category", "vacation_request");
        }
      }

      toast({
        title: action === "approved" ? "Antrag genehmigt" : "Antrag abgelehnt",
        description: action === "approved" 
          ? "Der Urlaubsantrag wurde genehmigt und in den Kalender aktualisiert." 
          : "Der Urlaubsantrag wurde abgelehnt und aus dem Kalender entfernt.",
      });

      // Reload data
      window.location.reload();
    } catch (e: any) {
      console.error(e);
      toast({
        title: "Fehler",
        description: e?.message ?? "Antrag konnte nicht aktualisiert werden.",
        variant: "destructive",
      });
    }
  };

  // Inline edit functions
  const updateHours = async (userId: string, newHours: number) => {
    console.log('SAVING HOURS:', userId, newHours);
    if (newHours < 1 || newHours > 39.5) {
      toast({
        title: "Ungültige Eingabe",
        description: "Stunden müssen zwischen 1 und 39,5 liegen. Maximal 39,5 Stunden pro Woche erlaubt.",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data, error } = await supabase
        .from("employee_settings")
        .upsert({ 
          user_id: userId, 
          hours_per_week: newHours,
          admin_id: user?.id 
        }, { 
          onConflict: 'user_id',
          ignoreDuplicates: false 
        })
        .select();

      if (error) throw error;
      console.log('HOURS SAVED SUCCESS:', data);

      // Update local state
      setEmployees(prev => prev.map(emp => 
        emp.user_id === userId ? { ...emp, hours_per_week: newHours } : emp
      ));

      toast({
        title: "Gespeichert",
        description: "Stunden pro Woche wurden aktualisiert.",
      });
    } catch (e: any) {
      console.error('HOURS SAVE ERROR:', e);
      toast({
        title: "Fehler",
        description: e?.message ?? "Stunden konnten nicht aktualisiert werden.",
        variant: "destructive",
      });
    }
  };

  const updateDaysPerWeek = async (userId: string, newDays: number) => {
    if (newDays < 1 || newDays > 5) {
      toast({
        title: "Ungültige Eingabe",
        description: "Tage müssen zwischen 1 und 5 liegen. Maximal 5 Arbeitstage pro Woche erlaubt.",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from("employee_settings")
        .upsert({ 
          user_id: userId, 
          days_per_week: newDays,
          admin_id: user?.id 
        }, { 
          onConflict: 'user_id',
          ignoreDuplicates: false 
        });

      if (error) throw error;

      // Update local state
      setEmployees(prev => prev.map(emp => 
        emp.user_id === userId ? { ...emp, days_per_week: newDays } : emp
      ));

      toast({
        title: "Gespeichert",
        description: "Tage pro Woche wurden aktualisiert.",
      });
    } catch (e: any) {
      console.error(e);
      toast({
        title: "Fehler",
        description: e?.message ?? "Tage konnten nicht aktualisiert werden.",
        variant: "destructive",
      });
    }
  };

  const updateDaysPerMonth = async (userId: string, newDays: number) => {
    if (newDays < 1 || newDays > 31) {
      toast({
        title: "Ungültige Eingabe",
        description: "Tage müssen zwischen 1 und 31 liegen.",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from("employee_settings")
        .upsert({ 
          user_id: userId, 
          days_per_month: newDays,
          admin_id: user?.id 
        }, { 
          onConflict: 'user_id',
          ignoreDuplicates: false 
        });

      if (error) throw error;

      // Update local state
      setEmployees(prev => prev.map(emp => 
        emp.user_id === userId ? { ...emp, days_per_month: newDays } : emp
      ));

      toast({
        title: "Gespeichert",
        description: "Tage pro Monat wurden aktualisiert.",
      });
    } catch (e: any) {
      console.error(e);
      toast({
        title: "Fehler",
        description: e?.message ?? "Tage konnten nicht aktualisiert werden.",
        variant: "destructive",
      });
    }
  };

  const updateVacationDays = async (userId: string, newDays: number) => {
    if (newDays < 0 || newDays > 50) {
      toast({
        title: "Ungültige Eingabe",
        description: "Urlaubstage müssen zwischen 0 und 50 liegen.",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from("employee_settings")
        .upsert({ 
          user_id: userId, 
          annual_vacation_days: newDays,
          admin_id: user?.id 
        }, { 
          onConflict: 'user_id',
          ignoreDuplicates: false 
        });

      if (error) throw error;

      // Update local state
      setEmployees(prev => prev.map(emp => 
        emp.user_id === userId ? { ...emp, annual_vacation_days: newDays } : emp
      ));

      toast({
        title: "Gespeichert",
        description: "Urlaubstage wurden aktualisiert.",
      });
    } catch (e: any) {
      console.error(e);
      toast({
        title: "Fehler",
        description: e?.message ?? "Urlaubstage konnten nicht aktualisiert werden.",
        variant: "destructive",
      });
    }
  };

  const updateStartDate = async (userId: string, newDate: string) => {
    try {
      const { error } = await supabase
        .from("employee_settings")
        .upsert({ 
          user_id: userId, 
          employment_start_date: newDate,
          admin_id: user?.id 
        }, { 
          onConflict: 'user_id',
          ignoreDuplicates: false 
        });

      if (error) throw error;

      // Update local state
      setEmployees(prev => prev.map(emp => 
        emp.user_id === userId ? { ...emp, employment_start_date: newDate } : emp
      ));

      toast({
        title: "Gespeichert",
        description: "Startdatum wurde aktualisiert.",
      });
    } catch (e: any) {
      console.error(e);
      toast({
        title: "Fehler",
        description: e?.message ?? "Startdatum konnte nicht aktualisiert werden.",
        variant: "destructive",
      });
    }
  };

  const totals = useMemo(() => {
    const init = {
      employees: employees.length,
      sick: 0,
      vacation: 0,
      other: 0,
      pending: 0,
    };
    return employees.reduce((acc, e) => {
      const a = leaves[e.user_id];
      if (a) {
        acc.sick += a.counts.sick;
        acc.vacation += a.counts.vacation;
        acc.other += a.counts.other;
        acc.pending += a.pending.sick + a.pending.vacation + a.pending.other;
      }
      return acc;
    }, init);
  }, [employees, leaves]);

  if (!isAdmin) {
    const pendingCount =
      (selfLeaveAgg?.pending.sick ?? 0) +
      (selfLeaveAgg?.pending.vacation ?? 0) +
      (selfLeaveAgg?.pending.other ?? 0);

    return (
      <main>
        <header className="p-4 sm:p-6">
          <h1 className="text-2xl font-semibold">Mitarbeiter</h1>
          <p className="text-muted-foreground">Ihre Einstellungen & Abwesenheiten</p>
        </header>

        <section className="px-4 sm:px-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Stunden/Woche</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="space-y-1">
                  <div className="text-2xl font-semibold">
                    {selfSettings?.hours_per_week ?? '–'}h
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {selfSettings 
                      ? `${Math.round((selfSettings.hours_per_week / 39.5) * 100)}% von Vollzeit (39,5h)`
                      : '–'}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Offene Anträge</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? <Skeleton className="h-8 w-16" /> : <div className="text-2xl font-semibold">{pendingCount}</div>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Krank (Anträge / genehmigt)</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <div className="text-2xl font-semibold">
                  {(selfLeaveAgg?.counts.sick ?? 0)} <span className="text-sm text-muted-foreground">/ {(selfLeaveAgg?.approved.sick ?? 0)}</span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Urlaub (Anträge / genehmigt)</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <div className="text-2xl font-semibold">
                  {(selfLeaveAgg?.counts.vacation ?? 0)} <span className="text-sm text-muted-foreground">/ {(selfLeaveAgg?.approved.vacation ?? 0)}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        <section className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Meine Einstellungen</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-2">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-5 w-32" />
                </div>
              ) : (
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Stunden/Woche</span>
                    <span>{selfSettings?.hours_per_week ?? '–'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Arbeitstage/Woche</span>
                    <span>{selfSettings?.days_per_week ?? '–'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Urlaubstage/Jahr</span>
                    <span>{selfSettings?.annual_vacation_days ?? '–'}</span>
                  </div>
                  {selfSettings?.employment_start_date ? (
                    <div className="flex justify-between">
                      <span>Beginn Arbeitsverhältnis</span>
                      <span>{new Date(selfSettings.employment_start_date).toLocaleDateString('de-DE')}</span>
                    </div>
                  ) : (
                    <div className="flex justify-between">
                      <span>Beginn Arbeitsverhältnis</span>
                      <span className="text-orange-600">Noch nicht eingetragen</span>
                    </div>
                  )}
                  {!selfSettings ? (
                    <div className="text-center text-blue-600 text-sm mt-2 p-3 bg-blue-50 rounded border border-blue-200">
                      <strong>Hinweis:</strong> Ihre Einstellungen werden geladen... <br/>
                      Falls Sie soeben vom Administrator eingetragen wurden, laden Sie die Seite neu (F5).
                      <br/>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="mt-2"
                        onClick={() => window.location.reload()}
                      >
                        Seite neu laden
                      </Button>
                    </div>
                  ) : (
                    <div className="text-center text-green-600 text-sm mt-1 p-2 bg-green-50 rounded">
                      ✓ Einstellungen erfolgreich geladen
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Letzte Abwesenheiten</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-2">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-5 w-48" />
                </div>
              ) : (
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between"><span>Krank</span><span>{selfLeaveAgg?.lastDates.sick ? new Date(selfLeaveAgg.lastDates.sick).toLocaleDateString('de-DE') : '–'}</span></div>
                  <div className="flex justify-between"><span>Urlaub</span><span>{selfLeaveAgg?.lastDates.vacation ? new Date(selfLeaveAgg.lastDates.vacation).toLocaleDateString('de-DE') : '–'}</span></div>
                  <div className="flex justify-between"><span>Sonstiges</span><span>{selfLeaveAgg?.lastDates.other ? new Date(selfLeaveAgg.lastDates.other).toLocaleDateString('de-DE') : '–'}</span></div>
                </div>
              )}
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Mitarbeitergespräche</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {selfSettings?.last_meeting_date && selfLastMeetingId ? (
                  <Button
                    variant="ghost"
                    className="h-auto w-full p-3 justify-start hover:bg-muted"
                    onClick={() => navigate(`/employee-meeting/${selfLastMeetingId}`)}
                  >
                    <div className="text-left space-y-1">
                      <span className="text-sm text-muted-foreground">Letztes Gespräch:</span>
                      <div className="font-medium">
                        {formatDistanceToNow(new Date(selfSettings.last_meeting_date), { 
                          addSuffix: true, 
                          locale: de 
                        })}
                      </div>
                    </div>
                  </Button>
                ) : selfSettings?.last_meeting_date ? (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Letztes Gespräch:</span>
                    <div className="font-medium">
                      {formatDistanceToNow(new Date(selfSettings.last_meeting_date), { 
                        addSuffix: true, 
                        locale: de 
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    Noch kein Mitarbeitergespräch erfasst
                  </div>
                )}
                
                <div className="pt-2">
                  <EmployeeMeetingRequestDialog />
                </div>
                
                <p className="text-xs text-muted-foreground">
                  Sie können jederzeit ein Gespräch mit Ihrem Vorgesetzten beantragen.
                </p>
              </div>
            </CardContent>
          </Card>
        </section>
      </main>
    );
  }

  return (
    <main>
      <header className="p-4 sm:p-6">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-2xl font-semibold">Mitarbeiterverwaltung</h1>
            <p className="text-muted-foreground">Überblick über Mitarbeitende, Stunden & Abwesenheiten</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" onClick={() => setYearlyStatsOpen(true)} className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Jahresstatistik
            </Button>
            <Button variant="outline" onClick={() => setShowAnnualTasks(!showAnnualTasks)} className="flex items-center gap-2">
              <RefreshCcw className="h-4 w-4" />
              Jährliche Aufgaben
            </Button>
            {pendingRequestsCount > 0 && (
              <Button onClick={() => setRequestManagerOpen(true)} className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Gesprächsanfragen
                <Badge variant="secondary">{pendingRequestsCount}</Badge>
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Annual Tasks Section */}
      {showAnnualTasks && (
        <section className="px-4 sm:px-6 mb-4">
          <AnnualTasksView />
        </section>
      )}

      <section className="px-4 sm:px-6 grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Mitarbeiter</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-8 w-16" /> : <div className="text-2xl font-semibold">{totals.employees}</div>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Krank (gesamt)</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-8 w-16" /> : <div className="text-2xl font-semibold">{totals.sick}</div>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Urlaub (gesamt)</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-8 w-16" /> : <div className="text-2xl font-semibold">{totals.vacation}</div>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Offene Anträge</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-8 w-16" /> : <div className="text-2xl font-semibold">{totals.pending}</div>}
          </CardContent>
        </Card>
      </section>

      {pendingLeaves.length > 0 && (
        <section className="px-4 sm:px-6">
          <Card>
            <CardHeader>
              <CardTitle>Offene Urlaubsanträge ({pendingLeaves.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mitarbeiter</TableHead>
                    <TableHead>Typ</TableHead>
                     <TableHead>Von</TableHead>
                     <TableHead>Bis</TableHead>
                     <TableHead>Arbeitstage</TableHead>
                     <TableHead>Aktionen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                   {pendingLeaves.map((req) => {
                     const workingDays = calculateWorkingDays(req.start_date, req.end_date);
                     return (
                     <TableRow key={req.id}>
                       <TableCell>{req.user_name}</TableCell>
                       <TableCell>
                         <Badge variant="outline">
                           {req.type === "vacation" ? "Urlaub" : req.type === "sick" ? "Krank" : "Sonstiges"}
                         </Badge>
                       </TableCell>
                       <TableCell>{new Date(req.start_date).toLocaleDateString("de-DE")}</TableCell>
                       <TableCell>{new Date(req.end_date).toLocaleDateString("de-DE")}</TableCell>
                       <TableCell>
                         <Badge variant="secondary">{workingDays} Tage</Badge>
                       </TableCell>
                       <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => handleLeaveAction(req.id, "approved")}
                          >
                            Genehmigen
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleLeaveAction(req.id, "rejected")}
                          >
                            Ablehnen
                          </Button>
                        </div>
                       </TableCell>
                     </TableRow>
                   )})}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </section>
      )}

      <section className="p-4 sm:p-6">
        <Card>
          <CardHeader>
            <CardTitle>Mitarbeiterliste</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : employees.length === 0 ? (
              <p className="text-muted-foreground">Noch keine Mitarbeitenden zugewiesen.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mitarbeiter</TableHead>
                    <TableHead>
                      <div className="flex flex-col">
                        <span>Stunden/Woche</span>
                        <span className="text-xs text-muted-foreground font-normal">(max. 39,5h)</span>
                      </div>
                    </TableHead>
                    <TableHead>
                      <div className="flex flex-col">
                        <span>Tage/Woche</span>
                        <span className="text-xs text-muted-foreground font-normal">(max. 5)</span>
                      </div>
                    </TableHead>
                    <TableHead>Urlaubstage/Jahr</TableHead>
                    <TableHead>Beginn Arbeitsverhältnis</TableHead>
                    <TableHead>Krankentage</TableHead>
                    <TableHead>Urlaub</TableHead>
                    <TableHead>Letztes Gespräch</TableHead>
                    <TableHead>Nächstes Gespräch</TableHead>
                    <TableHead>Aktion</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employees.map((e) => {
                    const a = leaves[e.user_id];
                    const vacApproved = a?.approved.vacation ?? 0;
                    const remainingVacationDays = e.annual_vacation_days - vacApproved;

                    return (
                      <TableRow key={e.user_id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={e.avatar_url ?? undefined} alt={e.display_name ?? "Avatar"} />
                              <AvatarFallback>
                                {(e.display_name ?? "?").slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col">
                              <span className="font-medium">{e.display_name ?? "Unbenannt"}</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              step="0.5"
                              value={e.hours_per_week}
                              onChange={(ev) => {
                                const newValue = Number(ev.target.value);
                                if (newValue >= 1 && newValue <= 39.5) {
                                  setEmployees(prev => prev.map(emp => 
                                    emp.user_id === e.user_id ? { ...emp, hours_per_week: newValue } : emp
                                  ));
                                  updateHours(e.user_id, newValue);
                                }
                              }}
                              className="w-20"
                              min="1"
                              max="39.5"
                            />
                            <Badge variant="outline" className="text-xs whitespace-nowrap">
                              {Math.round((e.hours_per_week / 39.5) * 100)}%
                            </Badge>
                            <EmployeeHistoryPopover userId={e.user_id} />
                          </div>
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={e.days_per_week}
                            onChange={(ev) => {
                              const newValue = Number(ev.target.value);
                              if (newValue >= 1 && newValue <= 5) {
                                setEmployees(prev => prev.map(emp => 
                                  emp.user_id === e.user_id ? { ...emp, days_per_week: newValue } : emp
                                ));
                                updateDaysPerWeek(e.user_id, newValue);
                              }
                            }}
                            className="w-20"
                            min="1"
                            max="5"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={e.annual_vacation_days}
                            onChange={(ev) => {
                              const newValue = Number(ev.target.value);
                              if (newValue >= 0 && newValue <= 50) {
                                setEmployees(prev => prev.map(emp => 
                                  emp.user_id === e.user_id ? { ...emp, annual_vacation_days: newValue } : emp
                                ));
                                updateVacationDays(e.user_id, newValue);
                              }
                            }}
                            className="w-20"
                            min="0"
                            max="50"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="date"
                            value={e.employment_start_date || "2025-01-01"}
                            onChange={(ev) => {
                              const newValue = ev.target.value;
                              setEmployees(prev => prev.map(emp => 
                                emp.user_id === e.user_id ? { ...emp, employment_start_date: newValue } : emp
                              ));
                              updateStartDate(e.user_id, newValue);
                            }}
                            className="w-40"
                          />
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{sickDays[e.user_id] || 0} Tage</Badge>
                         </TableCell>
                          <TableCell>
                            <Badge variant="secondary">
                              {vacApproved} von {e.annual_vacation_days} Arbeitstagen
                            </Badge>
                            {remainingVacationDays > 0 && (
                              <div className="text-xs text-muted-foreground mt-1">
                                {remainingVacationDays} verbleibende Arbeitstage
                              </div>
                            )}
                         </TableCell>
                         <TableCell>
                           {e.last_meeting_date && e.last_meeting_id ? (
                             <Button
                               variant="ghost"
                               className="h-auto p-2 hover:bg-muted"
                               onClick={() => navigate(`/employee-meeting/${e.last_meeting_id}`)}
                             >
                               <div className="space-y-1 text-left">
                                 <div className="text-sm">
                                   {new Date(e.last_meeting_date).toLocaleDateString('de-DE')}
                                 </div>
                                 <div className="text-xs text-muted-foreground">
                                   {formatDistanceToNow(new Date(e.last_meeting_date), { 
                                     addSuffix: true, 
                                     locale: de 
                                   })}
                                 </div>
                               </div>
                             </Button>
                           ) : e.last_meeting_date ? (
                             <div className="space-y-1">
                               <div className="text-sm">
                                 {new Date(e.last_meeting_date).toLocaleDateString('de-DE')}
                               </div>
                               <div className="text-xs text-muted-foreground">
                                 {formatDistanceToNow(new Date(e.last_meeting_date), { 
                                   addSuffix: true, 
                                   locale: de 
                                 })}
                               </div>
                             </div>
                           ) : (
                             <span className="text-muted-foreground text-sm">–</span>
                           )}
                         </TableCell>
                         <TableCell>
                           {e.next_meeting_due ? (
                             <div className="space-y-1">
                               <div className="flex items-center gap-2">
                                 <Calendar className="h-3 w-3" />
                                 <span className="text-sm">
                                   {new Date(e.next_meeting_due).toLocaleDateString('de-DE')}
                                 </span>
                               </div>
                               {differenceInDays(new Date(e.next_meeting_due), new Date()) < 0 ? (
                                 <Badge variant="destructive" className="text-xs">
                                   <AlertCircle className="h-3 w-3 mr-1" />
                                   Überfällig
                                 </Badge>
                               ) : differenceInDays(new Date(e.next_meeting_due), new Date()) <= 14 ? (
                                 <Badge variant="default" className="text-xs">
                                   In {differenceInDays(new Date(e.next_meeting_due), new Date())} Tagen
                                 </Badge>
                               ) : (
                                 <span className="text-xs text-muted-foreground">
                                   In {differenceInDays(new Date(e.next_meeting_due), new Date())} Tagen
                                 </span>
                               )}
                               {e.open_meeting_requests > 0 && (
                                 <Badge variant="secondary" className="text-xs">
                                   {e.open_meeting_requests} Anfrage{e.open_meeting_requests > 1 ? 'n' : ''}
                                 </Badge>
                               )}
                             </div>
                           ) : (
                             <span className="text-muted-foreground text-sm">Nicht geplant</span>
                           )}
                         </TableCell>
                         <TableCell>
                           <Button
                             size="sm"
                             variant="outline"
                             onClick={() => {
                               setSelectedEmployee({
                                 id: e.user_id,
                                 name: e.display_name || "Unbenannt"
                               });
                               setSchedulerOpen(true);
                             }}
                           >
                             Gespräch planen
                           </Button>
                         </TableCell>
                       </TableRow>
                     );
                   })}
                 </TableBody>
               </Table>
             )}
           </CardContent>
          </Card>
        </section>

        {/* Meeting History Section */}
        <section className="px-4 sm:px-6 pb-6">
          <EmployeeMeetingHistory showFilters={true} />
        </section>
        
        {selectedEmployee && (
          <EmployeeMeetingScheduler
            employeeId={selectedEmployee.id}
            employeeName={selectedEmployee.name}
            open={schedulerOpen}
            onOpenChange={setSchedulerOpen}
            onScheduled={() => {
              setSchedulerOpen(false);
              setSelectedEmployee(null);
              // Reload data after scheduling
              window.location.reload();
            }}
          />
        )}

        {/* Request Manager Dialog */}
        <Dialog open={requestManagerOpen} onOpenChange={setRequestManagerOpen}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Gesprächsanfragen verwalten</DialogTitle>
            </DialogHeader>
            <EmployeeMeetingRequestManager />
          </DialogContent>
        </Dialog>
        {/* Yearly Stats Dialog */}
        <EmployeeYearlyStatsView
          isOpen={yearlyStatsOpen}
          onClose={() => setYearlyStatsOpen(false)}
        />
      </main>
    );
}

export default EmployeesView;