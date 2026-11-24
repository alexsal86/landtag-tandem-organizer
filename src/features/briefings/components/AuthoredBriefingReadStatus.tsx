import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';
import { berlinDay } from '@/utils/dashboard/daySummary';
import { dailyBriefingReadLabel } from '../utils';

/** Use authoritative deputy receipts, including a deputy reading their own briefing. */
export function AuthoredBriefingReadStatus() {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const today = berlinDay(new Date());
  const { data = [], isError } = useQuery({
    queryKey: ['daily-briefings', 'authored-read-status-v2', currentTenant?.id, user?.id, today],
    enabled: !!currentTenant?.id && !!user?.id,
    staleTime: 0, refetchInterval: 15_000, refetchOnWindowFocus: 'always',
    queryFn: async () => {
      const result = await supabase.rpc('get_authored_daily_briefing_read_status', { p_tenant: currentTenant!.id });
      if (result.error) throw result.error;
      return (result.data ?? []).map(row => ({ id: row.id, briefing_date: row.briefing_date, readAt: row.read_at }));
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
