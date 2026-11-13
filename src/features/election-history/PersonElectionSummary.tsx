import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export function PersonElectionSummary({ personId, periodId }: { personId: string; periodId: string }) {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  const summary = useQuery({
    queryKey: ['election-history', user?.id, 'summary', personId, periodId], enabled: open && !!user,
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase.rpc('get_election_person_summary', { person: personId, through_period: periodId }).abortSignal(signal);
      if (error) throw error;
      if (!data || typeof data !== 'object' || Array.isArray(data) || typeof data.elections !== 'number' || typeof data.direct_wins !== 'number' || typeof data.complete !== 'boolean') throw new Error('Zusammenfassung nicht verfügbar.');
      return { elections: data.elections, directWins: data.direct_wins, complete: data.complete };
    }, staleTime: 60_000, gcTime: 120_000, retry: false,
  });
  return <details onToggle={event => setOpen(event.currentTarget.open)} className="text-xs text-muted-foreground">
    <summary className="cursor-pointer">Wiederwahlen anzeigen</summary>
    {summary.isLoading && <p>Lädt …</p>}
    {summary.error && <p role="alert">Zusammenfassung konnte nicht geladen werden.</p>}
    {summary.data && <p>{summary.data.complete ? `${Math.max(0, summary.data.elections - 1)} Wiederwahlen` : `${summary.data.elections} gewählte Perioden erfasst · Historie unvollständig`} · {summary.data.directWins} Direktwahlsiege bis zur ausgewählten Periode</p>}
  </details>;
}
