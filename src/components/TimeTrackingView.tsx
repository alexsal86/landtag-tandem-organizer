import { useEffect, useMemo, useState } from "react";
import { addDays, differenceInCalendarDays, eachDayOfInterval, endOfMonth, isAfter, isBefore, isWithinInterval, parseISO, startOfMonth } from "date-fns";
import { de } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, PlusCircle } from "lucide-react";

interface TimeEntryRow {
  id: string;
  work_date: string; // date
  started_at: string | null;
  ended_at: string | null;
  minutes: number;
  notes: string | null;
}

interface EmployeeSettingsRow {
  user_id: string;
  hours_per_month: number;
  days_per_month: number;
  employment_start_date: string | null;
  annual_vacation_days: number;
  carry_over_days: number;
}

interface LeaveRow {
  id: string;
  type: string; // 'sick' | 'vacation' | 'other'
  status: string; // 'pending' | 'approved' | ...
  start_date: string; // date
  end_date: string; // date
}

export function TimeTrackingView() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [entries, setEntries] = useState<TimeEntryRow[]>([]);
  const [settings, setSettings] = useState<EmployeeSettingsRow | null>(null);
  const [leaves, setLeaves] = useState<LeaveRow[]>([]);

  const [date, setDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState<string>("09:00");
  const [endTime, setEndTime] = useState<string>("17:00");
  const [pauseMinutes, setPauseMinutes] = useState<string>("30");
  const [notes, setNotes] = useState<string>("");

  // Urlaub beantragen – Formularzustand
  const [leaveStart, setLeaveStart] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [leaveEnd, setLeaveEnd] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [leaveReason, setLeaveReason] = useState<string>("");
  const [leaveSubmitting, setLeaveSubmitting] = useState(false);
  
  // Krankmeldung – Formularzustand
  const [sickDate, setSickDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [sickSubmitting, setSickSubmitting] = useState(false);

  const monthStart = startOfMonth(new Date());
  const monthEnd = endOfMonth(new Date());

  useEffect(() => {
    // SEO
    document.title = "Zeiterfassung & Urlaub – LandtagsOS";
    const metaDescription = document.querySelector('meta[name="description"]');
    if (!metaDescription) {
      const meta = document.createElement("meta");
      meta.name = "description";
      meta.content = "Zeiterfassung mit Start/Ende, automatische Dauer und Urlaubsübersicht mit Übertrag und Anteiligkeit.";
      document.head.appendChild(meta);
    } else {
      metaDescription.setAttribute("content", "Zeiterfassung mit Start/Ende, automatische Dauer und Urlaubsübersicht mit Übertrag und Anteiligkeit.");
    }
    // canonical
    const linkCanonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!linkCanonical) {
      const link = document.createElement("link");
      link.rel = "canonical";
      link.href = window.location.href;
      document.head.appendChild(link);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoading(true);
      try {
        const { data: entriesData, error: entriesErr } = await supabase
          .from("time_entries")
          .select("id, work_date, started_at, ended_at, minutes, notes")
          .gte("work_date", monthStart.toISOString().slice(0, 10))
          .lte("work_date", monthEnd.toISOString().slice(0, 10))
          .eq("user_id", user.id)
          .order("work_date", { ascending: false });
        if (entriesErr) throw entriesErr;

        const { data: settingsData, error: settingsErr } = await supabase
          .from("employee_settings")
          .select("user_id, hours_per_month, days_per_month, employment_start_date, annual_vacation_days, carry_over_days")
          .eq("user_id", user.id)
          .maybeSingle();
        if (settingsErr) throw settingsErr;

        const { data: leavesData, error: leavesErr } = await supabase
          .from("leave_requests")
          .select("id, type, status, start_date, end_date")
          .eq("user_id", user.id)
          .lte("start_date", monthEnd.toISOString().slice(0,10))
          .gte("end_date", monthStart.toISOString().slice(0,10));
        if (leavesErr) throw leavesErr;

        setEntries(entriesData || []);
        setSettings(settingsData as any);
        setLeaves(leavesData || []);
      } catch (e: any) {
        toast({ title: "Fehler beim Laden", description: e.message, variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user]);

  const [dailyHours, setDailyHours] = useState<number>(0);
  useEffect(() => {
    if (!user) return;
    const fetchDaily = async () => {
      const { data, error } = await supabase.rpc("get_daily_hours", { _user_id: user.id });
      if (error) {
        console.warn("get_daily_hours error", error.message);
      }
      let dh = (data as number) || 0;
      if ((!dh || dh <= 0) && settings) {
        dh = settings.hours_per_month / Math.max(1, settings.days_per_month);
      }
      setDailyHours(dh || 0);
    };
    fetchDaily();
  }, [user, settings]);

  const totals = useMemo(() => {
    const workedMin = entries.reduce((acc, e) => acc + (e.minutes || 0), 0);

    // Count approved sick days within current month and multiply by dailyHours
    const sickDays = leaves
      .filter(l => l.type === "sick" && l.status === "approved")
      .reduce((acc, l) => {
        const s = parseISO(l.start_date);
        const e = parseISO(l.end_date);
        const days = eachDayOfInterval({ start: s, end: e })
          .filter(d => isWithinInterval(d, { start: monthStart, end: monthEnd }))
          .filter(d => {
            const dow = d.getDay();
            return dow !== 0 && dow !== 6; // weekdays only
          }).length;
        return acc + days;
      }, 0);

    const sickMin = Math.round((dailyHours * 60) * sickDays);

    return {
      workedMin,
      sickMin,
      totalMin: workedMin + sickMin,
      sickDays,
    };
  }, [entries, leaves, dailyHours, monthStart, monthEnd]);

  const vacation = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const annual = settings?.annual_vacation_days || 0;
    const carry = settings?.carry_over_days || 0;

    // Determine prorated entitlement for current year based on employment_start_date
    let prorated = annual;
    if (settings?.employment_start_date) {
      const start = parseISO(settings.employment_start_date);
      if (start.getFullYear() === currentYear) {
        const startMonth = start.getMonth(); // 0-based
        const monthsEligible = 12 - startMonth; // inclusive current month
        prorated = Math.round((annual * monthsEligible) / 12);
      } else if (start.getFullYear() > currentYear) {
        prorated = 0;
      }
    }

    // Calculate approved vacation days taken this year (weekdays only)
    const vacDaysTaken = leaves
      .filter(l => l.type === "vacation" && l.status === "approved")
      .reduce((acc, l) => {
        const s = parseISO(l.start_date);
        const e = parseISO(l.end_date);
        const days = eachDayOfInterval({ start: s, end: e })
          .filter(d => d.getFullYear() === currentYear)
          .filter(d => {
            const dow = d.getDay();
            return dow !== 0 && dow !== 6;
          }).length;
        return acc + days;
      }, 0);

    const entitlement = prorated + carry;
    const remaining = Math.max(0, entitlement - vacDaysTaken);

    return { annual, carry, prorated, entitlement, vacDaysTaken, remaining };
  }, [settings, leaves]);

  const onSubmit = async () => {
    if (!user) return;
    setSubmitting(true);
    try {
      if (!date || !startTime || !endTime) {
        throw new Error("Bitte Datum, Start- und Endzeit angeben.");
      }
      const start = new Date(`${date}T${startTime}:00`);
      const end = new Date(`${date}T${endTime}:00`);
      if (end <= start) throw new Error("Ende muss nach Start liegen.");

      // Calculate total minutes worked minus pause
      const totalMinutes = Math.floor((end.getTime() - start.getTime()) / (1000 * 60));
      const pause = parseInt(pauseMinutes) || 0;
      const workedMinutes = Math.max(0, totalMinutes - pause);

      const { error } = await supabase.from("time_entries").insert({
        user_id: user.id,
        work_date: date,
        started_at: start.toISOString(),
        ended_at: end.toISOString(),
        minutes: workedMinutes,
        notes: notes ? `${notes} (Pause: ${pause} Min)` : `Pause: ${pause} Min`,
      });
      if (error) throw error;

      toast({ title: "Erfasst", description: `Zeit wurde gespeichert. Arbeitszeit: ${workedMinutes} Min (${pause} Min Pause abgezogen)` });

      // reload entries
      const { data: entriesData, error: entriesErr } = await supabase
        .from("time_entries")
        .select("id, work_date, started_at, ended_at, minutes, notes")
        .gte("work_date", monthStart.toISOString().slice(0, 10))
        .lte("work_date", monthEnd.toISOString().slice(0, 10))
        .eq("user_id", user.id)
        .order("work_date", { ascending: false });
      if (entriesErr) throw entriesErr;
      setEntries(entriesData || []);

      // reset form
      setNotes("");
      setPauseMinutes("30");
    } catch (e: any) {
      toast({ title: "Fehler", description: e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const submitLeave = async () => {
    if (!user) return;
    setLeaveSubmitting(true);
    try {
      if (!leaveStart || !leaveEnd) throw new Error("Bitte Start- und Enddatum wählen.");
      const s = new Date(`${leaveStart}T00:00:00`);
      const e = new Date(`${leaveEnd}T00:00:00`);
      if (e < s) throw new Error("Ende muss nach Start liegen.");

      // Get user profile for display name
      const { data: userProfile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("user_id", user.id)
        .single();

      // Get tenant information
      const { data: tenantData } = await supabase
        .from("user_tenant_memberships")
        .select("tenant_id")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .limit(1)
        .single();

      if (!tenantData) {
        throw new Error("Kein Tenant gefunden");
      }

      const { error } = await supabase.from("leave_requests").insert({
        user_id: user.id,
        type: "vacation",
        start_date: leaveStart,
        end_date: leaveEnd,
        reason: leaveReason || null,
      });
      if (error) throw error;

      // Create calendar entry for the request (pending status)
      const userName = userProfile?.display_name || "Mitarbeiter";
      const { error: calendarError } = await supabase
        .from("appointments")
        .insert({
          user_id: user.id,
          tenant_id: tenantData.tenant_id,
          start_time: new Date(`${leaveStart}T00:00:00`).toISOString(),
          end_time: new Date(`${leaveEnd}T23:59:59`).toISOString(),
          title: `Anfrage Urlaub von ${userName}`,
          description: `Urlaubsantrag eingereicht${leaveReason ? ` - Grund: ${leaveReason}` : ''}`,
          category: "vacation_request",
          priority: "medium",
          status: "pending",
          is_all_day: true
        });

      if (calendarError) {
        console.error("Fehler beim Erstellen des Kalendereintrags:", calendarError);
      }

      toast({ title: "Antrag gesendet", description: "Urlaubsantrag wurde eingereicht und in den Kalender eingetragen." });

      // Reload leaves for current month
      const { data: leavesData, error: leavesErr } = await supabase
        .from("leave_requests")
        .select("id, type, status, start_date, end_date")
        .eq("user_id", user.id)
        .lte("start_date", monthEnd.toISOString().slice(0,10))
        .gte("end_date", monthStart.toISOString().slice(0,10));
      if (leavesErr) throw leavesErr;
      setLeaves(leavesData || []);

      setLeaveReason("");
    } catch (e: any) {
      toast({ title: "Fehler", description: e.message, variant: "destructive" });
    } finally {
      setLeaveSubmitting(false);
    }
  };

  const submitSick = async () => {
    if (!user) return;
    setSickSubmitting(true);
    try {
      if (!sickDate) throw new Error("Bitte Datum wählen.");

      const { error } = await supabase.from("sick_days").insert({
        user_id: user.id,
        sick_date: sickDate,
      });
      if (error) throw error;

      toast({ title: "Krankmeldung gesendet", description: "Krankmeldung wurde erfasst." });

      setSickDate(new Date().toISOString().slice(0, 10));
    } catch (e: any) {
      toast({ title: "Fehler", description: e.message, variant: "destructive" });
    } finally {
      setSickSubmitting(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <header className="sr-only">
        <h1>Zeiterfassung und Urlaub</h1>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Gearbeitet (Monat)</CardTitle>
            <CardDescription>Summe erfasster Zeiten</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-8 flex items-center"><Loader2 className="h-4 w-4 animate-spin" /></div>
            ) : (
              <div className="text-2xl font-semibold">
                {(totals.workedMin / 60).toFixed(1)} Std
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Krank (angerechnet)</CardTitle>
            <CardDescription>{totals.sickDays} Tage × {dailyHours.toFixed(2)} Std</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-8 flex items-center"><Loader2 className="h-4 w-4 animate-spin" /></div>
            ) : (
              <div className="text-2xl font-semibold">
                {(totals.sickMin / 60).toFixed(1)} Std
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Gesamt (inkl. Krank)</CardTitle>
            <CardDescription>Dieser Monat</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-8 flex items-center"><Loader2 className="h-4 w-4 animate-spin" /></div>
            ) : (
              <div className="text-2xl font-semibold">
                {(totals.totalMin / 60).toFixed(1)} Std
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Neue Zeit erfassen</CardTitle>
            <CardDescription>Start/Ende eingeben, Pause wird abgezogen, Nettodauer wird gespeichert.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
              <div>
                <Label htmlFor="date">Datum</Label>
                <Input id="date" type="date" value={date} onChange={e => setDate(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="start">Start</Label>
                <Input id="start" type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="end">Ende</Label>
                <Input id="end" type="time" value={endTime} onChange={e => setEndTime(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="pause">Pause (Min)</Label>
                <Input 
                  id="pause" 
                  type="number" 
                  min="0" 
                  max="480" 
                  value={pauseMinutes} 
                  onChange={e => setPauseMinutes(e.target.value)} 
                  placeholder="30"
                />
              </div>
              <div className="md:col-span-1">
                <Label htmlFor="notes">Notiz</Label>
                <Input id="notes" placeholder="optional" value={notes} onChange={e => setNotes(e.target.value)} />
              </div>
              <div className="md:col-span-5">
                <Button onClick={onSubmit} disabled={submitting} className="w-full">
                  {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                  Speichern
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Urlaubskonto</CardTitle>
            <CardDescription>Übertrag & Anteiligkeit ab Startdatum</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {settings ? (
              <div className="space-y-1">
                <div className="flex justify-between"><span>Jahresanspruch</span><span>{vacation.annual} Tage</span></div>
                <div className="flex justify-between"><span>Übertrag</span><span>{vacation.carry} Tage</span></div>
                <div className="flex justify-between"><span>Anteilig (dieses Jahr)</span><span>{vacation.prorated} Tage</span></div>
                <div className="flex justify-between"><span>Genommen (bewilligt)</span><span>{vacation.vacDaysTaken} Tage</span></div>
                <div className="flex justify-between font-semibold"><span>Verfügbar</span><span>{vacation.remaining} Tage</span></div>
              </div>
            ) : (
              <div className="text-muted-foreground">Keine Mitarbeiter-Einstellungen gefunden.</div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Urlaub beantragen</CardTitle>
            <CardDescription>Zeitraum wählen und optionalen Grund angeben</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div>
                <Label htmlFor="leaveStart">Start</Label>
                <Input id="leaveStart" type="date" value={leaveStart} onChange={e => setLeaveStart(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="leaveEnd">Ende</Label>
                <Input id="leaveEnd" type="date" value={leaveEnd} onChange={e => setLeaveEnd(e.target.value)} />
              </div>
              <div className="md:col-span-1">
                <Label htmlFor="leaveReason">Grund (optional)</Label>
                <Input id="leaveReason" placeholder="z. B. Sommerurlaub" value={leaveReason} onChange={e => setLeaveReason(e.target.value)} />
              </div>
              <div className="md:col-span-3">
                <Button onClick={submitLeave} disabled={leaveSubmitting} className="w-full">
                  {leaveSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                  Urlaubsantrag einreichen
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Krankmeldung</CardTitle>
            <CardDescription>Krankheitstag direkt erfassen (keine Genehmigung erforderlich)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
              <div>
                <Label htmlFor="sickDate">Krankheitstag</Label>
                <Input id="sickDate" type="date" value={sickDate} onChange={e => setSickDate(e.target.value)} />
              </div>
              <div>
                <Button onClick={submitSick} disabled={sickSubmitting} className="w-full">
                  {sickSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                  Krankmeldung erfassen
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Urlaubsanträge (dieser Monat)</CardTitle>
            <CardDescription>Eigene Anträge mit Status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Start</TableHead>
                    <TableHead>Ende</TableHead>
                    <TableHead>Typ</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leaves.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">Keine Anträge</TableCell>
                    </TableRow>
                  )}
                  {leaves.map(l => (
                    <TableRow key={l.id}>
                      <TableCell>{l.start_date}</TableCell>
                      <TableCell>{l.end_date}</TableCell>
                      <TableCell>{l.type}</TableCell>
                      <TableCell>{l.status}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Einträge (dieser Monat)</CardTitle>
          <CardDescription>Start, Ende, Dauer und Notizen</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Datum</TableHead>
                  <TableHead>Start</TableHead>
                  <TableHead>Ende</TableHead>
                  <TableHead>Dauer (Min)</TableHead>
                  <TableHead>Notiz</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">Keine Einträge</TableCell>
                  </TableRow>
                )}
                {entries.map(e => (
                  <TableRow key={e.id}>
                    <TableCell>{e.work_date}</TableCell>
                    <TableCell>{e.started_at ? new Date(e.started_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : '-'}</TableCell>
                    <TableCell>{e.ended_at ? new Date(e.ended_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : '-'}</TableCell>
                    <TableCell>{e.minutes}</TableCell>
                    <TableCell>{e.notes || ''}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default TimeTrackingView;
