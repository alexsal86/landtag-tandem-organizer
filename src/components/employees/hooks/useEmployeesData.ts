import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { useToast } from "@/hooks/use-toast";
import { debugConsole } from '@/utils/debugConsole';
import { startOfYear, endOfYear } from "date-fns";
import {
  Employee, EmployeeSettingsRow, Profile, LeaveAgg, PendingLeaveRequest,
  calculateWorkingDays, initLeaveAgg,
} from "../types";

export function useEmployeesData() {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const { toast } = useToast();

  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [leaves, setLeaves] = useState<Record<string, LeaveAgg>>({});
  const [pendingLeaves, setPendingLeaves] = useState<PendingLeaveRequest[]>([]);
  const [sickDays, setSickDays] = useState<Record<string, number>>({});
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);

  // Self-view state
  const [selfSettings, setSelfSettings] = useState<EmployeeSettingsRow | null>(null);
  const [selfLeaveAgg, setSelfLeaveAgg] = useState<LeaveAgg | null>(null);
  const [selfProfile, setSelfProfile] = useState<Profile | null>(null);
  const [selfLastMeetingId, setSelfLastMeetingId] = useState<string | null>(null);

  // Admin check
  useEffect(() => {
    if (!user) return;
    const run = async () => {
      const { data: roleData, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();
      if (error) debugConsole.error(error);
      setIsAdmin(roleData?.role === "abgeordneter");
    };
    run();
  }, [user]);

  // Load admin data
  useEffect(() => {
    const load = async () => {
      if (!user || !currentTenant) return;
      setLoading(true);
      try {
        const { data: tenantMemberships } = await supabase
          .from('user_tenant_memberships')
          .select('user_id')
          .eq('tenant_id', currentTenant.id)
          .eq('is_active', true);

        if (!tenantMemberships?.length) {
          setEmployees([]); setLeaves({}); setPendingLeaves([]); setLoading(false);
          return;
        }

        const tenantUserIds = tenantMemberships.map(m => m.user_id);

        const { data: roles, error: rErr } = await supabase
          .from("user_roles")
          .select("user_id, role")
          .in("user_id", tenantUserIds);
        if (rErr) throw rErr;

        const managedIds = (roles || [])
          .filter((r: any) => ["mitarbeiter", "praktikant", "bueroleitung"].includes(r.role))
          .map((r: any) => r.user_id);

        if (managedIds.length === 0) {
          setEmployees([]); setLeaves({}); setPendingLeaves([]); setLoading(false);
          return;
        }

        const [profilesRes, settingsRes, leaveRes, pendingRes, sickRes, meetingRequestsRes, lastMeetingsRes] = await Promise.all([
          supabase.from("profiles").select("user_id, display_name, avatar_url").in("user_id", managedIds),
          supabase.from("employee_settings")
            .select("user_id, hours_per_week, timezone, workdays, admin_id, annual_vacation_days, employment_start_date, hours_per_month, days_per_month, days_per_week, last_meeting_date, meeting_interval_months, next_meeting_reminder_days, carry_over_days, carry_over_expires_at")
            .in("user_id", managedIds),
          supabase.from("leave_requests").select("user_id, type, status, start_date").in("user_id", managedIds),
          supabase.from("leave_requests").select("id, user_id, type, status, start_date, end_date")
            .in("status", ["pending", "cancel_requested"] as any).in("user_id", managedIds),
          supabase.from("sick_days").select("user_id").in("user_id", managedIds),
          supabase.from("employee_meeting_requests").select("employee_id").eq("status", "pending").in("employee_id", managedIds),
          supabase.from("employee_meetings").select("id, employee_id, meeting_date").in("employee_id", managedIds).order("meeting_date", { ascending: false }),
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

        const lastMeetingMap = new Map<string, string>();
        (lastMeetingsRes.data || []).forEach((m: any) => {
          if (!lastMeetingMap.has(m.employee_id)) lastMeetingMap.set(m.employee_id, m.id);
        });

        const meetingRequestCounts: Record<string, number> = {};
        (meetingRequestsRes.data || []).forEach((req: any) => {
          meetingRequestCounts[req.employee_id] = (meetingRequestCounts[req.employee_id] || 0) + 1;
        });
        setPendingRequestsCount((meetingRequestsRes.data || []).length);

        const joined: Employee[] = managedIds.map((uid) => {
          const s = settingsMap.get(uid);
          const p = profileMap.get(uid);
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
            carry_over_days: s?.carry_over_days ?? 0,
          } as Employee;
        });
        setEmployees(joined);

        // Aggregate leaves
        const agg: Record<string, LeaveAgg> = {};
        const { data: fullLeaveData } = await supabase
          .from("leave_requests")
          .select("user_id, type, status, start_date, end_date")
          .in("user_id", managedIds)
          .gte("start_date", startOfYear(new Date()).toISOString())
          .lte("start_date", endOfYear(new Date()).toISOString());

        (fullLeaveData || []).forEach((lr: any) => {
          if (!agg[lr.user_id]) agg[lr.user_id] = initLeaveAgg();
          const workingDays = lr.end_date ? calculateWorkingDays(lr.start_date, lr.end_date) : 1;
          if (lr.status === "approved") agg[lr.user_id].approved[lr.type] += workingDays;
          if (lr.status === "pending") agg[lr.user_id].pending[lr.type] += workingDays;
          agg[lr.user_id].counts[lr.type] += workingDays;
          const curr = agg[lr.user_id].lastDates[lr.type];
          if (!curr || new Date(lr.start_date) > new Date(curr)) agg[lr.user_id].lastDates[lr.type] = lr.start_date;
        });
        setLeaves(agg);

        const sickCount: Record<string, number> = {};
        (sickRes.data || []).forEach((sick: any) => { sickCount[sick.user_id] = (sickCount[sick.user_id] || 0) + 1; });
        setSickDays(sickCount);

        const pendingWithNames: PendingLeaveRequest[] = (pendingRes.data || []).map((req: any) => ({
          id: req.id, user_id: req.user_id,
          user_name: profileMap.get(req.user_id)?.display_name || "Unbekannt",
          type: req.type, start_date: req.start_date, end_date: req.end_date, status: req.status,
        }));
        setPendingLeaves(pendingWithNames);
      } catch (e: any) {
        debugConsole.error(e);
        toast({ title: "Fehler beim Laden", description: e?.message ?? "Daten konnten nicht geladen werden.", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user, currentTenant, toast]);

  // Load self data for non-admin users
  useEffect(() => {
    if (!user || isAdmin) return;

    const checkEmployeeStatus = async () => {
      const { data: hasSettings } = await supabase
        .from('employee_settings').select('user_id').eq('user_id', user.id).maybeSingle();
      if (!hasSettings) {
        const { data: profileData } = await supabase.from("profiles").select("user_id, display_name, avatar_url").eq("user_id", user.id).single();
        setSelfProfile(profileData as Profile || null);
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
          supabase.from("employee_meetings").select("id").eq("employee_id", user.id).order("meeting_date", { ascending: false }).limit(1).maybeSingle(),
        ]);

        if (settingsRes.error) { debugConsole.error(settingsRes.error); toast({ title: "Fehler", description: "Fehler beim Laden der Mitarbeitereinstellungen", variant: "destructive" }); return; }
        if (profileRes.error) { debugConsole.error(profileRes.error); toast({ title: "Fehler", description: "Fehler beim Laden des Profils", variant: "destructive" }); return; }
        if (leavesRes.error) { debugConsole.error(leavesRes.error); toast({ title: "Fehler", description: "Fehler beim Laden der Urlaubsanträge", variant: "destructive" }); return; }

        if (!settingsRes.data) {
          toast({ title: "Keine Mitarbeitereinstellungen", description: "Falls der Administrator soeben Daten eingetragen hat, laden Sie die Seite neu (F5).", variant: "destructive" });
        } else {
          toast({ title: "Daten geladen", description: "Mitarbeitereinstellungen erfolgreich geladen." });
        }

        setSelfSettings((settingsRes.data as EmployeeSettingsRow) || null);
        setSelfProfile((profileRes.data as Profile) || null);
        setSelfLastMeetingId(lastMeetingRes.data?.id || null);

        const agg = initLeaveAgg();
        const { data: fullLeaveData } = await supabase
          .from("leave_requests").select("type, status, start_date, end_date").eq("user_id", user.id)
          .gte("start_date", startOfYear(new Date()).toISOString()).lte("start_date", endOfYear(new Date()).toISOString());

        (fullLeaveData || []).forEach((lr: any) => {
          const workingDays = lr.end_date ? calculateWorkingDays(lr.start_date, lr.end_date) : 1;
          if (lr.status === "approved") agg.approved[lr.type] += workingDays;
          if (lr.status === "pending") agg.pending[lr.type] += workingDays;
          agg.counts[lr.type] += workingDays;
          const curr = agg.lastDates[lr.type];
          if (!curr || new Date(lr.start_date) > new Date(curr)) agg.lastDates[lr.type] = lr.start_date;
        });
        setSelfLeaveAgg(agg);
      } catch (e: any) {
        console.error(e);
        toast({ title: "Fehler beim Laden", description: e?.message ?? "Eigene Daten konnten nicht geladen werden.", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };

    checkEmployeeStatus();
  }, [user, isAdmin, toast]);

  return {
    isAdmin, loading, employees, setEmployees, leaves, pendingLeaves, setPendingLeaves,
    sickDays, pendingRequestsCount, setPendingRequestsCount,
    selfSettings, selfLeaveAgg, selfProfile, selfLastMeetingId,
  };
}
