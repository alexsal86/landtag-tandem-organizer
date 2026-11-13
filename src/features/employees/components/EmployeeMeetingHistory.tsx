import { useCallback, useEffect, useState } from "react";
import { mentionColors } from "@/utils/mentionColors";
import { getHashedColor } from "@/utils/userColors";
import { debugConsole } from '@/utils/debugConsole';
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { FileText, Loader2, Plus, Trash2 } from "lucide-react";
import { notify } from "@/lib/notify";

interface Meeting {
  id: string;
  employee_id: string;
  conducted_by: string;
  meeting_date: string;
  meeting_type: string;
  status: string;
  next_meeting_due: string | null;
  employee_name?: string;
  employee_avatar_url?: string | null;
  employee_badge_color?: string | null;
  conductor_name?: string;
  open_action_items?: number;
  total_action_items?: number;
}

interface EmployeeMeetingHistoryProps {
  employeeId?: string; // Optional: Filter by specific employee
  showFilters?: boolean;
  refreshTrigger?: number;
  onScheduleMeeting?: () => void;
}

export function EmployeeMeetingHistory({ employeeId, showFilters = true, refreshTrigger = 0, onScheduleMeeting }: EmployeeMeetingHistoryProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const [loading, setLoading] = useState(true);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [employeeFilter, setEmployeeFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [deletingMeetingId, setDeletingMeetingId] = useState<string | null>(null);

  const loadMeetings = useCallback(async () => {
    if (!user || !currentTenant) return;
    setLoading(true);
    try {
      let query = supabase
        .from("employee_meetings")
        .select(`
          id,
          employee_id,
          conducted_by,
          meeting_date,
          meeting_type,
          status,
          next_meeting_due
        `)
        .eq("tenant_id", currentTenant.id)
        .order("meeting_date", { ascending: false });

      if (employeeId) {
        query = query.eq("employee_id", employeeId);
      }

      const { data: meetingsData, error: meetingsError } = await query;
      if (meetingsError) throw meetingsError;

      // Get all unique user IDs
      const userIds = new Set<string>();
      meetingsData?.forEach((m) => {
        userIds.add(m.employee_id);
        userIds.add(m.conducted_by);
      });

      // Fetch profiles
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name, avatar_url, badge_color")
        .in("user_id", Array.from(userIds));

      type P = { user_id: string; display_name: string | null; avatar_url: string | null; badge_color: string | null };
      const profileMap = new Map<string, P>((profiles as P[] | null)?.map((profile) => [profile.user_id, profile]) || []);

      // Fetch action items counts
      const meetingIds = meetingsData?.map((m) => m.id) || [];
      const { data: actionItems } = await supabase
        .from("employee_meeting_action_items")
        .select("meeting_id, status")
        .in("meeting_id", meetingIds);

      const actionItemsMap = new Map<string, { open: number; total: number }>();
      actionItems?.forEach((item) => {
        const existing = actionItemsMap.get(item.meeting_id) || { open: 0, total: 0 };
        existing.total += 1;
        if (item.status !== "completed") {
          existing.open += 1;
        }
        actionItemsMap.set(item.meeting_id, existing);
      });

      // Combine data
      const enrichedMeetings: Meeting[] = (meetingsData || []).map((m) => ({
        ...m,
        employee_name: profileMap.get(m.employee_id)?.display_name || "Unbekannt",
        employee_avatar_url: profileMap.get(m.employee_id)?.avatar_url,
        employee_badge_color: profileMap.get(m.employee_id)?.badge_color,
        conductor_name: profileMap.get(m.conducted_by)?.display_name || "Unbekannt",
        open_action_items: actionItemsMap.get(m.id)?.open || 0,
        total_action_items: actionItemsMap.get(m.id)?.total || 0,
      }));

      setMeetings(enrichedMeetings);
    } catch (error: unknown) {
      debugConsole.error("Error loading meetings:", error);
      notify.error("Fehler", {
        description: "Meetings konnten nicht geladen werden"
});
    } finally {
      setLoading(false);
    }
  }, [currentTenant, employeeId, user]);

  useEffect(() => {
    if (!user || !currentTenant) return;
    loadMeetings();
  }, [user, currentTenant, refreshTrigger, loadMeetings]);

  const handleDeleteMeeting = async (meetingId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (deletingMeetingId) return;

    setDeletingMeetingId(meetingId);
    try {
      const { error } = await supabase.rpc("delete_employee_meeting", {
        p_meeting_id: meetingId,
      });

      if (error) throw error;

      setMeetings((prev) => prev.filter((m) => m.id !== meetingId));
      notify.success("Gespräch gelöscht", {
        description: "Das Mitarbeitergespräch wurde erfolgreich entfernt."
});
    } catch (error) {
      debugConsole.error("Error deleting meeting:", error);
      notify.error("Fehler", {
        description: "Das Gespräch konnte nicht gelöscht werden. Es wurden keine Teil-Löschungen übernommen."
});
    } finally {
      setDeletingMeetingId(null);
    }
  };

  const getMeetingTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      regular: "Regulär",
      annual_review: "Jahresgespräch",
      probation_review: "Probezeitgespräch",
      development_review: "Entwicklungsgespräch",
      probation: "Probezeit",
      development: "Entwicklung",
      performance: "Leistung",
      conflict: "Konflikt",
    };
    return labels[type] || type;
  };

  const isCancelled = (status: string) => status === "cancelled" || status === "cancelled_by_employee";
  const getStatusBadge = (status: string) => {
    const labels: Record<string, string> = {
      scheduled: "Geplant",
      in_progress: "In Bearbeitung",
      completed: "Abgeschlossen",
      pending_acknowledgement: "Bestätigung offen",
      acknowledged: "Bestätigt",
      cancelled: "Abgesagt",
      cancelled_by_employee: "Vom MA abgesagt",
      rescheduled: "Umterminiert",
    };
    const color = isCancelled(status)
      ? "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300"
      : status === "completed"
        ? "bg-lime-50 text-lime-700 dark:bg-lime-950/40 dark:text-lime-300"
        : status === "in_progress"
          ? "bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300"
          : "bg-muted text-muted-foreground";
    return (
      <Badge variant="outline" className={`gap-1.5 rounded-full border-0 px-3 py-1 font-medium ${color}`}>
        <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
        {labels[status] || status}
      </Badge>
    );
  };

  const employeeOptions = Array.from(new Map(meetings.map(meeting => [
    meeting.employee_id, meeting.employee_name || "Unbekannt",
  ])).entries()).sort((a, b) => a[1].localeCompare(b[1], "de"));
  const typeOptions = Array.from(new Set([
    "regular", "probation", "development", "performance", "conflict",
    ...meetings.map(meeting => meeting.meeting_type),
  ]));
  const filteredMeetings = meetings.filter(meeting =>
    (statusFilter === "all" || (statusFilter === "cancelled" ? isCancelled(meeting.status) : meeting.status === statusFilter)) &&
    (typeFilter === "all" || meeting.meeting_type === typeFilter) &&
    (employeeId || employeeFilter === "all" || meeting.employee_id === employeeFilter),
  );
  const groups = new Map<string, { label: string; meetings: Meeting[] }>();
  filteredMeetings.forEach(meeting => {
    const date = new Date(meeting.meeting_date);
    const key = format(date, "yyyy-MM");
    const group = groups.get(key) ?? { label: format(date, "MMMM yyyy", { locale: de }), meetings: [] };
    group.meetings.push(meeting);
    groups.set(key, group);
  });
  const statusOptions = [
    { value: "all", label: "Alle" },
    { value: "in_progress", label: "In Bearbeitung" },
    { value: "completed", label: "Abgeschlossen" },
    { value: "pending_acknowledgement", label: "Bestätigung offen" },
    { value: "acknowledged", label: "Bestätigt" },
    { value: "cancelled", label: "Abgesagt" },
    ...(["scheduled", "rescheduled"].filter(status => meetings.some(meeting => meeting.status === status)).map(status => ({
      value: status, label: status === "scheduled" ? "Geplant" : "Umterminiert",
    }))),
  ];
  const summary = [
    `${meetings.length} ${meetings.length === 1 ? "Gespräch" : "Gespräche"}`,
    ...[
      { count: meetings.filter(meeting => meeting.status === "in_progress").length, label: "in Bearbeitung" },
      { count: meetings.filter(meeting => meeting.status === "completed").length, label: "abgeschlossen" },
      { count: meetings.filter(meeting => isCancelled(meeting.status)).length, label: "abgesagt" },
    ].filter(item => item.count > 0).map(item => `${item.count} ${item.label}`),
  ].join(" · ");

  return (
    <Card className="overflow-hidden rounded-2xl shadow-none">
      <CardHeader className="gap-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <CardTitle className="text-xl">Gesprächshistorie</CardTitle>
            {!loading && <p className="mt-1 text-sm text-muted-foreground">{summary}</p>}
          </div>
          {onScheduleMeeting && (
            <Button onClick={onScheduleMeeting} className="gap-2 rounded-xl bg-lime-600 text-white hover:bg-lime-700">
              <Plus className="h-4 w-4" />Gespräch planen
            </Button>
          )}
        </div>
        {showFilters && (
          <div className="flex flex-wrap items-center gap-2">
            <div role="group" aria-label="Nach Gesprächsstatus filtern" className="flex flex-wrap gap-2">
              {statusOptions.map(option => (
                <Button key={option.value} variant="outline" size="sm" aria-pressed={statusFilter === option.value}
                  onClick={() => setStatusFilter(option.value)}
                  className={`rounded-full px-3 font-medium ${statusFilter === option.value ? "border-lime-600 bg-lime-50 text-lime-700 hover:bg-lime-100 dark:bg-lime-950/40 dark:text-lime-300" : "text-muted-foreground"}`}>
                  {option.label}
                </Button>
              ))}
            </div>
            <span aria-hidden="true" className="mx-1 hidden h-6 w-px bg-border sm:block" />
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger aria-label="Nach Gesprächstyp filtern" className="h-9 w-full rounded-xl sm:w-44"><SelectValue placeholder="Alle Typen" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Typen</SelectItem>
                {typeOptions.map(type => <SelectItem key={type} value={type}>{getMeetingTypeLabel(type)}</SelectItem>)}
              </SelectContent>
            </Select>
            {!employeeId && (
              <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
                <SelectTrigger aria-label="Nach Mitarbeiter filtern" className="h-9 w-full rounded-xl sm:w-48"><SelectValue placeholder="Alle Mitarbeitenden" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Mitarbeitenden</SelectItem>
                  {employeeOptions.map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>
        )}
      </CardHeader>
      <CardContent className="p-0" aria-busy={loading}>
        {loading ? (
          <div role="status" className="flex items-center justify-center gap-2 p-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />Gespräche werden geladen …
          </div>
        ) : filteredMeetings.length === 0 ? (
          <div role="status" className="border-t py-10 text-center text-muted-foreground">
            <FileText className="mx-auto mb-2 h-10 w-10 opacity-50" />
            <p>{meetings.length === 0 ? "Noch keine Gespräche vorhanden." : "Keine Gespräche für diese Filter gefunden."}</p>
          </div>
        ) : Array.from(groups.entries()).map(([key, group]) => (
          <section key={key} aria-label={group.label}>
            <h3 className="border-t bg-muted/40 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:px-6">{group.label}</h3>
            <ul>
              {group.meetings.map(meeting => {
                const cancelled = isCancelled(meeting.status);
                const date = new Date(meeting.meeting_date);
                const total = meeting.total_action_items ?? 0;
                const open = meeting.open_action_items ?? 0;
                const completed = total - open;
                const avatarColor = mentionColors(meeting.employee_badge_color || getHashedColor(meeting.employee_id));
                return (
                  <li key={meeting.id} className="grid grid-cols-1 items-center gap-4 border-t px-5 py-4 hover:bg-muted/20 sm:grid-cols-2 sm:px-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
                    <div className={`flex min-w-0 items-center gap-3 ${cancelled ? "opacity-50" : ""}`}>
                      <time dateTime={meeting.meeting_date} aria-label={format(date, "dd.MM.yyyy")} className="w-14 shrink-0 rounded-xl border bg-card py-2 text-center">
                        <span className={`block text-xl font-semibold leading-none ${cancelled ? "line-through" : ""}`}>{format(date, "dd")}</span>
                        <span className="mt-1 block text-xs uppercase text-muted-foreground">{format(date, "MMM", { locale: de }).slice(0, 3)}</span>
                      </time>
                      <div className="flex min-w-0 items-center gap-2.5">
                        <Avatar className="h-9 w-9 shrink-0">
                          <AvatarImage src={meeting.employee_avatar_url ?? undefined} alt={meeting.employee_name || "Mitarbeiter"} />
                          <AvatarFallback className="text-xs font-semibold" style={{ backgroundColor: avatarColor.background, color: avatarColor.text }}>{(meeting.employee_name || "?").slice(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="break-words font-semibold">{meeting.employee_name}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">{getMeetingTypeLabel(meeting.meeting_type)} · <span title="Durchgeführt von">{meeting.conductor_name}</span></p>
                        </div>
                      </div>
                    </div>
                    <div>{getStatusBadge(meeting.status)}</div>
                    <div className={`space-y-2 ${cancelled ? "opacity-50" : ""}`}>
                      <div>
                        <p className="text-xs text-muted-foreground">Nächstes Gespräch</p>
                        <p className="text-sm">{meeting.next_meeting_due ? format(new Date(meeting.next_meeting_due), "dd.MM.yyyy", { locale: de }) : "–"}</p>
                      </div>
                      <div className="flex items-center gap-2" title={`${open} offene Action Items`}>
                        <div role="progressbar" aria-label="Abgeschlossene Action Items" aria-valuemin={0} aria-valuemax={Math.max(total, 1)} aria-valuenow={completed} aria-valuetext={`${completed} von ${total} Action Items abgeschlossen`} className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full bg-lime-600" style={{ width: `${total > 0 ? completed / total * 100 : 0}%` }} />
                        </div>
                        <span className={`text-xs text-muted-foreground ${total === 0 ? "opacity-60" : ""}`}>{completed}/{total} erledigt</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 lg:justify-end">
                      <Button variant="outline" size="sm" className="rounded-xl" onClick={() => navigate(`/employee-meeting/${meeting.id}`)}>Öffnen</Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" aria-label={`Gespräch mit ${meeting.employee_name} vom ${format(date, "dd.MM.yyyy")} löschen`} className="h-8 w-8 rounded-xl text-muted-foreground hover:text-destructive" disabled={deletingMeetingId !== null}>
                            {deletingMeetingId === meeting.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Gespräch löschen?</AlertDialogTitle>
                            <AlertDialogDescription>Dieses Mitarbeitergespräch wird unwiderruflich gelöscht, einschließlich aller zugehörigen Bewertungen und Action Items.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={event => handleDeleteMeeting(meeting.id, event)} disabled={deletingMeetingId !== null}>
                              {deletingMeetingId === meeting.id ? "Lösche..." : "Löschen"}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </CardContent>
    </Card>
  );
}
