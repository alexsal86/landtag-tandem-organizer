import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { Calendar, Clock, FileText, Loader2 } from "lucide-react";

interface Meeting {
  id: string;
  employee_id: string;
  conducted_by: string;
  meeting_date: string;
  meeting_type: string;
  status: string;
  next_meeting_due: string | null;
  employee_name?: string;
  conductor_name?: string;
  open_action_items?: number;
  total_action_items?: number;
}

interface EmployeeMeetingHistoryProps {
  employeeId?: string; // Optional: Filter by specific employee
  showFilters?: boolean;
}

export function EmployeeMeetingHistory({ employeeId, showFilters = true }: EmployeeMeetingHistoryProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  useEffect(() => {
    if (!user || !currentTenant) return;
    loadMeetings();
  }, [user, currentTenant, employeeId, statusFilter, typeFilter]);

  const loadMeetings = async () => {
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

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      if (typeFilter !== "all") {
        query = query.eq("meeting_type", typeFilter);
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
        .select("user_id, display_name")
        .in("user_id", Array.from(userIds));

      const profileMap = new Map(profiles?.map((p) => [p.user_id, p.display_name]) || []);

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
        employee_name: profileMap.get(m.employee_id) || "Unbekannt",
        conductor_name: profileMap.get(m.conducted_by) || "Unbekannt",
        open_action_items: actionItemsMap.get(m.id)?.open || 0,
        total_action_items: actionItemsMap.get(m.id)?.total || 0,
      }));

      setMeetings(enrichedMeetings);
    } catch (error: any) {
      console.error("Error loading meetings:", error);
      toast({
        title: "Fehler",
        description: "Meetings konnten nicht geladen werden",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getMeetingTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      regular: "Regulär",
      probation: "Probezeit",
      development: "Entwicklung",
      performance: "Leistung",
      conflict: "Konflikt",
    };
    return labels[type] || type;
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
      scheduled: "default",
      in_progress: "secondary",
      completed: "outline",
      cancelled: "destructive",
      cancelled_by_employee: "destructive",
      rescheduled: "secondary",
    };
    const labels: Record<string, string> = {
      scheduled: "Geplant",
      in_progress: "In Bearbeitung",
      completed: "Abgeschlossen",
      cancelled: "Abgesagt",
      cancelled_by_employee: "Vom MA abgesagt",
      rescheduled: "Umterminiert",
    };
    return (
      <Badge variant={variants[status] || "default"}>
        {labels[status] || status}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Gesprächshistorie</CardTitle>
          {showFilters && (
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Status filtern" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Status</SelectItem>
                  <SelectItem value="scheduled">Geplant</SelectItem>
                  <SelectItem value="in_progress">In Bearbeitung</SelectItem>
                  <SelectItem value="completed">Abgeschlossen</SelectItem>
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Typ filtern" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Typen</SelectItem>
                  <SelectItem value="regular">Regulär</SelectItem>
                  <SelectItem value="probation">Probezeit</SelectItem>
                  <SelectItem value="development">Entwicklung</SelectItem>
                  <SelectItem value="performance">Leistung</SelectItem>
                  <SelectItem value="conflict">Konflikt</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {meetings.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>Keine Gespräche gefunden</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Datum</TableHead>
                <TableHead>Typ</TableHead>
                <TableHead>Status</TableHead>
                {!employeeId && <TableHead>Mitarbeiter</TableHead>}
                <TableHead>Durchgeführt von</TableHead>
                <TableHead>Nächstes Gespräch</TableHead>
                <TableHead>Action Items</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {meetings.map((meeting) => (
                <TableRow
                  key={meeting.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => navigate(`/employee-meeting/${meeting.id}`)}
                >
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="font-medium">
                          {format(new Date(meeting.meeting_date), "dd.MM.yyyy", { locale: de })}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(meeting.meeting_date), "HH:mm", { locale: de })} Uhr
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{getMeetingTypeLabel(meeting.meeting_type)}</TableCell>
                  <TableCell>{getStatusBadge(meeting.status)}</TableCell>
                  {!employeeId && <TableCell>{meeting.employee_name}</TableCell>}
                  <TableCell>{meeting.conductor_name}</TableCell>
                  <TableCell>
                    {meeting.next_meeting_due ? (
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        {format(new Date(meeting.next_meeting_due), "dd.MM.yyyy", { locale: de })}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">–</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Badge variant={meeting.open_action_items > 0 ? "default" : "outline"}>
                        {meeting.open_action_items}/{meeting.total_action_items}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/employee-meeting/${meeting.id}`);
                      }}
                    >
                      Öffnen
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
