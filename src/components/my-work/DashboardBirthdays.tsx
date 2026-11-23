import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Cake } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { berlinDay } from '@/utils/dashboard/daySummary';
import { birthdayAge } from '@/utils/dashboard/occasions';

const labels: Record<string, string> = { card: 'Karte', gift: 'Geschenk', mail: 'Mail', call: 'Anruf' };
export function DashboardBirthdays() {
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const { toast } = useToast();
  const client = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const day = berlinDay(new Date());
  const tenant = currentTenant?.id;
  const key = ['dashboard-birthdays', tenant, user?.id, day];
  const { data, isError } = useQuery({
    queryKey: key, enabled: !!tenant && !!user, staleTime: 60_000, refetchInterval: 60_000,
    queryFn: async () => {
      const contacts = await supabase.from('contacts').select('id,name,birthday')
        .eq('tenant_id', tenant!).not('birthday', 'is', null);
      if (contacts.error) throw contacts.error;
      return (contacts.data ?? []).flatMap(contact => {
        const age = birthdayAge(contact.birthday!, day);
        return age === undefined ? [] : [{ ...contact, age }];
      });
    },
  });
  // Supplementary office information must never hide an otherwise readable birthday.
  const planning = useQuery({
    queryKey: ['dashboard-birthday-planning', tenant, user?.id, day],
    enabled: !!tenant && !!user, staleTime: 60_000, refetchInterval: 60_000,
    queryFn: async () => {
      const since = new Date(Date.parse(day + 'T12:00:00Z') - 14 * 86400_000).toISOString().slice(0, 10);
      const meetings = await supabase.from('meetings').select('id').eq('tenant_id', tenant!)
        .gte('meeting_date', since).lte('meeting_date', day);
      if (meetings.error) throw meetings.error;
      const ids = (meetings.data ?? []).map(meeting => meeting.id);
      // Resolve IDs explicitly. This does not depend on a PostgREST relationship.
      const agenda = ids.length ? await supabase.from('meeting_agenda_items').select('result_text')
        .in('meeting_id', ids).eq('system_type', 'birthdays').order('updated_at', { ascending: false })
        : { data: [], error: null };
      if (agenda.error) throw agenda.error;
      const actions = new Map<string, { action?: string; assigned_to?: string[] }>();
      // The most recent meeting's explicit entry wins, including a removed selection.
      for (const item of agenda.data ?? []) {
        try {
          const parsed: unknown = JSON.parse(item.result_text ?? '{}');
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            for (const [id, value] of Object.entries(parsed)) {
              if (!actions.has(id) && value && typeof value === 'object') actions.set(id, value);
            }
          }
        } catch { /* Older plain-text meeting results have no birthday assignments. */ }
      }
      return actions;
    },
  });
  const requestsKey = ['dashboard-birthday-requests', tenant, user?.id, day];
  const requests = useQuery({
    queryKey: requestsKey, enabled: !!tenant && !!user, staleTime: 60_000, refetchInterval: 60_000,
    queryFn: async () => {
      const tasks = await supabase.from('tasks').select('source_id').eq('tenant_id', tenant!)
        .eq('source_type', 'birthday_congratulations').gte('due_date', `${day.slice(0, 4)}-01-01`);
      if (tasks.error) throw tasks.error;
      return new Set((tasks.data ?? []).map(task => `${task.source_id}:${day.slice(0, 4)}`));
    },
  });
  const request = async (id: string) => {
    if (busy) return;
    setBusy(id);
    try {
      const { error } = await supabase.rpc('request_birthday_congratulations', { _contact_id: id, _tenant_id: tenant! });
      if (error) throw error;
      client.setQueryData<Set<string>>(requestsKey, previous => new Set([...(previous ?? []), `${id}:${day.slice(0, 4)}`]));
      void client.invalidateQueries({ queryKey: requestsKey });
      toast({ title: 'Glückwünsche beim Büro beauftragt' });
    } catch {
      toast({ title: 'Glückwünsche konnten nicht beauftragt werden', description: 'Bitte erneut versuchen. Die Aufgabe wurde nicht bestätigt.', variant: 'destructive' });
    } finally { setBusy(null); }
  };
  if (isError) return <p className="mb-3 text-xs text-muted-foreground">Geburtstage konnten nicht geladen werden.</p>;
  return <div className="space-y-2 mb-3">{data?.map(contact => {
    const action = planning.data?.get(contact.id);
    const requested = requests.data?.has(`${contact.id}:${day.slice(0, 4)}`);
    return <div key={contact.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/40 px-3 py-2">
    <Cake className="h-4 w-4 shrink-0 text-muted-foreground" />
    <div className="min-w-0 flex-1">
      <p className="text-sm font-medium">{contact.name} hat Geburtstag</p>
      <p className="text-xs text-muted-foreground">wird {contact.age} Jahre alt</p>
      <p className="text-xs text-muted-foreground">{planning.isError ? 'Jour-fixe-Planung konnte nicht geladen werden' : planning.isPending ? 'Jour-fixe-Planung wird geladen…' : action?.action && labels[action.action]
        ? `${labels[action.action]} vorgesehen${action.assigned_to?.length ? ' · zugewiesen' : ' · noch niemandem zugewiesen'}` : 'Keine Glückwünsche zugewiesen'}</p>
    </div>
    <Button size="sm" variant="outline" disabled={!!busy || requested} onClick={() => void request(contact.id)}>
      {requested ? 'Glückwünsche veranlasst' : 'Glückwünsche veranlassen'}
    </Button>
    {requests.isError && <p className="w-full text-xs text-muted-foreground">Auftragsstatus konnte nicht geladen werden.</p>}
  </div>})}</div>;
}
