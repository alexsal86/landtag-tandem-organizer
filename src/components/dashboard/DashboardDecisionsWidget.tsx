import { useWorkspaceView } from "@/contexts/WorkspaceViewContext";
import { decisionNudgeDateTime, decisionNudgePriority } from "@/features/decisions/dashboardNudges";
import { useDeputyDashboardDecisions, type DeputyDashboardDecision } from "@/features/decisions/useDeputyDashboardDecisions";
import { useMemo, useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, ChevronRight, MessageSquare, Undo2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { berlinDateShort, berlinDaysSince, berlinWeekday, berlinWeekdayDate } from '@/utils/berlinDate';
import { useMyWorkDecisionsData } from '@/hooks/useMyWorkDecisionsData';
import { needsOwnDecision, resetOwnDecisionResponse, MyWorkDecision } from '@/components/my-work/decisions/types';
import { TaskDecisionResponse } from '@/components/task-decisions/TaskDecisionResponse';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { notify } from "@/lib/notify";
import { ErrorState } from '@/components/ui-patterns';

/**
 * Antwortfristen werden über Berliner Kalendertage bewertet: `new Date('2026-11-25')`
 * ist UTC-Mitternacht und würde die Frist sonst auf den Vortag schieben.
 */
function formatDeadline(deadline: string | null, now: Date = new Date()): { label: string; isOverdue: boolean } {
  if (!deadline) return { label: '', isOverdue: false };
  const daysSince = berlinDaysSince(deadline, now);
  if (daysSince > 0) return { label: `Antwort überfällig seit ${berlinDateShort(deadline)}`, isOverdue: true };
  if (daysSince === 0) return { label: 'Antwort bis heute', isOverdue: false };
  if (daysSince === -1) return { label: 'Antwort bis morgen', isOverdue: false };
  return { label: `Antwort bis ${daysSince > -7 ? berlinWeekday(deadline) : berlinWeekdayDate(deadline)}`, isOverdue: false };
}

const PROMPT_COLOR_CLASS: Record<string, string> = {
  green: 'border-palette-green/30 bg-palette-green/10',
  red: 'border-palette-red/30 bg-palette-red/10',
  orange: 'border-palette-orange/30 bg-palette-orange/10',
  yellow: 'border-palette-yellow/30 bg-palette-yellow/10',
  blue: 'border-palette-blue/30 bg-palette-blue/10',
  default: 'border-border bg-muted/40',
};

// Textfarbe jeweils als dunkle Variante der Chip-Farbe, damit "Büro: …" auf dem
// hellen Chip lesbar bleibt. Für Grün gilt das schon im Geburtstags-Chip genutzte
// Dunkelgrün, die übrigen Töne entsprechen den 700er-Stufen derselben Hues.
const RECOMMENDATION_COLOR_CLASS: Record<string, { background: string; text: string }> = {
  green: { background: 'bg-[#eaf5df]', text: 'text-[#397d16]' },
  red: { background: 'bg-palette-red/10', text: 'text-[#b91c1c]' },
  orange: { background: 'bg-palette-orange/10', text: 'text-[#c2410c]' },
  yellow: { background: 'bg-palette-yellow/10', text: 'text-[#a16207]' },
  blue: { background: 'bg-palette-blue/10', text: 'text-[#1d4ed8]' },
  purple: { background: 'bg-palette-purple/10', text: 'text-[#7e22ce]' },
  lime: { background: 'bg-palette-lime/10', text: 'text-[#4d7c0f]' },
  gray: { background: 'bg-palette-gray/10', text: 'text-[#374151]' },
};

interface DecisionRowProps {
  decision: MyWorkDecision;
  expanded: boolean;
  onToggle: () => void;
  nudge?: DeputyDashboardDecision;
  onDismissConfirmed: (id: string) => void;
  onOpen: (id: string) => void;
  onPromptOpen: (id: string) => void;
  onPromptClose: (id: string) => void;
  onUndoConfirmed: (id: string) => void;
  forcePrompt?: { color: string } | null;
}

function DecisionRow({ decision, expanded, onToggle, nudge, onDismissConfirmed, onOpen, onPromptOpen, onPromptClose, onUndoConfirmed, forcePrompt }: DecisionRowProps) {
  const recommendation = decision.response_options?.find(option => option.recommended);
  const recommendationColor = RECOMMENDATION_COLOR_CLASS[recommendation?.color ?? ''] ?? RECOMMENDATION_COLOR_CLASS.green;
  const { label, isOverdue } = formatDeadline(decision.response_deadline);
  const [undoing, setUndoing] = useState(false);
  const [exiting, setExiting] = useState(false);
  const exitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (exitTimer.current) clearTimeout(exitTimer.current);
  }, []);
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
    if (!decision.participant_id || undoing) return;
    setUndoing(true);
    try {
      const { error } = await supabase
        .from('task_decision_responses')
        .delete()
        .eq('decision_id', decision.id)
        .eq('participant_id', decision.participant_id)
        .is('parent_response_id', null)
        .select('id');
      if (error) throw error;

      const { data: remaining, error: verifyError } = await supabase
        .from('task_decision_responses')
        .select('id')
        .eq('decision_id', decision.id)
        .eq('participant_id', decision.participant_id)
        .is('parent_response_id', null);
      if (verifyError) throw verifyError;
      if (remaining?.length) throw new Error('Die Antwort ist weiterhin gespeichert. Die Rücknahme wurde nicht bestätigt.');

      onUndoConfirmed(decision.id);
      setPrompt(null);
      notify.success('Antwort zurückgenommen');
    } catch (error) {
      notify.error('Rückgängig fehlgeschlagen', {
        description: error instanceof Error ? error.message : 'Die Antwort konnte nicht zurückgenommen werden. Bitte erneut versuchen.',
      });
    } finally {
      setUndoing(false);
    }
  };

  const handleAddJustification = () => {
    setPrompt(null);
    onPromptClose(decision.id);
    onOpen(decision.id);
  };

  const handleDismiss = () => {
    if (exiting || undoing) return;
    const finish = () => {
      setPrompt(null);
      onDismissConfirmed(decision.id);
    };
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      finish();
      return;
    }
    setExiting(true);
    exitTimer.current = setTimeout(finish, 250);
  };

  return (
    <div
      className={cn("dashboard-decision-exit", expanded ? "py-4 first:pt-0 last:pb-0" : "py-3", exiting && "pointer-events-none opacity-0")}
      style={{ transform: exiting ? "translateX(24px)" : undefined }}
    >
      {expanded && nudge?.nudged_at && <div className="animate-fade-up mb-3 rounded-xl bg-[#eee9f9] px-3 py-2 text-xs" role="status">
        <p className="flex items-center gap-1.5 text-meta font-medium text-[#8b5cf6]">
          <Bell className="h-3 w-3 shrink-0" aria-hidden="true" />
          <span>Angestoßen {nudge.nudged_by_name ? `von ${nudge.nudged_by_name} ` : ""}{decisionNudgeDateTime(nudge.nudged_at)}</span>
        </p>
        {nudge.nudge_note && <p className="mt-1 whitespace-pre-wrap text-meta font-normal text-[#18202b]">{nudge.nudge_note}</p>}
      </div>}
      <button
        type="button"
        className={cn("flex w-full items-start justify-between gap-3 text-left", expanded && "mb-3")}
        aria-expanded={expanded}
        aria-controls={`decision-details-${decision.id}`}
        disabled={exiting}
        onClick={onToggle}
      >
        <span className="min-w-0 flex-1">
          <span className="block break-words text-body-lg font-medium">{decision.title}</span>
          {label && <span className={`mt-1 block text-meta ${isOverdue ? "text-destructive" : "text-muted-foreground"}`}>{label}</span>}
        </span>
        {recommendation && <span className={`ml-auto max-w-[45%] shrink-0 rounded-full px-2.5 py-1 text-caption font-medium ${recommendationColor.background} ${recommendationColor.text}`}>
          Büro: {recommendation.label}
        </span>}
        <ChevronRight className={cn("mt-1 h-4 w-4 shrink-0 transition-transform duration-500 motion-reduce:transition-none", expanded && "rotate-90")} aria-hidden="true" />
      </button>
      <div
        id={`decision-details-${decision.id}`}
        className={cn("grid transition-[grid-template-rows,opacity] duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] motion-reduce:transition-none", expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")}
        inert={!expanded}
      >
        <div className="min-h-0 overflow-hidden">
          <div onClick={() => { if (!exiting) onOpen(decision.id); }}>
            {recommendation?.recommendation_reason?.trim() && (
              <p className={`mb-3 rounded-xl px-3 py-2 text-meta text-foreground ${recommendationColor.background}`}><span className={cn("font-bold", recommendationColor.text)}>Büro empfiehlt: {recommendation.label}.</span> {recommendation.recommendation_reason.trim()}</p>
            )}

            {decision.isParticipant && decision.participant_id && !decision.hasResponded && !prompt && (
              <div className="[&_button]:text-body [&_button]:font-medium" onClick={(e) => e.stopPropagation()}>
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
                  'animate-fade-up mt-1 rounded-md border p-2 text-xs',
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
                  <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs" disabled={undoing || exiting} onClick={handleAddJustification}>
                    <MessageSquare className="h-3 w-3 mr-1" />Begründung hinzufügen
                  </Button>
                  <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" disabled={undoing || exiting} onClick={handleUndo}>
                    <Undo2 className="h-3 w-3 mr-1" />{undoing ? "Wird zurückgenommen…" : "Rückgängig"}
                  </Button>
                  <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs ml-auto" disabled={undoing || exiting} onClick={handleDismiss}>
                    Fertig
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function DashboardDecisionsWidget() {
  const { user } = useAuth();
  const { isDeputyView } = useWorkspaceView();
  const navigate = useNavigate();
  const { decisions, setDecisions, loading, error, loadDecisions } = useMyWorkDecisionsData(user?.id);
  const [showAll, setShowAll] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null | undefined>(undefined);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

  const handlePromptOpen = (id: string) =>
    setPendingIds((prev) => { const n = new Set(prev); n.add(id); return n; });
  const handlePromptClose = (id: string) =>
    setPendingIds((prev) => { const n = new Set(prev); n.delete(id); return n; });

  const handleUndoConfirmed = (id: string) => {
    setDecisions(previous => previous.map(decision =>
      decision.id === id ? resetOwnDecisionResponse(decision) : decision));
    handlePromptClose(id);
    void loadDecisions({ silent: true });
  };

  const handleDismissConfirmed = (id: string) => {
    setDecisions(previous => previous.map(decision =>
      decision.id === id ? { ...decision, hasResponded: true } : decision));
    handlePromptClose(id);
    void loadDecisions({ silent: true });
  };

  const eligibleDecisions = useMemo(() => decisions.filter(decision =>
    needsOwnDecision(decision, pendingIds.has(decision.id))), [decisions, pendingIds]);
  const nudgeDecisionIds = useMemo(() => isDeputyView ? eligibleDecisions.map(decision => decision.id) : [], [isDeputyView, eligibleDecisions]);
  const nudges = useDeputyDashboardDecisions(nudgeDecisionIds);
  const items = useMemo(() => {
    const byDecision = new Map<string, string | null>((nudges.data ?? []).map(nudge => [nudge.decision_id, nudge.nudged_at]));
    const now = new Date();
    return [...eligibleDecisions]
      .sort((a, b) => {
        const nudgeDifference = decisionNudgePriority(byDecision.get(b.id), now) - decisionNudgePriority(byDecision.get(a.id), now);
        if (nudgeDifference) return nudgeDifference;
        if (!a.response_deadline && !b.response_deadline) return 0;
        if (!a.response_deadline) return 1;
        if (!b.response_deadline) return -1;
        return new Date(a.response_deadline).getTime() - new Date(b.response_deadline).getTime();
      })
      .slice(0, showAll ? undefined : 3);
  }, [eligibleDecisions, nudges.data, showAll]);

  const currentExpandedId = expandedId === null ? null
    : items.some(item => item.id === expandedId) ? expandedId : items[0]?.id;

  const hiddenCount = Math.max(0, eligibleDecisions.length - items.length);

  const goToDecision = (id: string) => {
    navigate(`/mywork?tab=decisions&highlight=${id}`);
  };

  if (loading) return <div className="animate-pulse h-32 bg-muted rounded-lg" />;

  if (error) {
    return (
      <ErrorState
        description="Entscheidungen konnten nicht geladen werden. Das heißt nicht, dass nichts zu entscheiden ist."
        onRetry={() => { void loadDecisions(); }}
      />
    );
  }

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">Keine ausstehenden Entscheidungen.</p>;
  }

  return (
    <div>
      <div className="divide-y divide-border">
        {isDeputyView && nudges.isError && <p role="status" className="pb-3 text-xs text-muted-foreground">Anstups-Hinweise konnten nicht geladen werden.</p>}
        {items.map((d) => (
          <DecisionRow
            key={d.id}
            decision={d}
            expanded={currentExpandedId === d.id}
            onToggle={() => setExpandedId(currentExpandedId === d.id ? null : d.id)}
            nudge={nudges.data?.find(nudge => nudge.decision_id === d.id)}
            onDismissConfirmed={handleDismissConfirmed}
            onOpen={goToDecision}
            onPromptOpen={handlePromptOpen}
            onPromptClose={handlePromptClose}
            onUndoConfirmed={handleUndoConfirmed}
            forcePrompt={pendingIds.has(d.id) && d.hasResponded ? { color: 'green' } : null}
          />
        ))}
      </div>
      {hiddenCount > 0 && <div className="flex flex-wrap justify-between gap-2 pt-3 text-meta font-medium text-muted-foreground">
        <button type="button" className="hover:text-foreground" onClick={() => setShowAll(true)}>+{hiddenCount} weitere</button>
      </div>}
    </div>
  );
}
