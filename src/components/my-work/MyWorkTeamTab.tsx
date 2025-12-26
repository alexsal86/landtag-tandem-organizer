import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Users, ExternalLink, Clock, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { format, differenceInDays } from "date-fns";
import { de } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface TeamMember {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  hours_per_week: number;
  last_meeting_date: string | null;
  next_meeting_due: string | null;
  open_meeting_requests: number;
}

export function MyWorkTeamTab() {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const navigate = useNavigate();
  
  const [isAdmin, setIsAdmin] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      checkAdminAndLoad();
    }
  }, [user, currentTenant]);

  const checkAdminAndLoad = async () => {
    if (!user) return;

    try {
      // Check if user is admin
      const { data: adminCheck } = await supabase.rpc("is_admin", { _user_id: user.id });
      setIsAdmin(!!adminCheck);

      if (!adminCheck || !currentTenant) {
        setLoading(false);
        return;
      }

      // Get tenant users with employee roles
      const { data: memberships } = await supabase
        .from("user_tenant_memberships")
        .select("user_id")
        .eq("tenant_id", currentTenant.id)
        .eq("is_active", true);

      if (!memberships?.length) {
        setTeamMembers([]);
        setLoading(false);
        return;
      }

      const userIds = memberships.map(m => m.user_id);

      // Get roles
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", userIds);

      const employeeIds = (roles || [])
        .filter(r => ["mitarbeiter", "praktikant", "bueroleitung"].includes(r.role))
        .map(r => r.user_id);

      if (employeeIds.length === 0) {
        setTeamMembers([]);
        setLoading(false);
        return;
      }

      // Get profiles and settings
      const [profilesRes, settingsRes, requestsRes] = await Promise.all([
        supabase.from("profiles").select("user_id, display_name, avatar_url").in("user_id", employeeIds),
        supabase.from("employee_settings").select("user_id, hours_per_week, last_meeting_date, meeting_interval_months").in("user_id", employeeIds),
        supabase.from("employee_meeting_requests").select("employee_id").eq("status", "pending").in("employee_id", employeeIds),
      ]);

      const profileMap = new Map(profilesRes.data?.map(p => [p.user_id, p]) || []);
      const settingsMap = new Map(settingsRes.data?.map(s => [s.user_id, s]) || []);
      
      // Count open requests per employee
      const requestCounts: Record<string, number> = {};
      (requestsRes.data || []).forEach((req: any) => {
        requestCounts[req.employee_id] = (requestCounts[req.employee_id] || 0) + 1;
      });

      const members: TeamMember[] = employeeIds.map(uid => {
        const profile = profileMap.get(uid);
        const settings = settingsMap.get(uid);
        
        let next_meeting_due: string | null = null;
        if (settings?.last_meeting_date && settings?.meeting_interval_months) {
          const lastMeeting = new Date(settings.last_meeting_date);
          const nextDue = new Date(lastMeeting);
          nextDue.setMonth(nextDue.getMonth() + settings.meeting_interval_months);
          next_meeting_due = nextDue.toISOString();
        }

        return {
          user_id: uid,
          display_name: profile?.display_name || null,
          avatar_url: profile?.avatar_url || null,
          hours_per_week: settings?.hours_per_week || 40,
          last_meeting_date: settings?.last_meeting_date || null,
          next_meeting_due,
          open_meeting_requests: requestCounts[uid] || 0,
        };
      });

      // Sort by next meeting due (urgent first)
      members.sort((a, b) => {
        if (a.open_meeting_requests > 0 && b.open_meeting_requests === 0) return -1;
        if (a.open_meeting_requests === 0 && b.open_meeting_requests > 0) return 1;
        if (a.next_meeting_due && b.next_meeting_due) {
          return new Date(a.next_meeting_due).getTime() - new Date(b.next_meeting_due).getTime();
        }
        return 0;
      });

      setTeamMembers(members);
    } catch (error) {
      console.error("Error loading team:", error);
    } finally {
      setLoading(false);
    }
  };

  const getMeetingStatus = (nextDue: string | null) => {
    if (!nextDue) return null;
    const daysUntil = differenceInDays(new Date(nextDue), new Date());
    if (daysUntil < 0) return { label: "Überfällig", variant: "destructive" as const };
    if (daysUntil <= 14) return { label: "Bald fällig", variant: "secondary" as const };
    return null;
  };

  if (loading) {
    return (
      <div className="space-y-2 p-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-muted animate-pulse rounded-md" />
        ))}
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="text-center py-8 text-muted-foreground p-4">
        <Users className="h-10 w-10 mx-auto mb-2 opacity-50" />
        <p>Mitarbeiterbereich</p>
        <p className="text-sm">Nur für Administratoren verfügbar</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[500px]">
      <div className="space-y-2 p-4">
        {teamMembers.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p>Keine Mitarbeiter</p>
          </div>
        ) : (
          teamMembers.map((member) => {
            const meetingStatus = getMeetingStatus(member.next_meeting_due);
            
            return (
              <div
                key={member.user_id}
                className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
              >
                <Avatar className="h-9 w-9">
                  <AvatarImage src={member.avatar_url || undefined} />
                  <AvatarFallback>
                    {member.display_name?.charAt(0) || "?"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">
                      {member.display_name || "Unbekannt"}
                    </span>
                    {member.open_meeting_requests > 0 && (
                      <Badge variant="destructive" className="text-xs">
                        {member.open_meeting_requests} Anfrage{member.open_meeting_requests > 1 ? "n" : ""}
                      </Badge>
                    )}
                    {meetingStatus && (
                      <Badge variant={meetingStatus.variant} className="text-xs">
                        {meetingStatus.label}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {member.hours_per_week}h/Woche
                    </span>
                    {member.last_meeting_date && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Letztes Gespräch: {format(new Date(member.last_meeting_date), "dd.MM.yyyy", { locale: de })}
                      </span>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 flex-shrink-0"
                  onClick={() => navigate("/employee")}
                >
                  <ExternalLink className="h-3 w-3" />
                </Button>
              </div>
            );
          })
        )}
      </div>
    </ScrollArea>
  );
}
