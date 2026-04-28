import { supabase } from "@/integrations/supabase/client";
import { debugConsole } from "@/utils/debugConsole";
import { format } from "date-fns";
import type { RecurrenceData, NewMeetingParticipant, AgendaItem, Meeting, MeetingTemplate, Profile } from "@/components/meetings/types";

interface AuthUser {
  id: string;
}

interface Tenant {
  id: string;
}

interface ToastFn {
  (opts: { title: string; description: string; variant?: "default" | "destructive" }): void;
}

interface UseMeetingCreateDeps {
  user: AuthUser | null;
  currentTenant: Tenant | null;
  toast: ToastFn;
  newMeeting: Meeting;
  newMeetingTime: string;
  newMeetingParticipants: NewMeetingParticipant[];
  newMeetingRecurrence: RecurrenceData;
  meetingTemplates: MeetingTemplate[];
  meetings: Meeting[];
  profiles: Profile[];
  setMeetings: React.Dispatch<React.SetStateAction<Meeting[]>>;
  setSelectedMeeting: React.Dispatch<React.SetStateAction<Meeting | null>>;
  setAgendaItems: React.Dispatch<React.SetStateAction<AgendaItem[]>>;
  setIsNewMeetingOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setNewMeeting: React.Dispatch<React.SetStateAction<Meeting>>;
  setNewMeetingParticipants: React.Dispatch<React.SetStateAction<NewMeetingParticipant[]>>;
  setNewMeetingRecurrence: React.Dispatch<React.SetStateAction<RecurrenceData>>;
  loadAgendaItems: (meetingId: string) => Promise<void>;
  loadAndApplyCarryoverItems: (meetingId: string, templateId: string) => Promise<void>;
}

