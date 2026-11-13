/** @owner team-platform @secondary-owner team-office @feature team-rituals */
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import { berlinDay, berlinWeek, type TeamProfile } from './logic';
export interface RitualQuestion { id: string; question: string; active: boolean }
export interface Snapshot {
  enabled: boolean; admin: boolean; own: TeamProfile | null; profiles: TeamProfile[];
  questions: RitualQuestion[]; week: { id: string; question: string } | null;
  answers: { user_id: string; answer: string; display_name: string }[];
}
// Validate every field consumed by the UI at the RPC boundary.
function record(value: Json | undefined): { [key: string]: Json | undefined } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Ungültige Team-Daten');
  return value;
}
function text(value: Json | undefined): string {
  if (typeof value !== 'string') throw new Error('Ungültiger Team-Text');
  return value;
}
function bool(value: Json | undefined): boolean {
  if (typeof value !== 'boolean') throw new Error('Ungültige Team-Freigabe');
  return value;
}
function list(value: Json | undefined): Json[] {
  if (!Array.isArray(value)) throw new Error('Ungültige Team-Liste');
  return value;
}
function profile(value: Json): TeamProfile {
  const row = record(value);
  if (row.birth_year !== null && typeof row.birth_year !== 'number') throw new Error('Ungültiges Geburtsjahr');
  return { user_id: text(row.user_id), display_name: text(row.display_name ?? 'Teammitglied'),
    opted_in: bool(row.opted_in), show_events: bool(row.show_events),
    birthday: row.birthday === null ? null : text(row.birthday), birth_year: row.birth_year,
    joined_on: row.joined_on === null ? null : text(row.joined_on) };
}
function decode(value: Json): Snapshot {
  const row = record(value);
  const week = row.week === null ? null : record(row.week);
  return {
    enabled: bool(row.enabled), admin: bool(row.admin), own: row.own === null ? null : profile(row.own!),
    profiles: list(row.profiles).map(profile),
    questions: list(row.questions).map(value => { const q = record(value); return { id: text(q.id), question: text(q.question), active: bool(q.active) }; }),
    week: week ? { id: text(week.id), question: text(week.question) } : null,
    answers: list(row.answers).map(value => { const a = record(value); return { user_id: text(a.user_id), answer: text(a.answer), display_name: text(a.display_name) }; }),
  };
}
export function useTeamRituals() {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  const query = useQuery({
    queryKey: ['team-rituals', tenantId, user?.id, berlinWeek(new Date()), berlinDay(new Date())],
    enabled: !!tenantId && !!user,
    refetchInterval: 60_000,
    queryFn: async () => {
      const first = await supabase.rpc('team_ritual_snapshot', { p_tenant: tenantId! });
      if (first.error) throw first.error;
      let data = decode(first.data);
      if (data.enabled && data.own?.opted_in && !data.week) {
        const week = await supabase.rpc('ensure_weekly_question', { p_tenant: tenantId! });
        if (week.error) throw week.error;
        const next = await supabase.rpc('team_ritual_snapshot', { p_tenant: tenantId! });
        if (next.error) throw next.error;
        data = decode(next.data);
      }
      return data;
    },
  });
  return { ...query, tenantId, userId: user?.id };
}
