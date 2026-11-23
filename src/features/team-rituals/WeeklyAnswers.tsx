import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useTenantProfiles } from '@/hooks/useTenantProfiles';
import { visibleWeeklyAnswers } from './logic';
import type { Snapshot } from './data';

export function WeeklyAnswers({ answers, userId, compact = false }: { answers: Snapshot['answers']; userId?: string; compact?: boolean }) {
  const { data: profiles } = useTenantProfiles();
  const visible = visibleWeeklyAnswers(answers, userId);
  if (!visible.length) return null;
  return <ul aria-label="Antworten des Teams" className={compact ? "space-y-2" : "space-y-3"}>
    {visible.map(answer => {
      const profile = profiles.find(p => p.user_id === answer.user_id);
      const name = profile?.display_name || answer.display_name;
      const initials = name.trim().split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase();
      return <li key={answer.user_id} className={compact ? "flex items-start gap-2 text-xs text-muted-foreground" : "flex items-start gap-3 text-sm"}>
        <Avatar className={compact ? "h-6 w-6 shrink-0" : "h-8 w-8 shrink-0"} title={name}>
          <AvatarImage src={profile?.avatar_url ?? undefined} alt={name} />
          <AvatarFallback style={{ backgroundColor: profile?.badge_color || undefined }} className={compact ? "text-[10px] font-medium" : "text-xs font-medium"}>{initials}</AvatarFallback>
        </Avatar>
        <span className={compact ? "min-w-0 whitespace-pre-wrap break-words pt-0.5 leading-snug" : "min-w-0 whitespace-pre-wrap break-words pt-1"}><span className="sr-only">{name}: </span>{answer.answer}</span>
      </li>;
    })}
  </ul>;
}
