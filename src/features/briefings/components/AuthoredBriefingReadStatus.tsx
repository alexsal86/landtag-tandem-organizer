import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';
import { berlinDay } from '@/utils/dashboard/daySummary';
import { dailyBriefingReadLabel } from '../utils';

/** Show the author the deputy's receipt, without treating an own preview as a read. */
export function AuthoredBriefingReadStatus() {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const today = berlinDay(new Date());
  const since = new Date(Date.parse(`${today}T12:00:00Z`) - 6 * 86400_000).toISOString().slice(0, 10);
  const { data = [], isError } = useQuery({
    queryKey: ['daily-briefings', 'authored-read-status', currentTenant?.id, user?.id, today],
    enabled: !!currentTenant?.id && !!user?.id,
    staleTime: 15_000, refetchInterval: 15_000,
    queryFn: async () => {
      const briefings = await supabase.from('daily_briefings').select('id,briefing_date')
        .eq('tenant_id', currentTenant!.id).eq('author_id', user!.id)
        .gte('briefing_date', since).lte('briefing_date', today).order('briefing_date', { ascending: false }).limit(20);
      if (briefings.error) throw briefings.error;
      if (!briefings.data?.length) return [];
      const reads = await supabase.from('daily_briefing_reads').select('briefing_id,read_at')
        .in('briefing_id', briefings.data.map(briefing => briefing.id)).neq('user_id', user!.id)
        .order('read_at', { ascending: true });
      if (reads.error) throw reads.error;
      return briefings.data.map(briefing => ({ ...briefing, readAt: reads.data?.find(read => read.briefing_id === briefing.id)?.read_at }));
    },
  });
  if (isError) return <p role="status" className="text-xs text-muted-foreground">Lesebestätigungen konnten nicht geladen werden.</p>;
  if (!data.length) return null;
  return <section className="space-y-2 border-t border-border pt-3" aria-label="Lesestatus deiner Tagesbriefings">
    <h3 className="text-xs font-medium text-muted-foreground">Deine Tagesbriefings</h3>
    {data.map(briefing => <div key={briefing.id} className="flex flex-wrap items-center justify-between gap-2 text-xs">
      <span>{briefing.briefing_date === today ? 'Heute' : new Intl.DateTimeFormat('de-DE', {
        timeZone: 'Europe/Berlin', weekday: 'short', day: 'numeric', month: 'numeric',
      }).format(new Date(`${briefing.briefing_date}T12:00:00Z`))}</span>
      {briefing.readAt ? <span className="rounded-full bg-[#eaf5df] px-3 py-1 font-medium text-[#397d16]">{dailyBriefingReadLabel(briefing.readAt)}</span>
        : <span className="text-muted-foreground">Noch nicht gelesen</span>}
    </div>)}
  </section>;
}
