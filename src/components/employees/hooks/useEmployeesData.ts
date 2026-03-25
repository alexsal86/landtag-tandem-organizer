import { useCallback, useEffect, useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { useToast } from "@/hooks/use-toast";
import { debugConsole } from '@/utils/debugConsole';
import { startOfYear, endOfYear } from "date-fns";
import {
  Employee,
  EmployeeRow,
  EmployeeSettingsRow,
  Profile,
  LeaveAgg,
  LeaveType,
  PendingLeaveRequest,
  calculateWorkingDays, initLeaveAgg,
} from "../types";

type AdminOverviewResponse = {
  employees: Array<Employee & { leave_agg?: LeaveAgg; sick_days_count?: number }>;
  pending_leaves: PendingLeaveRequest[];
  pending_requests_count: number;
};
type LatestEmployeeMeetingRpcRow = {
  meeting_id: string | null;
};

type EmployeesDataError = {
  message: string;
  cause: unknown;
} | null;

export type UseEmployeesDataResult = {
  isAdmin: boolean;
  loading: boolean;
  error: EmployeesDataError;
  employees: EmployeeRow[];
  setEmployees: Dispatch<SetStateAction<EmployeeRow[]>>;
  leaves: Record<string, LeaveAgg>;
  pendingLeaves: PendingLeaveRequest[];
  setPendingLeaves: Dispatch<SetStateAction<PendingLeaveRequest[]>>;
  sickDays: Record<string, number>;
  pendingRequestsCount: number;
  setPendingRequestsCount: Dispatch<SetStateAction<number>>;
  reloadPendingRequestsCount: () => Promise<void>;
  selfSettings: EmployeeSettingsRow | null;
  selfLeaveAgg: LeaveAgg | null;
  selfProfile: Profile | null;
  selfLastMeetingId: string | null;
};

const ADMIN_OVERVIEW_STALE_TIME_MS = 60 * 1000;
const ADMIN_OVERVIEW_GC_TIME_MS = 10 * 60 * 1000;

export function useEmployeesData(): UseEmployeesDataResult {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isAdmin, setIsAdmin] = useState(false);
  const [roleResolved, setRoleResolved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [leaves, setLeaves] = useState<Record<string, LeaveAgg>>({});
  const [pendingLeaves, setPendingLeaves] = useState<PendingLeaveRequest[]>([]);
  const [sickDays, setSickDays] = useState<Record<string, number>>({});
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const [error, setError] = useState<EmployeesDataError>(null);

  // Self-view state
  const [selfSettings, setSelfSettings] = useState<EmployeeSettingsRow | null>(null);
  const [selfLeaveAgg, setSelfLeaveAgg] = useState<LeaveAgg | null>(null);
  const [selfProfile, setSelfProfile] = useState<Profile | null>(null);
  const [selfLastMeetingId, setSelfLastMeetingId] = useState<string | null>(null);

  const adminOverviewKey = useMemo(() => ["employee-admin-overview", currentTenant?.id], [currentTenant?.id]);

  const reloadPendingRequestsCount = useCallback(async () => {
    if (!currentTenant || !isAdmin) return;
    try {
      const data = await queryClient.fetchQuery({
        queryKey: adminOverviewKey,
        staleTime: 0,
        gcTime: ADMIN_OVERVIEW_GC_TIME_MS,
        queryFn: async () => {
          const { data: rpcData, error } = await supabase.rpc("get_employee_admin_overview", {
            p_tenant_id: currentTenant.id,
          });

          if (error) throw error;
          return (rpcData ?? { employees: [], pending_leaves: [], pending_requests_count: 0 }) as unknown as AdminOverviewResponse;
        },
      });
      setPendingRequestsCount(data.pending_requests_count || 0);
    } catch (error) {
      debugConsole.error("Error loading pending request count:", error);
    }
  }, [adminOverviewKey, currentTenant, isAdmin, queryClient]);

  // Admin check
  useEffect(() => {
    if (!user) {
      setIsAdmin(false);
      setRoleResolved(true);
      setLoading(false);
      setError(null);
      return;
    }

    const run = async () => {
      setRoleResolved(false);
      setLoading(true);
      const { data: roleData, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();
      if (error) debugConsole.error(error);
      setIsAdmin(roleData?.role === "abgeordneter");
      setRoleResolved(true);
    };
    run();
  }, [user]);

  const adminOverviewQuery = useQuery({
    queryKey: adminOverviewKey,
    enabled: roleResolved && isAdmin && !!currentTenant,
    staleTime: ADMIN_OVERVIEW_STALE_TIME_MS,
    gcTime: ADMIN_OVERVIEW_GC_TIME_MS,
    queryFn: async () => {
      if (!currentTenant) return { employees: [], pending_leaves: [], pending_requests_count: 0 } as AdminOverviewResponse;

      const { data, error } = await supabase.rpc("get_employee_admin_overview", {
        p_tenant_id: currentTenant.id,
      });

      if (error) throw error;
      return (data ?? { employees: [], pending_leaves: [], pending_requests_count: 0 }) as unknown as AdminOverviewResponse;
    },
  });

  // Load admin data from consolidated endpoint
  useEffect(() => {
    if (!roleResolved || !isAdmin) return;

    if (adminOverviewQuery.error) {
      debugConsole.error(adminOverviewQuery.error);
      setError({ message: "Admin-Daten konnten nicht geladen werden.", cause: adminOverviewQuery.error });
      toast({ title: "Fehler beim Laden", description: "Daten konnten nicht geladen werden.", variant: "destructive" });
      setLoading(false);
      return;
    }

    if (!adminOverviewQuery.data) {
      setLoading(adminOverviewQuery.isFetching);
      return;
    }

    setError(null);
    const overview = adminOverviewQuery.data;
    const normalizedEmployees = (overview.employees || []).map((employee) => {
      let next_meeting_due: string | null = null;
      if (employee.last_meeting_date && employee.meeting_interval_months) {
        const lastMeeting = new Date(employee.last_meeting_date);
        const nextDue = new Date(lastMeeting);
        nextDue.setMonth(nextDue.getMonth() + employee.meeting_interval_months);
        next_meeting_due = nextDue.toISOString();
      }

      return {
        user_id: employee.user_id,
        hours_per_week: employee.hours_per_week ?? 40,
        timezone: employee.timezone ?? "Europe/Berlin",
        workdays: employee.workdays ?? [true, true, true, true, true, false, false],
        display_name: employee.display_name ?? null,
        avatar_url: employee.avatar_url ?? null,
        admin_id: employee.admin_id ?? null,
        annual_vacation_days: employee.annual_vacation_days ?? 30,
        employment_start_date: employee.employment_start_date ?? null,
        hours_per_month: employee.hours_per_month ?? 160,
        days_per_month: employee.days_per_month ?? 20,
        days_per_week: employee.days_per_week ?? 5,
        last_meeting_date: employee.last_meeting_date ?? null,
        meeting_interval_months: employee.meeting_interval_months ?? 3,
        next_meeting_reminder_days: employee.next_meeting_reminder_days ?? 14,
        next_meeting_due,
        open_meeting_requests: employee.open_meeting_requests ?? 0,
        last_meeting_id: employee.last_meeting_id ?? null,
        carry_over_days: employee.carry_over_days ?? 0,
        carry_over_expires_at: employee.carry_over_expires_at ?? null,
      } as Employee;
    });

    const nextLeaves: Record<string, LeaveAgg> = {};
    const nextSickDays: Record<string, number> = {};
    (overview.employees || []).forEach((employee) => {
      nextLeaves[employee.user_id] = employee.leave_agg || initLeaveAgg();
      nextSickDays[employee.user_id] = employee.sick_days_count || 0;
    });

    setEmployees(normalizedEmployees);
    setLeaves(nextLeaves);
    setSickDays(nextSickDays);
    setPendingLeaves(overview.pending_leaves || []);
    setPendingRequestsCount(overview.pending_requests_count || 0);
    setLoading(adminOverviewQuery.isFetching);
  }, [adminOverviewQuery.data, adminOverviewQuery.error, adminOverviewQuery.isFetching, isAdmin, roleResolved, toast]);

  // Lazy: secondary meeting IDs are refreshed in the background without blocking initial table render.
  useEffect(() => {
    if (!roleResolved || !isAdmin || !currentTenant || employees.length === 0) return;

    const run = async () => {
      try {
        const employeeIds = employees.map((employee) => employee.user_id);
        const { data, error } = await supabase
          .from("employee_meetings")
          .select("id, employee_id, meeting_date")
          .in("employee_id", employeeIds)
          .eq("tenant_id", currentTenant.id)
          .order("meeting_date", { ascending: false });

        if (error) throw error;

        const latestMeetingByEmployee = new Map<string, string>();
        (data || []).forEach((meeting) => {
          if (!latestMeetingByEmployee.has(meeting.employee_id)) {
            latestMeetingByEmployee.set(meeting.employee_id, meeting.id);
          }
        });

        setEmployees((prev) => {
          let changed = false;
          const next = prev.map((employee) => {
            const lazyLastMeetingId = latestMeetingByEmployee.get(employee.user_id) || null;
            const resolvedLastMeetingId = employee.last_meeting_id || lazyLastMeetingId;
            if (resolvedLastMeetingId !== employee.last_meeting_id) {
              changed = true;
              return { ...employee, last_meeting_id: resolvedLastMeetingId };
            }
            return employee;
          });
          return changed ? next : prev;
        });
      } catch (error) {
        debugConsole.warn("Lazy meeting refresh failed", error);
      }
    };

    const timeoutId = window.setTimeout(() => {
      run();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [currentTenant, employees, isAdmin, roleResolved]);

  // Load self data for non-admin users
  useEffect(() => {
    if (!roleResolved || !user || isAdmin) return;

    const checkEmployeeStatus = async () => {
      const { data: hasSettings } = await supabase
        .from('employee_settings').select('user_id').eq('user_id', user.id).maybeSingle();
      if (!hasSettings) {
        const { data: profileData } = await supabase.from("profiles").select("user_id, display_name, avatar_url").eq("user_id", user.id).single();
        setSelfProfile(profileData as Profile || null);
        setLoading(false);
        return;
      }
      loadEmployeeData();
    };

    const loadEmployeeData = async () => {
      setLoading(true);
      try {
        const [settingsRes, profileRes, leavesRes, lastMeetingRes] = await Promise.all([
          supabase.from("employee_settings")
            .select("user_id, hours_per_week, timezone, workdays, days_per_week, annual_vacation_days, employment_start_date, last_meeting_date")
            .eq("user_id", user.id).maybeSingle(),
          supabase.from("profiles").select("user_id, display_name, avatar_url").eq("user_id", user.id).single(),
          supabase.from("leave_requests").select("id, type, status, start_date, end_date").eq("user_id", user.id)
            .gte("start_date", startOfYear(new Date()).toISOString()).lte("start_date", endOfYear(new Date()).toISOString()),
          supabase.rpc("get_latest_employee_meetings", { p_employee_ids: [user.id] }).maybeSingle<LatestEmployeeMeetingRpcRow>(),
        ]);

        if (settingsRes.error) { debugConsole.error(settingsRes.error); toast({ title: "Fehler", description: "Fehler beim Laden der Mitarbeitereinstellungen", variant: "destructive" }); return; }
        if (profileRes.error) { debugConsole.error(profileRes.error); toast({ title: "Fehler", description: "Fehler beim Laden des Profils", variant: "destructive" }); return; }
        if (leavesRes.error) { debugConsole.error(leavesRes.error); toast({ title: "Fehler", description: "Fehler beim Laden der Urlaubsanträge", variant: "destructive" }); return; }

        if (!settingsRes.data) {
          toast({ title: "Keine Mitarbeitereinstellungen", description: "Falls der Administrator soeben Daten eingetragen hat, laden Sie die Seite neu (F5).", variant: "destructive" });
        }

        setSelfSettings((settingsRes.data as EmployeeSettingsRow) || null);
        setSelfProfile((profileRes.data as Profile) || null);
        setSelfLastMeetingId(lastMeetingRes.data?.meeting_id || null);

        const agg = initLeaveAgg();
        (leavesRes.data || []).forEach((lr) => {
          const leaveType = lr.type as LeaveType;
          const workingDays = lr.end_date ? calculateWorkingDays(lr.start_date, lr.end_date) : 1;
          if (lr.status === "approved") agg.approved[leaveType] += workingDays;
          if (lr.status === "pending") agg.pending[leaveType] += workingDays;
          agg.counts[leaveType] += workingDays;
          const curr = agg.lastDates[leaveType];
          if (!curr || new Date(lr.start_date) > new Date(curr)) agg.lastDates[leaveType] = lr.start_date;
        });
        setSelfLeaveAgg(agg);
      } catch (e: unknown) {
        debugConsole.error(e);
        const message = e instanceof Error ? e.message : "Eigene Daten konnten nicht geladen werden.";
        setError({ message, cause: e });
        toast({ title: "Fehler beim Laden", description: message, variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };

    checkEmployeeStatus();
  }, [user, isAdmin, roleResolved, toast]);

  return {
    isAdmin,
    loading: roleResolved && isAdmin ? (loading || adminOverviewQuery.isFetching) : loading,
    error,
    employees,
    setEmployees,
    leaves,
    pendingLeaves,
    setPendingLeaves,
    sickDays,
    pendingRequestsCount,
    setPendingRequestsCount,
    reloadPendingRequestsCount,
    selfSettings,
    selfLeaveAgg,
    selfProfile,
    selfLastMeetingId,
  };
}
