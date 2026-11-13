import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useTenantProfiles } from '@/hooks/useTenantProfiles';
import { visibleWeeklyAnswers } from './logic';
import type { Snapshot } from './data';

export function WeeklyAnswers({ answers, userId }: { answers: Snapshot['answers']; userId?: string }) {
  const { data: profiles } = useTenantProfiles();
  const visible = visibleWeeklyAnswers(answers, userId);
  if (!visible.length) return null;
  return <ul aria-label="Antworten des Teams" className="space-y-3">
    {visible.map(answer => {
      const profile = profiles.find(p => p.user_id === answer.user_id);
      const name = profile?.display_name || answer.display_name;
      const initials = name.trim().split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase();
      return <li key={answer.user_id} className="flex items-start gap-3 text-sm">
        <Avatar className="h-8 w-8 shrink-0" title={name}>
          <AvatarImage src={profile?.avatar_url ?? undefined} alt={name} />
          <AvatarFallback style={{ backgroundColor: profile?.badge_color || undefined }} className="text-xs font-medium">{initials}</AvatarFallback>
        </Avatar>
        <span className="min-w-0 whitespace-pre-wrap break-words pt-1"><span className="sr-only">{name}: </span>{answer.answer}</span>
      </li>;
    })}
  </ul>;
}
