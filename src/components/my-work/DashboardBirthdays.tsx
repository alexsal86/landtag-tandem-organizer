import { BIRTHDAY_ACTION_OPTIONS, birthdayActionLabel, type BirthdayActionKey } from '@/utils/birthdayActions';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Cake, ChevronDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { berlinDay } from '@/utils/dashboard/daySummary';
import type { AppointmentData } from '@/hooks/useDashboardAppointmentsData';
import { Badge } from '@/components/ui/badge';
import { birthdayAge } from '@/utils/dashboard/occasions';

interface Props {
  allDayAppointments?: AppointmentData[];
  includeBirthdays?: boolean;
}

export function DashboardBirthdays({ allDayAppointments = [], includeBirthdays = true }: Props) {
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const { toast } = useToast();
  const client = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const requestInFlight = useRef(false);
  const day = berlinDay(new Date());
  const tenant = currentTenant?.id;
  const key = ['dashboard-birthdays', tenant, user?.id, day];
  const { data, isError } = useQuery({
    queryKey: key, enabled: includeBirthdays && !!tenant && !!user, staleTime: 60_000, refetchInterval: 60_000,
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
    enabled: includeBirthdays && !!tenant && !!user, staleTime: 60_000, refetchInterval: 60_000,
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
    queryKey: requestsKey, enabled: includeBirthdays && !!tenant && !!user, staleTime: 60_000, refetchInterval: 60_000,
    queryFn: async () => {
      const tasks = await supabase.from('tasks').select('source_id').eq('tenant_id', tenant!)
        .eq('source_type', 'birthday_congratulations').gte('due_date', `${day.slice(0, 4)}-01-01`).lt('due_date', `${Number(day.slice(0, 4)) + 1}-01-01`);
      if (tasks.error) throw tasks.error;
      return new Set((tasks.data ?? []).map(task => `${task.source_id}:${day.slice(0, 4)}`));
    },
  });
  const request = async (id: string, choice: BirthdayActionKey) => {
    if (requestInFlight.current) return;
    requestInFlight.current = true;
    setBusy(id);
    try {
      const { error } = await supabase.rpc('request_birthday_congratulations', { _contact_id: id, _tenant_id: tenant!, _action: choice });
      if (error) throw error;
      client.setQueryData<Set<string>>(requestsKey, previous => new Set([...(previous ?? []), `${id}:${day.slice(0, 4)}`]));
      void client.invalidateQueries({ queryKey: requestsKey });
      toast({ title: `${birthdayActionLabel(choice)} beim Büro beauftragt` });
    } catch {
      toast({ title: 'Glückwünsche konnten nicht beauftragt werden', description: 'Bitte erneut versuchen. Die Aufgabe wurde nicht bestätigt.', variant: 'destructive' });
    } finally { requestInFlight.current = false; setBusy(null); }
  };
  const birthdays = includeBirthdays ? data ?? [] : [];
  const birthdayError = includeBirthdays && isError;
  if (!birthdays.length && !allDayAppointments.length && !birthdayError) return null;
  return <section className="mb-3 space-y-2" aria-label="Ganztägig & Anlässe">
    <h3 className="text-label text-[rgb(102,114,127)]">GANZTÄGIG &amp; ANLÄSSE</h3>
    {birthdayError && <p className="text-caption text-muted-foreground">Geburtstage konnten nicht geladen werden.</p>}
    {allDayAppointments.map(appointment => <div key={appointment.id} className="flex items-start gap-2 rounded-lg bg-[rgb(240,243,246)] px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="text-body font-medium">{appointment.title}</p>
        {appointment.location && <p className="text-caption text-muted-foreground">{appointment.location}</p>}
      </div>
      <Badge variant="secondary" className="ml-auto shrink-0 bg-gray-100 text-caption text-gray-700 hover:bg-gray-100">Ganztägig</Badge>
    </div>)}
    {birthdays.map(contact => {
      const action = planning.data?.get(contact.id);
      const requested = requests.data?.has(`${contact.id}:${day.slice(0, 4)}`);
      return <div key={contact.id} className="flex flex-wrap items-start gap-2 rounded-lg bg-[rgb(253,243,224)] px-3 py-2">
        <Cake className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <p className="text-body font-medium">{contact.name} hat Geburtstag</p>
          <p className="text-caption text-muted-foreground">wird {contact.age} Jahre alt</p>
          {(planning.isError || planning.isPending || (action?.action && birthdayActionLabel(action.action))) && <p className="text-caption text-muted-foreground">{planning.isError ? 'Jour-fixe-Planung konnte nicht geladen werden' : planning.isPending ? 'Jour-fixe-Planung wird geladen…' : action?.action && birthdayActionLabel(action.action)
            ? `${birthdayActionLabel(action.action)} vorgesehen${action.assigned_to?.length ? ' · zugewiesen' : ' · noch niemandem zugewiesen'}` : null}</p>}
        </div>
        <div className="ml-auto flex shrink-0 flex-col items-end gap-2">
          {requested ? <span role="status" className="inline-flex items-center rounded-full bg-[#eaf5df] px-3 py-1 text-caption font-medium text-[#397d16]">Büro kümmert sich ✓</span> :
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" disabled={!!busy}>
                  {busy === contact.id ? 'Wird beauftragt…' : 'Glückwünsche veranlassen'}
                  <ChevronDown className="ml-1.5 h-3 w-3" aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" aria-label="Art der Glückwünsche">
                {BIRTHDAY_ACTION_OPTIONS.map(option => <DropdownMenuItem key={option.key}
                  disabled={!!busy} onSelect={() => void request(contact.id, option.key)}>
                  <option.icon className="mr-2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  {option.label}
                </DropdownMenuItem>)}
              </DropdownMenuContent>
            </DropdownMenu>}

        </div>
        {requests.isError && <p className="w-full text-caption text-muted-foreground">Auftragsstatus konnte nicht geladen werden.</p>}
      </div>;
    })}
  </section>;
}
