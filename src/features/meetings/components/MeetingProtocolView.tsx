import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Calendar, MapPin, FileText, Printer, Star, Users, Scale, StickyNote, Briefcase, CheckSquare, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { debugConsole } from "@/utils/debugConsole";
import { Badge } from "@/components/ui/badge";

interface ProtocolAgendaItem {
  id: string;
  title: string;
  description?: string | null;
  notes?: string | null;
  result_text?: string | null;
  assigned_to?: string[] | null;
  order_index: number;
  parent_id?: string | null;
  system_type?: string | null;
  is_completed?: boolean;
  task_id?: string | null;
}

interface ProtocolMeeting {
  id: string;
  title: string;
  description?: string | null;
  meeting_date: string;
  meeting_time?: string | null;
  location?: string | null;
  status: string;
  user_id?: string | null;
}

interface Profile {
  user_id: string;
  display_name: string | null;
  avatar_url?: string | null;
}

interface StarredAppointment {
  id: string;
  title: string;
  start_time: string;
}

interface ProtocolQuickNote {
  id: string;
  title?: string | null;
  content: string;
  meeting_result?: string | null;
  category?: string | null;
}

interface ProtocolCaseItem {
  id: string;
  subject: string | null;
  status: string;
  meeting_result?: string;
}

interface ProtocolDecision {
  id: string;
  title: string;
  status: string;
  response_deadline?: string | null;
  result_text?: string | null;
}

interface ProtocolParticipant {
  user_id: string;
  role: string;
  display_name: string | null;
}

interface CreatedTask {
  id: string;
  title: string;
  assigned_to?: string | null;
  parent_task_id?: string | null;
}

interface MeetingProtocolViewProps {
  meetingId: string;
  onBack: () => void;
  /** When true, shows "Zurück zur Übersicht" instead of "Zurück zum Archiv" */
  isPostArchive?: boolean;
}

