import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
};

type Profile = {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
};

type LeaveRow = {
  user_id: string;
  type: LeaveType;
  status: LeaveStatus;
  start_date: string; // ISO date
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
          setLoading(false);
          return;
        }

        const [profilesRes, settingsRes, leaveRes] = await Promise.all([
          supabase.from("profiles").select("user_id, display_name, avatar_url").in("user_id", managedIds),
          supabase
            .from("employee_settings")
            .select("user_id, hours_per_week, timezone, workdays, admin_id")
            .in("user_id", managedIds),
          supabase
            .from("leave_requests")
            .select("user_id, type, status, start_date")
            .in("user_id", managedIds),
        ]);
        if (profilesRes.error) throw profilesRes.error;
        if (settingsRes.error) throw settingsRes.error;
        if (leaveRes.error) throw leaveRes.error;

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
                    <TableHead>Krank (Anträge / genehmigt)</TableHead>
                    <TableHead>Urlaub (Anträge / genehmigt)</TableHead>
                    <TableHead>Letzte Abwesenheit</TableHead>
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
                          <Badge variant="secondary">{e.hours_per_week} h</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span>{sickCount}</span>
                            <Badge variant="outline">{sickApproved} genehmigt</Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span>{vacCount}</span>
                            <Badge variant="outline">{vacApproved} genehmigt</Badge>
                          </div>
                        </TableCell>
                        <TableCell>{lastStr}</TableCell>
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
