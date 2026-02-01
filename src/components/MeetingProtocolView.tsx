import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Calendar, MapPin, FileText, Printer, Star } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface AgendaItem {
  id: string;
  title: string;
  description?: string;
  notes?: string;
  result_text?: string;
  assigned_to?: string[];
  order_index: number;
}

interface Meeting {
  id: string;
  title: string;
  description?: string;
  meeting_date: string;
  location?: string;
  status: string;
}

interface Profile {
  user_id: string;
  display_name: string;
}

interface StarredAppointment {
  id: string;
  title: string;
  start_time: string;
}

interface MeetingProtocolViewProps {
  meetingId: string;
  onBack: () => void;
}

export function MeetingProtocolView({ meetingId, onBack }: MeetingProtocolViewProps) {
  const { toast } = useToast();
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [agendaItems, setAgendaItems] = useState<AgendaItem[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [starredAppointments, setStarredAppointments] = useState<StarredAppointment[]>([]);
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
        .select('*')
        .eq('id', meetingId)
        .single();

      if (meetingError) throw meetingError;

      // Load agenda items
      const { data: agendaData, error: agendaError } = await supabase
        .from('meeting_agenda_items')
        .select('*')
        .eq('meeting_id', meetingId)
        .order('order_index');

      if (agendaError) throw agendaError;

      // Load all profiles for assigned users
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, display_name');

      if (profilesError) throw profilesError;

      // Load starred appointments for this meeting
      const { data: starredData } = await supabase
        .from('starred_appointments')
        .select('id, appointment_id, external_event_id')
        .eq('meeting_id', meetingId);

      const starredList: StarredAppointment[] = [];
      if (starredData && starredData.length > 0) {
        const appointmentIds = starredData.filter(s => s.appointment_id).map(s => s.appointment_id);
        const externalEventIds = starredData.filter(s => s.external_event_id).map(s => s.external_event_id);

        if (appointmentIds.length > 0) {
          const { data: appointments } = await supabase
            .from('appointments')
            .select('id, title, start_time')
            .in('id', appointmentIds);
          if (appointments) {
            starredList.push(...appointments.map(a => ({
              id: a.id,
              title: a.title,
              start_time: a.start_time
            })));
          }
        }

        if (externalEventIds.length > 0) {
          const { data: externalEvents } = await supabase
            .from('external_events')
            .select('id, title, start_time')
            .in('id', externalEventIds);
          if (externalEvents) {
            starredList.push(...externalEvents.map(e => ({
              id: e.id,
              title: e.title,
              start_time: e.start_time
            })));
          }
        }
      }

      setMeeting(meetingData);
      setAgendaItems(agendaData || []);
      setProfiles(profilesData || []);
      setStarredAppointments(starredList);
    } catch (error) {
      console.error('Error loading meeting protocol:', error);
      toast({
        title: "Fehler",
        description: "Das Besprechungsprotokoll konnte nicht geladen werden.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getAssignedUserNames = (userIds?: string[]) => {
    if (!userIds || userIds.length === 0) return null;
    const names = userIds.map(userId => {
      const profile = profiles.find(p => p.user_id === userId);
      return profile?.display_name || 'Unbekannter Benutzer';
    });
    return names.join(', ');
  };

  const handlePrint = () => {
    window.print();
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
          Zurück zum Archiv
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between print:hidden">
        <Button variant="outline" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Zurück zum Archiv
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

        {/* Agenda Items */}
        <div className="space-y-8">
          <h3 className="text-xl font-semibold mb-6">Tagesordnung und Ergebnisse</h3>
          
          {agendaItems.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <p>Keine Tagesordnungspunkte verfügbar.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {agendaItems.map((item, index) => (
                <div key={item.id} className="border-l-4 border-primary/20 pl-6 py-2">
                  <div className="space-y-3">
                    {/* Item Number and Title */}
                    <h4 className="text-lg font-semibold">
                      {index + 1}. {item.title}
                    </h4>

                    {/* Description */}
                    {item.description && item.description.trim() && (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground mb-1">Beschreibung:</p>
                        <p className="text-sm leading-relaxed">{item.description}</p>
                      </div>
                    )}

                    {/* Notes */}
                    {item.notes && item.notes.trim() && (
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
                    {item.result_text && item.result_text.trim() && (
                      <div className="bg-muted/50 p-3 rounded-md border-l-4 border-primary">
                        <p className="text-sm font-medium text-primary mb-1">Ergebnis:</p>
                        <p className="text-sm leading-relaxed">{item.result_text}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Starred Appointments Section */}
        {starredAppointments.length > 0 && (
          <div className="space-y-4 mt-8 pt-6 border-t">
            <h3 className="text-xl font-semibold">Markierte Termine zur Besprechung</h3>
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

        {/* Protocol Footer */}
        <div className="border-t pt-6 mt-12 text-center text-sm text-muted-foreground">
          <p>Protokoll erstellt am {format(new Date(), 'PPP', { locale: de })}</p>
        </div>
      </div>
    </div>
  );
}