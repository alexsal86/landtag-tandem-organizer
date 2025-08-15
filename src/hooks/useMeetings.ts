import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Meeting, MeetingTemplate } from "@/types/meeting";
import { format } from "date-fns";

export function useMeetings() {
  const { toast } = useToast();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [meetingTemplates, setMeetingTemplates] = useState<MeetingTemplate[]>([]);

  const loadMeetings = async () => {
    try {
      const { data, error } = await supabase
        .from('meetings')
        .select('*')
        .order('meeting_date', { ascending: false });

      if (error) throw error;
      setMeetings((data || []).map(meeting => ({
        ...meeting,
        meeting_date: new Date(meeting.meeting_date)
      })));
    } catch (error) {
      toast({
        title: "Fehler beim Laden der Meetings",
        description: "Die Meetings konnten nicht geladen werden.",
        variant: "destructive",
      });
    }
  };

  const loadMeetingTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('meeting_templates')
        .select('*')
        .order('name');

      if (error) throw error;
      setMeetingTemplates(data || []);
    } catch (error) {
      console.error('Error loading meeting templates:', error);
    }
  };

  const createMeeting = async (newMeeting: Meeting, userId: string) => {
    if (!newMeeting.title.trim()) {
      toast({
        title: "Fehler", 
        description: "Bitte geben Sie einen Titel ein!",
        variant: "destructive",
      });
      return null;
    }

    try {
      const insertData = {
        title: newMeeting.title,
        description: newMeeting.description || null,
        meeting_date: format(newMeeting.meeting_date, 'yyyy-MM-dd'),
        location: newMeeting.location || null,
        status: newMeeting.status,
        user_id: userId,
        template_id: newMeeting.template_id || null
      };

      const { data, error } = await supabase
        .from('meetings')
        .insert([insertData])
        .select()
        .single();

      if (error) throw error;

      const newMeetingWithDate = {...data, meeting_date: new Date(data.meeting_date)};
      setMeetings(prev => [newMeetingWithDate, ...prev]);

      toast({
        title: "Meeting erstellt",
        description: "Das Meeting wurde mit vordefinierter Agenda erstellt.",
      });

      return newMeetingWithDate;
    } catch (error) {
      console.error('Error creating meeting:', error);
      toast({
        title: "Fehler beim Erstellen",
        description: `Supabase Fehler: ${error.message || error.toString()}`,
        variant: "destructive",
      });
      return null;
    }
  };

  const updateMeeting = async (meeting: Meeting) => {
    if (!meeting.id) return;

    try {
      const updateData = {
        title: meeting.title,
        description: meeting.description,
        meeting_date: format(meeting.meeting_date, 'yyyy-MM-dd'),
        location: meeting.location,
        status: meeting.status,
      };

      const { error } = await supabase
        .from('meetings')
        .update(updateData)
        .eq('id', meeting.id);

      if (error) throw error;

      setMeetings(prev => 
        prev.map(m => m.id === meeting.id ? { ...meeting, meeting_date: new Date(meeting.meeting_date) } : m)
      );

      toast({
        title: "Meeting aktualisiert",
        description: "Die Änderungen wurden gespeichert.",
      });
    } catch (error) {
      console.error('Error updating meeting:', error);
      toast({
        title: "Fehler beim Speichern",
        description: "Die Änderungen konnten nicht gespeichert werden.",
        variant: "destructive",
      });
    }
  };

  const deleteMeeting = async (meetingId: string) => {
    try {
      // Delete meeting (cascade will handle agenda items and documents)
      const { error } = await supabase
        .from('meetings')
        .delete()
        .eq('id', meetingId);

      if (error) throw error;

      setMeetings(prev => prev.filter(m => m.id !== meetingId));

      toast({
        title: "Meeting gelöscht",
        description: "Das Meeting und alle zugehörigen Daten wurden gelöscht.",
      });
    } catch (error) {
      console.error('Error deleting meeting:', error);
      toast({
        title: "Fehler beim Löschen",
        description: "Das Meeting konnte nicht gelöscht werden.",
        variant: "destructive",
      });
    }
  };

  return {
    meetings,
    meetingTemplates,
    loadMeetings,
    loadMeetingTemplates,
    createMeeting,
    updateMeeting,
    deleteMeeting,
    setMeetings
  };
}