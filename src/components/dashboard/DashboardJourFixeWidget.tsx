import { useNavigate } from 'react-router-dom';
import { Calendar, Users } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { useAuth } from '@/hooks/useAuth';
import { useMyWorkJourFixeMeetings } from '@/hooks/useMyWorkJourFixeMeetings';

function formatMeetingWhen(date: string, time?: string | null): string {
  const d = new Date(date);
  const datePart = format(d, 'EEE, dd.MM.', { locale: de });
  if (time) return `${datePart} · ${time.slice(0, 5)}`;
  return `${datePart} · ganztägig`;
}

export function DashboardJourFixeWidget() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { upcomingMeetings, meetingParticipants, loading } = useMyWorkJourFixeMeetings(user?.id);

  if (loading) return <div className="animate-pulse h-24 bg-muted rounded-lg" />;

  const items = (upcomingMeetings ?? []).slice(0, 2);

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">Keine anstehenden Jour fixes.</p>;
  }

  return (
    <div className="space-y-2">
      {items.map((m) => {
        const participants = meetingParticipants[m.id] || [];
        return (
          <button
            key={m.id}
            type="button"
            onClick={() => navigate(`/meetings?id=${m.id}`)}
            className="w-full text-left rounded-md border border-border bg-card p-3 hover:bg-muted/40 transition-colors"
          >
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1 tabular-nums">
              <Calendar className="h-3.5 w-3.5" />
              {formatMeetingWhen(m.meeting_date, m.meeting_time)}
            </div>
            <div className="text-sm font-medium truncate">{m.title}</div>
            {participants.length > 0 && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                <Users className="h-3 w-3" />
                {participants.length} Teilnehmende
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
