import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useTeamRituals, type RitualQuestion } from './data';
import { useRitualAction } from './actions';
export function QuestionBank() {
  const { data, tenantId, error } = useTeamRituals();
  const { busy, run } = useRitualAction(tenantId);
  if (error) return <p role="alert">Die Fragenbank konnte nicht geladen werden.</p>;
  if (!data || !tenantId || !data.admin) return null;
  return <Card><CardHeader><CardTitle>Fragenbank & Freigabe</CardTitle></CardHeader><CardContent className="space-y-3">
    <p className="text-sm text-muted-foreground">Abgeordnete und Büroleitung verwalten hier die Team-Rituale für dieses Büro.</p>
    <Button disabled={busy} onClick={() => void run(() => supabase.rpc('configure_team_rituals', { p_tenant: tenantId, p_enabled: !data.enabled }))}>{data.enabled ? 'Team-Rituale für dieses Büro ausschalten' : 'Team-Rituale für dieses Büro einschalten'}</Button>
    <p className="text-sm text-muted-foreground">Fragenänderungen gelten für kommende Wochen. Archivierte Fragen bleiben in vergangenen Wochen erhalten.</p>
    <QuestionForm tenantId={tenantId} busy={busy} run={run} />
    {data.questions.map(q => <QuestionForm key={`${q.id}:${q.question}:${q.active}`} tenantId={tenantId} question={q} busy={busy} run={run} />)}
  </CardContent></Card>;
}
function QuestionForm({ tenantId, question, busy, run }: { tenantId: string; question?: RitualQuestion } & ReturnType<typeof useRitualAction>) {
  const [text, setText] = useState(question?.question ?? '');
  const [active, setActive] = useState(question?.active ?? true);
  return <form className="space-y-2 border-t pt-3" onSubmit={e => { e.preventDefault(); void run(async () => {
    const result = await supabase.rpc('save_team_question', { p_tenant: tenantId, p_id: question?.id ?? null, p_question: text, p_active: active });
    if (!result.error && !question) setText('');
    return result;
  }); }}>
    <label className="block">{question ? 'Frage bearbeiten' : 'Neue Frage'}<Input required maxLength={280} value={text} onChange={e => setText(e.target.value)} /></label>
    <label className="flex gap-2"><input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} />Aktiv</label>
    <Button disabled={busy || !text.trim()} variant="outline">{question ? 'Frage speichern' : 'Frage hinzufügen'}</Button>
  </form>;
}
