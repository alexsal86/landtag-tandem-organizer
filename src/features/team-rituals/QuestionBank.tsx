import { useId, useState } from 'react';
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
    <p className="text-sm text-muted-foreground">Wöchentliche Rotation: Zuerst kommen noch nicht gestellte Fragen, danach die am längsten nicht verwendete aktive Frage. Das Datum bezeichnet den Beginn der Einsatzwoche.</p>
    <div className="border-y py-3"><h3 className="mb-2 text-sm font-medium">Neue Frage</h3><QuestionForm tenantId={tenantId} busy={busy} run={run} /></div>
    <div className="hidden gap-3 text-sm font-medium text-muted-foreground lg:grid lg:grid-cols-[5rem_minmax(0,1fr)_10rem_10rem]" aria-hidden="true"><span>Aktiv</span><span>Frage</span><span>Zuletzt gestellt</span><span className="sr-only">Aktion</span></div>
    <div className="divide-y">{data.questions.map(q => <QuestionForm key={`${q.id}:${q.question}:${q.active}`} tenantId={tenantId} question={q} busy={busy} run={run} />)}</div>
  </CardContent></Card>;
}
function QuestionForm({ tenantId, question, busy, run }: { tenantId: string; question?: RitualQuestion } & ReturnType<typeof useRitualAction>) {
  const id = useId();
  const [text, setText] = useState(question?.question ?? '');
  const [active, setActive] = useState(question?.active ?? true);
  return <form className="grid grid-cols-[5rem_minmax(0,1fr)] items-center gap-3 py-2 lg:grid-cols-[5rem_minmax(0,1fr)_10rem_10rem]" onSubmit={e => { e.preventDefault(); void run(async () => {
    const result = await supabase.rpc('save_team_question', { p_tenant: tenantId, p_id: question?.id ?? null, p_question: text, p_active: active });
    if (!result.error && !question) setText('');
    return result;
  }); }}>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={busy} checked={active} onChange={e => setActive(e.target.checked)} aria-label={question ? `Frage aktiv: ${question.question}` : 'Neue Frage aktiv'} /><span>Aktiv</span></label>
    <div className="min-w-0"><label htmlFor={id} className="sr-only">{question ? 'Frage bearbeiten' : 'Neue Frage'}</label><Input id={id} required maxLength={280} disabled={busy} placeholder="Neue Frage eingeben …" value={text} onChange={e => setText(e.target.value)} /></div>
    <p className="col-start-2 text-xs text-muted-foreground lg:col-auto">{question ? question.last_used_week === undefined ? 'Letzter Einsatz unbekannt' : question.last_used_week === null ? 'Noch nie gestellt' : <>Zuletzt: Woche ab <time dateTime={question.last_used_week}>{new Date(`${question.last_used_week}T12:00:00Z`).toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin' })}</time></> : 'Noch nicht gespeichert'}</p>
    <Button className="col-start-2 lg:col-auto" disabled={busy || !text.trim()} size="sm" variant="outline">{question ? 'Frage speichern' : 'Frage hinzufügen'}</Button>
  </form>;
}
