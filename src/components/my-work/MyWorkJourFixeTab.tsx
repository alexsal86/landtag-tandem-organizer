import { useState, useEffect, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ChevronDown, ChevronRight, Calendar, ExternalLink, Clock, List, StickyNote, Users, ListTodo, Globe, Cake, Scale } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { cn } from "@/lib/utils";
import { addDays, format, isToday, isPast, parseISO } from "date-fns";
import { de } from "date-fns/locale";

interface MeetingParticipant {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface Meeting {
  id: string;
  title: string;
  meeting_date: string;
  meeting_time?: string | null;
  status: string;
  description?: string | null;
  is_public?: boolean;
  user_id?: string;
}

interface AgendaItem {
  id: string;
  title: string;
  parent_id: string | null;
  order_index: number;
  system_type?: string | null;
}

interface SystemItemData {
  id: string;
  title: string;
  user_id?: string;
}

interface UserProfileData {
  user_id: string;
  display_name: string | null;
}

interface BirthdayItemData {
  id: string;
  name: string;
  birthDate: Date;
  nextBirthday: Date;
  age: number;
}

export function MyWorkJourFixeTab() {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [upcomingMeetings, setUpcomingMeetings] = useState<Meeting[]>([]);
  const [pastMeetings, setPastMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [upcomingOpen, setUpcomingOpen] = useState(true);
  const [pastOpen, setPastOpen] = useState(false);
  
  // State for expandable agenda
  const [expandedMeetingId, setExpandedMeetingId] = useState<string | null>(null);
  const [agendaItems, setAgendaItems] = useState<Record<string, AgendaItem[]>>({});
  const [loadingAgenda, setLoadingAgenda] = useState<string | null>(null);
  
  // State for meeting participants
  const [meetingParticipants, setMeetingParticipants] = useState<Record<string, MeetingParticipant[]>>({});

  // State for system item data (notes and tasks per meeting)
  const [meetingQuickNotes, setMeetingQuickNotes] = useState<Record<string, SystemItemData[]>>({});
  const [meetingTasks, setMeetingTasks] = useState<Record<string, SystemItemData[]>>({});
  const [meetingDecisions, setMeetingDecisions] = useState<Record<string, SystemItemData[]>>({});
  const [meetingBirthdays, setMeetingBirthdays] = useState<Record<string, BirthdayItemData[]>>({});
  const [userProfiles, setUserProfiles] = useState<Record<string, UserProfileData>>({});
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Handle action parameter from URL
  useEffect(() => {
    const action = searchParams.get('action');
    if (action === 'create-meeting') {
      searchParams.delete('action');
      setSearchParams(searchParams, { replace: true });
      navigate('/meetings?action=create-meeting');
    }
  }, [searchParams, setSearchParams, navigate]);

  useEffect(() => {
    if (user) {
      loadMeetings();
    }
  }, [user]);

  // Load participants when meetings are loaded
  useEffect(() => {
    const allMeetingIds = [...upcomingMeetings, ...pastMeetings].map(m => m.id);
    if (allMeetingIds.length > 0) {
      loadParticipantsForMeetings(allMeetingIds);
    }
  }, [upcomingMeetings, pastMeetings]);

  const loadMeetings = async () => {
    if (!user) return;
    
    try {
      const now = new Date().toISOString();
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const selectFields = "id, title, meeting_date, meeting_time, status, description, is_public, user_id";
      
      // 1. Own meetings (creator) - upcoming
      const { data: ownUpcoming } = await supabase
        .from("meetings")
        .select(selectFields)
        .eq("user_id", user.id)
        .neq("status", "archived")
        .gte("meeting_date", now)
        .order("meeting_date", { ascending: true })
        .limit(20);

      // 2. Own meetings (creator) - past
      const { data: ownPast } = await supabase
        .from("meetings")
        .select(selectFields)
        .eq("user_id", user.id)
        .neq("status", "archived")
        .lt("meeting_date", now)
        .gte("meeting_date", thirtyDaysAgo.toISOString())
        .order("meeting_date", { ascending: false })
        .limit(10);

      // 3. Participant meetings (where user is added as participant)
      const { data: participantData } = await supabase
        .from("meeting_participants")
        .select(`meeting_id, meetings(${selectFields})`)
        .eq("user_id", user.id);

      // 4. Public meetings in tenant
      const { data: publicMeetings } = await supabase
        .from("meetings")
        .select(selectFields)
        .eq("is_public", true)
        .neq("status", "archived")
        .gte("meeting_date", thirtyDaysAgo.toISOString());

      // Combine and deduplicate
      const ownIds = new Set([
        ...(ownUpcoming || []).map(m => m.id),
        ...(ownPast || []).map(m => m.id)
      ]);
      
      const participantMeetings = (participantData || [])
        .filter((p: any) => p.meetings && !ownIds.has(p.meetings.id) && p.meetings.status !== 'archived')
        .map((p: any) => p.meetings as Meeting);
      
      const allIds = new Set([...ownIds, ...participantMeetings.map(m => m.id)]);
      const publicExtra = (publicMeetings || []).filter(m => !allIds.has(m.id));
      
      const allMeetings: Meeting[] = [
        ...(ownUpcoming || []),
        ...(ownPast || []),
        ...participantMeetings,
        ...publicExtra
      ];

      // Split into upcoming/past and deduplicate by id
      const seenIds = new Set<string>();
      const deduped = allMeetings.filter(m => {
        if (seenIds.has(m.id)) return false;
        seenIds.add(m.id);
        return true;
      });

      const upcoming = deduped
        .filter(m => new Date(m.meeting_date) >= new Date(now))
        .sort((a, b) => new Date(a.meeting_date).getTime() - new Date(b.meeting_date).getTime())
        .slice(0, 20);

      const past = deduped
        .filter(m => new Date(m.meeting_date) < new Date(now))
        .sort((a, b) => new Date(b.meeting_date).getTime() - new Date(a.meeting_date).getTime())
        .slice(0, 10);

      if (isMountedRef.current) setUpcomingMeetings(upcoming);
      if (isMountedRef.current) setPastMeetings(past);
    } catch (error) {
      console.error("Error loading meetings:", error);
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  };

  const loadParticipantsForMeetings = async (meetingIds: string[]) => {
    if (meetingIds.length === 0) return;
    
    try {
      const { data: participants, error: participantsError } = await supabase
        .from('meeting_participants')
        .select('meeting_id, user_id')
        .in('meeting_id', meetingIds);
      
      if (participantsError || !participants || participants.length === 0) return;
      
      const userIds = [...new Set(participants.map(p => p.user_id))];
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, display_name, avatar_url')
        .in('user_id', userIds);
      
      if (profilesError) return;
      
      // Group participants by meeting with profile data
      const participantsByMeeting: Record<string, MeetingParticipant[]> = {};
      participants.forEach(p => {
        const profile = profiles?.find(prof => prof.user_id === p.user_id);
        if (!participantsByMeeting[p.meeting_id]) {
          participantsByMeeting[p.meeting_id] = [];
        }
        participantsByMeeting[p.meeting_id].push({
          user_id: p.user_id,
          display_name: profile?.display_name || null,
          avatar_url: profile?.avatar_url || null
        });
      });
      
      if (isMountedRef.current) setMeetingParticipants(participantsByMeeting);
    } catch (error) {
      console.error('Error loading participants:', error);
    }
  };

  const loadAgendaForMeeting = async (meetingId: string, meetingDate?: string) => {
    // Already loaded
    if (agendaItems[meetingId]) return;
    
    if (isMountedRef.current) setLoadingAgenda(meetingId);
    try {
      const { data, error } = await supabase
        .from('meeting_agenda_items')
        .select('id, title, parent_id, order_index, system_type')
        .eq('meeting_id', meetingId)
        .order('order_index');

      if (error) throw error;
      
      const items = data || [];
      if (isMountedRef.current) setAgendaItems(prev => ({ ...prev, [meetingId]: items }));
      
      // Load system item data if needed
      await loadMeetingSystemData(meetingId, items, meetingDate);
    } catch (error) {
      console.error('Error loading agenda:', error);
    } finally {
      if (isMountedRef.current) setLoadingAgenda(null);
    }
  };

  const loadMeetingSystemData = async (meetingId: string, items: AgendaItem[], meetingDate?: string) => {
    const hasNotes = items.some(i => i.system_type === 'quick_notes');
    const hasTasks = items.some(i => i.system_type === 'tasks');
    const hasDecisions = items.some(i => i.system_type === 'decisions');
    const hasBirthdays = items.some(i => i.system_type === 'birthdays');
    const encounteredUserIds = new Set<string>();
    
    if (hasNotes) {
      try {
        const { data } = await supabase
          .from('quick_notes')
          .select('id, title, user_id')
          .eq('meeting_id', meetingId)
          .is('deleted_at', null);
        (data || []).forEach(note => note.user_id && encounteredUserIds.add(note.user_id));
        if (isMountedRef.current) setMeetingQuickNotes(prev => ({ ...prev, [meetingId]: data || [] }));
      } catch { /* ignore */ }
    }
    
    if (hasTasks) {
      try {
        const { data } = await supabase
          .from('tasks')
          .select('id, title, user_id')
          .eq('meeting_id', meetingId);
        (data || []).forEach(task => task.user_id && encounteredUserIds.add(task.user_id));
        if (isMountedRef.current) setMeetingTasks(prev => ({ ...prev, [meetingId]: data || [] }));
      } catch { /* ignore */ }
    }

    if (hasDecisions && currentTenant?.id && user?.id) {
      try {
        const nowDate = new Date();
        const now = nowDate.toISOString();
        const in7Days = addDays(nowDate, 7).toISOString();
        const { data: decisions } = await supabase
          .from('task_decisions')
          .select('id, title, created_by, status, response_deadline, priority')
          .eq('tenant_id', currentTenant.id)
          .eq('status', 'active')
          .or(`priority.gte.1,response_deadline.lt.${now},and(response_deadline.gte.${now},response_deadline.lte.${in7Days})`)
          .order('priority', { ascending: false, nullsFirst: false })
          .order('response_deadline', { ascending: true, nullsFirst: false });

        const decisionIds = (decisions || []).map(decision => decision.id);
        let participantRows: Array<{ decision_id: string; user_id: string }> = [];

        if (decisionIds.length > 0) {
          const { data: participants } = await supabase
            .from('task_decision_participants')
            .select('decision_id, user_id')
            .in('decision_id', decisionIds);
          participantRows = participants || [];
        }

        const relevantDecisions = (decisions || [])
          .filter((decision) =>
            decision.created_by === user.id ||
            participantRows.some(
              (participant) => participant.decision_id === decision.id && participant.user_id === user.id
            )
          )
          .map((decision) => ({
            id: decision.id,
            title: decision.title,
            user_id: decision.created_by,
          }));

        relevantDecisions.forEach(decision => decision.user_id && encounteredUserIds.add(decision.user_id));
        if (isMountedRef.current) setMeetingDecisions(prev => ({ ...prev, [meetingId]: relevantDecisions }));
      } catch {
        if (isMountedRef.current) setMeetingDecisions(prev => ({ ...prev, [meetingId]: [] }));
      }
    }

    if (hasBirthdays && currentTenant?.id) {
      try {
        const referenceDate = meetingDate ? new Date(meetingDate) : new Date();
        const endDate = addDays(referenceDate, 14);

        const { data: contacts } = await supabase
          .from('contacts')
          .select('id, name, birthday')
          .eq('tenant_id', currentTenant.id)
          .not('birthday', 'is', null);

        if (!contacts || contacts.length === 0) {
          if (isMountedRef.current) setMeetingBirthdays(prev => ({ ...prev, [meetingId]: [] }));
          return;
        }

        const birthdays: BirthdayItemData[] = [];
        const referenceYear = referenceDate.getFullYear();

        for (const contact of contacts) {
          if (!contact.birthday) continue;

          const originalBirthday = parseISO(contact.birthday);
          if (Number.isNaN(originalBirthday.getTime())) continue;
          const month = originalBirthday.getMonth();
          const day = originalBirthday.getDate();

          for (const year of [referenceYear, referenceYear + 1]) {
            const nextBirthday = new Date(year, month, day);
            if (nextBirthday >= referenceDate && nextBirthday <= endDate) {
              birthdays.push({
                id: contact.id,
                name: contact.name,
                birthDate: originalBirthday,
                nextBirthday,
                age: year - originalBirthday.getFullYear(),
              });
              break;
            }
          }
        }

        birthdays.sort((a, b) => a.nextBirthday.getTime() - b.nextBirthday.getTime());
        if (isMountedRef.current) setMeetingBirthdays(prev => ({ ...prev, [meetingId]: birthdays }));
      } catch {
        if (isMountedRef.current) setMeetingBirthdays(prev => ({ ...prev, [meetingId]: [] }));
      }
    }

    if (encounteredUserIds.size > 0) {
      try {
        const missingUserIds = Array.from(encounteredUserIds).filter(userId => !userProfiles[userId]);
        if (missingUserIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('user_id, display_name')
            .in('user_id', missingUserIds);

          if (profiles && profiles.length > 0) {
            if (!isMountedRef.current) return;
            setUserProfiles(prev => {
              const next = { ...prev };
              profiles.forEach((profile) => {
                next[profile.user_id] = profile;
              });
              return next;
            });
          }
        }
      } catch {
        // ignore profile lookup errors
      }
    }
  };

  const getOwnerLabel = (userId?: string) => {
    if (!userId) return null;
    const displayName = userProfiles[userId]?.display_name;
    return displayName ? `von ${displayName}` : 'von unbekannt';
  };

  const getInitials = (name: string | null | undefined) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getSystemItemIcon = (systemType: string | null | undefined) => {
    if (systemType === 'quick_notes') return <StickyNote className="h-3 w-3 text-amber-500" />;
    if (systemType === 'upcoming_appointments') return <Calendar className="h-3 w-3 text-blue-500" />;
    if (systemType === 'tasks') return <ListTodo className="h-3 w-3 text-green-500" />;
    if (systemType === 'decisions') return <Scale className="h-3 w-3 text-violet-500" />;
    if (systemType === 'birthdays') return <Cake className="h-3 w-3 text-pink-500" />;
    return null;
  };

  const getMeetingStatusColor = (meeting: Meeting) => {
    const meetingDate = new Date(meeting.meeting_date);
    if (isToday(meetingDate)) return "text-orange-500";
    if (isPast(meetingDate)) return "text-muted-foreground";
    return "text-foreground";
  };

  const MeetingItem = ({ meeting }: { meeting: Meeting }) => {
    const meetingDate = new Date(meeting.meeting_date);
    const isExpanded = expandedMeetingId === meeting.id;
    const meetingAgenda = agendaItems[meeting.id] || [];
    const isLoadingThisAgenda = loadingAgenda === meeting.id;
    const participants = meetingParticipants[meeting.id] || [];
    const notes = meetingQuickNotes[meeting.id] || [];
    const tasks = meetingTasks[meeting.id] || [];
    const decisions = meetingDecisions[meeting.id] || [];
    const birthdays = meetingBirthdays[meeting.id] || [];
    
    // Get only main items (no parent)
    const mainItems = meetingAgenda
      .filter(item => !item.parent_id)
      .sort((a, b) => a.order_index - b.order_index);

    const handleToggleExpand = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (isExpanded) {
        setExpandedMeetingId(null);
      } else {
        setExpandedMeetingId(meeting.id);
        loadAgendaForMeeting(meeting.id, meeting.meeting_date);
      }
    };

    const handleNavigate = (e: React.MouseEvent) => {
      e.stopPropagation();
      navigate(`/meetings?id=${meeting.id}`);
    };

    return (
      <div className="rounded-lg border bg-card overflow-hidden">
        {/* Header - clickable for expand */}
        <div 
          className="p-3 hover:bg-muted/50 transition-colors cursor-pointer"
          onClick={handleToggleExpand}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                )}
                <span className={cn("font-semibold text-base truncate", getMeetingStatusColor(meeting))}>
                  {meeting.title}
                </span>
                {meeting.is_public && meeting.user_id !== user?.id && (
                  <Globe className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                )}
                {isToday(meetingDate) && (
                  <Badge variant="secondary" className="text-xs px-1.5 py-0 bg-orange-100 text-orange-700">
                    Heute
                  </Badge>
                )}
              </div>
              {meeting.description && (
                <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5 ml-6">
                  {meeting.description}
                </p>
              )}
              <div className="flex items-center gap-3 mt-1.5 ml-6">
                <div className={cn("flex items-center gap-1 text-xs", getMeetingStatusColor(meeting))}>
                  <Calendar className="h-3 w-3" />
                  {format(meetingDate, "dd.MM.yyyy", { locale: de })}
                </div>
                {meeting.meeting_time && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {meeting.meeting_time.substring(0, 5)} Uhr
                  </div>
                )}
                {/* Participants avatars */}
                {participants.length > 0 && (
                  <div className="flex items-center gap-1">
                    <Users className="h-3 w-3 text-muted-foreground" />
                    <div className="flex -space-x-1">
                      {participants.slice(0, 3).map(p => (
                        <Avatar key={p.user_id} className="h-5 w-5 border border-background">
                          <AvatarImage src={p.avatar_url || undefined} />
                          <AvatarFallback className="text-[8px]">
                            {getInitials(p.display_name)}
                          </AvatarFallback>
                        </Avatar>
                      ))}
                      {participants.length > 3 && (
                        <span className="text-xs text-muted-foreground ml-1">
                          +{participants.length - 3}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 flex-shrink-0"
              onClick={handleNavigate}
              title="Zum Jour Fixe"
            >
              <ExternalLink className="h-3 w-3" />
            </Button>
          </div>
        </div>
        
        {/* Expandable Agenda - read-only */}
        {isExpanded && (
          <div className="border-t bg-muted/30 p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <List className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">Tagesordnung</span>
            </div>
            
            {isLoadingThisAgenda ? (
              <div className="space-y-1.5">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-4 bg-muted animate-pulse rounded w-3/4" />
                ))}
              </div>
            ) : mainItems.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">Keine Agenda-Punkte vorhanden</p>
            ) : (
              <ul className="space-y-1.5">
                {mainItems.map((item, index) => {
                  const subItems = meetingAgenda.filter(sub => sub.parent_id === item.id).sort((a, b) => a.order_index - b.order_index);
                  const systemIcon = getSystemItemIcon(item.system_type);
                  
                  return (
                    <li key={item.id} className="text-xs">
                      <div className="flex items-start gap-2">
                        <span className="text-muted-foreground font-medium min-w-[1rem]">{index + 1}.</span>
                        {systemIcon}
                        <span className={cn("text-foreground", item.system_type && "font-medium")}>
                          {item.title}
                        </span>
                      </div>
                      {/* Show individual notes under quick_notes system item */}
                      {item.system_type === 'quick_notes' && notes.length > 0 && (
                        <ul className="ml-6 mt-1 space-y-0.5">
                          {notes.map((note, nIdx) => (
                            <li key={note.id} className="flex items-center gap-1.5 text-muted-foreground">
                              <StickyNote className="h-2.5 w-2.5 text-amber-500" />
                              <span>{note.title || `Notiz ${nIdx + 1}`}</span>
                              {getOwnerLabel(note.user_id) && (
                                <span className="text-muted-foreground/80">({getOwnerLabel(note.user_id)})</span>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                      {/* Show individual tasks under tasks system item */}
                      {item.system_type === 'tasks' && tasks.length > 0 && (
                        <ul className="ml-6 mt-1 space-y-0.5">
                          {tasks.map((task) => (
                            <li key={task.id} className="flex items-center gap-1.5 text-muted-foreground">
                              <ListTodo className="h-2.5 w-2.5 text-green-500" />
                              <span>{task.title}</span>
                              {getOwnerLabel(task.user_id) && (
                                <span className="text-muted-foreground/80">({getOwnerLabel(task.user_id)})</span>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                      {item.system_type === 'decisions' && decisions.length > 0 && (
                        <ul className="ml-6 mt-1 space-y-0.5">
                          {decisions.map((decision) => (
                            <li key={decision.id} className="flex items-center gap-1.5 text-muted-foreground">
                              <Scale className="h-2.5 w-2.5 text-violet-500" />
                              <span>{decision.title}</span>
                              {getOwnerLabel(decision.user_id) && (
                                <span className="text-muted-foreground/80">({getOwnerLabel(decision.user_id)})</span>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                      {item.system_type === 'birthdays' && birthdays.length > 0 && (
                        <ul className="ml-6 mt-1 space-y-0.5">
                          {birthdays.map((birthday) => (
                            <li key={birthday.id} className="flex items-center gap-1.5 text-muted-foreground">
                              <Cake className="h-2.5 w-2.5 text-pink-500" />
                              <span>
                                {birthday.name} (geb. {format(birthday.birthDate, "dd.MM.yyyy", { locale: de })}, {birthday.age} Jahre)
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                      {subItems.length > 0 && (
                        <ul className="ml-6 mt-1 space-y-0.5">
                          {subItems.map((subItem, subIndex) => {
                            const subSystemIcon = getSystemItemIcon(subItem.system_type);
                            return (
                              <li key={subItem.id} className="text-muted-foreground">
                                <div className="flex items-start gap-1.5">
                                  <span className="min-w-[1rem]">{String.fromCharCode(97 + subIndex)})</span>
                                  {subSystemIcon}
                                  <span className={subItem.system_type ? "font-medium text-foreground" : ""}>
                                    {subItem.title}
                                  </span>
                                </div>
                                {/* Show individual notes under sub-item quick_notes */}
                                {subItem.system_type === 'quick_notes' && notes.length > 0 && (
                                  <ul className="ml-8 mt-0.5 space-y-0.5">
                                    {notes.map((note, nIdx) => (
                                      <li key={note.id} className="flex items-center gap-1.5 text-muted-foreground">
                                        <StickyNote className="h-2.5 w-2.5 text-amber-500" />
                                        <span>{note.title || `Notiz ${nIdx + 1}`}</span>
                                        {getOwnerLabel(note.user_id) && (
                                          <span className="text-muted-foreground/80">({getOwnerLabel(note.user_id)})</span>
                                        )}
                                      </li>
                                    ))}
                                  </ul>
                                )}
                                {/* Show individual tasks under sub-item tasks */}
                                {subItem.system_type === 'tasks' && tasks.length > 0 && (
                                  <ul className="ml-8 mt-0.5 space-y-0.5">
                                    {tasks.map((task) => (
                                      <li key={task.id} className="flex items-center gap-1.5 text-muted-foreground">
                                        <ListTodo className="h-2.5 w-2.5 text-green-500" />
                                        <span>{task.title}</span>
                                        {getOwnerLabel(task.user_id) && (
                                          <span className="text-muted-foreground/80">({getOwnerLabel(task.user_id)})</span>
                                        )}
                                      </li>
                                    ))}
                                  </ul>
                                )}
                                {subItem.system_type === 'decisions' && decisions.length > 0 && (
                                  <ul className="ml-8 mt-0.5 space-y-0.5">
                                    {decisions.map((decision) => (
                                      <li key={decision.id} className="flex items-center gap-1.5 text-muted-foreground">
                                        <Scale className="h-2.5 w-2.5 text-violet-500" />
                                        <span>{decision.title}</span>
                                        {getOwnerLabel(decision.user_id) && (
                                          <span className="text-muted-foreground/80">({getOwnerLabel(decision.user_id)})</span>
                                        )}
                                      </li>
                                    ))}
                                  </ul>
                                )}
                                {subItem.system_type === 'birthdays' && birthdays.length > 0 && (
                                  <ul className="ml-8 mt-0.5 space-y-0.5">
                                    {birthdays.map((birthday) => (
                                      <li key={birthday.id} className="flex items-center gap-1.5 text-muted-foreground">
                                        <Cake className="h-2.5 w-2.5 text-pink-500" />
                                        <span>
                                          {birthday.name} (geb. {format(birthday.birthDate, "dd.MM.yyyy", { locale: de })}, {birthday.age} Jahre)
                                        </span>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>
    );
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

  const totalMeetings = upcomingMeetings.length + pastMeetings.length;

  return (
    <ScrollArea className="h-[calc(100vh-20rem)]">
      <div className="space-y-4 p-4">
        {totalMeetings === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Calendar className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p>Keine Jour Fixe Meetings</p>
          </div>
        ) : (
          <>
            {/* Upcoming */}
            <Collapsible open={upcomingOpen} onOpenChange={setUpcomingOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between p-2 h-auto">
                  <div className="flex items-center gap-2">
                    {upcomingOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    <span className="font-medium">Anstehend</span>
                  </div>
                  <Badge variant="secondary">{upcomingMeetings.length}</Badge>
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-2 mt-2">
                {upcomingMeetings.length === 0 ? (
                  <p className="text-sm text-muted-foreground px-2">Keine anstehenden Meetings</p>
                ) : (
                  upcomingMeetings.map((meeting) => <MeetingItem key={meeting.id} meeting={meeting} />)
                )}
              </CollapsibleContent>
            </Collapsible>

            {/* Past */}
            {pastMeetings.length > 0 && (
              <Collapsible open={pastOpen} onOpenChange={setPastOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="w-full justify-between p-2 h-auto">
                    <div className="flex items-center gap-2">
                      {pastOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      <span className="font-medium">Vergangene (30 Tage)</span>
                    </div>
                    <Badge variant="secondary">{pastMeetings.length}</Badge>
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-2 mt-2">
                  {pastMeetings.map((meeting) => <MeetingItem key={meeting.id} meeting={meeting} />)}
                </CollapsibleContent>
              </Collapsible>
            )}
          </>
        )}
      </div>
    </ScrollArea>
  );
}
