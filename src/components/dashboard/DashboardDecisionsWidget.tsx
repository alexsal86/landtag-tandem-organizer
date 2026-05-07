import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Vote } from 'lucide-react';
import { differenceInCalendarDays, format } from 'date-fns';
import { de } from 'date-fns/locale';
import { useAuth } from '@/hooks/useAuth';
import { useMyWorkDecisionsData } from '@/hooks/useMyWorkDecisionsData';
import { getResponseSummary } from '@/components/my-work/decisions/types';
import { Button } from '@/components/ui/button';

function formatDeadline(deadline: string | null): { label: string; isOverdue: boolean } {
  if (!deadline) return { label: 'Ohne Frist', isOverdue: false };
  const d = new Date(deadline);
  const diff = differenceInCalendarDays(d, new Date());
  if (diff < 0) return { label: `überfällig · ${format(d, 'dd.MM.', { locale: de })}`, isOverdue: true };
  if (diff === 0) return { label: 'fällig heute', isOverdue: false };
  if (diff === 1) return { label: 'fällig morgen', isOverdue: false };
  return { label: `fällig in ${diff} Tagen`, isOverdue: false };
}

export function DashboardDecisionsWidget() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { decisions, loading } = useMyWorkDecisionsData(user?.id);

  const items = useMemo(() => {
    return [...decisions]
      .filter((d) => d.status !== 'resolved')
      .sort((a, b) => {
        if (!a.response_deadline && !b.response_deadline) return 0;
        if (!a.response_deadline) return 1;
        if (!b.response_deadline) return -1;
        return new Date(a.response_deadline).getTime() - new Date(b.response_deadline).getTime();
      })
      .slice(0, 3);
  }, [decisions]);

  const goToDecision = (id: string, respond?: 'yes' | 'no' | 'question') => {
    const respondQs = respond ? `&respond=${respond}` : '';
    navigate(`/mywork?tab=decisions&highlight=${id}${respondQs}`);
  };

  if (loading) return <div className="animate-pulse h-32 bg-muted rounded-lg" />;

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">Keine ausstehenden Entscheidungen.</p>;
  }

  return (
    <div className="space-y-3">
      {items.map((d) => {
        const summary = getResponseSummary(d.participants);
        const { label, isOverdue } = formatDeadline(d.response_deadline);
        return (
          <div
            key={d.id}
            role="button"
            tabIndex={0}
            onClick={() => goToDecision(d.id)}
            onKeyDown={(e) => { if (e.key === 'Enter') goToDecision(d.id); }}
            className="rounded-md border border-border bg-card p-3 hover:bg-muted/40 transition-colors cursor-pointer"
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <Vote className="h-3.5 w-3.5 shrink-0 text-purple-500" />
                <span className="text-sm font-medium truncate">{d.title}</span>
              </div>
              <span className={`text-xs shrink-0 tabular-nums ${isOverdue ? 'text-destructive' : 'text-muted-foreground'}`}>
                {label}
              </span>
            </div>
            {summary.total > 0 && (
              <div className="flex items-center gap-1 mb-2" aria-hidden>
                {Array.from({ length: summary.yesCount }).map((_, i) => <span key={`y${i}`} className="h-1.5 flex-1 rounded-sm bg-emerald-500" />)}
                {Array.from({ length: summary.noCount }).map((_, i) => <span key={`n${i}`} className="h-1.5 flex-1 rounded-sm bg-destructive" />)}
                {Array.from({ length: summary.questionCount }).map((_, i) => <span key={`q${i}`} className="h-1.5 flex-1 rounded-sm bg-amber-500" />)}
                {Array.from({ length: summary.pending }).map((_, i) => <span key={`p${i}`} className="h-1.5 flex-1 rounded-sm bg-muted" />)}
              </div>
            )}
            {!d.hasResponded && d.isParticipant && (
              <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                <Button size="sm" variant="outline" className="h-7 px-2 text-xs flex-1" onClick={() => goToDecision(d.id, 'yes')}>
                  Ja
                </Button>
                <Button size="sm" variant="outline" className="h-7 px-2 text-xs flex-1" onClick={() => goToDecision(d.id, 'no')}>
                  Nein
                </Button>
                <Button size="sm" variant="outline" className="h-7 px-2 text-xs flex-1" onClick={() => goToDecision(d.id, 'question')}>
                  Frage
                </Button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
