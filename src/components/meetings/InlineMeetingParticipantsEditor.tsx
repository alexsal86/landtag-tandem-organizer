import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserSelector } from '@/components/UserSelector';
import { Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Participant {
  id: string;
  user_id: string;
  role: 'organizer' | 'participant' | 'optional';
  user?: {
    display_name: string | null;
    avatar_url: string | null;
  };
}

interface InlineMeetingParticipantsEditorProps {
  meetingId: string;
}

const roleLabels: Record<string, { label: string; color: string }> = {
  organizer: { label: 'Org', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300' },
  participant: { label: 'Teiln', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300' },
  optional: { label: 'Opt', color: 'bg-muted text-muted-foreground' }
};

export function InlineMeetingParticipantsEditor({ meetingId }: InlineMeetingParticipantsEditorProps) {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRole, setSelectedRole] = useState<'organizer' | 'participant' | 'optional'>('participant');

  useEffect(() => {
    if (meetingId) {
      loadParticipants();
    } else {
      setLoading(false);
    }
  }, [meetingId]);

  const loadParticipants = async () => {
    if (!meetingId) {
      console.error('InlineMeetingParticipantsEditor: No meetingId provided!');
      setLoading(false);
      return;
    }
    
    setLoading(true);
    console.log('Loading participants for meeting:', meetingId);
    
    const { data: participantsData, error: participantsError } = await supabase
      .from('meeting_participants')
      .select('id, user_id, role')
      .eq('meeting_id', meetingId);

    if (participantsError) {
      console.error('Error loading participants:', participantsError);
      setParticipants([]);
      setLoading(false);
      return;
    }
    
    if (!participantsData || participantsData.length === 0) {
      console.log('No participants found for meeting:', meetingId);
      setParticipants([]);
      setLoading(false);
      return;
    }

    const userIds = participantsData.map(p => p.user_id);
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('user_id, display_name, avatar_url')
      .in('user_id', userIds);

    if (profilesError) {
      console.error('Error loading profiles:', profilesError);
    }

    const enrichedParticipants: Participant[] = participantsData.map(p => ({
      ...p,
      role: (p.role as 'organizer' | 'participant' | 'optional') || 'participant',
      user: profiles?.find(prof => prof.user_id === p.user_id) || undefined
    }));

    console.log('Loaded participants:', enrichedParticipants);
    setParticipants(enrichedParticipants);
    setLoading(false);
  };

  const handleAddParticipant = async (user: { id: string; display_name: string }) => {
    if (!meetingId) {
      console.error('InlineMeetingParticipantsEditor: No meetingId provided!');
      return;
    }
    if (participants.some(p => p.user_id === user.id)) {
      console.log('User already a participant');
      return;
    }

    console.log('Adding participant:', user.id, 'to meeting:', meetingId, 'with role:', selectedRole);
    
    const { data, error } = await supabase
      .from('meeting_participants')
      .insert({
        meeting_id: meetingId,
        user_id: user.id,
        role: selectedRole,
        status: 'pending'
      })
      .select()
      .single();

    if (error) {
      console.error('Error adding participant:', error);
      return;
    }
    
    if (data) {
      console.log('Participant added successfully:', data);
      setParticipants(prev => [...prev, {
        ...data,
        role: selectedRole,
        user: { display_name: user.display_name, avatar_url: null }
      }]);
    }
  };

  const handleRoleChange = async (participantId: string, newRole: 'organizer' | 'participant' | 'optional') => {
    const { error } = await supabase
      .from('meeting_participants')
      .update({ role: newRole })
      .eq('id', participantId);

    if (error) {
      console.error('Error updating participant role:', error);
      return;
    }
    
    setParticipants(prev => prev.map(p => 
      p.id === participantId ? { ...p, role: newRole } : p
    ));
  };

  const handleRemoveParticipant = async (participantId: string) => {
    const { error } = await supabase
      .from('meeting_participants')
      .delete()
      .eq('id', participantId);

    if (!error) {
      setParticipants(prev => prev.filter(p => p.id !== participantId));
    } else {
      console.error('Error removing participant:', error);
    }
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

  if (loading) {
    return <p className="text-xs text-muted-foreground">Lade Teilnehmer...</p>;
  }

  return (
    <div className="space-y-3">
      {/* Add participant with role selection */}
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <UserSelector
            onSelect={handleAddParticipant}
            placeholder="Teilnehmer hinzufügen..."
            clearAfterSelect
            excludeUserIds={participants.map(p => p.user_id)}
          />
        </div>
        <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as any)}>
          <SelectTrigger className="w-28 h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="organizer">Organisator</SelectItem>
            <SelectItem value="participant">Teilnehmer</SelectItem>
            <SelectItem value="optional">Optional</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      {/* Participants list */}
      {participants.length > 0 && (
        <div className="space-y-2">
          {participants.map(p => (
            <div 
              key={p.id} 
              className="flex items-center gap-2 p-2 bg-muted/50 rounded-md"
            >
              <Avatar className="h-7 w-7">
                <AvatarImage src={p.user?.avatar_url || undefined} />
                <AvatarFallback className="text-xs">
                  {getInitials(p.user?.display_name)}
                </AvatarFallback>
              </Avatar>
              <span className="flex-1 text-sm">{p.user?.display_name || 'Unbekannt'}</span>
              <Select value={p.role} onValueChange={(v) => handleRoleChange(p.id, v as any)}>
                <SelectTrigger className="w-28 h-7 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="organizer">Organisator</SelectItem>
                  <SelectItem value="participant">Teilnehmer</SelectItem>
                  <SelectItem value="optional">Optional</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 hover:bg-destructive/20"
                onClick={() => handleRemoveParticipant(p.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
      
      {participants.length === 0 && (
        <p className="text-xs text-muted-foreground">Keine Teilnehmer hinzugefügt</p>
      )}
    </div>
  );
}
