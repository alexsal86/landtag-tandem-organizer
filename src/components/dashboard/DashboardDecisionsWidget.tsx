import { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, Undo2 } from 'lucide-react';
import { differenceInCalendarDays, format } from 'date-fns';
import { de } from 'date-fns/locale';
import { useAuth } from '@/hooks/useAuth';
import { useMyWorkDecisionsData } from '@/hooks/useMyWorkDecisionsData';
import { getResponseSummary, MyWorkDecision } from '@/components/my-work/decisions/types';
import { TaskDecisionResponse } from '@/components/task-decisions/TaskDecisionResponse';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { getColorClasses } from "@/lib/decisionTemplates";
import { notify } from "@/lib/notify";

function formatDeadline(deadline: string | null): { label: string; isOverdue: boolean } {
  if (!deadline) return { label: 'Ohne Frist', isOverdue: false };
  const d = new Date(deadline);
  const diff = differenceInCalendarDays(d, new Date());
  if (diff < 0) return { label: `Antwort überfällig seit ${format(d, 'dd.MM.', { locale: de })}`, isOverdue: true };
  if (diff === 0) return { label: 'Antwort bis heute', isOverdue: false };
  if (diff === 1) return { label: 'Antwort bis morgen', isOverdue: false };
  return { label: `Antwort bis ${format(d, diff < 7 ? 'EEEE' : 'EEEE, d. MMMM', { locale: de })}`, isOverdue: false };
}

const PROMPT_COLOR_CLASS: Record<string, string> = {
  green: 'border-palette-green/30 bg-palette-green/10',
  red: 'border-palette-red/30 bg-palette-red/10',
  orange: 'border-palette-orange/30 bg-palette-orange/10',
  yellow: 'border-palette-yellow/30 bg-palette-yellow/10',
  blue: 'border-palette-blue/30 bg-palette-blue/10',
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
  const recommendation = decision.response_options?.find(option => option.recommended);
  const recommendationColors = recommendation ? getColorClasses(recommendation.color) : null;
  const { label, isOverdue } = formatDeadline(decision.response_deadline);
  const [prompt, setPrompt] = useState<{ color: string } | null>(forcePrompt ?? null);

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
      notify.error('Rückgängig fehlgeschlagen', { description: error.message
});
      return;
    }
    notify.success('Antwort zurückgenommen');
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
      onKeyDown={(e) => {
        if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onOpen(decision.id);
        }
      }}
      className="py-4 first:pt-0 last:pb-0"
    >
      <div className="mb-3">
        <p className="break-words text-base font-medium leading-6">{decision.title}</p>
        <p className={cn("mt-1 text-sm", isOverdue ? "text-destructive" : "text-muted-foreground")}>
          {label}
        </p>
      </div>

      {recommendation && recommendationColors && (
        <div className={cn("mb-3 rounded-2xl px-3 py-2.5 text-sm leading-6 text-foreground", recommendationColors.bgClass)}>
          <span className={cn("font-medium", recommendationColors.textClass)}>Büro empfiehlt: {recommendation.label}.</span>
          {recommendation.recommendation_reason?.trim() && <> {recommendation.recommendation_reason.trim()}</>}
        </div>
      )}

      {decision.isCreator && !decision.isParticipant && (
        <p className="text-xs text-muted-foreground mb-2">
          {decision.pendingCount > 0 ? 'Warten auf Rückmeldung' : 'Rückmeldungen liegen vor'}
        </p>
      )}

      {summary.total > 0 && decision.isCreator && (
        <div className="flex items-center gap-1 mb-2" aria-hidden>
          {Array.from({ length: summary.yesCount }).map((_, i) => <span key={`y${i}`} className="h-1.5 flex-1 rounded-sm bg-palette-green" />)}
          {Array.from({ length: summary.noCount }).map((_, i) => <span key={`n${i}`} className="h-1.5 flex-1 rounded-sm bg-destructive" />)}
          {Array.from({ length: summary.questionCount }).map((_, i) => <span key={`q${i}`} className="h-1.5 flex-1 rounded-sm bg-palette-amber" />)}
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
            Du kannst die Antwort zurücknehmen oder begründen:
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={handleAddJustification}>
              <MessageSquare className="h-3 w-3 mr-1" />Begründung hinzufügen
            </Button>
            <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={handleUndo}>
              <Undo2 className="h-3 w-3 mr-1" />Rückgängig
            </Button>
            <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs ml-auto" onClick={handleDismiss}>
              Fertig
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
  const { decisions, loading, error, loadDecisions } = useMyWorkDecisionsData(user?.id);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

  const handlePromptOpen = (id: string) =>
    setPendingIds((prev) => { const n = new Set(prev); n.add(id); return n; });
  const handlePromptClose = (id: string) =>
    setPendingIds((prev) => { const n = new Set(prev); n.delete(id); return n; });

  const items = useMemo(() => {
    return [...decisions]
      .filter((d) => d.status !== 'resolved' && ((d.isParticipant && !d.hasResponded) || d.isCreator || pendingIds.has(d.id)))
      .sort((a, b) => {
        if (!a.response_deadline && !b.response_deadline) return 0;
        if (!a.response_deadline) return 1;
        if (!b.response_deadline) return -1;
        return new Date(a.response_deadline).getTime() - new Date(b.response_deadline).getTime();
      })
      .slice(0, 3);
  }, [decisions, pendingIds]);

  const goToDecision = (id: string) => {
    navigate(`/mywork?tab=decisions&highlight=${id}`);
  };

  if (loading) return <div className="animate-pulse h-32 bg-muted rounded-lg" />;

  if (error) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-destructive">Entscheidungen konnten nicht geladen werden.</p>
        <Button size="sm" variant="outline" onClick={() => void loadDecisions()}>Erneut laden</Button>
      </div>
    );
  }

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">Keine ausstehenden Entscheidungen.</p>;
  }

  return (
    <div className="divide-y divide-border">
      {items.map((d) => (
        <DecisionRow
          key={d.id}
          decision={d}
          onRefresh={() => loadDecisions({ silent: true })}
          onOpen={goToDecision}
          onPromptOpen={handlePromptOpen}
          onPromptClose={handlePromptClose}
          forcePrompt={pendingIds.has(d.id) && d.hasResponded ? { color: 'green' } : null}
        />
      ))}
    </div>
  );
}
