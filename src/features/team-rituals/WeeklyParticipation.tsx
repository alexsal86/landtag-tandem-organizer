import { useEffect, useState } from "react";
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { visibleWeeklyAnswers } from './logic';
import type { Snapshot } from './data';

export function WeeklyParticipation({ tenantId, weekId, userId, answers, suspended = false }: {
  tenantId: string; weekId: string; userId?: string; answers: Snapshot['answers']; suspended?: boolean;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => { if (suspended) setOpen(false); }, [suspended]);
  const { data: members = [], isPending, isError } = useQuery({
    queryKey: ['team-rituals', tenantId, 'weekly-participation', weekId, userId],
    staleTime: 30_000, refetchInterval: 60_000,
    queryFn: async () => {
      const result = await supabase.rpc('team_weekly_question_participation', { p_tenant: tenantId });
      if (result.error) throw result.error;
      return result.data ?? [];
    },
  });
  const ownAnswer = answers.some(answer => answer.user_id === userId);
  const visibleAnswers = visibleWeeklyAnswers(answers, userId);
  const answerByUser = new Map(visibleAnswers.map(answer => [answer.user_id, answer.answer]));
  const responded = members.filter(member => member.answered).length;
  const avatar = (member: typeof members[number], label = false) => {
    const initials = member.display_name.trim().split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase();
    return <Avatar className={`h-6 w-6 shrink-0 ${label ? '' : 'ring-2 ring-background'}`} title={member.display_name}>
      <AvatarFallback className={`text-[10px] font-semibold ${member.answered ? 'bg-[#eaf5df] text-[#397d16]' : 'bg-muted text-muted-foreground'}`}>{initials}</AvatarFallback>
    </Avatar>;
  };
  if (isPending) return <p className="text-xs text-muted-foreground">Teilnahmestand wird geladen…</p>;
  if (isError) return <p role="status" className="text-xs text-muted-foreground">Teilnahmestand konnte nicht geladen werden.</p>;
  const summary = <>
    <span className="flex shrink-0 -space-x-1.5" aria-hidden="true">{members.slice(0, 5).map(member => <span key={member.user_id}>{avatar(member)}</span>)}</span>
    <span>{responded} von {members.length} haben geantwortet{ownAnswer ? ' · Antworten ansehen' : ''}</span>
  </>;
  if (!ownAnswer) return <div className="flex items-center gap-3 text-xs text-muted-foreground">{summary}</div>;
  return <Popover open={open && !suspended} onOpenChange={setOpen}>
    <PopoverTrigger asChild>
      <button type="button" className="flex w-full items-center gap-3 rounded text-left text-xs text-muted-foreground hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">{summary}</button>
    </PopoverTrigger>
    <PopoverContent align="end" className="w-80 max-w-[calc(100vw-2rem)] rounded-2xl p-4">
      <h3 className="mb-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Antworten im Team</h3>
      <ul className="max-h-80 space-y-4 overflow-y-auto" aria-label="Antworten im Team">
        {members.map(member => <li key={member.user_id} className="flex items-start gap-3">
          {avatar(member, true)}
          <div className="min-w-0">
            <p className="text-xs font-medium text-foreground">{member.display_name}</p>
            <p className="whitespace-pre-wrap break-words text-xs text-muted-foreground">{answerByUser.get(member.user_id) ?? (member.answered ? 'Antwort wird geladen…' : 'noch offen')}</p>
          </div>
        </li>)}
      </ul>
    </PopoverContent>
  </Popover>;
}
