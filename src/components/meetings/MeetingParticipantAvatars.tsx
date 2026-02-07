import { useState, useEffect } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Participant {
  user_id: string;
  user?: {
    display_name: string | null;
    avatar_url: string | null;
  };
}

interface MeetingParticipantAvatarsProps {
  meetingId?: string;
  size?: 'xs' | 'sm' | 'default';
}

export function MeetingParticipantAvatars({ meetingId, size = 'default' }: MeetingParticipantAvatarsProps) {
  const [participants, setParticipants] = useState<Participant[]>([]);

  useEffect(() => {
    if (!meetingId) return;
    
    const loadParticipants = async () => {
      const { data: participantsData, error: participantsError } = await supabase
        .from('meeting_participants')
        .select('user_id')
        .eq('meeting_id', meetingId);

      if (participantsError || !participantsData || participantsData.length === 0) {
        setParticipants([]);
        return;
      }

      const userIds = participantsData.map(p => p.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name, avatar_url')
        .in('user_id', userIds);

      const enrichedParticipants = participantsData.map(p => ({
        ...p,
        user: profiles?.find(prof => prof.user_id === p.user_id) || null
      }));

      setParticipants(enrichedParticipants);
    };

    loadParticipants();
  }, [meetingId]);

  const getInitials = (name: string | null | undefined) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (participants.length === 0) return null;

  const sizeClasses = {
    xs: { wrapper: 'gap-0.5 mt-1', icon: 'h-2.5 w-2.5', avatar: 'h-4 w-4', text: 'text-[10px]' },
    sm: { wrapper: 'gap-0.5 mt-1.5', icon: 'h-3 w-3', avatar: 'h-5 w-5', text: 'text-xs' },
    default: { wrapper: 'gap-1 mt-2', icon: 'h-3.5 w-3.5', avatar: 'h-6 w-6', text: 'text-xs' },
  };
  const s = sizeClasses[size];

  return (
    <div className={`flex items-center ${s.wrapper}`}>
      <Users className={`${s.icon} text-muted-foreground`} />
      <div className="flex -space-x-1">
        {participants.slice(0, 5).map(p => (
          <Avatar key={p.user_id} className={`${s.avatar} border-2 border-background`}>
            <AvatarImage src={p.user?.avatar_url || undefined} />
            <AvatarFallback className={s.text}>
              {getInitials(p.user?.display_name)}
            </AvatarFallback>
          </Avatar>
        ))}
        {participants.length > 5 && (
          <span className={`${s.text} text-muted-foreground ml-1`}>
            +{participants.length - 5}
          </span>
        )}
      </div>
    </div>
  );
}
