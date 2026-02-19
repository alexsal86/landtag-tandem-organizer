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
import { useMyWorkJourFixeMeetings, Meeting } from "@/hooks/useMyWorkJourFixeMeetings";
import { AgendaItem, useMyWorkJourFixeSystemData } from "@/hooks/useMyWorkJourFixeSystemData";
import { cn } from "@/lib/utils";
import { format, isToday, isPast } from "date-fns";
import { de } from "date-fns/locale";

export function MyWorkJourFixeTab() {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const { upcomingMeetings, pastMeetings, meetingParticipants, loading } = useMyWorkJourFixeMeetings(user?.id);
  const [upcomingOpen, setUpcomingOpen] = useState(true);
  const [pastOpen, setPastOpen] = useState(false);
  
  // State for expandable agenda
  const [expandedMeetingId, setExpandedMeetingId] = useState<string | null>(null);
  const [agendaItems, setAgendaItems] = useState<Record<string, AgendaItem[]>>({});
  const [loadingAgenda, setLoadingAgenda] = useState<string | null>(null);

  // State for system item data (notes and tasks per meeting)
  const {
    meetingQuickNotes,
    meetingTasks,
    meetingDecisions,
    meetingBirthdays,
    userProfiles,
    loadMeetingSystemData,
    setMounted,
  } = useMyWorkJourFixeSystemData(user?.id, currentTenant?.id);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    setMounted(true);
    return () => {
      isMountedRef.current = false;
      setMounted(false);
    };
  }, [setMounted]);

  // Handle action parameter from URL
  useEffect(() => {
    const action = searchParams.get('action');
    if (action === 'create-meeting') {
      searchParams.delete('action');
      setSearchParams(searchParams, { replace: true });
      navigate('/meetings?action=create-meeting');
    }
  }, [searchParams, setSearchParams, navigate]);

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
      await loadMeetingSystemData({ meetingId, items, meetingDate });
    } catch (error) {
      console.error('Error loading agenda:', error);
    } finally {
      if (isMountedRef.current) setLoadingAgenda(null);
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
