import { useMemo, useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Vote, MessageSquare, Undo2 } from 'lucide-react';
import { differenceInCalendarDays, format } from 'date-fns';
import { de } from 'date-fns/locale';
import { useAuth } from '@/hooks/useAuth';
import { useMyWorkDecisionsData } from '@/hooks/useMyWorkDecisionsData';
import { getResponseSummary, MyWorkDecision } from '@/components/my-work/decisions/types';
import { TaskDecisionResponse } from '@/components/task-decisions/TaskDecisionResponse';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

function formatDeadline(deadline: string | null): { label: string; isOverdue: boolean } {
  if (!deadline) return { label: 'Ohne Frist', isOverdue: false };
  const d = new Date(deadline);
  const diff = differenceInCalendarDays(d, new Date());
  if (diff < 0) return { label: `überfällig · ${format(d, 'dd.MM.', { locale: de })}`, isOverdue: true };
  if (diff === 0) return { label: 'fällig heute', isOverdue: false };
  if (diff === 1) return { label: 'fällig morgen', isOverdue: false };
  return { label: `fällig in ${diff} Tagen`, isOverdue: false };
}

const PROMPT_COLOR_CLASS: Record<string, string> = {
  green: 'border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/30',
  red: 'border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-950/30',
  orange: 'border-orange-200 bg-orange-50 dark:border-orange-900/40 dark:bg-orange-950/30',
  yellow: 'border-yellow-200 bg-yellow-50 dark:border-yellow-900/40 dark:bg-yellow-950/30',
  blue: 'border-blue-200 bg-blue-50 dark:border-blue-900/40 dark:bg-blue-950/30',
  default: 'border-border bg-muted/40',
};

interface DecisionRowProps {
  decision: MyWorkDecision;
  onRefresh: () => void;
  onOpen: (id: string) => void;
  onPromptOpen: (id: string) => void;
  onPromptClose: (id: string) => void;
  forcePrompt?: { color: string } | null;
}

function DecisionRow({ decision, onRefresh, onOpen, onPromptOpen, onPromptClose, forcePrompt }: DecisionRowProps) {
  const summary = getResponseSummary(decision.participants);
  const { label, isOverdue } = formatDeadline(decision.response_deadline);
  const [prompt, setPrompt] = useState<{ color: string } | null>(forcePrompt ?? null);
  const { toast } = useToast();

  useEffect(() => {
    if (forcePrompt && !prompt) setPrompt(forcePrompt);
  }, [forcePrompt, prompt]);

  const handleSubmitted = (meta?: { responseType: string; color?: string }) => {
    const color = meta?.color
      || decision.response_options?.find((o) => o.key === meta?.responseType)?.color
      || 'green';
    setPrompt({ color });
    onPromptOpen(decision.id);
  };

  const handleUndo = async () => {
    if (!decision.participant_id) return;
    const { error } = await supabase
      .from('task_decision_responses')
      .delete()
      .eq('decision_id', decision.id)
      .eq('participant_id', decision.participant_id)
      .is('parent_response_id', null);
    if (error) {
      toast({ title: 'Rückgängig fehlgeschlagen', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Antwort zurückgenommen' });
    setPrompt(null);
    onPromptClose(decision.id);
    onRefresh();
  };

  const handleAddJustification = () => {
    setPrompt(null);
    onPromptClose(decision.id);
    onOpen(decision.id);
  };

  const handleDismiss = () => {
    setPrompt(null);
    onPromptClose(decision.id);
    onRefresh();
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(decision.id)}
      onKeyDown={(e) => { if (e.key === 'Enter') onOpen(decision.id); }}
      className="rounded-md border border-border bg-card p-3 hover:bg-muted/40 transition-colors cursor-pointer"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Vote className="h-3.5 w-3.5 shrink-0 text-purple-500" />
          <span className="text-sm font-medium truncate">{decision.title}</span>
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

      {decision.isParticipant && decision.participant_id && !decision.hasResponded && !prompt && (
        <div onClick={(e) => e.stopPropagation()}>
          <TaskDecisionResponse
            decisionId={decision.id}
            participantId={decision.participant_id}
            onResponseSubmitted={handleSubmitted}
            hasResponded={false}
            creatorId={decision.created_by}
            layout="decision-panel"
            disabled={false}
            showCreatorResponse={false}
          />
        </div>
      )}

      {prompt && (
        <div
          onClick={(e) => e.stopPropagation()}
          className={cn(
            'animate-in fade-in slide-in-from-top-1 mt-1 rounded-md border p-2 text-xs',
            PROMPT_COLOR_CLASS[prompt.color] || PROMPT_COLOR_CLASS.default,
          )}
        >
          <div className="flex items-center gap-1.5 font-semibold text-foreground mb-1">
            <MessageSquare className="h-3.5 w-3.5" /> Entscheidung erfasst.
          </div>
          <div className="text-muted-foreground mb-2">
            Aktualisierung in 10 Sekunden – oder direkt:
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={handleAddJustification}>
              <MessageSquare className="h-3 w-3 mr-1" />Begründung hinzufügen
            </Button>
            <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={handleUndo}>
              <Undo2 className="h-3 w-3 mr-1" />Rückgängig
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function DashboardDecisionsWidget() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { decisions, loading, loadDecisions } = useMyWorkDecisionsData(user?.id);

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

  const goToDecision = (id: string) => {
    navigate(`/mywork?tab=decisions&highlight=${id}`);
  };

  if (loading) return <div className="animate-pulse h-32 bg-muted rounded-lg" />;

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">Keine ausstehenden Entscheidungen.</p>;
  }

  return (
    <div className="space-y-3">
      {items.map((d) => (
        <DecisionRow
          key={d.id}
          decision={d}
          onRefresh={() => loadDecisions({ silent: true })}
          onOpen={goToDecision}
        />
      ))}
    </div>
  );
}
