import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";

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

type Employee = EmployeeSettingsRow & Profile;

type LeaveAgg = {
  counts: Record<LeaveType, number>;
  lastDates: Partial<Record<LeaveType, string>>;
  approved: Record<LeaveType, number>;
  pending: Record<LeaveType, number>;
};

export function EmployeesView() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [leaves, setLeaves] = useState<Record<string, LeaveAgg>>({});
  const [pendingLeaves, setPendingLeaves] = useState<PendingLeaveRequest[]>([]);
  const [editingHours, setEditingHours] = useState<string | null>(null);
  const [tempHours, setTempHours] = useState<number>(0);
  const [editingVacationDays, setEditingVacationDays] = useState<string | null>(null);
  const [tempVacationDays, setTempVacationDays] = useState<number>(0);
  const [editingStartDate, setEditingStartDate] = useState<string | null>(null);
  const [tempStartDate, setTempStartDate] = useState<string>("");
  const [sickDays, setSickDays] = useState<Record<string, number>>({});

  // Self-view state for non-admin users
  const [selfSettings, setSelfSettings] = useState<EmployeeSettingsRow | null>(null);
  const [selfLeaveAgg, setSelfLeaveAgg] = useState<LeaveAgg | null>(null);
  const [selfProfile, setSelfProfile] = useState<Profile | null>(null);

  // SEO basics
  useEffect(() => {
    document.title = "Mitarbeiterverwaltung | Admin";
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
      if (!user) return;
      setLoading(true);
      try {
        // Alle Nicht-Admin-Benutzer (Rollen: Mitarbeiter, Praktikant, Büroleitung)
        const { data: roles, error: rErr } = await supabase
          .from("user_roles")
          .select("user_id, role");
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

        const [profilesRes, settingsRes, leaveRes, pendingRes, sickRes] = await Promise.all([
          supabase.from("profiles").select("user_id, display_name, avatar_url").in("user_id", managedIds),
          supabase
            .from("employee_settings")
            .select("user_id, hours_per_week, timezone, workdays, admin_id, annual_vacation_days, employment_start_date")
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
        ]);
        if (sickRes.error) throw sickRes.error;
        if (profilesRes.error) throw profilesRes.error;
        if (settingsRes.error) throw settingsRes.error;
        if (leaveRes.error) throw leaveRes.error;
        if (pendingRes.error) throw pendingRes.error;

        const profileMap = new Map<string, Profile>();
        (profilesRes.data as Profile[] | null)?.forEach((p) => profileMap.set(p.user_id, p));

        const settingsMap = new Map<string, EmployeeSettingsRow>();
        (settingsRes.data as any[] | null)?.forEach((s) => settingsMap.set(s.user_id, s as EmployeeSettingsRow));

        const joined: Employee[] = managedIds.map((uid) => {
          const s = settingsMap.get(uid);
          const p = profileMap.get(uid);
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
          } as Employee;
        });
        setEmployees(joined);

        // Abwesenheiten aggregieren (RLS erlaubt nur Zugriff auf zugewiesene Nutzer)
        const agg: Record<string, LeaveAgg> = {};
        const initAgg = (): LeaveAgg => ({
          counts: { vacation: 0, sick: 0, other: 0 },
          approved: { vacation: 0, sick: 0, other: 0 },
          pending: { vacation: 0, sick: 0, other: 0 },
          lastDates: {},
        });

        ((leaveRes.data as LeaveRow[] | null) || []).forEach((lr) => {
          if (!agg[lr.user_id]) agg[lr.user_id] = initAgg();
          agg[lr.user_id].counts[lr.type]++;
          if (lr.status === "approved") agg[lr.user_id].approved[lr.type]++;
          if (lr.status === "pending") agg[lr.user_id].pending[lr.type]++;
          const curr = agg[lr.user_id].lastDates[lr.type];
          if (!curr || new Date(lr.start_date) > new Date(curr as string)) {
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
  }, [user, toast]);

  // Load self data for non-admin users
  useEffect(() => {
    if (!user || isAdmin) return;
    const loadSelf = async () => {
      setLoading(true);
      try {
        const [settingsRes, profileRes, leavesRes] = await Promise.all([
          supabase
            .from("employee_settings")
            .select("user_id, hours_per_week, timezone, workdays")
            .eq("user_id", user.id)
            .maybeSingle(),
          supabase
            .from("profiles")
            .select("user_id, display_name, avatar_url")
            .eq("user_id", user.id)
            .maybeSingle(),
          supabase
            .from("leave_requests")
            .select("user_id, type, status, start_date")
            .eq("user_id", user.id),
        ]);

        if (settingsRes.error) throw settingsRes.error;
        if (profileRes.error) throw profileRes.error;
        if (leavesRes.error) throw leavesRes.error;

        setSelfSettings((settingsRes.data as EmployeeSettingsRow) || null);
        setSelfProfile((profileRes.data as Profile) || null);

        const agg: LeaveAgg = {
          counts: { vacation: 0, sick: 0, other: 0 },
          approved: { vacation: 0, sick: 0, other: 0 },
          pending: { vacation: 0, sick: 0, other: 0 },
          lastDates: {},
        };
        (leavesRes.data as LeaveRow[] | null)?.forEach((lr) => {
          agg.counts[lr.type]++;
          if (lr.status === "approved") agg.approved[lr.type]++;
          if (lr.status === "pending") agg.pending[lr.type]++;
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
    loadSelf();
  }, [user, isAdmin, toast]);

  // Urlaubsantrag freigeben/ablehnen
  const handleLeaveAction = async (leaveId: string, action: "approved" | "rejected") => {
    try {
      const { error } = await supabase
        .from("leave_requests")
        .update({ status: action })
        .eq("id", leaveId);

      if (error) throw error;

      toast({
        title: action === "approved" ? "Antrag genehmigt" : "Antrag abgelehnt",
        description: "Der Urlaubsantrag wurde aktualisiert.",
      });

      // Reload data
      if (!user) return;
      setLoading(true);
      try {
        const { data: roles, error: rErr } = await supabase
          .from("user_roles")
          .select("user_id, role");
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

        const [profilesRes, settingsRes, leaveRes, pendingRes] = await Promise.all([
          supabase.from("profiles").select("user_id, display_name, avatar_url").in("user_id", managedIds),
          supabase
            .from("employee_settings")
            .select("user_id, hours_per_week, timezone, workdays, admin_id, annual_vacation_days, employment_start_date")
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
        ]);
        if (profilesRes.error) throw profilesRes.error;
        if (settingsRes.error) throw settingsRes.error;
        if (leaveRes.error) throw leaveRes.error;
        if (pendingRes.error) throw pendingRes.error;

        const profileMap = new Map<string, Profile>();
        (profilesRes.data as Profile[] | null)?.forEach((p) => profileMap.set(p.user_id, p));

        const settingsMap = new Map<string, EmployeeSettingsRow>();
        (settingsRes.data as any[] | null)?.forEach((s) => settingsMap.set(s.user_id, s as EmployeeSettingsRow));

        const joined: Employee[] = managedIds.map((uid) => {
          const s = settingsMap.get(uid);
          const p = profileMap.get(uid);
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
          } as Employee;
        });
        setEmployees(joined);

        const agg: Record<string, LeaveAgg> = {};
        const initAgg = (): LeaveAgg => ({
          counts: { vacation: 0, sick: 0, other: 0 },
          approved: { vacation: 0, sick: 0, other: 0 },
          pending: { vacation: 0, sick: 0, other: 0 },
          lastDates: {},
        });

        ((leaveRes.data as LeaveRow[] | null) || []).forEach((lr) => {
          if (!agg[lr.user_id]) agg[lr.user_id] = initAgg();
          agg[lr.user_id].counts[lr.type]++;
          if (lr.status === "approved") agg[lr.user_id].approved[lr.type]++;
          if (lr.status === "pending") agg[lr.user_id].pending[lr.type]++;
          const curr = agg[lr.user_id].lastDates[lr.type];
          if (!curr || new Date(lr.start_date) > new Date(curr as string)) {
            agg[lr.user_id].lastDates[lr.type] = lr.start_date;
          }
        });

        setLeaves(agg);

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
    } catch (e: any) {
      console.error(e);
      toast({
        title: "Fehler",
        description: e?.message ?? "Antrag konnte nicht aktualisiert werden.",
        variant: "destructive",
      });
    }
  };

  // Stunden pro Woche bearbeiten
  const startEditHours = (userId: string, currentHours: number) => {
    setEditingHours(userId);
    setTempHours(currentHours);
  };

  const saveHours = async (userId: string) => {
    if (tempHours < 1 || tempHours > 60) {
      toast({
        title: "Ungültige Eingabe",
        description: "Stunden müssen zwischen 1 und 60 liegen.",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from("employee_settings")
        .upsert({ 
          user_id: userId, 
          hours_per_week: tempHours,
          admin_id: user?.id 
        });

      if (error) throw error;

      setEditingHours(null);
      toast({
        title: "Gespeichert",
        description: "Stunden pro Woche wurden aktualisiert.",
      });

      // Reload data
      if (!user) return;
      setLoading(true);
      try {
        const { data: roles, error: rErr } = await supabase
          .from("user_roles")
          .select("user_id, role");
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

        const [profilesRes, settingsRes] = await Promise.all([
          supabase.from("profiles").select("user_id, display_name, avatar_url").in("user_id", managedIds),
          supabase
            .from("employee_settings")
            .select("user_id, hours_per_week, timezone, workdays, admin_id, annual_vacation_days, employment_start_date")
            .in("user_id", managedIds),
        ]);
        if (profilesRes.error) throw profilesRes.error;
        if (settingsRes.error) throw settingsRes.error;

        const profileMap = new Map<string, Profile>();
        (profilesRes.data as Profile[] | null)?.forEach((p) => profileMap.set(p.user_id, p));

        const settingsMap = new Map<string, EmployeeSettingsRow>();
        (settingsRes.data as any[] | null)?.forEach((s) => settingsMap.set(s.user_id, s as EmployeeSettingsRow));

        const joined: Employee[] = managedIds.map((uid) => {
          const s = settingsMap.get(uid);
          const p = profileMap.get(uid);
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
          } as Employee;
        });
        setEmployees(joined);
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
    } catch (e: any) {
      console.error(e);
      toast({
        title: "Fehler",
        description: e?.message ?? "Stunden konnten nicht gespeichert werden.",
        variant: "destructive",
      });
    }
  };

  const cancelEditHours = () => {
    setEditingHours(null);
    setTempHours(0);
  };

  // Urlaubstage bearbeiten
  const startEditVacationDays = (userId: string, currentDays: number) => {
    setEditingVacationDays(userId);
    setTempVacationDays(currentDays);
  };

  const saveVacationDays = async (userId: string) => {
    if (tempVacationDays < 0 || tempVacationDays > 365) {
      toast({
        title: "Ungültige Eingabe",
        description: "Urlaubstage müssen zwischen 0 und 365 liegen.",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from("employee_settings")
        .upsert({ 
          user_id: userId, 
          annual_vacation_days: tempVacationDays,
          admin_id: user?.id 
        });

      if (error) throw error;

      setEditingVacationDays(null);
      toast({
        title: "Gespeichert",
        description: "Urlaubstage wurden aktualisiert.",
      });

      // Update local state
      setEmployees(prev => prev.map(emp => 
        emp.user_id === userId 
          ? { ...emp, annual_vacation_days: tempVacationDays }
          : emp
      ));
    } catch (e: any) {
      console.error(e);
      toast({
        title: "Fehler",
        description: e?.message ?? "Urlaubstage konnten nicht gespeichert werden.",
        variant: "destructive",
      });
    }
  };

  const cancelEditVacationDays = () => {
    setEditingVacationDays(null);
    setTempVacationDays(0);
  };

  // Startdatum bearbeiten
  const startEditStartDate = (userId: string, currentDate: string | null) => {
    setEditingStartDate(userId);
    setTempStartDate(currentDate || "2025-01-01");
  };

  const saveStartDate = async (userId: string) => {
    try {
      const { error } = await supabase
        .from("employee_settings")
        .upsert({ 
          user_id: userId, 
          employment_start_date: tempStartDate,
          admin_id: user?.id 
        });

      if (error) throw error;

      setEditingStartDate(null);
      toast({
        title: "Gespeichert",
        description: "Startdatum wurde aktualisiert.",
      });

      // Update local state
      setEmployees(prev => prev.map(emp => 
        emp.user_id === userId 
          ? { ...emp, employment_start_date: tempStartDate }
          : emp
      ));
    } catch (e: any) {
      console.error(e);
      toast({
        title: "Fehler",
        description: e?.message ?? "Startdatum konnte nicht gespeichert werden.",
        variant: "destructive",
      });
    }
  };

  const cancelEditStartDate = () => {
    setEditingStartDate(null);
    setTempStartDate("");
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
                <div className="text-2xl font-semibold">{selfSettings?.hours_per_week ?? '–'}</div>
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
                  <div className="flex justify-between"><span>Zeitzone</span><span>{selfSettings?.timezone ?? '–'}</span></div>
                  <div className="flex justify-between"><span>Arbeitstage/Woche</span><span>{selfSettings?.workdays ? selfSettings.workdays.filter((w) => w).length : '–'}</span></div>
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
        </section>
      </main>
    );
  }

  return (
    <main>
      <header className="p-4 sm:p-6">
        <h1 className="text-2xl font-semibold">Mitarbeiterverwaltung</h1>
        <p className="text-muted-foreground">Überblick über Mitarbeitende, Stunden & Abwesenheiten</p>
      </header>

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
                    <TableHead>Aktionen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingLeaves.map((req) => (
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
                  ))}
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
                    <TableHead>Stunden/Woche</TableHead>
                    <TableHead>Tage/Woche</TableHead>
                    <TableHead>Urlaubstage/Jahr</TableHead>
                    <TableHead>Beginn Arbeitsverhältnis</TableHead>
                    <TableHead>Krankentage</TableHead>
                    <TableHead>Urlaub (Anträge / genehmigt)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employees.map((e) => {
                    const a = leaves[e.user_id];
                    const sickCount = a?.counts.sick ?? 0;
                    const sickApproved = a?.approved.sick ?? 0;
                    const vacCount = a?.counts.vacation ?? 0;
                    const vacApproved = a?.approved.vacation ?? 0;

                    const lastDate = [
                      a?.lastDates.sick,
                      a?.lastDates.vacation,
                      a?.lastDates.other,
                    ]
                      .filter(Boolean)
                      .sort((d1: any, d2: any) => (new Date(d2 as string).getTime() - new Date(d1 as string).getTime()))[0];

                    const lastStr = lastDate
                      ? new Date(lastDate as string).toLocaleDateString("de-DE")
                      : "–";

                    const workingDays = e.workdays.filter((w) => w).length;

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
                              <span className="text-xs text-muted-foreground">{e.timezone}</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {editingHours === e.user_id ? (
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                value={tempHours}
                                onChange={(e) => setTempHours(Number(e.target.value))}
                                className="w-20"
                                min="1"
                                max="60"
                              />
                              <Button size="sm" onClick={() => saveHours(e.user_id)}>
                                ✓
                              </Button>
                              <Button size="sm" variant="outline" onClick={cancelEditHours}>
                                ✕
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary">{e.hours_per_week} h</Badge>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => startEditHours(e.user_id, e.hours_per_week)}
                              >
                                ✏️
                              </Button>
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{workingDays}</Badge>
                        </TableCell>
                        <TableCell>
                          {editingVacationDays === e.user_id ? (
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                value={tempVacationDays}
                                onChange={(e) => setTempVacationDays(Number(e.target.value))}
                                className="w-20"
                                min="0"
                                max="365"
                              />
                              <Button size="sm" onClick={() => saveVacationDays(e.user_id)}>
                                ✓
                              </Button>
                              <Button size="sm" variant="outline" onClick={cancelEditVacationDays}>
                                ✕
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary">{e.annual_vacation_days} Tage</Badge>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => startEditVacationDays(e.user_id, e.annual_vacation_days)}
                              >
                                ✏️
                              </Button>
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {editingStartDate === e.user_id ? (
                            <div className="flex items-center gap-2">
                              <Input
                                type="date"
                                value={tempStartDate}
                                onChange={(e) => setTempStartDate(e.target.value)}
                                className="w-40"
                              />
                              <Button size="sm" onClick={() => saveStartDate(e.user_id)}>
                                ✓
                              </Button>
                              <Button size="sm" variant="outline" onClick={cancelEditStartDate}>
                                ✕
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span>{e.employment_start_date ? new Date(e.employment_start_date).toLocaleDateString("de-DE") : "01.01.2025"}</span>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => startEditStartDate(e.user_id, e.employment_start_date)}
                              >
                                ✏️
                              </Button>
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{sickDays[e.user_id] || 0} Tage</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span>{vacCount}</span>
                            <Badge variant="outline">{vacApproved} genehmigt</Badge>
                          </div>
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
    </main>
  );
}