export function useMeetingCreate(deps: UseMeetingCreateDeps) {
  const {
    user, currentTenant, toast, newMeeting, newMeetingTime, newMeetingParticipants,
    newMeetingRecurrence, meetingTemplates, meetings, profiles,
    setMeetings, setSelectedMeeting, setAgendaItems, setIsNewMeetingOpen,
    setNewMeeting, setNewMeetingParticipants, setNewMeetingRecurrence,
    loadAgendaItems, loadAndApplyCarryoverItems,
  } = deps;

  const createMeeting = async () => {
    toast({ title: "Meeting wird erstellt...", description: "Bitte warten..." });
    if (!user) { toast({ title: "Fehler", description: "Kein Benutzer gefunden!", variant: "destructive" }); return; }
    if (!newMeeting.title.trim()) { toast({ title: "Fehler", description: "Bitte geben Sie einen Titel ein!", variant: "destructive" }); return; }

    try {
      const insertData = {
        title: newMeeting.title, description: newMeeting.description || null,
        meeting_date: format(newMeeting.meeting_date, 'yyyy-MM-dd'), meeting_time: newMeetingTime,
        location: newMeeting.location || null, status: newMeeting.status, user_id: user.id,
        tenant_id: currentTenant?.id, template_id: newMeeting.template_id || null,
        is_public: newMeeting.is_public || false,
        recurrence_rule: newMeetingRecurrence.enabled ? JSON.parse(JSON.stringify(newMeetingRecurrence)) : null
      };

      const { data, error } = await supabase.from('meetings').insert([insertData]).select().single();
      if (error) throw error;

      // Create calendar appointment
      if (data.id && currentTenant?.id) {
        try {
          const meetingDateStr = format(newMeeting.meeting_date, 'yyyy-MM-dd');
          const localStartTime = new Date(`${meetingDateStr}T${newMeetingTime}:00`);
          const localEndTime = new Date(localStartTime.getTime() + 60 * 60 * 1000);
          await supabase.from('appointments').insert([{
            title: newMeeting.title, description: newMeeting.description || null,
            location: newMeeting.location || null, start_time: localStartTime.toISOString(),
            end_time: localEndTime.toISOString(), category: 'meeting', status: 'planned',
            user_id: user.id, tenant_id: currentTenant.id, meeting_id: data.id
          }]);
        } catch (e) { debugConsole.error('Error creating appointment for meeting:', e); }
      }

      // Add participants
      if (newMeetingParticipants.length > 0 && data.id) {
        const participantInserts = newMeetingParticipants.map(p => ({
          meeting_id: data.id, user_id: p.userId, role: p.role, status: 'pending'
        }));
        await supabase.from('meeting_participants').insert(participantInserts);
      }

      const newMeetingWithDate = { ...data, meeting_date: new Date(data.meeting_date) };
      setMeetings([newMeetingWithDate, ...meetings]);
      setSelectedMeeting(newMeetingWithDate);
      setAgendaItems([]);

      // Auto-assign pending notes
      try {
        const { data: pendingNotes, error: pendingError } = await supabase
          .from('quick_notes').select('id').eq('user_id', user.id).eq('pending_for_jour_fixe', true).is('deleted_at', null);
        if (!pendingError && pendingNotes && pendingNotes.length > 0) {
          const noteIds = pendingNotes.map((n: Record<string, any>) => n.id);
          const { error: updateError } = await supabase
            .from('quick_notes').update({ meeting_id: data.id, pending_for_jour_fixe: false }).in('id', noteIds);
          if (!updateError) {
            toast({ title: "Notizen verknüpft", description: `${pendingNotes.length} vorgemerkte Notiz(en) wurden automatisch hinzugefügt.` });
          }
        }
      } catch (e) { debugConsole.error('Error processing pending notes:', e); }

      // Auto-create future recurring meetings
      if (newMeetingRecurrence.enabled && newMeeting.template_id) {
        try {
          const template = meetingTemplates.find(t => t.id === newMeeting.template_id);
          const autoCreateCount = template?.auto_create_count || 3;
          const { count: existingCount } = await supabase
            .from('meetings').select('id', { count: 'exact', head: true })
            .eq('template_id', newMeeting.template_id).eq('status', 'planned')
            .gte('meeting_date', format(new Date(), 'yyyy-MM-dd'));
          const toCreate = autoCreateCount - (existingCount || 1);

          if (toCreate > 0) {
            const futureDates: Date[] = [];
            let currentDate = new Date(newMeeting.meeting_date);
            for (let i = 0; i < toCreate; i++) {
              switch (newMeetingRecurrence.frequency) {
                case 'daily': currentDate = new Date(currentDate); currentDate.setDate(currentDate.getDate() + newMeetingRecurrence.interval); break;
                case 'weekly': currentDate = new Date(currentDate); currentDate.setDate(currentDate.getDate() + (7 * newMeetingRecurrence.interval)); break;
                case 'monthly': currentDate = new Date(currentDate); currentDate.setMonth(currentDate.getMonth() + newMeetingRecurrence.interval); break;
                case 'yearly': currentDate = new Date(currentDate); currentDate.setFullYear(currentDate.getFullYear() + newMeetingRecurrence.interval); break;
              }
              futureDates.push(new Date(currentDate));
            }
            for (const futureDate of futureDates) {
              const { data: futureMeeting, error: futureError } = await supabase
                .from('meetings').insert([{
                  title: newMeeting.title, description: newMeeting.description || null,
                  meeting_date: format(futureDate, 'yyyy-MM-dd'), location: newMeeting.location || null,
                  status: 'planned', user_id: user.id, tenant_id: currentTenant?.id,
                  template_id: newMeeting.template_id, recurrence_rule: JSON.parse(JSON.stringify(newMeetingRecurrence))
                }]).select().single();
              if (!futureError && futureMeeting?.id && newMeetingParticipants.length > 0) {
                await supabase.from('meeting_participants').insert(
                  newMeetingParticipants.map(p => ({ meeting_id: futureMeeting.id, user_id: p.userId, role: p.role, status: 'pending' }))
                );
              }
            }
            toast({ title: "Wiederkehrende Meetings erstellt", description: `${toCreate} zukünftige Meeting(s) wurden automatisch erstellt.` });
          }
        } catch (e) { debugConsole.error('Error creating recurring meetings:', e); }
      }

      // Load agenda and apply carryover
      try {
        await loadAgendaItems(data.id);
      } catch (e) {
        debugConsole.error('Error loading agenda items for new meeting:', e);
        toast({
          title: "Agenda konnte nicht geladen werden",
          description: "Das Meeting wurde erstellt, aber die Agenda konnte nicht sofort geladen werden.",
          variant: "destructive"
        });
      }

      if (data.template_id) {
        try {
          await loadAndApplyCarryoverItems(data.id, data.template_id);
        } catch (e) {
          debugConsole.error('Error applying carryover items for new meeting:', e);
          toast({
            title: "Übertragspunkte konnten nicht angewendet werden",
            description: "Das Meeting wurde erstellt, aber Übertragspunkte konnten nicht automatisch übernommen werden.",
            variant: "destructive"
          });
        }
      }

      if (currentTenant && user) {
        try {
          const { data: allMeetings, error: reloadError } = await supabase
            .from('meetings').select('*').eq('tenant_id', currentTenant.id).eq('user_id', user.id)
            .neq('status', 'archived').order('meeting_date', { ascending: false });
          if (reloadError) throw reloadError;
          if (allMeetings) setMeetings(allMeetings.map((m: Record<string, any>) => ({ ...m, meeting_date: new Date(m.meeting_date) })));
        } catch (e) {
          debugConsole.error('Error reloading meetings after create:', e);
          toast({
            title: "Meetingliste konnte nicht aktualisiert werden",
            description: "Das Meeting wurde erstellt, aber die Liste konnte nicht neu geladen werden.",
            variant: "destructive"
          });
        }
      }

      setIsNewMeetingOpen(false);
      setNewMeeting({ title: "", description: "", meeting_date: new Date(), location: "", status: "planned", is_public: false });
      setNewMeetingParticipants([]);
      setNewMeetingRecurrence({ enabled: false, frequency: 'weekly', interval: 1, weekdays: [] });
      toast({ title: "Meeting erstellt", description: "Das Meeting wurde mit vordefinierter Agenda erstellt." });
    } catch (error: unknown) {
      debugConsole.error('Error creating meeting:', error);
      const msg = error instanceof Error ? error.message : String(error);
      toast({ title: "Fehler beim Erstellen", description: `Supabase Fehler: ${msg}`, variant: "destructive" });
    }
  };

  return { createMeeting };
}
