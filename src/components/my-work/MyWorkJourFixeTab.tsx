import { useState, useEffect, useRef, useCallback } from "react";
import { debugConsole } from '@/utils/debugConsole';
import { useSearchParams, useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ChevronDown, ChevronRight, Calendar, ExternalLink, Clock, List, StickyNote, Users, ListTodo, Globe, Cake, Scale, Briefcase } from "lucide-react";
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

  // Stable refs to guard against duplicate/stale loads
  const agendaItemsRef = useRef<Record<string, AgendaItem[]>>({});
  const inFlightRef = useRef<Set<string>>(new Set());

  // State for system item data (notes and tasks per meeting)
  const {
    meetingQuickNotes,
    meetingTasks,
    meetingDecisions,
    meetingBirthdays,
    meetingCaseItems,
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

  const loadAgendaForMeeting = useCallback(async (meetingId: string, meetingDate?: string) => {
    // Already loaded or currently loading – skip
    if (agendaItemsRef.current[meetingId] || inFlightRef.current.has(meetingId)) return;

    inFlightRef.current.add(meetingId);
    if (isMountedRef.current) setLoadingAgenda(meetingId);
    try {
      const { data, error } = await supabase
        .from('meeting_agenda_items')
        .select('id, title, parent_id, order_index, system_type')
        .eq('meeting_id', meetingId)
        .order('order_index');

      if (error) throw error;
      
      const items = data || [];
      agendaItemsRef.current[meetingId] = items;
      if (isMountedRef.current) setAgendaItems(prev => ({ ...prev, [meetingId]: items }));
      
      // Load system item data if needed
      await loadMeetingSystemData({ meetingId, items, meetingDate });
    } catch (error) {
      debugConsole.error('Error loading agenda:', error);
    } finally {
      inFlightRef.current.delete(meetingId);
      if (isMountedRef.current) setLoadingAgenda(null);
    }
  }, [loadMeetingSystemData]);

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
    if (systemType === 'case_items') return <Briefcase className="h-3 w-3 text-teal-500" />;
    return null;
  };

  const getMeetingStatusColor = (meeting: Meeting) => {
    const meetingDate = new Date(meeting.meeting_date);
    if (isToday(meetingDate)) return "text-orange-500";
    if (isPast(meetingDate)) return "text-muted-foreground";
    return "text-foreground";
  };

  const getSystemEntries = (
    systemType: string | null | undefined,
    notes: typeof meetingQuickNotes[string],
    tasks: typeof meetingTasks[string],
    decisions: typeof meetingDecisions[string],
    birthdays: typeof meetingBirthdays[string],
    caseItems: typeof meetingCaseItems[string],
  ): Array<{ id: string; icon: React.ReactNode; label: string; ownerLabel?: string | null }> => {
    if (systemType === 'quick_notes') {
      return notes.map((note, index) => ({
        id: note.id,
        icon: <StickyNote className="h-2.5 w-2.5 text-amber-500" />,
        label: note.title || `Notiz ${index + 1}`,
        ownerLabel: getOwnerLabel(note.user_id),
      }));
    }

    if (systemType === 'tasks') {
      return tasks.map((task) => ({
        id: task.id,
        icon: <ListTodo className="h-2.5 w-2.5 text-green-500" />,
        label: task.title || 'Ohne Titel',
        ownerLabel: getOwnerLabel(task.user_id),
      }));
    }

    if (systemType === 'decisions') {
      return decisions.map((decision) => ({
        id: decision.id,
        icon: <Scale className="h-2.5 w-2.5 text-violet-500" />,
        label: decision.title || 'Ohne Titel',
        ownerLabel: getOwnerLabel(decision.user_id),
      }));
    }

    if (systemType === 'birthdays') {
      return birthdays.map((birthday) => ({
        id: birthday.id,
        icon: <Cake className="h-2.5 w-2.5 text-pink-500" />,
        label: `${birthday.name} (geb. ${format(birthday.birthDate, "dd.MM.yyyy", { locale: de })}, ${birthday.age} Jahre)`,
      }));
    }

    if (systemType === 'case_items') {
      return caseItems.map((ci) => ({
        id: ci.id,
        icon: <Briefcase className="h-2.5 w-2.5 text-teal-500" />,
        label: ci.subject || 'Ohne Betreff',
        ownerLabel: getOwnerLabel(ci.owner_user_id ?? undefined),
      }));
    }

    return [];
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
    const caseItems = meetingCaseItems[meeting.id] || [];
    
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
              <ul className="ml-[18px] space-y-1.5">
                {mainItems.map((item, index) => {
                  const subItems = meetingAgenda.filter(sub => sub.parent_id === item.id).sort((a, b) => a.order_index - b.order_index);
                  const systemIcon = getSystemItemIcon(item.system_type);
                  const systemEntries = getSystemEntries(item.system_type, notes, tasks, decisions, birthdays, caseItems);
                  
                  return (
                    <li key={item.id} className="text-xs">
                      <div className="flex items-start gap-1">
                        <span className="text-muted-foreground font-medium min-w-[0.5rem]">{index + 1}.</span>
                        {systemIcon}
                        <span className={cn("text-foreground", item.system_type && "font-medium")}>
                          {item.title}
                        </span>
                      </div>
                      {systemEntries.length > 0 && (
                        <ul className="ml-6 mt-1 space-y-1">
                          {systemEntries.map((entry, systemEntryIndex) => (
                            <li key={entry.id} className="text-muted-foreground rounded bg-muted/40 px-2 py-1">
                              <div className="flex items-center gap-1">
                                <span className="min-w-[0.5rem] text-[11px] font-medium text-foreground/70">{String.fromCharCode(97 + systemEntryIndex)})</span>
                                {entry.icon}
                                <span className="text-foreground">{entry.label}</span>
                                {entry.ownerLabel && (
                                  <span className="text-muted-foreground/80">({entry.ownerLabel})</span>
                                )}
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                      {subItems.length > 0 && (
                        <ul className="ml-[0.8rem] mt-1 space-y-0.5">
                          {subItems.map((subItem, subIndex) => {
                            const subSystemIcon = getSystemItemIcon(subItem.system_type);
                            const subSystemEntries = getSystemEntries(subItem.system_type, notes, tasks, decisions, birthdays, caseItems);
                            return (
                              <li key={subItem.id} className="text-muted-foreground">
                                <div className="flex items-start gap-1">
                                  <span className="min-w-[0.5rem]">{index + 1}.{subIndex + 1}</span>
                                  {subSystemIcon}
                                  <span className={subItem.system_type ? "font-medium text-foreground" : ""}>
                                    {subItem.title}
                                  </span>
                                </div>
                                {subSystemEntries.length > 0 && (
                                  <ul className="ml-[0.8rem] space-y-1">
                                    {subSystemEntries.map((entry, subSystemEntryIndex) => (
                                      <li key={entry.id} className="flex items-center gap-1 text-muted-foreground rounded bg-muted/40 px-2 py-1">
                                        <span className="min-w-[0.5rem] text-[11px] font-medium text-foreground/70">{String.fromCharCode(97 + subSystemEntryIndex)})</span>
                                        {entry.icon}
                                        <span className="text-foreground">{entry.label}</span>
                                        {entry.ownerLabel && (
                                          <span className="text-muted-foreground/80">({entry.ownerLabel})</span>
                                        )}
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
  );
}
