import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface MeetingParticipant {
  id: string;
  meeting_id: string;
  contact_id: string;
  role: 'organizer' | 'participant' | 'optional';
  status: 'pending' | 'confirmed' | 'declined';
  created_at: string;
  contact?: {
    id: string;
    name: string;
    email?: string;
    avatar_url?: string;
    organization?: string;
  };
}

export function useMeetingParticipants(meetingId?: string) {
  const [participants, setParticipants] = useState<MeetingParticipant[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (meetingId) {
      loadParticipants();
    } else {
      setParticipants([]);
    }
  }, [meetingId]);

  const loadParticipants = async () => {
    if (!meetingId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('meeting_participants')
        .select(`
          *,
          contact:contacts(id, name, email, avatar_url, organization)
        `)
        .eq('meeting_id', meetingId);

      if (error) throw error;
      setParticipants((data || []) as MeetingParticipant[]);
    } catch (error) {
      console.error('Error loading participants:', error);
    } finally {
      setLoading(false);
    }
  };

  const addParticipant = async (contactId: string, role: 'organizer' | 'participant' | 'optional' = 'participant') => {
    if (!meetingId) return null;

    try {
      const { data, error } = await supabase
        .from('meeting_participants')
        .insert({
          meeting_id: meetingId,
          contact_id: contactId,
          role,
          status: 'pending'
        })
        .select(`
          *,
          contact:contacts(id, name, email, avatar_url, organization)
        `)
        .single();

      if (error) {
        if (error.code === '23505') {
          toast({
            title: "Teilnehmer existiert bereits",
            description: "Dieser Kontakt ist bereits als Teilnehmer hinzugefügt.",
            variant: "destructive"
          });
          return null;
        }
        throw error;
      }

      setParticipants(prev => [...prev, data as MeetingParticipant]);
      return data as MeetingParticipant;
    } catch (error) {
      console.error('Error adding participant:', error);
      toast({
        title: "Fehler",
        description: "Teilnehmer konnte nicht hinzugefügt werden.",
        variant: "destructive"
      });
      return null;
    }
  };

  const updateParticipant = async (participantId: string, updates: Partial<Pick<MeetingParticipant, 'role' | 'status'>>) => {
    try {
      const { error } = await supabase
        .from('meeting_participants')
        .update(updates)
        .eq('id', participantId);

      if (error) throw error;

      setParticipants(prev => 
        prev.map(p => p.id === participantId ? { ...p, ...updates } : p)
      );
    } catch (error) {
      console.error('Error updating participant:', error);
      toast({
        title: "Fehler",
        description: "Teilnehmer konnte nicht aktualisiert werden.",
        variant: "destructive"
      });
    }
  };

  const removeParticipant = async (participantId: string) => {
    try {
      const { error } = await supabase
        .from('meeting_participants')
        .delete()
        .eq('id', participantId);

      if (error) throw error;

      setParticipants(prev => prev.filter(p => p.id !== participantId));
    } catch (error) {
      console.error('Error removing participant:', error);
      toast({
        title: "Fehler",
        description: "Teilnehmer konnte nicht entfernt werden.",
        variant: "destructive"
      });
    }
  };

  const addMultipleParticipants = async (contactIds: string[], role: 'organizer' | 'participant' | 'optional' = 'participant') => {
    if (!meetingId || contactIds.length === 0) return [];

    try {
      const insertData = contactIds.map(contactId => ({
        meeting_id: meetingId,
        contact_id: contactId,
        role,
        status: 'pending' as const
      }));

      const { data, error } = await supabase
        .from('meeting_participants')
        .insert(insertData)
        .select(`
          *,
          contact:contacts(id, name, email, avatar_url, organization)
        `);

      if (error) throw error;

      setParticipants(prev => [...prev, ...((data || []) as MeetingParticipant[])]);
      return (data || []) as MeetingParticipant[];
    } catch (error) {
      console.error('Error adding multiple participants:', error);
      return [];
    }
  };

  return {
    participants,
    loading,
    addParticipant,
    updateParticipant,
    removeParticipant,
    addMultipleParticipants,
    reload: loadParticipants
  };
}
