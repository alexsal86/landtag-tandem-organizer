import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useTeamRituals, record, text, bool, list } from './data';
import { useRitualAction } from './actions';
import { isValidFunFacts } from './twoTruths';
interface OwnFacts { facts: string[]; lieIndex: number; shared: boolean }
export function FunFactsEditor() {
  const { data, tenantId, userId } = useTeamRituals();
  const own = useQuery({
    queryKey: ['team-quiz', tenantId, userId, 'own-facts'], enabled: !!tenantId && !!userId,
    queryFn: async (): Promise<OwnFacts> => {
      const result = await supabase.rpc('own_team_fun_facts', { p_tenant: tenantId! });
      if (result.error) throw result.error;
      if (!result.data) return { facts: ['', '', ''], lieIndex: 0, shared: false };
      const row = record(result.data);
      const facts = list(row.facts).map(text);
      if (typeof row.lie_index !== 'number' || !isValidFunFacts(facts, row.lie_index)) throw new Error('Ungültige Aussagen');
      return { facts, lieIndex: row.lie_index, shared: bool(row.shared) };
    },
  });
  if (own.error) return <p role="alert">Deine Aussagen konnten nicht geladen werden.</p>;
  if (!own.data || !tenantId || !userId) return null;
  return <FactsForm key={`${tenantId}:${userId}:${JSON.stringify(own.data)}`} tenantId={tenantId} initial={own.data} canShare={!!data?.enabled && !!data.own?.opted_in} />;
}
function FactsForm({ tenantId, initial, canShare }: { tenantId: string; initial: OwnFacts; canShare: boolean }) {
  const [facts, setFacts] = useState(initial.facts);
  const [lie, setLie] = useState(initial.lieIndex);
  const [shared, setShared] = useState(initial.shared);
  const { busy, run } = useRitualAction(tenantId);
  return <Card><CardHeader><CardTitle>Meine drei Aussagen</CardTitle></CardHeader><CardContent>
    <form className="space-y-3" onSubmit={e => { e.preventDefault(); void run(() => supabase.rpc('save_team_fun_facts', { p_tenant: tenantId, p_facts: facts.map(f => f.trim()), p_lie_index: lie, p_shared: shared })); }}>
      <p className="text-sm text-muted-foreground">Zwei Wahrheiten und eine erfundene Aussage, jeweils höchstens 160 Zeichen. Markiere die Lüge. Bereits verwendete Aussagen werden archiviert und nicht erneut ausgewählt. Hinterlege danach neue Aussagen für ein künftiges Monatsquiz. Änderungen gelten für künftige Monatsquiz; beim Entziehen der Freigabe werden bestehende Quiz mit deinen Aussagen gelöscht.</p>
      {facts.map((fact, index) => <div key={index} className="space-y-1">
        <label className="block">Aussage {index + 1}<Input required maxLength={160} value={fact} onChange={e => setFacts(previous => previous.map((value, i) => i === index ? e.target.value : value))} /></label>
        <label className="flex gap-2"><input type="radio" name={`lie-${tenantId}`} checked={lie === index} onChange={() => setLie(index)} />Diese Aussage ist erfunden</label>
      </div>)}
      <label className="flex gap-2"><input type="checkbox" checked={shared} disabled={!canShare && !shared} onChange={e => setShared(e.target.checked)} />Meine Aussagen für das Monatsquiz im Büro freigeben</label>
      {!canShare && <p className="text-sm text-muted-foreground">Für die Freigabe muss die Teilnahme an Team-Ritualen aktiviert sein.</p>}
      <div className="flex flex-wrap gap-2"><Button disabled={busy || !isValidFunFacts(facts, lie) || (shared && !canShare)}>Aussagen speichern</Button>
        <Button variant="outline" type="button" disabled={busy} onClick={() => void run(() => supabase.rpc('delete_team_fun_facts', { p_tenant: tenantId }))}>Eigene Aussagen löschen</Button></div>
    </form>
  </CardContent></Card>;
}
