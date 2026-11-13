import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { historyError } from './useElectionHistory';

export function ElectionHistoryAudit() {
  const [open, setOpen] = useState(false);
  const query = useQuery({
    queryKey: ['election-history', 'audit'], enabled: open, staleTime: 0,
    queryFn: async () => {
      const { data, error } = await supabase.from('election_history_audit').select('*').order('occurred_at', { ascending: false }).limit(100);
      if (error) throw error;
      return data;
    },
  });
  return <details className="rounded-lg border p-4" onToggle={event => setOpen(event.currentTarget.open)}>
    <summary className="cursor-pointer text-sm font-medium">Änderungsprotokoll · letzte 100 Änderungen</summary>
    {query.isLoading && <p className="mt-2 text-sm">Lade Protokoll …</p>}
    {query.error && <p className="mt-2 text-sm" role="alert">{historyError(query.error)}</p>}
    <div className="mt-3 space-y-2">{query.data?.map(entry => <details className="border-t pt-2" key={entry.id}>
      <summary className="cursor-pointer break-words text-xs">{new Date(entry.occurred_at).toLocaleString('de-DE', { timeZone: 'Europe/Berlin' })} · {entry.action} · {entry.table_name.replace('election_history_', '')}</summary>
      <p className="mt-1 break-all text-xs text-muted-foreground">Datensatz: {entry.record_id} · Bearbeiter-ID: {entry.actor_id || 'System'}</p>
      <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-all text-xs">{JSON.stringify({ vorher: entry.old_data, nachher: entry.new_data }, null, 2)}</pre>
    </details>)}</div>
  </details>;
}