export function MeetingProtocolView({ meetingId, onBack, isPostArchive }: MeetingProtocolViewProps) {
  const { toast } = useToast();
  const [meeting, setMeeting] = useState<ProtocolMeeting | null>(null);
  const [agendaItems, setAgendaItems] = useState<ProtocolAgendaItem[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [starredAppointments, setStarredAppointments] = useState<StarredAppointment[]>([]);
  const [participants, setParticipants] = useState<ProtocolParticipant[]>([]);
  const [quickNotes, setQuickNotes] = useState<ProtocolQuickNote[]>([]);
  const [caseItems, setCaseItems] = useState<ProtocolCaseItem[]>([]);
  const [decisions, setDecisions] = useState<ProtocolDecision[]>([]);
  const [createdTasks, setCreatedTasks] = useState<CreatedTask[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMeetingProtocol();
  }, [meetingId]);

  const loadMeetingProtocol = async () => {
    try {
      setLoading(true);

      // Load meeting details
      const { data: meetingData, error: meetingError } = await supabase
        .from('meetings')
        .select('id, title, description, meeting_date, meeting_time, location, status, user_id')
        .eq('id', meetingId)
        .single();
      if (meetingError) throw meetingError;

      // Load agenda items with hierarchy fields
      const { data: agendaData, error: agendaError } = await supabase
        .from('meeting_agenda_items')
        .select('id, title, description, notes, result_text, assigned_to, order_index, parent_id, system_type, is_completed, task_id')
        .eq('meeting_id', meetingId)
        .order('order_index');
      if (agendaError) throw agendaError;

      // Load all profiles
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('user_id, display_name, avatar_url');

      // Load participants
      const { data: participantsData } = await supabase
        .from('meeting_participants')
        .select('user_id, role')
        .eq('meeting_id', meetingId);

      const participantList: ProtocolParticipant[] = [];
      // Add creator
      if (meetingData?.user_id) {
        const creatorProfile = profilesData?.find((p: Record<string, any>) => p.user_id === meetingData.user_id);
        participantList.push({
          user_id: meetingData.user_id,
          role: 'organizer',
          display_name: creatorProfile?.display_name || 'Unbekannt',
        });
      }
      // Add participants (avoid duplicates with creator)
      for (const p of participantsData || []) {
        if (p.user_id === meetingData?.user_id) continue;
        const profile = profilesData?.find((pr: Record<string, any>) => pr.user_id === p.user_id);
        participantList.push({
          user_id: p.user_id,
          role: p.role,
          display_name: profile?.display_name || 'Unbekannt',
        });
      }

      // Load quick notes linked to this meeting with results
      const { data: notesData } = await supabase
        .from('quick_notes')
        .select('id, title, content, meeting_result, category')
        .eq('meeting_id', meetingId);

      // Load case items linked via agenda items with system_type='case_items'
      const caseItemAgendaItems = ((agendaData || []) as ProtocolAgendaItem[]).filter(
        (item) => item.system_type === 'case_items' && item.result_text?.trim()
      );
      // We'll display them from agenda items directly

      // Load decisions linked via agenda items with system_type='decisions'
      const decisionAgendaItems = ((agendaData || []) as ProtocolAgendaItem[]).filter(
        (item) => item.system_type === 'decisions'
      );
      const decisionList: ProtocolDecision[] = [];
      if (decisionAgendaItems.length > 0) {
        // Try to load the actual decisions by title match (best effort)
        const { data: decisionsData } = await supabase
          .from('decisions')
          .select('id, title, status, response_deadline')
          .limit(100);
        
        for (const agendaItem of decisionAgendaItems) {
          const matchedDecision = decisionsData?.find((d: Record<string, any>) => d.title === agendaItem.title);
          decisionList.push({
            id: matchedDecision?.id || agendaItem.id,
            title: agendaItem.title,
            status: matchedDecision?.status || 'open',
            response_deadline: matchedDecision?.response_deadline,
            result_text: agendaItem.result_text,
          });
        }
      }

      // Load tasks created from this meeting (category='meeting', description mentions meeting title)
      const meetingDateFormatted = format(new Date(meetingData.meeting_date), 'dd.MM.yyyy', { locale: de });
      const { data: tasksData } = await supabase
        .from('tasks')
        .select('id, title, assigned_to, parent_task_id')
        .eq('category', 'meeting')
        .ilike('description', `%${meetingData.title}%${meetingDateFormatted}%`)
        .limit(50);

      // Load starred appointments
      const starredList: StarredAppointment[] = [];
      const { data: starredData } = await supabase
        .from('starred_appointments')
        .select('id, appointment_id, external_event_id')
        .eq('meeting_id', meetingId);

      if (starredData && starredData.length > 0) {
        const appointmentIds = starredData.filter((s: Record<string, any>) => s.appointment_id).map((s: Record<string, any>) => s.appointment_id!);
        const externalEventIds = starredData.filter((s: Record<string, any>) => s.external_event_id).map((s: Record<string, any>) => s.external_event_id!);

        if (appointmentIds.length > 0) {
          const { data: appointments } = await supabase
            .from('appointments').select('id, title, start_time').in('id', appointmentIds);
          if (appointments) starredList.push(...appointments);
        }
        if (externalEventIds.length > 0) {
          const { data: externalEvents } = await supabase
            .from('external_events').select('id, title, start_time').in('id', externalEventIds);
          if (externalEvents) starredList.push(...externalEvents);
        }
      }

      setMeeting(meetingData as ProtocolMeeting);
      setAgendaItems((agendaData || []) as ProtocolAgendaItem[]);
      setProfiles((profilesData || []) as Profile[]);
      setParticipants(participantList);
      setQuickNotes((notesData || []) as ProtocolQuickNote[]);
      setDecisions(decisionList);
      setCreatedTasks((tasksData || []) as CreatedTask[]);
      setStarredAppointments(starredList);
    } catch (error) {
      debugConsole.error('Error loading meeting protocol:', error);
      toast({
        title: "Fehler",
        description: "Das Besprechungsprotokoll konnte nicht geladen werden.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getAssignedUserNames = (userIds?: string[] | null) => {
    if (!userIds || userIds.length === 0) return null;
    return userIds.map(userId => {
      const profile = profiles.find(p => p.user_id === userId);
      return profile?.display_name || 'Unbekannter Benutzer';
    }).join(', ');
  };

  const handlePrint = () => {
    window.print();
  };

  // Build hierarchical agenda
  const mainItems = agendaItems.filter(i => !i.parent_id).sort((a, b) => a.order_index - b.order_index);
  const getChildren = (parentId: string) =>
    agendaItems.filter(i => i.parent_id === parentId).sort((a, b) => a.order_index - b.order_index);

  const getSystemIcon = (systemType?: string | null) => {
    switch (systemType) {
      case 'decisions': return <Scale className="h-4 w-4 text-violet-500" />;
      case 'quick_notes': return <StickyNote className="h-4 w-4 text-amber-500" />;
      case 'tasks': return <CheckSquare className="h-4 w-4 text-blue-500" />;
      case 'case_items': return <Briefcase className="h-4 w-4 text-emerald-500" />;
      case 'birthdays': return <span className="text-base">🎂</span>;
      case 'upcoming_appointments': return <Calendar className="h-4 w-4 text-orange-500" />;
      default: return null;
    }
  };

  const roleLabelMap: Record<string, string> = {
    organizer: 'Organisator',
    participant: 'Teilnehmer',
    optional: 'Optional',
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Lade Besprechungsprotokoll...</div>
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="text-center space-y-4">
        <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
        <h3 className="text-lg font-medium">Besprechung nicht gefunden</h3>
        <Button onClick={onBack} variant="outline">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Zurück
        </Button>
      </div>
    );
  }

  const backLabel = isPostArchive ? "Zurück zur Übersicht" : "Zurück zum Archiv";
  const notesWithResults = quickNotes.filter(n => n.meeting_result?.trim());
  const parentTasks = createdTasks.filter(t => !t.parent_task_id);

  const renderAgendaItem = (item: ProtocolAgendaItem, index: number, isChild = false) => {
    const children = item.id ? getChildren(item.id) : [];
    const icon = getSystemIcon(item.system_type);
    const borderColor = item.system_type
      ? 'border-primary/40'
      : 'border-primary/20';

    return (
      <div key={item.id} className={`${isChild ? 'ml-6' : ''} border-l-4 ${borderColor} pl-6 py-2`}>
        <div className="space-y-2">
          {/* Title */}
          <h4 className={`${isChild ? 'text-base' : 'text-lg'} font-semibold flex items-center gap-2`}>
            {icon}
            {!isChild && <span className="text-muted-foreground">{index + 1}.</span>}
            {isChild && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
            {item.title}
            {item.is_completed && (
              <Badge variant="outline" className="text-xs text-green-600 border-green-300">Erledigt</Badge>
            )}
          </h4>

          {/* Description */}
          {item.description?.trim() && (
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">Beschreibung:</p>
              <p className="text-sm leading-relaxed">{item.description}</p>
            </div>
          )}

          {/* Notes */}
          {item.notes?.trim() && (
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">Notizen:</p>
              <p className="text-sm leading-relaxed">{item.notes}</p>
            </div>
          )}

          {/* Assigned Users */}
          {item.assigned_to && item.assigned_to.length > 0 && (
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">Zugewiesen an:</p>
              <p className="text-sm">{getAssignedUserNames(item.assigned_to)}</p>
            </div>
          )}

          {/* Result */}
          {item.result_text?.trim() && !item.system_type?.includes('birthday') && (
            <div className="bg-muted/50 p-3 rounded-md border-l-4 border-primary">
              <p className="text-sm font-medium text-primary mb-1">Ergebnis:</p>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{item.result_text}</p>
            </div>
          )}
        </div>

        {/* Render children */}
        {children.length > 0 && (
          <div className="mt-3 space-y-3">
            {children.map((child, ci) => renderAgendaItem(child, ci, true))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between print:hidden">
        <Button variant="outline" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          {backLabel}
        </Button>
        <Button variant="outline" size="sm" onClick={handlePrint}>
          <Printer className="h-4 w-4 mr-2" />
          Drucken
        </Button>
      </div>

      {/* Protocol Content */}
      <div className="bg-background border rounded-lg p-8 print:border-0 print:shadow-none">
        {/* Protocol Header */}
        <div className="text-center border-b pb-6 mb-8">
          <h1 className="text-3xl font-bold mb-4">Besprechungsprotokoll</h1>
          <div className="space-y-2">
            <h2 className="text-xl font-semibold">{meeting.title}</h2>
            {meeting.description && (
              <p className="text-muted-foreground">{meeting.description}</p>
            )}
            <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground mt-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                {format(new Date(meeting.meeting_date), 'PPP', { locale: de })}
                {meeting.meeting_time && ` um ${meeting.meeting_time.substring(0, 5)} Uhr`}
              </div>
              {meeting.location && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  {meeting.location}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Participants */}
        {participants.length > 0 && (
          <div className="mb-8">
            <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Users className="h-5 w-5" />
              Teilnehmer
            </h3>
            <div className="flex flex-wrap gap-2">
              {participants.map(p => (
                <Badge key={p.user_id} variant="secondary" className="text-sm py-1 px-3">
                  {p.display_name}
                  <span className="text-muted-foreground ml-1">({roleLabelMap[p.role] || p.role})</span>
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Agenda Items (hierarchical) */}
        <div className="space-y-8 mb-8">
          <h3 className="text-xl font-semibold mb-6">Tagesordnung und Ergebnisse</h3>
          
          {mainItems.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <p>Keine Tagesordnungspunkte verfügbar.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {mainItems.map((item, index) => renderAgendaItem(item, index))}
            </div>
          )}
        </div>

        {/* Decisions Section */}
        {decisions.length > 0 && (
          <div className="space-y-4 pt-6 border-t mb-8">
            <h3 className="text-xl font-semibold flex items-center gap-2">
              <Scale className="h-5 w-5 text-violet-500" />
              Entscheidungen
            </h3>
            <div className="space-y-3">
              {decisions.map(d => (
                <div key={d.id} className="p-4 bg-violet-50 dark:bg-violet-900/20 rounded-lg border border-violet-200 dark:border-violet-800">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <p className="font-medium">{d.title}</p>
                      {d.response_deadline && (
                        <p className="text-xs text-muted-foreground">
                          Frist: {format(new Date(d.response_deadline), 'dd.MM.yyyy', { locale: de })}
                        </p>
                      )}
                    </div>
                    <Badge variant={d.status === 'decided' ? 'default' : 'secondary'} className="shrink-0">
                      {d.status === 'decided' ? 'Entschieden' : d.status === 'open' ? 'Offen' : d.status}
                    </Badge>
                  </div>
                  {d.result_text?.trim() && (
                    <div className="mt-2 p-2 bg-background/60 rounded border-l-4 border-violet-400">
                      <p className="text-sm font-medium text-violet-700 dark:text-violet-300 mb-1">Ergebnis:</p>
                      <p className="text-sm whitespace-pre-wrap">{d.result_text}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick Notes with Results */}
        {notesWithResults.length > 0 && (
          <div className="space-y-4 pt-6 border-t mb-8">
            <h3 className="text-xl font-semibold flex items-center gap-2">
              <StickyNote className="h-5 w-5 text-amber-500" />
              Besprochene Notizen
            </h3>
            <div className="space-y-3">
              {notesWithResults.map(note => (
                <div key={note.id} className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                  <p className="font-medium">{note.title || note.content.substring(0, 80)}</p>
                  {note.meeting_result?.trim() && (
                    <div className="mt-2 p-2 bg-background/60 rounded border-l-4 border-amber-400">
                      <p className="text-sm font-medium text-amber-700 dark:text-amber-300 mb-1">Ergebnis:</p>
                      <p className="text-sm whitespace-pre-wrap">{note.meeting_result}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Starred Appointments */}
        {starredAppointments.length > 0 && (
          <div className="space-y-4 pt-6 border-t mb-8">
            <h3 className="text-xl font-semibold flex items-center gap-2">
              <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
              Markierte Termine
            </h3>
            <div className="space-y-2">
              {starredAppointments.map(apt => (
                <div key={apt.id} className="flex items-center gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                  <Star className="h-4 w-4 fill-amber-400 text-amber-400 shrink-0" />
                  <span className="font-medium">{apt.title}</span>
                  <span className="text-sm text-muted-foreground">
                    ({format(new Date(apt.start_time), 'dd.MM.yyyy HH:mm', { locale: de })})
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Created Tasks Summary */}
        {parentTasks.length > 0 && (
          <div className="space-y-4 pt-6 border-t mb-8">
            <h3 className="text-xl font-semibold flex items-center gap-2">
              <CheckSquare className="h-5 w-5 text-blue-500" />
              Erstellte Aufgaben ({createdTasks.length})
            </h3>
            <div className="space-y-2">
              {parentTasks.map(task => {
                const childTasks = createdTasks.filter(t => t.parent_task_id === task.id);
                return (
                  <div key={task.id} className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <p className="font-medium text-sm">{task.title}</p>
                    {task.assigned_to && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Zugewiesen an: {getAssignedUserNames(
                          typeof task.assigned_to === 'string'
                            ? task.assigned_to.replace(/[{}]/g, '').split(',').filter(Boolean)
                            : null
                        ) || 'Unbekannt'}
                      </p>
                    )}
                    {childTasks.length > 0 && (
                      <div className="mt-2 ml-4 space-y-1">
                        {childTasks.map(ct => (
                          <div key={ct.id} className="flex items-center gap-2 text-sm text-muted-foreground">
                            <ChevronRight className="h-3 w-3" />
                            {ct.title}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Protocol Footer */}
        <div className="border-t pt-6 mt-12 text-center text-sm text-muted-foreground">
          <p>Protokoll erstellt am {format(new Date(), 'PPP \'um\' HH:mm \'Uhr\'', { locale: de })}</p>
        </div>
      </div>
    </div>
  );
}
