import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Users, ExternalLink, Clock, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { format, differenceInDays, startOfWeek } from "date-fns";
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
  weekly_worked_minutes: number;
  weekly_target_minutes: number;
  last_time_entry_date: string | null;
}

// Work time indicator component
function WorkTimeIndicator({ worked, target, lastEntry }: { 
  worked: number; 
  target: number; 
  lastEntry: string | null;
}) {
  const percentage = target > 0 ? (worked / target) * 100 : 0;
  
  const getColorClass = () => {
    if (worked === 0) return "bg-muted-foreground/30";
    if (percentage < 25) return "bg-destructive";
    if (percentage < 50) return "bg-orange-500";
    if (percentage < 80) return "bg-yellow-500";
    if (percentage <= 100) return "bg-green-500";
    return "bg-blue-500"; // Überstunden
  };

  const getLabel = () => {
    if (worked === 0) return "Keine Einträge";
    if (percentage < 25) return "Wenig erfasst";
    if (percentage < 50) return "Untererfasst";
    if (percentage < 80) return "In Arbeit";
    if (percentage <= 100) return "Gut erfasst";
    return "Überstunden";
  };
  
  const workedHours = (worked / 60).toFixed(1).replace(".", ",");
  const targetHours = (target / 60).toFixed(0);
  const today = new Date();
  const dayName = format(today, "EEEE", { locale: de });
  
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={cn("w-2.5 h-2.5 rounded-full flex-shrink-0 cursor-help", getColorClass())} />
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        <p className="font-medium">Diese Woche: {workedHours} von {targetHours}h</p>
        <p className="text-muted-foreground">
          {percentage.toFixed(0)}% – {getLabel()} (Stand: {dayName})
        </p>
        {lastEntry && (
          <p className="text-muted-foreground">
            Letzter Eintrag: {format(new Date(lastEntry), "dd.MM.yyyy", { locale: de })}
          </p>
        )}
      </TooltipContent>
    </Tooltip>
  );
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

      // Calculate current week range (Monday to today)
      const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
      const today = new Date();

      // Get profiles, settings, requests, and time entries
      const [profilesRes, settingsRes, requestsRes, timeEntriesRes] = await Promise.all([
        supabase.from("profiles").select("user_id, display_name, avatar_url").in("user_id", employeeIds),
        supabase.from("employee_settings").select("user_id, hours_per_week, last_meeting_date, meeting_interval_months").in("user_id", employeeIds),
        supabase.from("employee_meeting_requests").select("employee_id").eq("status", "pending").in("employee_id", employeeIds),
        supabase.from("time_entries").select("user_id, minutes, work_date").in("user_id", employeeIds)
          .gte("work_date", format(weekStart, "yyyy-MM-dd"))
          .lte("work_date", format(today, "yyyy-MM-dd")),
      ]);

      const profileMap = new Map(profilesRes.data?.map(p => [p.user_id, p]) || []);
      const settingsMap = new Map(settingsRes.data?.map(s => [s.user_id, s]) || []);
      
      // Count open requests per employee
      const requestCounts: Record<string, number> = {};
      (requestsRes.data || []).forEach((req: any) => {
        requestCounts[req.employee_id] = (requestCounts[req.employee_id] || 0) + 1;
      });

      // Sum weekly minutes and find last entry per employee
      const weeklyMinutes: Record<string, number> = {};
      const lastTimeEntry: Record<string, string> = {};
      (timeEntriesRes.data || []).forEach((entry: any) => {
        weeklyMinutes[entry.user_id] = (weeklyMinutes[entry.user_id] || 0) + entry.minutes;
        if (!lastTimeEntry[entry.user_id] || entry.work_date > lastTimeEntry[entry.user_id]) {
          lastTimeEntry[entry.user_id] = entry.work_date;
        }
      });

      // Calculate target minutes based on days passed in week
      const dayOfWeek = today.getDay() === 0 ? 7 : today.getDay(); // 1=Mon, 7=Sun
      const workDaysPassed = Math.min(dayOfWeek, 5); // Max 5 work days

      const members: TeamMember[] = employeeIds.map(uid => {
        const profile = profileMap.get(uid);
        const settings = settingsMap.get(uid);
        const hoursPerWeek = settings?.hours_per_week || 40;
        
        let next_meeting_due: string | null = null;
        if (settings?.last_meeting_date && settings?.meeting_interval_months) {
          const lastMeeting = new Date(settings.last_meeting_date);
          const nextDue = new Date(lastMeeting);
          nextDue.setMonth(nextDue.getMonth() + settings.meeting_interval_months);
          next_meeting_due = nextDue.toISOString();
        }

        // Calculate proportional target for days passed
        const dailyMinutes = (hoursPerWeek * 60) / 5;
        const targetMinutesSoFar = dailyMinutes * workDaysPassed;

        return {
          user_id: uid,
          display_name: profile?.display_name || null,
          avatar_url: profile?.avatar_url || null,
          hours_per_week: hoursPerWeek,
          last_meeting_date: settings?.last_meeting_date || null,
          next_meeting_due,
          open_meeting_requests: requestCounts[uid] || 0,
          weekly_worked_minutes: weeklyMinutes[uid] || 0,
          weekly_target_minutes: targetMinutesSoFar,
          last_time_entry_date: lastTimeEntry[uid] || null,
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
                    <WorkTimeIndicator 
                      worked={member.weekly_worked_minutes} 
                      target={member.weekly_target_minutes}
                      lastEntry={member.last_time_entry_date}
                    />
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
